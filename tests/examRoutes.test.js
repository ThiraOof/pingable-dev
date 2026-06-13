process.env.LOG_LEVEL = 'silent';

// /exam route logic (§21): the server-authoritative timer, grade → advance →
// finalize state machine, skip/abandon, expiry, and result ownership/sharing.
// HTTP is exercised end-to-end through a minimal app (helpers/routeApp) with a
// faked session; GNS3 and node consoles are the in-process fakes, so no real
// services are touched. The EXAMS config itself is covered separately (it just
// resolves real seed slugs, which an empty test DB deliberately lacks).

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startFakeGns3 } from './helpers/fakeGns3.js';
import { startFakeConsole } from './helpers/fakeConsole.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import { startRouteApp } from './helpers/routeApp.js';

// fake GNS3 must exist BEFORE the service is imported (it freezes GNS3_BASE).
const fake = await startFakeGns3();
process.env.GNS3_HOST = 'http://127.0.0.1';
process.env.GNS3_PORT = String(fake.port);
delete process.env.GNS3_PUBLIC_URL;

const { default: examRoutes, sharedRouter } = await import('../src/routes/examRoutes.js');
const { default: Course } = await import('../src/models/Course.js');
const { default: ExamAttempt } = await import('../src/models/ExamAttempt.js');
const { default: LabSession } = await import('../src/models/LabSession.js');

const dbUp = await connectTestDb('pingable-test-examroutes');
if (dbUp) await LabSession.init();
const opts = { skip: !dbUp && 'MongoDB not reachable' };

const oid = () => new mongoose.Types.ObjectId();
const hex = (o) => String(o);

let app;
const consoles = [];
before(async () => {
  // sharedRouter (public /exam/shared/:token) mounts BEFORE the auth-gated
  // /exam, exactly as server.js does, so the public page bypasses requireAuth.
  app = await startRouteApp((a) => { a.use('/', sharedRouter); a.use('/exam', examRoutes); });
});
after(async () => {
  await app?.close();
  await Promise.all(consoles.splice(0).map((c) => c.close()));
  await disconnectTestDb();
  await fake.close();
});
beforeEach(async () => {
  if (!dbUp) return;
  await Promise.all([Course.deleteMany({}), ExamAttempt.deleteMany({}), LabSession.deleteMany({})]);
  fake.deleted.length = 0; fake.calls.length = 0; fake.projects.clear(); fake.failOn.clear();
});

// ── fixtures ──────────────────────────────────────────────────────────────────

// A lab lesson whose single grading check passes against a fake console that
// answers `command` with output matching `expect`.
function passLab(title) {
  return {
    type: 'lab', title,
    topology: { nodes: [{ name: 'R1', nodeType: 'vpcs' }], links: [] },
    gradingChecks: [{ description: 'R1 ok', node: 'R1', command: 'show ok', expect: 'OK', points: 1 }],
  };
}

async function makeCourse(lessons) {
  return Course.create({ slug: 'exam-fixture-' + Math.random().toString(36).slice(2),
    title: 'Exam Fixture', modules: [{ title: 'M', lessons }] });
}

// A ready LabSession for `user` on course/module/lesson, with R1 wired to a
// fake console that makes the passLab check pass (unless `failing`).
async function readySession(user, course, m, l, { failing = false } = {}) {
  const con = await startFakeConsole({ prompt: 'R1> ', responses: { 'show ok': failing ? 'STATUS BAD' : 'STATUS OK' } });
  consoles.push(con);
  await LabSession.create({
    user, course, moduleIdx: m, lessonIdx: l, status: 'ready', projectId: 'p-' + hex(user).slice(-6),
    nodes: { R1: { consoleHost: '127.0.0.1', consolePort: con.port } },
  });
  return con;
}

function makeAttempt(user, course, labRefs, over = {}) {
  return ExamAttempt.create({
    user, examId: 'fixture', title: 'Fixture Exam',
    labs: labRefs.map((r) => ({ course, moduleIdx: r.m, lessonIdx: r.l, title: `lab ${r.m}.${r.l}`, status: 'pending' })),
    timeLimitMin: 60, startedAt: new Date(), state: 'running', currentIdx: 0, ...over,
  });
}

// ── auth + index ────────────────────────────────────────────────────────────

test('GET /exam without a session is gated to login', opts, async () => {
  const r = await app.request('/exam');
  assert.equal(r.status, 302);
  assert.equal(r.location, '/auth/login');
});

