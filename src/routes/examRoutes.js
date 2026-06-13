// /exam — Exam Simulator (§21): ทำ lab ต่อเนื่องทีละข้อภายใต้เวลาจำกัด
// ขับ LabSession เดียวของผู้ใช้: เริ่มข้อแรก → grade/skip → stop+start ข้อถัดไป
// เวลาเป็น server-authoritative (เช็ก startedAt+limit ทุกครั้ง timer ฝั่ง client
// เป็นแค่จอแสดงผล) ไม่มี hint ไม่มี failHint เห็นแค่ผ่าน/ไม่ผ่านรายข้อ

import express from 'express';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import Course from '../models/Course.js';
import ExamAttempt from '../models/ExamAttempt.js';
import { EXAMS, examList } from '../config/exams.js';
import * as labSessions from '../services/labSessionService.js';
import { runChecks } from '../services/gradingService.js';
import { interpolateExpect } from '../services/labVariables.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

const activeAttempt = (userId) => ExamAttempt.findOne({ user: userId, state: 'running' });

// แปลง {slug,m,l} ของ exam config เป็น lab จริง + snapshot ชื่อ (null ถ้าหาไม่เจอ)
async function resolveLabs(def) {
  const slugs = [...new Set(def.labs.map((x) => x.slug))];
  const courses = await Course.find({ slug: { $in: slugs } }).select('slug title modules').lean();
  const bySlug = new Map(courses.map((c) => [c.slug, c]));
  const out = [];
  for (const ref of def.labs) {
    const c = bySlug.get(ref.slug);
    const lesson = c?.modules?.[ref.m]?.lessons?.[ref.l];
    if (!c || !lesson || lesson.type !== 'lab') return null; // ชุดสอบพัง — ปฏิเสธทั้งชุด
    out.push({ course: c._id, moduleIdx: ref.m, lessonIdx: ref.l, title: lesson.title, status: 'pending' });
  }
  return out;
}

function locateLessonLab(course, m, l) {
  const lesson = course?.modules?.[m]?.lessons?.[l];
  return lesson && lesson.type === 'lab' ? lesson : null;
}

// เริ่ม lab ของข้อ idx (teardown ของเดิมเกิดใน startSession อยู่แล้ว)
async function startLabFor(userId, attempt) {
  const ref = attempt.labs[attempt.currentIdx];
  const course = await Course.findById(ref.course);
  const lab = locateLessonLab(course, ref.moduleIdx, ref.lessonIdx);
  if (!lab) throw new Error('exam lab missing');
  return labSessions.startSession(userId, String(ref.course), ref.moduleIdx, ref.lessonIdx, lab);
}

// จบการสอบ: คิดคะแนนรวม (ทุกข้อถ่วงน้ำหนักเท่ากัน), หยุด lab, ปิด attempt
async function finalize(userId, attempt, state = 'done') {
  const passed = attempt.labs.filter((x) => x.status === 'passed').length;
  attempt.finalPct = Math.round((passed / attempt.labs.length) * 100);
  attempt.durationSec = Math.round((Date.now() - attempt.startedAt.getTime()) / 1000);
  attempt.state = state;
  await attempt.save();
  await labSessions.stopSession(userId).catch(() => {});
  return attempt;
}

// GET /exam — รายการชุดสอบ หรือ ลิงก์เข้าห้องสอบที่ค้างอยู่
router.get('/', async (req, res) => {
  const attempt = await activeAttempt(req.session.user.id);
  res.render('exam-index.njk', { exams: examList(), active: attempt });
});

