process.env.LOG_LEVEL = 'silent';

// Verifiable certificates (§5): the issuance rules (100% complete, plus a
// passed Boss Lab when the course has one), serial generation/uniqueness, the
// public verify page, and the
// owner-only display-name edit. DB-backed (skips without local MongoDB). GNS3
// is the in-process fake purely so courseRoutes' service imports load cleanly.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startFakeGns3 } from './helpers/fakeGns3.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import { startRouteApp } from './helpers/routeApp.js';

// fake GNS3 must exist BEFORE the services are imported (it freezes GNS3_BASE).
const fake = await startFakeGns3();
process.env.GNS3_HOST = 'http://127.0.0.1';
process.env.GNS3_PORT = String(fake.port);
delete process.env.GNS3_PUBLIC_URL;

const { default: courseRoutes } = await import('../src/routes/courseRoutes.js');
const { default: certRoutes } = await import('../src/routes/certRoutes.js');
const { default: Course } = await import('../src/models/Course.js');
const { default: User } = await import('../src/models/User.js');
const { default: Certificate } = await import('../src/models/Certificate.js');
const { default: Counter } = await import('../src/models/Counter.js');
const { markComplete, getProgress } = await import('../src/models/Progress.js');
const certService = await import('../src/services/certificateService.js');

const dbUp = await connectTestDb('pingable-test-certificate');
const opts = { skip: !dbUp && 'MongoDB not reachable' };

let app;
before(async () => {
  app = await startRouteApp((a) => { a.use('/cert', certRoutes); a.use('/courses', courseRoutes); });
});
after(async () => {
  await app?.close();
  await disconnectTestDb();
  await fake.close();
});
beforeEach(async () => {
  if (!dbUp) return;
  await Promise.all([
    Course.deleteMany({}), User.deleteMany({}), Certificate.deleteMany({}), Counter.deleteMany({}),
  ]);
  await mongoose.connection.collection('progresses').deleteMany({});
});

// ── fixtures ──────────────────────────────────────────────────────────────────

let courseCounter = 0;
// A course: one module with a reading then a Boss lab (unless bossless).
async function makeCourse({ bossless = false } = {}) {
  return Course.create({
    slug: 'cert-fixture-' + (courseCounter++) + '-' + Math.random().toString(36).slice(2),
    title: 'Cert Fixture', description: 'd', level: 'advanced',
    modules: [{ title: 'M', lessons: [
      { type: 'reading', title: 'intro', body: 'x' },
      { type: 'lab', title: 'boss', isBoss: !bossless, passThreshold: 80,
        topology: { nodes: [{ name: 'R1', nodeType: 'vpcs' }], links: [] },
        gradingChecks: [{ description: 'ok', node: 'R1', command: 'show', expect: 'OK', points: 1 }] },
    ] }],
  });
}

async function makeUser(username = 'tester') {
  return User.create({ username, email: `${username}@e.co`, password: 'pw123456' });
}

// Complete every lesson in the course for a user (lab recorded as passed).
async function completeAll(userId, course) {
  await markComplete(userId, course._id, 0, 0, 'reading');
  await markComplete(userId, course._id, 0, 1, 'lab', 100);
}

// ── service: eligibility + issuance ─────────────────────────────────────────

test('not eligible until the course is 100% complete', opts, async () => {
  const user = await makeUser();
  const course = await makeCourse();
  await markComplete(user._id, course._id, 0, 0, 'reading'); // only the reading

  const fresh = await Course.findById(course._id);
  const cert = await certService.maybeIssue(user._id, fresh, await getProgress(user._id, course._id));
  assert.equal(cert, null);
  assert.equal(await Certificate.countDocuments(), 0);
});

test('a bossless course earns a certificate at 100% (matches the UI button)', opts, async () => {
  const user = await makeUser();
  const course = await makeCourse({ bossless: true });
  await completeAll(user._id, course);

  const fresh = await Course.findById(course._id);
  const cert = await certService.maybeIssue(user._id, fresh, await getProgress(user._id, course._id));
  assert.ok(cert);
  assert.match(cert.serial, /^PNG-\d{4}-\d{6}$/);
});

