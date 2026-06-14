import LabSession from '../models/LabSession.js';
import * as gns3 from './gns3Service.js';
import { probeNode, runCommands } from './gradingService.js';
import { rollVariables, interpolateSetup } from './labVariables.js';
import logger from '../config/logger.js';

// Labs are ephemeral: every running session costs GNS3 RAM/CPU, so anything
// without a recent heartbeat (the lab page polls /status) gets torn down.
const IDLE_MINUTES      = Number(process.env.LAB_IDLE_MINUTES || 45);
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const BUILD_STALE_MS    = 5 * 60 * 1000;  // a 'building' doc older than this = crashed build, reclaimable
const ORPHAN_MIN_AGE_MS = 10 * 60 * 1000; // never reap GNS3 projects younger than this (build may be in flight)

// How many setup-injection attempts may fail before the lab latches 'failed'
// permanently (see ensureSetup). The boot probe only confirms a console/login
// prompt, but VyOS's config daemon (configure/commit) lags well behind it — and
// a duel boots 4 routers at once, so that lag is worst exactly there. A small
// budget latched 'failed' on a transient early-boot commit timeout and bricked
// the lab (a duel has no restart). Give it enough strikes to outlast the boot.
// Read per call (like maxConcurrent) so tests pick up an env override.
const setupMaxAttempts = () => Number(process.env.LAB_SETUP_MAX_ATTEMPTS || 8);

export class LabBusyError extends Error {}
export class LabCapacityError extends Error {}

// Global cap on concurrent lab sessions: every session is real QEMU VMs on the
// GNS3 host, so admission control is what keeps one classroom-sized burst from
// OOMing the box. Read per call so tests (and a restart after .env edits) pick
// it up; <= 0 disables the cap.
const maxConcurrent = () => Number(process.env.LAB_MAX_CONCURRENT || 10);

async function teardown(projectId) {
  if (!projectId) return;
  // Stop nodes before deleting: a bare DELETE on a project the controller no
  // longer holds in memory (closed lab tab dropped the notification socket, or
  // the server bounced) removes the project dir but orphans the spawned
  // ubridge/vpcs/qemu processes — they keep their NIO UDP ports, so the next
  // build's VPCS hits "Address already in use" and frames stop flowing.
  // Re-open so the controller re-attaches to the nodes, stop them (kills the
  // processes), then delete. Each step is best-effort: a project that is
  // already gone/closed just makes these 404 and we still try the delete.
  try { await gns3.openProject(projectId); }  catch {}
  try { await gns3.stopAllNodes(projectId); } catch {}
  try { await gns3.deleteProject(projectId); }
  catch (err) { logger.error({ err, projectId }, 'GNS3 deleteProject failed'); }
}

export function getSession(userId) {
  return LabSession.findOne({ user: userId });
}

// "ตอนนี้มีคนทำ Lab อยู่ N คน" for the catalog/dashboard. Counts ready
// sessions whose page heartbeat fired within the last 5 minutes; cached 60s
// so the public catalog can't hammer Mongo.
let activeCountCache = { n: 0, expiresAt: 0 };
export async function countActiveLabs() {
  if (Date.now() < activeCountCache.expiresAt) return activeCountCache.n;
  const n = await LabSession.countDocuments({
    status: 'ready',
    lastActivityAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) },
  });
  activeCountCache = { n, expiresAt: Date.now() + 60_000 };
  return n;
}

export function touch(userId) {
  return LabSession.updateOne({ user: userId }, { $set: { lastActivityAt: new Date() } });
}

/** บันทึกว่าผู้ใช้เปิดคำใบ้ index นี้ใน run ปัจจุบัน (idempotent ต่อใบ) */
export function recordHint(userId, idx) {
  return LabSession.updateOne(
    { user: userId },
    { $addToSet: { hintsUsed: idx }, $set: { lastActivityAt: new Date() } },
  );
}

/** บันทึกว่าผู้ใช้ถามพี่เลี้ยง AI ใน run นี้ (มีผลต่อโบนัส no-hint) */
export function markMentorUsed(userId) {
  return LabSession.updateOne({ user: userId }, { $set: { mentorUsed: true, lastActivityAt: new Date() } });
}

/**
 * Claim the user's single lab slot and build the topology.
 *
 * The claim is atomic: `status: 'building'` acts as a start lock (double-click
 * or a second tab gets LabBusyError instead of racing two builds), and the
 * unique `user` index turns a racing upsert into E11000. A build that never
 * finished (crash) is reclaimable after BUILD_STALE_MS.
 */