// POST /exam/start — สร้าง attempt แล้วเริ่มข้อแรก
router.post('/start', async (req, res) => {
  const def = EXAMS[String(req.body.examId)];
  if (!def) return res.redirect('/exam');
  if (await activeAttempt(req.session.user.id)) return res.redirect('/exam/run'); // มีสอบค้างอยู่

  const labs = await resolveLabs(def);
  if (!labs) return res.status(500).render('error.njk', { code: 500, message: 'ชุดสอบนี้ยังไม่พร้อม (อ้างถึง lab ที่ไม่มี) — แจ้งผู้ดูแล' });

  const attempt = await ExamAttempt.create({
    user: req.session.user.id, examId: def.id, title: def.title,
    labs, timeLimitMin: def.timeLimitMin, startedAt: new Date(),
  });
  try {
    await startLabFor(req.session.user.id, attempt);
  } catch (err) {
    if (err instanceof labSessions.LabCapacityError) {
      await ExamAttempt.deleteOne({ _id: attempt._id });
      return res.status(503).render('error.njk', { code: 503, message: 'ห้อง Lab เต็มชั่วคราว — เริ่มสอบใหม่อีกครั้งในภายหลัง' });
    }
    req.log.error({ err }, 'exam start lab failed');
  }
  res.redirect('/exam/run');
});

// GET /exam/run — ห้องสอบ: ข้อปัจจุบัน + เวลาที่เหลือ + iframe ของ lab
router.get('/run', async (req, res) => {
  const attempt = await activeAttempt(req.session.user.id);
  if (!attempt) return res.redirect('/exam');

  // หมดเวลา → ปิดสอบทันที
  if (attempt.secondsLeft() <= 0) {
    await finalize(req.session.user.id, attempt, 'expired');
    return res.redirect(`/exam/result/${attempt._id}`);
  }

  const ref = attempt.labs[attempt.currentIdx];
  let session = await labSessions.getSession(req.session.user.id);
  const matches = session && String(session.course) === String(ref.course)
    && session.moduleIdx === ref.moduleIdx && session.lessonIdx === ref.lessonIdx;
  if (!matches) { // session หาย (ถูก sweep/หลุด) — เริ่มข้อปัจจุบันใหม่
    try { session = await startLabFor(req.session.user.id, attempt); } catch (err) { req.log.error({ err }, 'exam resume failed'); }
  }

  res.render('exam-run.njk', {
    attempt,
    current: ref,
    number: attempt.currentIdx + 1,
    total: attempt.labs.length,
    secondsLeft: attempt.secondsLeft(),
    gns3Url: session?.webUiUrl || null,
  });
});

// status สำหรับหน้า exam-run (เบากว่า lab status — แค่บูต + เวลา)
router.get('/run/status', async (req, res) => {
  const attempt = await activeAttempt(req.session.user.id);
  if (!attempt) return res.json({ ok: true, done: true });
  if (attempt.secondsLeft() <= 0) {
    await finalize(req.session.user.id, attempt, 'expired');
    return res.json({ ok: true, expired: true });
  }
  const session = await labSessions.getSession(req.session.user.id);
  let boot = { allBooted: false, setup: 'none' };
  if (session?.status === 'ready') {
    const b = await labSessions.probeBoot(session);
    const { lab } = await locateLabFromSession(session);
    const setup = b.allBooted && lab ? await labSessions.ensureSetup(session, lab) : 'none';
    boot = { ...b, setup, gns3Url: session.webUiUrl };
  }
  await labSessions.touch(req.session.user.id);
  res.json({ ok: true, secondsLeft: attempt.secondsLeft(), ...boot });
});

async function locateLabFromSession(session) {
  const course = await Course.findById(session.course);
  return { lab: locateLessonLab(course, session.moduleIdx, session.lessonIdx) };
}

