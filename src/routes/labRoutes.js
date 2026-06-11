import express from 'express';
import mongoose from 'mongoose';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import Course from '../models/Course.js';
import requireAuth from '../middleware/requireAuth.js';
import { runChecks } from '../services/gradingService.js';
import { markComplete } from '../models/Progress.js';
import LabAttempt from '../models/LabAttempt.js';
import * as labSessions from '../services/labSessionService.js';
import { checkPrerequisites } from '../utils/prereqs.js';

const router = express.Router();

// Starting a lab spins up real QEMU VMs on the GNS3 server — by far the most
// expensive endpoint we have, so cap how often one user can hit it.
const startLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.session.user ? String(req.session.user.id) : ipKeyGenerator(req.ip)),
  handler: (req, res) => res.status(429).json({ ok: false, error: 'เริ่ม Lab ถี่เกินไป — กรุณารอสักครู่แล้วลองใหม่' }),
});

// Resolve a lab lesson (type === 'lab') from course/module/lesson indices.
async function locateLab(courseId, m, l) {
  if (!mongoose.isValidObjectId(courseId)) return {};
  const course = await Course.findById(courseId);
  if (!course) return {};
  const lesson = course.modules?.[m]?.lessons?.[l];
  if (!lesson || lesson.type !== 'lab') return { course };
  return { course, lab: lesson };
}

// Does the user's persisted session belong to this exact lab?
function matchesLab(session, courseId, m, l) {
  return !!session
    && String(session.course) === String(courseId)
    && session.moduleIdx === m
    && session.lessonIdx === l;
}

// GET /lab/:courseId/:m/:l — render the lab page
router.get('/:courseId/:m/:l', requireAuth, async (req, res) => {
  const { courseId } = req.params;
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const { course, lab } = await locateLab(courseId, m, l);
  if (!course) return res.redirect('/courses');
  if (!lab) return res.redirect(`/courses/${courseId}`);

  const { met } = await checkPrerequisites(req.session.user.id, course);
  if (!met) return res.redirect(`/courses/${courseId}`);

  res.render('lab.njk', { course, lab, m, l });
});

// POST /lab/:courseId/:m/:l/start — provision GNS3 lab
router.post('/:courseId/:m/:l/start', requireAuth, startLimiter, async (req, res) => {
  const { courseId } = req.params;
  const m = Number(req.params.m);
  const l = Number(req.params.l);

  try {
    const { course, lab } = await locateLab(courseId, m, l);
    if (!lab) return res.status(404).json({ ok: false, error: 'Lab not found.' });

    const { met } = await checkPrerequisites(req.session.user.id, course);
    if (!met) return res.status(403).json({ ok: false, error: 'โปรดเรียนคอร์สพื้นฐานให้ครบก่อน' });

    const session = await labSessions.startSession(req.session.user.id, courseId, m, l, lab);
    res.json({ ok: true, gns3Url: session.webUiUrl });
  } catch (err) {
    if (err instanceof labSessions.LabBusyError) {
      return res.status(409).json({ ok: false, error: err.message });
    }
    req.log.error({ err }, 'GNS3 buildLab failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /lab/:courseId/:m/:l/status — heartbeat + boot progress for the lab page.
// The page polls this: every hit bumps lastActivityAt (so the idle sweeper
// only reaps abandoned labs), and for the matching ready session it probes
// which node consoles answer yet.
router.get('/:courseId/:m/:l/status', requireAuth, async (req, res) => {
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const session = await labSessions.getSession(req.session.user.id);
  if (!session) return res.json({ ok: true, active: false });

  await labSessions.touch(req.session.user.id);
  const sameLab = matchesLab(session, req.params.courseId, m, l);
  if (!sameLab || session.status !== 'ready') {
    return res.json({ ok: true, active: true, sameLab, status: session.status });
  }

  const boot = await labSessions.probeBoot(session);
  res.json({ ok: true, active: true, sameLab: true, status: 'ready', gns3Url: session.webUiUrl, ...boot });
});

// POST /lab/:courseId/:m/:l/grade — run automated grading checks
router.post('/:courseId/:m/:l/grade', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { courseId } = req.params;
  const m = Number(req.params.m);
  const l = Number(req.params.l);

  // Grade only the lab that is actually running — node names (R1, PC1, …)
  // repeat across labs, so another lab's checks could falsely pass against
  // this topology.
  const session = await labSessions.getSession(userId);
  if (!matchesLab(session, courseId, m, l) || session.status !== 'ready') {
    return res.status(409).json({ ok: false, error: 'Lab นี้ยังไม่ได้เริ่มทำงาน — กดเริ่ม Lab ก่อนตรวจคำตอบ' });
  }

  try {
    const { lab } = await locateLab(courseId, m, l);
    if (!lab) return res.status(404).json({ ok: false, error: 'Lab not found.' });
    if (!lab.gradingChecks?.length) {
      return res.json({ ok: true, score: 0, total: 0, results: [], message: 'No grading checks defined for this lab.' });
    }

    await labSessions.touch(userId);
    const { score, total, results } = await runChecks(session.nodes, lab.gradingChecks);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= 60;

    await Promise.all([
      passed
        ? markComplete(userId, courseId, m, l, 'lab', pct).catch((e) => req.log.error({ err: e }, 'progress save failed'))
        : null,
      LabAttempt.create({
        user: userId, course: courseId, moduleIdx: m, lessonIdx: l,
        pct, passed, score, total,
        results: results.map((r, i) => ({
          description: lab.gradingChecks[i]?.description || `ข้อ ${i + 1}`,
          passed: r.passed,
          points: r.points ?? 1,
        })),
      }).catch((e) => req.log.error({ err: e }, 'attempt save failed')),
    ]);

    res.json({ ok: true, score, total, results });
  } catch (err) {
    req.log.error({ err }, 'grading failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /lab/:courseId/:m/:l/history — last 20 grading attempts for this lab
router.get('/:courseId/:m/:l/history', requireAuth, async (req, res) => {
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const attempts = await LabAttempt.find({
    user: req.session.user.id,
    course: req.params.courseId,
    moduleIdx: m,
    lessonIdx: l,
  }).sort({ at: -1 }).limit(20).lean();
  res.json({ ok: true, attempts });
});

// POST /lab/stop — destroy GNS3 project and free resources
router.post('/stop', requireAuth, async (req, res) => {
  await labSessions.stopSession(req.session.user.id);
  res.json({ ok: true });
});

export default router;