export async function startSession(userId, courseId, m, l, lab) {
  let prev;
  try {
    prev = await LabSession.findOneAndUpdate(
      {
        user: userId,
        $or: [
          { status: { $ne: 'building' } },
          { updatedAt: { $lt: new Date(Date.now() - BUILD_STALE_MS) } },
        ],
      },
      {
        $set: {
          course: courseId, moduleIdx: m, lessonIdx: l,
          status: 'building', projectId: null, webUiUrl: null,
          nodes: {}, bootedNodes: [], lastActivityAt: new Date(),
          hintsUsed: [], startedAt: new Date(),
          setup: { state: 'idle', attempts: 0 },
          vars: rollVariables(lab.variables), // mystery lab: สุ่มค่าต่อ attempt
        },
      },
      { upsert: true }, // default `new: false` → pre-update doc (null when inserted)
    );
  } catch (err) {
    if (err.code === 11000) throw new LabBusyError('Lab กำลังถูกสร้างอยู่ — กรุณารอสักครู่แล้วลองใหม่');
    throw err;
  }

  // Admission control, checked AFTER the claim so it is race-safe: a brand-new
  // session (no prev doc) bumped the global count by one — if that pushed us
  // past the cap, release the slot before any GNS3 work happens. Two racing
  // newcomers at the boundary may both back off (transient over-rejection);
  // the cap itself is never exceeded once builds start. A user rebuilding an
  // existing session doesn't change the count and is always admitted.
  const max = maxConcurrent();
  if (!prev && max > 0) {
    const active = await LabSession.countDocuments();
    if (active > max) {
      await LabSession.deleteOne({ user: userId, status: 'building' }).catch(() => {});
      throw new LabCapacityError(
        `ห้อง Lab เต็มชั่วคราว (กำลังถูกใช้งานครบ ${max} ห้อง) — กรุณารอสักครู่แล้วลองใหม่`,
      );
    }
  }

  await teardown(prev?.projectId); // one live lab per user

  try {
    const built = await gns3.buildLab(lab, lab.title); // { projectId, webUiUrl, nodes }
    return await LabSession.findOneAndUpdate(
      { user: userId },
      { $set: { ...built, status: 'ready', lastActivityAt: new Date() } },
      { new: true },
    );
  } catch (err) {
    await LabSession.deleteOne({ user: userId, status: 'building' }).catch(() => {});
    throw err;
  }
}

export async function stopSession(userId) {
  const doc = await LabSession.findOneAndDelete({ user: userId });
  await teardown(doc?.projectId);
  return !!doc;
}

/**
 * Probe consoles of nodes that haven't answered yet and remember the ones
 * that have (a booted node stays booted). VyOS takes 1–2 min to boot, so the
 * lab page polls this until allBooted before enabling the grade button.
 */
export async function probeBoot(session) {
  const names = Object.keys(session.nodes || {});
  const pending = names.filter((n) => !session.bootedNodes.includes(n));
  if (pending.length) {
    const up = (await Promise.all(pending.map(async (name) => {
      const { consoleHost, consolePort } = session.nodes[name] || {};
      return (await probeNode(consoleHost, consolePort)) ? name : null;
    }))).filter(Boolean);
    if (up.length) {
      await LabSession.updateOne({ _id: session._id }, { $addToSet: { bootedNodes: { $each: up } } });
      session.bootedNodes.push(...up);
    }
  }
  return {
    nodeCount: names.length,
    bootedCount: session.bootedNodes.length,
    allBooted: session.bootedNodes.length >= names.length,
  };
}

/**
 * จัดฉากโจทย์ troubleshoot: ฉีด setupCommands ลงอุปกรณ์หลังบูตครบ
 * (เรียกจาก status route เมื่อ allBooted) — claim แบบ atomic กันสอง poll
 * รันซ้อนกัน, ล้มได้ retry สูงสุด setupMaxAttempts() ครั้งแล้วค่อยถือว่า failed
 * (เผื่อ config daemon ของ VyOS ยังไม่พร้อมตอนเพิ่งบูต โดยเฉพาะใน duel ที่บูต
 * อุปกรณ์พร้อมกันหลายตัว)
 *
 * @returns {'none'|'idle'|'running'|'done'|'failed'} สถานะปัจจุบันของ setup
 */
