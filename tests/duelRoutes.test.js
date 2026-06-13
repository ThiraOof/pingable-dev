process.env.LOG_LEVEL = 'silent';
delete process.env.DUELS_ENABLED; // each test opts in explicitly

// /duel route logic (§14): the DUELS_ENABLED event gate, room create/join with
// the atomic guest claim, role-based access to a room, the first-to-100% win
// (atomic, stops both labs), and forfeit. HTTP runs through a minimal app
// (helpers/routeApp) with a faked session; GNS3 + node consoles are in-process
// fakes. The duel lab is resolved by slug, so fixtures use slug
// 'network-troubleshooting' (module 0, lesson 1) to match duelRoutes' DUEL_LAB.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startFakeGns3 } from './helpers/fakeGns3.js';
import { startFakeConsole } from './helpers/fakeConsole.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import { startRouteApp } from './helpers/routeApp.js';

const fake = await startFakeGns3();
process.env.GNS3_HOST = 'http://127.0.0.1';
process.env.GNS3_PORT = String(fake.port);
delete process.env.GNS3_PUBLIC_URL;

const { default: duelRoutes } = await import('../src/routes/duelRoutes.js');
const { default: Course } = await import('../src/models/Course.js');
const { default: Duel } = await import('../src/models/Duel.js');
const { default: LabSession } = await import('../src/models/LabSession.js');

const dbUp = await connectTestDb('pingable-test-duelroutes');
if (dbUp) await LabSession.init();
const opts = { skip: !dbUp && 'MongoDB not reachable' };

const oid = () => new mongoose.Types.ObjectId();

let app;
const consoles = [];
const enable = (on) => { if (on) process.env.DUELS_ENABLED = '1'; else delete process.env.DUELS_ENABLED; };

before(async () => { app = await startRouteApp((a) => a.use('/duel', duelRoutes)); });
after(async () => {
  await app?.close();
  await Promise.all(consoles.splice(0).map((c) => c.close()));
  await disconnectTestDb();
  await fake.close();
});
beforeEach(async () => {
  enable(false);
  if (!dbUp) return;
  await Promise.all([Course.deleteMany({}), Duel.deleteMany({}), LabSession.deleteMany({})]);
  fake.deleted.length = 0; fake.calls.length = 0; fake.projects.clear(); fake.failOn.clear();
});

// ── fixtures ──────────────────────────────────────────────────────────────────

// The duel lab lives at slug 'network-troubleshooting' module 0 / lesson 1
// (duelRoutes.DUEL_LAB). lesson 1 is a no-setup troubleshoot lab whose single
// check passes against a fake console answering `show ok` with "OK".
function makeDuelCourse() {
  return Course.create({
    slug: 'network-troubleshooting', title: 'Duel Fixture',
    modules: [{ title: 'M', lessons: [
      { type: 'reading', title: 'intro' },
      { type: 'lab', title: 'ซ่อม #1', mode: 'troubleshoot',
        topology: { nodes: [{ name: 'R1', nodeType: 'vpcs' }], links: [] },
        gradingChecks: [{ description: 'R1 ok', node: 'R1', command: 'show ok', expect: 'OK', points: 1 }] },
    ] }],
  });
}

async function readySession(user, course, { failing = false } = {}) {
  const con = await startFakeConsole({ prompt: 'R1> ', responses: { 'show ok': failing ? 'STATUS BAD' : 'STATUS OK' } });
  consoles.push(con);
  await LabSession.create({
    user, course, moduleIdx: 0, lessonIdx: 1, status: 'ready', projectId: 'p-' + String(user).slice(-6),
    nodes: { R1: { consoleHost: '127.0.0.1', consolePort: con.port } },
  });
  return con;
}

const makeDuel = (course, host, over = {}) => Duel.create({
  course: course._id, moduleIdx: 0, lessonIdx: 1, labTitle: 'ซ่อม #1',
  host: { user: host, username: 'host' }, state: 'open', ...over,
});