test('100% + passed Boss Lab issues one cert with a PNG-YYYY-NNNNNN serial', opts, async () => {
  const user = await makeUser('alice');
  const course = await makeCourse();
  await completeAll(user._id, course);

  const fresh = await Course.findById(course._id);
  const cert = await certService.maybeIssue(user._id, fresh, await getProgress(user._id, course._id));
  assert.ok(cert);
  assert.match(cert.serial, /^PNG-\d{4}-\d{6}$/);
  assert.equal(cert.displayName, 'alice');     // defaults to username
  assert.equal(cert.courseTitle, 'Cert Fixture');
  assert.equal(cert.lessonTotal, 2);

  // idempotent — issuing again returns the same doc, no duplicate
  const again = await certService.maybeIssue(user._id, fresh, await getProgress(user._id, course._id));
  assert.equal(String(again._id), String(cert._id));
  assert.equal(await Certificate.countDocuments({ user: user._id }), 1);
});

test('serials increment within the year', opts, async () => {
  const user = await makeUser('bob');
  const c1 = await makeCourse();
  const c2 = await makeCourse();
  await completeAll(user._id, c1);
  await completeAll(user._id, c2);

  const cert1 = await certService.maybeIssue(user._id, await Course.findById(c1._id), await getProgress(user._id, c1._id));
  const cert2 = await certService.maybeIssue(user._id, await Course.findById(c2._id), await getProgress(user._id, c2._id));
  const n1 = Number(cert1.serial.split('-')[2]);
  const n2 = Number(cert2.serial.split('-')[2]);
  assert.equal(n2, n1 + 1);
});

// ── route: owner certificate page ───────────────────────────────────────────

test('GET certificate redirects when not eligible, renders when eligible', opts, async () => {
  const user = await makeUser('carol');
  const course = await makeCourse();

  const before = await app.request(`/courses/${course._id}/certificate`, { user: user._id, username: 'carol' });
  assert.equal(before.status, 302); // not complete yet

  await completeAll(user._id, course);
  const r = await app.request(`/courses/${course._id}/certificate`, { user: user._id, username: 'carol' });
  assert.equal(r.json.__render, 'certificate.njk');
  assert.match(r.json.cert.serial, /^PNG-\d{4}-\d{6}$/);
  assert.match(r.json.verifyUrl, /\/cert\/PNG-\d{4}-\d{6}$/);
});

test('POST certificate/name updates the owner display name', opts, async () => {
  const user = await makeUser('dan');
  const course = await makeCourse();
  await completeAll(user._id, course);
  await app.request(`/courses/${course._id}/certificate`, { user: user._id }); // issue it

  const r = await app.request(`/courses/${course._id}/certificate/name`, {
    method: 'POST', user: user._id, body: { displayName: '  Daniel Networker  ' },
  });
  assert.equal(r.status, 302);
  const cert = await Certificate.findOne({ user: user._id, course: course._id });
  assert.equal(cert.displayName, 'Daniel Networker'); // trimmed
});

// ── route: public verification ──────────────────────────────────────────────

test('GET /cert/:serial verifies a real certificate without auth', opts, async () => {
  const user = await makeUser('erin');
  const course = await makeCourse();
  await completeAll(user._id, course);
  const cert = await certService.maybeIssue(user._id, await Course.findById(course._id), await getProgress(user._id, course._id));

  const r = await app.request(`/cert/${cert.serial}`); // no auth header
  assert.equal(r.json.__render, 'cert-verify.njk');
  assert.equal(r.json.cert.serial, cert.serial);
  assert.equal(r.json.cert.displayName, 'erin');
  assert.equal(r.json.profileUrl, null); // profile not public
});

test('GET /cert/:serial 404s on a malformed or unknown serial', opts, async () => {
  const bad = await app.request('/cert/not-a-serial');
  assert.equal(bad.status, 404);
  const unknown = await app.request('/cert/PNG-2026-999999');
  assert.equal(unknown.status, 404);
});