export async function ensureSetup(session, lab) {
  const groups = lab?.setupCommands || [];
  if (!groups.length) return 'none';
  const state = session.setup?.state || 'idle';
  if (state === 'done' || state === 'failed' || state === 'running') return state;

  const claimed = await LabSession.findOneAndUpdate(
    { _id: session._id, 'setup.state': 'idle' },
    { $set: { 'setup.state': 'running' }, $inc: { 'setup.attempts': 1 } },
    { new: true },
  );
  if (!claimed) return 'running'; // poll อื่นกำลังทำอยู่

  try {
    // mystery lab: แทนค่าโทเคน {{NAME}} ในคำสั่ง setup ด้วยค่าที่สุ่มไว้ของ session
    const staged = interpolateSetup(groups, session.vars || {});
    for (const group of staged) {
      const info = session.nodes?.[group.node];
      if (!info?.consolePort) throw new Error(`setup node "${group.node}" not found in session`);
      await runCommands(info.consoleHost, info.consolePort, group.node, group.commands);
    }
    await LabSession.updateOne({ _id: session._id }, { $set: { 'setup.state': 'done' } });
    return 'done';
  } catch (err) {
    const failedForGood = (claimed.setup?.attempts || 1) >= setupMaxAttempts();
    logger.error({ err, attempts: claimed.setup?.attempts }, 'lab setup injection failed');
    await LabSession.updateOne(
      { _id: session._id },
      { $set: { 'setup.state': failedForGood ? 'failed' : 'idle' } },
    );
    return failedForGood ? 'failed' : 'idle';
  }
}

// ── Sweeper ───────────────────────────────────────────────────────────────────

export async function sweepIdle() {
  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60 * 1000);
  const stale = await LabSession.find({ lastActivityAt: { $lt: cutoff } });
  for (const doc of stale) {
    logger.info({ projectId: doc.projectId, user: String(doc.user) }, `lab-sweeper: idle > ${IDLE_MINUTES}min, tearing down`);
    await teardown(doc.projectId);
    await LabSession.deleteOne({ _id: doc._id });
  }
}

// Fetch the GNS3 project list once; callers share it so a sweep cycle hits the
// server only once. Returns null (not []) when GNS3 is unreachable so callers
// can tell "no projects" from "couldn't ask" and skip destructive reconcile.
async function listProjects() {
  try { return await gns3.getProjects(); }
  catch (err) { logger.warn({ err }, 'lab-sweeper: GNS3 unreachable'); return null; }
}

// Reap pingable_* projects on the GNS3 server that no session references
// (crashed builds, projects from before sessions were persisted). Project
// names embed their creation time (pingable_<ms>_<title>), so fresh projects
// whose session doc may not carry a projectId yet are left alone.
export async function sweepOrphans(projects) {
  if (projects === undefined) projects = await listProjects();
  if (!projects) return;

  const known = new Set((await LabSession.find().select('projectId')).map((d) => d.projectId));
  for (const p of projects) {
    const stamp = /^pingable_(\d+)_/.exec(p.name || '')?.[1];
    if (!stamp || known.has(p.project_id)) continue;
    if (Date.now() - Number(stamp) < ORPHAN_MIN_AGE_MS) continue;
    logger.info({ project: p.name }, 'lab-sweeper: deleting orphaned project');
    await teardown(p.project_id);
  }
}

// Drop sessions whose GNS3 project has vanished (deleted out-of-band, or the
// GNS3 server came back with a fresh data dir / a stale process from a previous
// instance was killed). The lab page would otherwise resume a phantom project
// forever — /status telnets consoles that no longer exist, so it never reaches
// allBooted and the grade button stays locked. Dropping the doc lets the next
// start rebuild cleanly. Only 'ready' sessions with a projectId are checked: a
// 'building' doc owns the start lock and has no projectId yet.
export async function sweepStaleSessions(projects) {
  if (projects === undefined) projects = await listProjects();
  if (!projects) return;

  const live = new Set(projects.map((p) => p.project_id));
  const sessions = await LabSession.find({ status: 'ready', projectId: { $ne: null } });
  for (const doc of sessions) {
    if (live.has(doc.projectId)) continue;
    logger.info({ projectId: doc.projectId, user: String(doc.user) },
      'lab-sweeper: GNS3 project vanished, dropping stale session');
    await LabSession.deleteOne({ _id: doc._id });
  }
}

/** Start the periodic sweep (also runs once at startup to reconcile after a restart). */
export function startSweeper() {
  const run = async () => {
    try {
      await sweepIdle();
      const projects = await listProjects(); // one fetch shared by both reconciles
      await sweepStaleSessions(projects);
      await sweepOrphans(projects);
    } catch (err) {
      logger.error({ err }, 'lab-sweeper failed');
    }
  };
  run();
  setInterval(run, SWEEP_INTERVAL_MS).unref();
}