// ── gate + landing ──────────────────────────────────────────────────────────

test('GET /duel without a session is gated to login', opts, async () => {
  const r = await app.request('/duel');
  assert.equal(r.status, 302);
  assert.equal(r.location, '/auth/login');
});

test('GET /duel reflects whether the event gate is open', opts, async () => {
  enable(false);
  let r = await app.request('/duel', { user: oid() });
  assert.equal(r.json.__render, 'duel-index.njk');
  assert.equal(r.json.enabled, false);

  enable(true);
  r = await app.request('/duel', { user: oid() });
  assert.equal(r.json.enabled, true);
});

test('POST /duel/create is blocked while the event gate is closed', opts, async () => {
  const r = await app.request('/duel/create', { method: 'POST', user: oid() });
  assert.equal(r.status, 403);
  assert.equal(r.json.__render, 'error.njk');
  assert.equal(await Duel.countDocuments(), 0);
});

test('POST /duel/create fails cleanly when the duel lab is missing', opts, async () => {
  enable(true); // no course seeded → resolveDuelLab is null
  const r = await app.request('/duel/create', { method: 'POST', user: oid() });
  assert.equal(r.status, 500);
  assert.equal(r.json.__render, 'error.njk');
});

test('POST /duel/create opens a room owned by the caller (state open)', opts, async () => {
  enable(true);
  await makeDuelCourse();
  const host = oid();
  await app.request('/duel/create', { method: 'POST', user: host, username: 'alice' });

  const duel = await Duel.findOne({ 'host.user': host });
  assert.ok(duel);
  assert.equal(duel.state, 'open');
  assert.equal(duel.host.username, 'alice');
  assert.equal(duel.guest, undefined);
});

// ── room access by role ───────────────────────────────────────────────────────

test('an outsider opening an OPEN room gets the join page; a RUNNING room is 403', opts, async () => {
  const course = await makeDuelCourse();
  const open = await makeDuel(course, oid());
  const join = await app.request(`/duel/${open._id}`, { user: oid() });
  assert.equal(join.json.__render, 'duel-join.njk');

  const running = await makeDuel(course, oid(), { state: 'running', guest: { user: oid(), username: 'g' } });
  const blocked = await app.request(`/duel/${running._id}`, { user: oid() });
  assert.equal(blocked.status, 403);
});

test('the host sees the duel room with role "host"', opts, async () => {
  const course = await makeDuelCourse();
  const host = oid();
  const duel = await makeDuel(course, host);
  const r = await app.request(`/duel/${duel._id}`, { user: host });
  assert.equal(r.json.__render, 'duel-room.njk');
  assert.equal(r.json.role, 'host');
});

test('GET /duel/:id with a malformed id redirects to /duel', opts, async () => {
  const r = await app.request('/duel/not-an-id', { user: oid() });
  assert.equal(r.status, 302);
});

// ── join ──────────────────────────────────────────────────────────────────────

test('a guest joining flips the room to running and provisions both labs', opts, async () => {
  enable(true);
  const course = await makeDuelCourse();
  const host = oid();
  const duel = await makeDuel(course, host);

  const r = await app.request(`/duel/${duel._id}/join`, { method: 'POST', user: oid(), username: 'bob' });
  assert.equal(r.json.ok, true);

  const after = await Duel.findById(duel._id);
  assert.equal(after.state, 'running');
  assert.equal(after.guest.username, 'bob');
  assert.ok(after.startedAt);
  // both players got their own GNS3 project + LabSession
  assert.equal(await LabSession.countDocuments({ course: course._id }), 2);
  assert.equal(fake.projects.size, 2);
});

test('the host cannot join their own room', opts, async () => {
  enable(true);
  const course = await makeDuelCourse();
  const host = oid();
  const duel = await makeDuel(course, host);
  const r = await app.request(`/duel/${duel._id}/join`, { method: 'POST', user: host });
  assert.equal(r.status, 409);
});