test('GET /exam renders the exam list (no active attempt)', opts, async () => {
  const r = await app.request('/exam', { user: oid() });
  assert.equal(r.json.__render, 'exam-index.njk');
  assert.ok(Array.isArray(r.json.exams) && r.json.exams.length >= 1);
  assert.equal(r.json.active, null);
});

// ── start ─────────────────────────────────────────────────────────────────────

test('POST /exam/start with an unknown examId redirects back to /exam', opts, async () => {
  const r = await app.request('/exam/start', { method: 'POST', user: oid(), body: { examId: 'nope' } });
  assert.equal(r.status, 302);
});

test('POST /exam/start refuses a config that references missing labs (empty DB)', opts, async () => {
  // EXAMS reference real seed slugs; the test DB has none → resolveLabs is null.
  const r = await app.request('/exam/start', { method: 'POST', user: oid(), body: { examId: 'ccna-rapid' } });
  assert.equal(r.status, 500);
  assert.equal(r.json.__render, 'error.njk');
  assert.equal(await ExamAttempt.countDocuments(), 0); // no orphan attempt left behind
});

// ── grade / skip / advance ──────────────────────────────────────────────────

test('grading the final lab finalizes the attempt with the weighted score', opts, async () => {
  const user = oid();
  const course = await makeCourse([passLab('only')]);
  await readySession(user, course._id, 0, 0);
  const attempt = await makeAttempt(user, course._id, [{ m: 0, l: 0 }]);

  const r = await app.request('/exam/grade', { method: 'POST', user });
  assert.equal(r.json.ok, true);
  assert.equal(r.json.done, true);
  assert.equal(r.json.resultUrl, `/exam/result/${attempt._id}`);

  const after = await ExamAttempt.findById(attempt._id);
  assert.equal(after.state, 'done');
  assert.equal(after.labs[0].status, 'passed');
  assert.equal(after.finalPct, 100);
  assert.equal(await LabSession.countDocuments({ user }), 0); // lab stopped on finalize
});

test('a failing final grade finalizes with the lab marked failed (0%)', opts, async () => {
  const user = oid();
  const course = await makeCourse([passLab('only')]);
  await readySession(user, course._id, 0, 0, { failing: true });
  const attempt = await makeAttempt(user, course._id, [{ m: 0, l: 0 }]);

  const r = await app.request('/exam/grade', { method: 'POST', user });
  assert.equal(r.json.done, true);
  const after = await ExamAttempt.findById(attempt._id);
  assert.equal(after.labs[0].status, 'failed');
  assert.equal(after.finalPct, 0);
});

test('grading a non-final lab advances and starts the next lab', opts, async () => {
  const user = oid();
  const course = await makeCourse([passLab('first'), passLab('second')]);
  await readySession(user, course._id, 0, 0);
  const attempt = await makeAttempt(user, course._id, [{ m: 0, l: 0 }, { m: 0, l: 1 }]);

  const r = await app.request('/exam/grade', { method: 'POST', user });
  assert.equal(r.json.ok, true);
  assert.equal(r.json.next, 2);
  assert.equal(r.json.total, 2);

  const after = await ExamAttempt.findById(attempt._id);
  assert.equal(after.currentIdx, 1);
  assert.equal(after.state, 'running');
  // the next lab was provisioned for this user (fresh ready session on lesson 1)
  const sess = await LabSession.findOne({ user });
  assert.equal(sess.lessonIdx, 1);
  assert.equal(sess.status, 'ready');
});

test('grade is rejected when the active lab session is not ready/matching', opts, async () => {
  const user = oid();
  const course = await makeCourse([passLab('only')]);
  await makeAttempt(user, course._id, [{ m: 0, l: 0 }]); // no LabSession created
  const r = await app.request('/exam/grade', { method: 'POST', user });
  assert.equal(r.json.ok, false);
  assert.match(r.json.error, /ยังไม่พร้อม/);
});

test('grade with no running attempt reports no active exam', opts, async () => {
  const r = await app.request('/exam/grade', { method: 'POST', user: oid() });
  assert.equal(r.json.ok, false);
  assert.match(r.json.error, /ไม่มีการสอบ/);
});