// POST /exam/grade — ตรวจข้อปัจจุบัน → บันทึกผล → ไปข้อถัดไป (หรือจบ)
// POST /exam/skip  — ข้ามข้อปัจจุบัน (นับเป็นไม่ผ่าน) → ไปข้อถัดไป
async function advance(req, res, { skip }) {
  const userId = req.session.user.id;
  const attempt = await activeAttempt(userId);
  if (!attempt) return res.json({ ok: false, error: 'ไม่มีการสอบที่กำลังดำเนินอยู่' });
  if (attempt.secondsLeft() <= 0) {
    await finalize(userId, attempt, 'expired');
    return res.json({ ok: true, expired: true, resultUrl: `/exam/result/${attempt._id}` });
  }

  const ref = attempt.labs[attempt.currentIdx];
  if (skip) {
    ref.status = 'skipped';
  } else {
    const session = await labSessions.getSession(userId);
    const matches = session && String(session.course) === String(ref.course)
      && session.moduleIdx === ref.moduleIdx && session.lessonIdx === ref.lessonIdx && session.status === 'ready';
    if (!matches) return res.json({ ok: false, error: 'Lab ข้อนี้ยังไม่พร้อม — รอสักครู่' });
    if (session.setup && ref && (await needsSetupGate(session))) {
      return res.json({ ok: false, error: 'กำลังจัดฉากโจทย์ — รอสักครู่แล้วลองตรวจใหม่' });
    }
    const { lab } = await locateLabFromSession(session);
    const checks = lab?.variables?.length
      ? lab.gradingChecks.map((c) => ({ ...c.toObject?.() ?? c, expect: interpolateExpect(c.expect, session.vars || {}) }))
      : (lab?.gradingChecks || []);
    const { score, total } = await runChecks(session.nodes, checks);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    ref.pct = pct;
    ref.status = pct >= (lab?.passThreshold ?? 60) ? 'passed' : 'failed';
  }

  // ไปข้อถัดไป หรือ จบสอบ
  if (attempt.currentIdx + 1 >= attempt.labs.length) {
    await finalize(userId, attempt, 'done');
    return res.json({ ok: true, done: true, resultUrl: `/exam/result/${attempt._id}` });
  }
  attempt.currentIdx += 1;
  await attempt.save();
  try { await startLabFor(userId, attempt); } catch (err) { req.log.error({ err }, 'exam next lab failed'); }
  res.json({ ok: true, next: attempt.currentIdx + 1, total: attempt.labs.length });
}

async function needsSetupGate(session) {
  const { lab } = await locateLabFromSession(session);
  return lab?.setupCommands?.length && session.setup?.state !== 'done';
}

router.post('/grade', (req, res) => advance(req, res, { skip: false }));
router.post('/skip', (req, res) => advance(req, res, { skip: true }));

// POST /exam/abandon — ยอมแพ้กลางคัน: จบด้วยผลเท่าที่ทำได้
router.post('/abandon', async (req, res) => {
  const attempt = await activeAttempt(req.session.user.id);
  if (attempt) await finalize(req.session.user.id, attempt, 'done');
  res.json({ ok: true, resultUrl: attempt ? `/exam/result/${attempt._id}` : '/exam' });
});

// GET /exam/result/:id — รายงานผล (เจ้าของเท่านั้น)
router.get('/result/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/exam');
  const attempt = await ExamAttempt.findOne({ _id: req.params.id, user: req.session.user.id }).lean();
  if (!attempt) return res.redirect('/exam');
  res.render('exam-result.njk', { attempt });
});

// POST /exam/result/:id/share — สร้างลิงก์แชร์ผล
router.post('/result/:id/share', async (req, res) => {
  const attempt = await ExamAttempt.findOne({ _id: req.params.id, user: req.session.user.id });
  if (!attempt) return res.json({ ok: false, error: 'not found' });
  if (!attempt.shareToken) { attempt.shareToken = randomBytes(16).toString('hex'); await attempt.save(); }
  res.json({ ok: true, url: `/exam/shared/${attempt.shareToken}` });
});

// GET /exam/shared/:token — ผลแบบสาธารณะ (read-only, ไม่ผ่าน requireAuth ของ router นี้)
export const sharedRouter = express.Router();
sharedRouter.get('/exam/shared/:token', async (req, res) => {
  const attempt = await ExamAttempt.findOne({ shareToken: req.params.token }).lean();
  if (!attempt) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผลการสอบนี้' });
  res.render('exam-result.njk', { attempt, shared: true });
});

export default router;
