import LabSession from '../models/LabSession.js';
import * as gns3 from './gns3Service.js';
import { probeNode } from './gradingService.js';
import logger from '../config/logger.js';

// Labs are ephemeral: every running session costs GNS3 RAM/CPU, so anything
// without a recent heartbeat (the lab page polls /status) gets torn down.
const IDLE_MINUTES      = Number(process.env.LAB_IDLE_MINUTES || 45);
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const BUILD_STALE_MS    = 5 * 60 * 1000;  // a 'building' doc older than this = crashed build, reclaimable
const ORPHAN_MIN_AGE_MS = 10 * 60 * 1000; // never reap GNS3 projects younger than this (build may be in flight)

export class LabBusyError extends Error {}
export class LabCapacityError extends Error {}

// Global cap on concurrent lab sessions: every session is real QEMU VMs on the
// GNS3 host, so admission control is what keeps one classroom-sized burst from
// OOMing the box. Read per call so tests (and a restart after .env edits) pick
// it up; <= 0 disables the cap.
const maxConcurrent = () => Number(process.env.LAB_MAX_CONCURRENT || 10);

async function teardown(projectId) {
  if (!projectId) return;
  try { await gns3.deleteProject(projectId); }
  catch (err) { logger.error({ err, projectId }, 'GNS3 deleteProject failed'); }
}

export function getSession(userId) {
  return LabSession.findOne({ user: userId });
}

export function touch(userId) {
  return LabSession.updateOne({ user: userId }, { $set: { lastActivityAt: new Date() } });
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

// Reap pingable_* projects on the GNS3 server that no session references
// (crashed builds, projects from before sessions were persisted). Project
// names embed their creation time (pingable_<ms>_<title>), so fresh projects
// whose session doc may not carry a projectId yet are left alone.
export async function sweepOrphans() {
  let projects;
  try { projects = await gns3.getProjects(); }
  catch (err) { logger.warn({ err }, 'lab-sweeper: GNS3 unreachable'); return; }

  const known = new Set((await LabSession.find().select('projectId')).map((d) => d.projectId));
  for (const p of projects || []) {
    const stamp = /^pingable_(\d+)_/.exec(p.name || '')?.[1];
    if (!stamp || known.has(p.project_id)) continue;
    if (Date.now() - Number(stamp) < ORPHAN_MIN_AGE_MS) continue;
    logger.info({ project: p.name }, 'lab-sweeper: deleting orphaned project');
    await teardown(p.project_id);
  }
}

/** Start the periodic sweep (also runs once at startup to reconcile after a restart). */
export function startSweeper() {
  const run = () =>
    sweepIdle().then(sweepOrphans).catch((err) => logger.error({ err }, 'lab-sweeper failed'));
  run();
  setInterval(run, SWEEP_INTERVAL_MS).unref();
}
