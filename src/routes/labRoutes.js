import express from 'express';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import Course from '../models/Course.js';
import requireAuth from '../middleware/requireAuth.js';
import { runChecks } from '../services/gradingService.js';
import { markComplete, getProgress } from '../models/Progress.js';
import { maybeIssue } from '../services/certificateService.js';
import LabAttempt from '../models/LabAttempt.js';
import * as labSessions from '../services/labSessionService.js';
import { award } from '../services/achievementService.js';
import { interpolate, interpolateExpect } from '../services/labVariables.js';
import { askMentor, mentorEnabled } from '../services/mentorService.js';
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

// GET /lab/shared/:token — public read-only view of a shared grading attempt
router.get('/shared/:token', async (req, res) => {
  const attempt = await LabAttempt.findOne({ shareToken: req.params.token }).lean();
  if (!attempt) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผลการตรวจ หรือลิงก์นี้ถูกยกเลิกแล้ว' });
  const course = await Course.findById(attempt.course).select('title modules').lean();
  const labTitle = course?.modules?.[attempt.moduleIdx]?.lessons?.[attempt.lessonIdx]?.title || '';
  res.render('lab-shared.njk', { attempt, course, labTitle });
});

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
    if (err instanceof labSessions.LabCapacityError) {
      // ทุกห้อง Lab ถูกใช้งานอยู่ — ไม่ใช่ข้อผิดพลาดของผู้ใช้ ให้ลองใหม่ทีหลัง
      return res.status(503).set('Retry-After', '60').json({ ok: false, error: err.message });
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

  // โจทย์ troubleshoot: หลังบูตครบค่อยฉีด config "ที่พังมาแล้ว" — ระหว่างนั้น
  // ปุ่มตรวจฝั่งหน้าเว็บยังล็อกอยู่ (setup: running)
  let setup = 'none';
  if (boot.allBooted) {
    const { lab } = await locateLab(req.params.courseId, m, l);
    setup = await labSessions.ensureSetup(session, lab);
  }

  // ส่ง vars ของ mystery lab ให้หน้าเว็บแทนค่าโทเคนในเป้าหมาย/คำใบ้ที่แสดงอยู่
  const vars = session.vars && Object.keys(session.vars).length ? session.vars : undefined;
  res.json({ ok: true, active: true, sameLab: true, status: 'ready', gns3Url: session.webUiUrl, ...boot, setup, vars });
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
    const { course, lab } = await locateLab(courseId, m, l);
    if (!lab) return res.status(404).json({ ok: false, error: 'Lab not found.' });
    if (!lab.gradingChecks?.length) {
      return res.json({ ok: true, score: 0, total: 0, results: [], message: 'No grading checks defined for this lab.' });
    }
    // โจทย์ troubleshoot ห้ามตรวจก่อนจัดฉากเสร็จ — ไม่งั้นตรวจบนระบบที่ยังไม่พัง
    if (lab.setupCommands?.length && session.setup?.state !== 'done') {
      return res.status(409).json({ ok: false, error: 'กำลังจัดฉากโจทย์อยู่ — รอสักครู่แล้วลองตรวจใหม่' });
    }

    await labSessions.touch(userId);
    // mystery lab: แทนค่าโทเคนใน expect ด้วยค่าที่สุ่มไว้ (escape ก่อนแปะลง regex)
    const checks = lab.variables?.length
      ? lab.gradingChecks.map((c) => ({ ...c.toObject?.() ?? c, expect: interpolateExpect(c.expect, session.vars || {}) }))
      : lab.gradingChecks;
    const { score, total, results } = await runChecks(session.nodes, checks);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= (lab.passThreshold ?? 60);
    // ถามพี่เลี้ยง AI นับเป็นการใช้คำใบ้รูปแบบหนึ่ง — สละโบนัส no-hint เช่นกัน
    const hintsUsed = (session.hintsUsed?.length || 0) + (session.mentorUsed ? 1 : 0);

    // ประวัติ "ก่อน" บันทึก attempt รอบนี้ — ใช้ตัดสิน one-shot / comeback
    const where = { user: userId, course: courseId, moduleIdx: m, lessonIdx: l };
    const [priorAttempts, priorFails] = await Promise.all([
      LabAttempt.countDocuments(where),
      LabAttempt.countDocuments({ ...where, passed: false }),
    ]);

    let firstCompletion = false;
    if (passed) {
      firstCompletion = (await markComplete(userId, courseId, m, l, 'lab', pct)
        .catch((e) => { req.log.error({ err: e }, 'progress save failed'); return null; }))?.inserted ?? false;
      // Passing a lab can complete the course (esp. the Boss Lab) → issue cert.
      const progress = await getProgress(userId, courseId);
      await maybeIssue(userId, course, progress)
        .catch((e) => req.log.error({ err: e }, 'certificate issue failed'));
    }
    await LabAttempt.create({
      user: userId, course: courseId, moduleIdx: m, lessonIdx: l,
      pct, passed, score, total, hintsUsed,
      results: results.map((r, i) => ({
        description: lab.gradingChecks[i]?.description || `ข้อ ${i + 1}`,
        passed: r.passed,
        points: r.points ?? 1,
      })),
    }).catch((e) => req.log.error({ err: e }, 'attempt save failed'));

    // Streak/XP/badges — สถิติพังต้องไม่ล้มการตรวจ จึง catch ทิ้งเสมอ
    const gamify = await award(userId, 'grade', {
      courseId, moduleIdx: m, lessonIdx: l,
      pct, passed, firstCompletion,
      passedChecks: results.filter((r) => r.passed).length,
      attemptNumber: priorAttempts + 1,
      failedBefore: priorFails,
      hintsUsed,
      durationMin: session.startedAt ? (Date.now() - new Date(session.startedAt).getTime()) / 60000 : null,
      estMinutes: lab.estMinutes || 0,
    }).catch((e) => { req.log.error({ err: e }, 'achievement award failed'); return null; });

    // Failed checks carry their human-written hint; `expect` itself never
    // leaves the server (it is the answer — trivially satisfiable with echo).
    res.json({
      ok: true, score, total, gamify,
      results: results.map((r, i) => (r.passed ? r : { ...r, failHint: interpolate(lab.gradingChecks[i]?.failHint, session.vars || {}) })),
    });
  } catch (err) {
    req.log.error({ err }, 'grading failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /lab/:courseId/:m/:l/hint/:idx — เปิดคำใบ้ "แบบมีราคา"
// เนื้อคำใบ้ไม่ถูกฝังใน HTML ของหน้า (เปิด devtools อ่านฟรีไม่ได้) — ต้องขอ
// ผ่าน endpoint นี้ซึ่งบันทึกการใช้ลง session ฝั่ง server เพื่อให้โบนัส
// no-hint เชื่อถือได้ การขอใบเดิมซ้ำไม่โดนหักเพิ่ม ($addToSet)
router.post('/:courseId/:m/:l/hint/:idx', requireAuth, async (req, res) => {
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const idx = Number(req.params.idx);

  const { lab } = await locateLab(req.params.courseId, m, l);
  if (!lab) return res.status(404).json({ ok: false, error: 'Lab not found.' });
  if (!Number.isInteger(idx) || idx < 0 || idx >= (lab.hints?.length || 0)) {
    return res.status(400).json({ ok: false, error: 'invalid hint index' });
  }

  const session = await labSessions.getSession(req.session.user.id);
  if (!matchesLab(session, req.params.courseId, m, l)) {
    return res.status(409).json({ ok: false, error: 'เริ่ม Lab ก่อนจึงจะเปิดคำใบ้ได้' });
  }

  await labSessions.recordHint(req.session.user.id, idx);
  res.json({ ok: true, hint: interpolate(lab.hints[idx], session.vars || {}) }); // mystery: แทนค่าจริงของผู้เรียน
});

// POST /lab/:courseId/:m/:l/mentor — ขอคำแนะนำแบบโสเครติสจากพี่เลี้ยง AI (§22)
// Feature-flag ด้วย ANTHROPIC_API_KEY; rate-limit 5 ครั้ง/lab/วัน ต่อ user (in-memory)
// ส่ง context เฉพาะข้อที่ fail + output จริง — ไม่ส่ง expect regex (เฉลย) เด็ดขาด
const MENTOR_DAILY_CAP = 5;
const mentorUsage = new Map(); // `${userId}:${c}:${m}:${l}:${YYYY-MM-DD}` -> count
router.post('/:courseId/:m/:l/mentor', requireAuth, async (req, res) => {
  if (!mentorEnabled()) return res.status(503).json({ ok: false, error: 'ยังไม่ได้เปิดใช้พี่เลี้ยง AI' });
  const userId = req.session.user.id;
  const { courseId } = req.params;
  const m = Number(req.params.m);
  const l = Number(req.params.l);

  const session = await labSessions.getSession(userId);
  if (!matchesLab(session, courseId, m, l) || session.status !== 'ready') {
    return res.status(409).json({ ok: false, error: 'เริ่ม Lab และกดตรวจก่อนจึงจะขอคำแนะนำได้' });
  }

  // rate-limit ต่อ lab ต่อวัน (เวลาไทย)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  const key = `${userId}:${courseId}:${m}:${l}:${day}`;
  const used = mentorUsage.get(key) || 0;
  if (used >= MENTOR_DAILY_CAP) {
    return res.status(429).json({ ok: false, error: `วันนี้ขอคำแนะนำสำหรับแล็บนี้ครบ ${MENTOR_DAILY_CAP} ครั้งแล้ว — ลองคิดต่อเองดูนะ` });
  }

  // failed checks มาจาก client (ผล grade ล่าสุด) — เชื่อแค่ description+output เพื่อสร้าง context
  const failed = Array.isArray(req.body?.failed) ? req.body.failed.slice(0, 8).map((f) => ({
    description: String(f.description || '').slice(0, 200),
    output: String(f.output || '').slice(0, 400),
  })) : [];
  if (!failed.length) return res.status(400).json({ ok: false, error: 'ไม่มีข้อที่ต้องช่วย' });

  try {
    const { lab } = await locateLab(courseId, m, l);
    const hint = await askMentor({
      labTitle: lab?.title || 'แล็บ',
      objectives: (lab?.objectives || []).map((o) => interpolate(o, session.vars || {})),
      failed,
    });
    mentorUsage.set(key, used + 1);
    // นับเป็นการใช้คำใบ้ — สละโบนัส no-hint ตอน grade
    await labSessions.markMentorUsed(userId).catch(() => {});
    res.json({ ok: true, hint, remaining: MENTOR_DAILY_CAP - used - 1 });
  } catch (err) {
    req.log.error({ err }, 'mentor request failed');
    res.status(502).json({ ok: false, error: 'พี่เลี้ยง AI ไม่ว่างชั่วคราว — ลองใหม่อีกครั้ง' });
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

// POST /lab/:courseId/:m/:l/share — generate (or return existing) share link for an attempt
router.post('/:courseId/:m/:l/share', requireAuth, async (req, res) => {
  const { attemptId } = req.body;
  if (!attemptId || !mongoose.isValidObjectId(attemptId)) {
    return res.status(400).json({ ok: false, error: 'invalid attemptId' });
  }
  const attempt = await LabAttempt.findOne({ _id: attemptId, user: req.session.user.id });
  if (!attempt) return res.status(404).json({ ok: false, error: 'not found' });
  if (!attempt.shareToken) {
    attempt.shareToken = randomBytes(16).toString('hex');
    await attempt.save();
  }
  res.json({ ok: true, url: `/lab/shared/${attempt.shareToken}` });
});

// POST /lab/stop — destroy GNS3 project and free resources
router.post('/stop', requireAuth, async (req, res) => {
  await labSessions.stopSession(req.session.user.id);
  res.json({ ok: true });
});

export default router;
