process.env.LOG_LEVEL = 'silent';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startFakeGns3 } from './helpers/fakeGns3.js';
import { startFakeConsole, closedPort } from './helpers/fakeConsole.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';

// The fake GNS3 must exist BEFORE gns3Service is imported — it freezes
// GNS3_BASE from the env at module load.
const fake = await startFakeGns3();
process.env.GNS3_HOST = 'http://127.0.0.1';
process.env.GNS3_PORT = String(fake.port);
delete process.env.GNS3_PUBLIC_URL; // assert against proxied-mode webUiUrl

const svc = await import('../src/services/labSessionService.js');
const { default: LabSession } = await import('../src/models/LabSession.js');

const dbUp = await connectTestDb('pingable-test-labsession');
// The start-lock tests rely on the unique `user` index — wait for it to build.
if (dbUp) await LabSession.init();
const opts = { skip: !dbUp && 'MongoDB not reachable' };

const oid = () => new mongoose.Types.ObjectId();

// Canonical lab shape (see scripts/seed.js): vpcs + built-in switch + a
// template appliance, with links exercising both port-mapping conventions.
const LAB = {
  title: 'Test Lab / Demo',
  topology: {
    nodes: [
      { name: 'PC1', nodeType: 'vpcs' },
      { name: 'SW1', nodeType: 'ethernet_switch' },
      { name: 'R1', templateId: '00000000-0000-0000-0000-000000000001' },
    ],
    links: [
      { node1: 'PC1', port1: 0, node2: 'SW1', port2: 1 },
      { node1: 'R1', port1: 1, node2: 'SW1', port2: 2 },
    ],
  },
};

beforeEach(async () => {
  if (!dbUp) return;
  await LabSession.deleteMany({});
  fake.deleted.length = 0;
  fake.stopped.length = 0;
  fake.calls.length = 0;
  fake.projects.clear();
  fake.failOn.clear();
});

after(async () => {
  await disconnectTestDb();
  await fake.close();
});

// ── startSession ──────────────────────────────────────────────────────────────

test('startSession builds the lab and stores a ready session', opts, async () => {
  const userId = oid();
  const doc = await svc.startSession(userId, oid(), 0, 1, LAB);

  assert.equal(doc.status, 'ready');
  assert.ok(doc.projectId);
  assert.equal(doc.webUiUrl, '/static/web-ui/bundled'); // proxied mode (no GNS3_PUBLIC_URL)
  assert.ok(fake.projects.has(doc.projectId));
  assert.match(fake.projects.get(doc.projectId).name, /^pingable_\d+_Test_Lab_-_Demo$/);

  // console_host 0.0.0.0 is rewritten to the GNS3 host so the grader can connect
  assert.equal(doc.nodes.PC1.consoleHost, '127.0.0.1');
  assert.equal(typeof doc.nodes.PC1.consolePort, 'number');
  // built-in switch consoles are not real telnet consoles → recorded as null
  assert.equal(doc.nodes.SW1.consolePort, null);
  // template appliance was renamed to its lab name
  assert.ok(doc.nodes.R1);
  assert.ok(fake.calls.some((c) => c.method === 'PUT' && c.body?.name === 'R1'));
});

test('startSession maps link ports per node kind (template: adapter N/port 0, built-in: adapter 0/port N)', opts, async () => {
  await svc.startSession(oid(), oid(), 0, 1, LAB);

  const links = fake.calls.filter((c) => c.method === 'POST' && /\/links$/.test(c.path));
  assert.equal(links.length, 2);

  const [pcSw, r1Sw] = links.map((c) => c.body.nodes);
  // PC1 (vpcs) port 0 / SW1 (switch) port 1 — both adapter 0
  assert.deepEqual(pcSw.map(({ adapter_number, port_number }) => [adapter_number, port_number]),
    [[0, 0], [0, 1]]);
  // R1 (template) port 1 → adapter 1, port 0; SW1 port 2 → adapter 0, port 2
  assert.deepEqual(r1Sw.map(({ adapter_number, port_number }) => [adapter_number, port_number]),
    [[1, 0], [0, 2]]);
});

test('startSession tears down the user\'s previous lab (one live lab per user)', opts, async () => {
  const userId = oid();
  await LabSession.create({
    user: userId, course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-old',
  });

  const doc = await svc.startSession(userId, oid(), 1, 2, LAB);
  assert.ok(fake.deleted.includes('proj-old'));
  assert.notEqual(doc.projectId, 'proj-old');
  assert.equal(await LabSession.countDocuments({ user: userId }), 1);
});