test('skipping the final lab finalizes it as skipped (counts as not passed)', opts, async () => {
  const user = oid();
  const course = await makeCourse([passLab('a'), passLab('b')]);
  const attempt = await makeAttempt(user, course._id, [{ m: 0, l: 0 }, { m: 0, l: 1 }], { currentIdx: 1 });
  attempt.labs[0].status = 'passed'; await attempt.save();

  const r = await app.request('/exam/skip', { method: 'POST', user });
  assert.equal(r.json.done, true);
  const after = await ExamAttempt.findById(attempt._id);
  assert.equal(after.labs[1].status, 'skipped');
  assert.equal(after.finalPct, 50); // 1 of 2 passed
});

// ── server-authoritative timer ────────────────────────────────────────────────

test('grading after the deadline expires the attempt instead of scoring', opts, async () => {
  const user = oid();
  const course = await makeCourse([passLab('only')]);
  await readySession(user, course._id, 0, 0);
  const attempt = await makeAttempt(user, course._id, [{ m: 0, l: 0 }],
    { startedAt: new Date(Date.now() - 61 * 60 * 1000) }); // 61 min ago, limit 60

  const r = await app.request('/exam/grade', { method: 'POST', user });
  assert.equal(r.json.expired, true);
  assert.equal(r.json.resultUrl, `/exam/result/${attempt._id}`);
  const after = await ExamAttempt.findById(attempt._id);
  assert.equal(after.state, 'expired');
  assert.equal(after.labs[0].status, 'pending'); // never graded — time ran out
});

test('GET /exam/run/status reports remaining time, and expires past the deadline', opts, async () => {
  const user = oid();
  const course = await makeCourse([passLab('only')]);
  const live = await makeAttempt(user, course._id, [{ m: 0, l: 0 }]);
  const ok = await app.request('/exam/run/status', { user });
  assert.equal(ok.json.ok, true);
  assert.ok(ok.json.secondsLeft > 0 && ok.json.secondsLeft <= 60 * 60);

  await ExamAttempt.updateOne({ _id: live._id }, { startedAt: new Date(Date.now() - 61 * 60 * 1000) });
  const expired = await app.request('/exam/run/status', { user });
  assert.equal(expired.json.expired, true);
  assert.equal((await ExamAttempt.findById(live._id)).state, 'expired');
});

// ── abandon ───────────────────────────────────────────────────────────────────

test('POST /exam/abandon finalizes with whatever has been scored so far', opts, async () => {
  const user = oid();
  const course = await makeCourse([passLab('a'), passLab('b')]);
  const attempt = await makeAttempt(user, course._id, [{ m: 0, l: 0 }, { m: 0, l: 1 }]);
  attempt.labs[0].status = 'passed'; await attempt.save();

  const r = await app.request('/exam/abandon', { method: 'POST', user });
  assert.equal(r.json.ok, true);
  const after = await ExamAttempt.findById(attempt._id);
  assert.equal(after.state, 'done');
  assert.equal(after.finalPct, 50);
});

// ── result ownership + sharing ────────────────────────────────────────────────

test('GET /exam/result/:id renders for the owner and redirects everyone else', opts, async () => {
  const owner = oid();
  const course = await makeCourse([passLab('only')]);
  const attempt = await makeAttempt(owner, course._id, [{ m: 0, l: 0 }], { state: 'done', finalPct: 100 });

  const mine = await app.request(`/exam/result/${attempt._id}`, { user: owner });
  assert.equal(mine.json.__render, 'exam-result.njk');

  const theirs = await app.request(`/exam/result/${attempt._id}`, { user: oid() });
  assert.equal(theirs.status, 302); // not yours → bounced to /exam

  const bad = await app.request('/exam/result/not-an-id', { user: owner });
  assert.equal(bad.status, 302);
});

test('share mints a token, and the public shared page needs no auth', opts, async () => {
  const owner = oid();
  const course = await makeCourse([passLab('only')]);
  const attempt = await makeAttempt(owner, course._id, [{ m: 0, l: 0 }], { state: 'done', finalPct: 100 });

  const share = await app.request(`/exam/result/${attempt._id}/share`, { method: 'POST', user: owner });
  assert.equal(share.json.ok, true);
  assert.match(share.json.url, /^\/exam\/shared\/[0-9a-f]{32}$/);

  const token = share.json.url.split('/').pop();
  const pub = await app.request(`/exam/shared/${token}`); // no x-test-user header
  assert.equal(pub.json.__render, 'exam-result.njk');
  assert.equal(pub.json.shared, true);

  const missing = await app.request('/exam/shared/deadbeef');
  assert.equal(missing.status, 404);
});