test('joining an already-running room is rejected', opts, async () => {
  enable(true);
  const course = await makeDuelCourse();
  const duel = await makeDuel(course, oid(), { state: 'running', guest: { user: oid(), username: 'g' } });
  const r = await app.request(`/duel/${duel._id}/join`, { method: 'POST', user: oid() });
  assert.equal(r.status, 409);
});

test('join is blocked while the event gate is closed', opts, async () => {
  const course = await makeDuelCourse();
  const duel = await makeDuel(course, oid());
  const r = await app.request(`/duel/${duel._id}/join`, { method: 'POST', user: oid() });
  assert.equal(r.status, 403);
  assert.equal(r.json.ok, false);
});

// ── state poll ────────────────────────────────────────────────────────────────

test('GET /duel/:id/state returns both scores to a participant, 403 to outsiders', opts, async () => {
  const course = await makeDuelCourse();
  const host = oid(), guest = oid();
  const duel = await makeDuel(course, host, { state: 'running', guest: { user: guest, username: 'g', bestPct: 40 } });

  const asHost = await app.request(`/duel/${duel._id}/state`, { user: host });
  assert.equal(asHost.json.ok, true);
  assert.equal(asHost.json.state, 'running');
  assert.equal(asHost.json.you.pct, 0);
  assert.equal(asHost.json.foe.pct, 40);
  assert.equal(asHost.json.foe.username, 'g');

  const asOutsider = await app.request(`/duel/${duel._id}/state`, { user: oid() });
  assert.equal(asOutsider.status, 403);
});

// ── grade (first to 100% wins) ────────────────────────────────────────────────

test('grading 100% wins the duel, marks the winner, and stops both labs', opts, async () => {
  const course = await makeDuelCourse();
  const host = oid(), guest = oid();
  const duel = await makeDuel(course, host, { state: 'running', guest: { user: guest, username: 'g' } });
  await readySession(host, course._id);

  const r = await app.request(`/duel/${duel._id}/grade`, { method: 'POST', user: host });
  assert.equal(r.json.ok, true);
  assert.equal(r.json.pct, 100);
  assert.equal(r.json.won, true);

  const after = await Duel.findById(duel._id);
  assert.equal(after.state, 'done');
  assert.equal(after.winner, 'host');
  assert.equal(after.host.bestPct, 100);
  assert.equal(await LabSession.countDocuments({ user: host }), 0); // winner's lab stopped
});

test('a sub-100% grade records the best score without ending the duel', opts, async () => {
  const course = await makeDuelCourse();
  const host = oid();
  const duel = await makeDuel(course, host, { state: 'running', guest: { user: oid(), username: 'g' } });
  await readySession(host, course._id, { failing: true });

  const r = await app.request(`/duel/${duel._id}/grade`, { method: 'POST', user: host });
  assert.equal(r.json.ok, true);
  assert.equal(r.json.pct, 0);
  assert.equal(r.json.won, undefined);
  assert.equal((await Duel.findById(duel._id)).state, 'running');
});

test('grading a duel that is not running is rejected', opts, async () => {
  const course = await makeDuelCourse();
  const host = oid();
  const duel = await makeDuel(course, host, { state: 'done', winner: 'guest' });
  const r = await app.request(`/duel/${duel._id}/grade`, { method: 'POST', user: host });
  assert.equal(r.json.ok, false);
});

// ── forfeit ───────────────────────────────────────────────────────────────────

test('forfeiting ends the duel and hands the win to the opponent', opts, async () => {
  const course = await makeDuelCourse();
  const host = oid(), guest = oid();
  const duel = await makeDuel(course, host, { state: 'running', guest: { user: guest, username: 'g' } });
  await readySession(host, course._id);

  const r = await app.request(`/duel/${duel._id}/forfeit`, { method: 'POST', user: host });
  assert.equal(r.json.ok, true);
  const after = await Duel.findById(duel._id);
  assert.equal(after.state, 'done');
  assert.equal(after.winner, 'guest'); // the other side wins by default
});