test('concurrent starts: exactly one wins, the other gets LabBusyError', opts, async () => {
  const userId = oid();
  const results = await Promise.allSettled([
    svc.startSession(userId, oid(), 0, 1, LAB),
    svc.startSession(userId, oid(), 0, 1, LAB),
  ]);

  const ok = results.filter((r) => r.status === 'fulfilled');
  const busy = results.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(busy.length, 1);
  assert.ok(busy[0].reason instanceof svc.LabBusyError);
  assert.equal(await LabSession.countDocuments({ user: userId }), 1);
});

test('a fresh "building" doc blocks a second start (start lock)', opts, async () => {
  const userId = oid();
  await LabSession.collection.insertOne({
    user: userId, course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'building', nodes: {}, bootedNodes: [],
    lastActivityAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  });

  await assert.rejects(svc.startSession(userId, oid(), 0, 1, LAB), svc.LabBusyError);
});

test('a stale "building" doc (crashed build) is reclaimable', opts, async () => {
  const userId = oid();
  const old = new Date(Date.now() - 6 * 60 * 1000); // > BUILD_STALE_MS (5 min)
  await LabSession.collection.insertOne({
    user: userId, course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'building', nodes: {}, bootedNodes: [],
    lastActivityAt: old, createdAt: old, updatedAt: old,
  });

  const doc = await svc.startSession(userId, oid(), 0, 1, LAB);
  assert.equal(doc.status, 'ready');
});

test('a failed build cleans up both the session doc and the GNS3 project', opts, async () => {
  fake.failOn.add('start-nodes'); // project + nodes get created, then the build dies
  const userId = oid();

  await assert.rejects(svc.startSession(userId, oid(), 0, 1, LAB), /HTTP 500/);
  assert.equal(await LabSession.countDocuments({ user: userId }), 0); // slot released
  assert.equal(fake.deleted.length, 1); // buildLab deleted its own half-built project
  assert.equal(fake.projects.size, 0);
});

// ── Global capacity cap ──────────────────────────────────────────────────────

const withCap = async (max, fn) => {
  const before = process.env.LAB_MAX_CONCURRENT;
  process.env.LAB_MAX_CONCURRENT = String(max);
  try { await fn(); }
  finally {
    if (before === undefined) delete process.env.LAB_MAX_CONCURRENT;
    else process.env.LAB_MAX_CONCURRENT = before;
  }
};

const seedSession = (userId, projectId) => LabSession.create({
  user: userId, course: oid(), moduleIdx: 0, lessonIdx: 0,
  status: 'ready', projectId, lastActivityAt: new Date(),
});

test('at the global cap, a newcomer gets LabCapacityError and the claimed slot is released', opts, () =>
  withCap(2, async () => {
    await seedSession(oid(), 'p1');
    await seedSession(oid(), 'p2');

    const newcomer = oid();
    await assert.rejects(svc.startSession(newcomer, oid(), 0, 1, LAB), svc.LabCapacityError);
    assert.equal(await LabSession.countDocuments({ user: newcomer }), 0); // slot released
    assert.equal(fake.projects.size, 0); // rejected before any GNS3 work
  }));

test('a user with an existing session can rebuild even at the cap (no net increase)', opts, () =>
  withCap(2, async () => {
    const userId = oid();
    await seedSession(userId, 'p-mine');
    await seedSession(oid(), 'p-other');

    const doc = await svc.startSession(userId, oid(), 0, 1, LAB);
    assert.equal(doc.status, 'ready');
    assert.ok(fake.deleted.includes('p-mine')); // replaced their own lab
    assert.equal(await LabSession.countDocuments(), 2); // still at, not over, the cap
  }));

test('LAB_MAX_CONCURRENT=0 disables the cap', opts, () =>
  withCap(0, async () => {
    await seedSession(oid(), 'p1');
    await seedSession(oid(), 'p2');
    await seedSession(oid(), 'p3');

    const doc = await svc.startSession(oid(), oid(), 0, 1, LAB);
    assert.equal(doc.status, 'ready');
  }));

// ── stop / touch / probeBoot ─────────────────────────────────────────────────

test('stopSession deletes the project and the session doc', opts, async () => {
  const userId = oid();
  await LabSession.create({
    user: userId, course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-stop',
  });

  assert.equal(await svc.stopSession(userId), true);
  assert.ok(fake.deleted.includes('proj-stop'));
  assert.equal(await LabSession.countDocuments({ user: userId }), 0);
  assert.equal(await svc.stopSession(userId), false); // nothing left to stop
});

test('touch bumps lastActivityAt (heartbeat)', opts, async () => {
  const userId = oid();
  const old = new Date(Date.now() - 10 * 60 * 1000);
  await LabSession.create({
    user: userId, course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'p', lastActivityAt: old,
  });

  await svc.touch(userId);
  const doc = await LabSession.findOne({ user: userId });
  assert.ok(doc.lastActivityAt > old);
});

