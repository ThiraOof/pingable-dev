process.env.LOG_LEVEL = 'silent';

// ensureSetup — ตัวฉีด config โจทย์ troubleshoot: รันคำสั่งผ่าน fake console
// และเดิน state machine idle → running → done / failed ถูกต้อง

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startFakeConsole, closedPort } from './helpers/fakeConsole.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import { ensureSetup } from '../src/services/labSessionService.js';
import LabSession from '../src/models/LabSession.js';

const dbUp = await connectTestDb('pingable-test-labsetup');
const opts = { skip: !dbUp && 'MongoDB not reachable' };

const oid = () => new mongoose.Types.ObjectId();

async function makeSession(nodes) {
  return LabSession.create({
    user: oid(), course: oid(), moduleIdx: 0, lessonIdx: 0,
    status: 'ready', nodes,
  });
}

beforeEach(async () => { if (dbUp) await LabSession.deleteMany({}); });
after(disconnectTestDb);

test('lab without setupCommands → "none" and nothing runs', opts, async () => {
  const session = await makeSession({});
  assert.equal(await ensureSetup(session, { setupCommands: [] }), 'none');
  assert.equal(await ensureSetup(session, {}), 'none');
});

test('runs each node group over telnet and lands on "done"', opts, async () => {
  const r1 = await startFakeConsole({ prompt: 'vyos@vyos:~$ ', responses: { configure: 'ok', 'set x': 'ok', commit: 'ok' } });
  const r2 = await startFakeConsole({ prompt: 'vyos@vyos:~$ ', responses: { configure: 'ok', 'set y': 'ok', commit: 'ok' } });
  const session = await makeSession({
    R1: { consoleHost: '127.0.0.1', consolePort: r1.port },
    R2: { consoleHost: '127.0.0.1', consolePort: r2.port },
  });
  const lab = { setupCommands: [
    { node: 'R1', commands: ['configure', 'set x', 'commit'] },
    { node: 'R2', commands: ['configure', 'set y', 'commit'] },
  ] };

  assert.equal(await ensureSetup(session, lab), 'done');
  assert.deepEqual(r1.commands, ['configure', 'set x', 'commit']);
  assert.deepEqual(r2.commands, ['configure', 'set y', 'commit']);

  const doc = await LabSession.findById(session._id);
  assert.equal(doc.setup.state, 'done');

  // เรียกซ้ำ (poll รอบถัดไป) — done ทันที ไม่รันคำสั่งซ้ำ
  assert.equal(await ensureSetup(doc, lab), 'done');
  assert.equal(r1.commands.length, 3);

  await r1.close(); await r2.close();
});

test('failure retries via idle, then "failed" after 3 attempts', opts, async () => {
  const dead = await closedPort();
  const session = await makeSession({ R1: { consoleHost: '127.0.0.1', consolePort: dead } });
  const lab = { setupCommands: [{ node: 'R1', commands: ['configure'] }] };

  // ครั้งที่ 1-2 → กลับเป็น idle (จะถูกลองใหม่), ครั้งที่ 3 → failed ถาวร
  assert.equal(await ensureSetup(await LabSession.findById(session._id), lab), 'idle');
  assert.equal(await ensureSetup(await LabSession.findById(session._id), lab), 'idle');
  assert.equal(await ensureSetup(await LabSession.findById(session._id), lab), 'failed');
  assert.equal(await ensureSetup(await LabSession.findById(session._id), lab), 'failed');

  const doc = await LabSession.findById(session._id);
  assert.equal(doc.setup.attempts, 3);
});

test('unknown setup node fails without crashing', opts, async () => {
  const session = await makeSession({});
  const lab = { setupCommands: [{ node: 'GHOST', commands: ['configure'] }] };
  assert.equal(await ensureSetup(session, lab), 'idle'); // attempt 1 failed → retryable
});

test('a poll that finds state already "running" returns early without re-running', opts, async () => {
  const fake = await startFakeConsole({ prompt: '$ ', responses: { ok: 'ok' } });
  const session = await makeSession({ R1: { consoleHost: '127.0.0.1', consolePort: fake.port } });
  await LabSession.updateOne({ _id: session._id }, { $set: { 'setup.state': 'running' } });
  const lab = { setupCommands: [{ node: 'R1', commands: ['ok'] }] };

  // อีก poll หนึ่งเห็น running อยู่แล้ว → คืนทันที ไม่แตะ console
  assert.equal(await ensureSetup(await LabSession.findById(session._id), lab), 'running');
  assert.equal(fake.commands.length, 0);
  await fake.close();
});

test('the atomic claim lets only one of two simultaneous polls run the commands', opts, async () => {
  const fake = await startFakeConsole({ prompt: '$ ', responses: { ok: 'ok' } });
  const session = await makeSession({ R1: { consoleHost: '127.0.0.1', consolePort: fake.port } });
  const lab = { setupCommands: [{ node: 'R1', commands: ['ok'] }] };

  // ยิงสอง poll พร้อมกันด้วย doc คนละสำเนา — claim เป็น atomic หนึ่งเดียวเท่านั้นที่ได้รัน
  const [a, b] = await Promise.all([
    ensureSetup(await LabSession.findById(session._id), lab),
    ensureSetup(await LabSession.findById(session._id), lab),
  ]);
  assert.deepEqual([a, b].filter((s) => s === 'done').length >= 1, true);
  assert.ok(a === 'running' || b === 'running' || a === 'done' || b === 'done');
  assert.deepEqual(fake.commands, ['ok']); // รันคำสั่งครั้งเดียวเท่านั้น
  await fake.close();
});