test('probeBoot: booted nodes are remembered and not re-probed', opts, async () => {
  const con = await startFakeConsole({ prompt: 'R1> ' });
  const dead = await closedPort();
  try {
    const session = await LabSession.create({
      user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
      status: 'ready', projectId: 'p',
      nodes: {
        R1:  { consoleHost: '127.0.0.1', consolePort: con.port },
        SW1: { consoleHost: '127.0.0.1', consolePort: null }, // console-less → booted
        R2:  { consoleHost: '127.0.0.1', consolePort: dead }, // still booting
      },
    });

    const first = await svc.probeBoot(session);
    assert.deepEqual(first, { nodeCount: 3, bootedCount: 2, allBooted: false });

    // Booted set is persisted, and a booted node stays booted: the next poll
    // only probes R2 — the R1 console sees no second connection.
    const reloaded = await LabSession.findById(session._id);
    assert.deepEqual([...reloaded.bootedNodes].sort(), ['R1', 'SW1']);
    const connectionsAfterFirst = con.connections;
    const second = await svc.probeBoot(reloaded);
    assert.equal(second.bootedCount, 2);
    assert.equal(con.connections, connectionsAfterFirst);
  } finally {
    await con.close();
  }
});

// ── Sweeper ──────────────────────────────────────────────────────────────────

test('sweepIdle tears down sessions without a recent heartbeat, keeps active ones', opts, async () => {
  const idleMin = Number(process.env.LAB_IDLE_MINUTES || 45);
  await LabSession.create({
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-idle',
    lastActivityAt: new Date(Date.now() - (idleMin + 1) * 60 * 1000),
  });
  await LabSession.create({
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-active', lastActivityAt: new Date(),
  });

  await svc.sweepIdle();
  assert.ok(fake.deleted.includes('proj-idle'));
  assert.ok(!fake.deleted.includes('proj-active'));
  assert.equal(await LabSession.countDocuments(), 1);
});

test('sweepOrphans reaps old unreferenced pingable_* projects only', opts, async () => {
  const oldMs = Date.now() - 11 * 60 * 1000; // > ORPHAN_MIN_AGE_MS (10 min)
  fake.seedProject('proj-orphan', `pingable_${oldMs}_crashed`);
  fake.seedProject('proj-young', `pingable_${Date.now()}_inflight`);
  fake.seedProject('proj-foreign', 'someones_other_project');
  fake.seedProject('proj-known', `pingable_${oldMs}_alive`);
  await LabSession.create({
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-known', lastActivityAt: new Date(),
  });

  await svc.sweepOrphans();
  assert.deepEqual(fake.deleted, ['proj-orphan']);
});

test('teardown stops nodes before deleting the project (no orphaned processes)', opts, async () => {
  await LabSession.create({
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-x',
    lastActivityAt: new Date(Date.now() - (Number(process.env.LAB_IDLE_MINUTES || 45) + 1) * 60 * 1000),
  });
  await svc.sweepIdle();
  // A bare DELETE on a project the controller no longer holds orphans the
  // node processes — they keep their NIO ports. Stopping first prevents that.
  assert.ok(fake.stopped.includes('proj-x'), 'nodes/stop should be called');
  assert.ok(fake.deleted.includes('proj-x'), 'project should be deleted');
});

test('sweepStaleSessions drops ready sessions whose GNS3 project vanished, keeps live ones', opts, async () => {
  fake.seedProject('proj-live', `pingable_${Date.now()}_live`);
  await LabSession.create({
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-live', lastActivityAt: new Date(),
  });
  await LabSession.create({ // points at a project GNS3 no longer knows about
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-gone', lastActivityAt: new Date(),
  });

  await svc.sweepStaleSessions();
  const left = await LabSession.find().select('projectId');
  assert.deepEqual(left.map((d) => d.projectId).sort(), ['proj-live']);
});

test('sweepStaleSessions leaves building sessions (no projectId) untouched', opts, async () => {
  await LabSession.create({
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'building', projectId: null, lastActivityAt: new Date(),
  });
  await svc.sweepStaleSessions();
  assert.equal(await LabSession.countDocuments(), 1);
});

test('reconcile sweeps are skipped (non-destructive) when GNS3 is unreachable', opts, async () => {
  fake.failOn.add('list-projects');
  await LabSession.create({
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', projectId: 'proj-gone', lastActivityAt: new Date(),
  });
  await svc.sweepStaleSessions(); // GNS3 down → must NOT delete the session
  await svc.sweepOrphans();
  assert.equal(await LabSession.countDocuments(), 1);
});
