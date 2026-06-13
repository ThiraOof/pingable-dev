// /duel — Lab Duel (§14): สองคนซ่อม troubleshoot lab เดียวกัน ใครผ่าน 100% ก่อนชนะ
//
// Event-only: เปิดด้วย DUELS_ENABLED=1 (กิน 2 slot จาก LAB_MAX_CONCURRENT ต่อคู่
// จึงไม่เปิด ad-hoc ทั้งระบบ) แต่ละผู้เล่นมี LabSession ของตัวเอง — duel แค่
// ประสานคะแนนและตัดสินผู้ชนะจาก attempt 100% แรก

import express from 'express';
import mongoose from 'mongoose';
import Course from '../models/Course.js';
import Duel from '../models/Duel.js';
import * as labSessions from '../services/labSessionService.js';
import { runChecks } from '../services/gradingService.js';
import { interpolateExpect } from '../services/labVariables.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

export const duelsEnabled = () => process.env.DUELS_ENABLED === '1' || process.env.DUELS_ENABLED === 'true';

// lab ที่ใช้ดวล (MVP: ล็อกเป็นโจทย์ซ่อมสั้น ๆ ที่ตัดสินแพ้ชนะได้ไว)
const DUEL_LAB = { slug: 'network-troubleshooting', m: 0, l: 1 }; // ซ่อม #1 ลิงก์เงียบ

async function resolveDuelLab() {
  const course = await Course.findOne({ slug: DUEL_LAB.slug }).select('title modules');
  const lesson = course?.modules?.[DUEL_LAB.m]?.lessons?.[DUEL_LAB.l];
  if (!course || !lesson || lesson.type !== 'lab') return null;
  return { course, lesson };
}

const player = (req) => ({ user: req.session.user.id, username: req.session.user.username, bestPct: 0 });
const isHost = (duel, uid) => String(duel.host.user) === String(uid);
const isGuest = (duel, uid) => duel.guest && String(duel.guest.user) === String(uid);

async function startDuelLab(userId, duel, lab) {
  return labSessions.startSession(userId, String(duel.course), duel.moduleIdx, duel.lessonIdx, lab);
}

// GET /duel — landing: สร้างหรือเข้าร่วม
router.get('/', async (req, res) => {
  const mine = await Duel.findOne({
    $or: [{ 'host.user': req.session.user.id }, { 'guest.user': req.session.user.id }],
    state: { $ne: 'done' },
  }).sort({ createdAt: -1 }).lean();
  res.render('duel-index.njk', { enabled: duelsEnabled(), active: mine });
});

// POST /duel/create — เปิดห้องดวล (state open) รอคู่แข่ง
router.post('/create', async (req, res) => {
  if (!duelsEnabled()) return res.status(403).render('error.njk', { code: 403, message: 'โหมดดวลเปิดเฉพาะช่วงอีเวนต์เท่านั้น' });
  const resolved = await resolveDuelLab();
  if (!resolved) return res.status(500).render('error.njk', { code: 500, message: 'ยังไม่พร้อมจัดดวล (lab หาย)' });

  const duel = await Duel.create({
    course: resolved.course._id, moduleIdx: DUEL_LAB.m, lessonIdx: DUEL_LAB.l,
    labTitle: resolved.lesson.title, host: player(req), state: 'open',
  });
  res.redirect(`/duel/${duel._id}`);
});

// GET /duel/:id — ห้องดวล (host/guest) หรือหน้าเข้าร่วม (คนที่ได้ลิงก์)
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/duel');
  const duel = await Duel.findById(req.params.id).lean();
  if (!duel) return res.redirect('/duel');
  const uid = req.session.user.id;
  const mine = isHost(duel, uid) || isGuest(duel, uid);

  // คนนอกเปิดลิงก์ห้องที่ยัง open → หน้าเชิญให้กดเข้าร่วม
  if (!mine && duel.state === 'open') {
    return res.render('duel-join.njk', { duel });
  }
  if (!mine) return res.status(403).render('error.njk', { code: 403, message: 'นี่ไม่ใช่ห้องดวลของคุณ' });

  const session = await labSessions.getSession(uid);
  const role = isHost(duel, uid) ? 'host' : 'guest';
  res.render('duel-room.njk', {
    duel, role, you: duel[role], foe: duel[role === 'host' ? 'guest' : 'host'],
    gns3Url: session?.webUiUrl || null,
  });
});

// POST /duel/:id/join — guest เข้าร่วม → state running, ทั้งคู่เริ่ม lab
router.post('/:id/join', async (req, res) => {
  if (!duelsEnabled()) return res.status(403).json({ ok: false, error: 'โหมดดวลปิดอยู่' });
  const duel = await Duel.findById(req.params.id);
  if (!duel || duel.state !== 'open') return res.status(409).json({ ok: false, error: 'ห้องนี้เข้าร่วมไม่ได้แล้ว' });
  if (isHost(duel, req.session.user.id)) return res.status(409).json({ ok: false, error: 'คุณคือเจ้าของห้อง รอคู่แข่งเข้าร่วม' });

  // claim ช่อง guest แบบ atomic (กันสองคนกดพร้อมกัน)
  const claimed = await Duel.findOneAndUpdate(
    { _id: duel._id, state: 'open', guest: { $exists: false } },
    { $set: { guest: player(req), state: 'running', startedAt: new Date() } },
    { new: true },
  );
  if (!claimed) return res.status(409).json({ ok: false, error: 'มีคนเข้าร่วมไปก่อนแล้ว' });

  const resolved = await resolveDuelLab();
  if (resolved) {
    // เริ่ม lab ให้ทั้งสองฝั่ง (host เริ่มเองตอนเข้าห้องด้วยก็ได้ แต่เริ่มให้เลยกันลืม)
    await Promise.allSettled([
      startDuelLab(String(claimed.host.user), claimed, resolved.lesson),
      startDuelLab(req.session.user.id, claimed, resolved.lesson),
    ]);
  }
  res.json({ ok: true });
});

// GET /duel/:id/state — โพล: คะแนนสองฝั่ง + สถานะ + บูตของตัวเอง
router.get('/:id/state', async (req, res) => {
  const duel = await Duel.findById(req.params.id).lean();
  if (!duel) return res.json({ ok: false });
  const uid = req.session.user.id;
  const role = isHost(duel, uid) ? 'host' : isGuest(duel, uid) ? 'guest' : null;
  if (!role) return res.status(403).json({ ok: false });

  let boot = { allBooted: false, setup: 'none', gns3Url: null };
  const session = await labSessions.getSession(uid);
  if (session?.status === 'ready' && String(session.course) === String(duel.course)
      && session.moduleIdx === duel.moduleIdx && session.lessonIdx === duel.lessonIdx) {
    const b = await labSessions.probeBoot(session);
    const resolved = await resolveDuelLab();
    const setup = b.allBooted && resolved ? await labSessions.ensureSetup(session, resolved.lesson) : 'none';
    boot = { ...b, setup, gns3Url: session.webUiUrl };
    await labSessions.touch(uid);
  }

  res.json({
    ok: true, state: duel.state, winner: duel.winner,
    you: { pct: duel[role].bestPct }, foe: { username: duel[role === 'host' ? 'guest' : 'host']?.username || 'รอคู่แข่ง', pct: duel[role === 'host' ? 'guest' : 'host']?.bestPct || 0 },
    ...boot,
  });
});

// POST /duel/:id/grade — ตรวจ lab ของตัวเอง → อัปคะแนน → ผ่าน 100% คนแรกชนะ
router.post('/:id/grade', async (req, res) => {
  const duel = await Duel.findById(req.params.id);
  if (!duel || duel.state !== 'running') return res.json({ ok: false, error: 'ดวลนี้ไม่ได้กำลังแข่งอยู่' });
  const uid = req.session.user.id;
  const role = isHost(duel, uid) ? 'host' : isGuest(duel, uid) ? 'guest' : null;
  if (!role) return res.status(403).json({ ok: false });

  const session = await labSessions.getSession(uid);
  if (!session || String(session.course) !== String(duel.course)
      || session.moduleIdx !== duel.moduleIdx || session.lessonIdx !== duel.lessonIdx || session.status !== 'ready') {
    return res.json({ ok: false, error: 'Lab ยังไม่พร้อม' });
  }
  const resolved = await resolveDuelLab();
  const lab = resolved?.lesson;
  if (lab?.setupCommands?.length && session.setup?.state !== 'done') {
    return res.json({ ok: false, error: 'กำลังจัดฉากโจทย์ — รอสักครู่' });
  }

  const checks = lab?.variables?.length
    ? lab.gradingChecks.map((c) => ({ ...c.toObject?.() ?? c, expect: interpolateExpect(c.expect, session.vars || {}) }))
    : (lab?.gradingChecks || []);
  const { score, total } = await runChecks(session.nodes, checks);
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  // อัปคะแนนของเรา (เก็บดีที่สุด) แล้วถ้าได้ 100% และยังไม่มีผู้ชนะ → เราชนะ (atomic)
  await Duel.updateOne(
    { _id: duel._id },
    { $max: { [`${role}.bestPct`]: pct }, $set: { [`${role}.gradedAt`]: new Date() } },
  );
  if (pct === 100) {
    const won = await Duel.findOneAndUpdate(
      { _id: duel._id, state: 'running' },
      { $set: { state: 'done', winner: role } },
      { new: true },
    );
    if (won) {
      await Promise.allSettled([labSessions.stopSession(String(duel.host.user)), duel.guest && labSessions.stopSession(String(duel.guest.user))]);
      return res.json({ ok: true, pct, won: true });
    }
    return res.json({ ok: true, pct, won: false, finished: true }); // อีกฝ่ายชนะไปก่อน
  }
  res.json({ ok: true, pct });
});

// POST /duel/:id/forfeit — ยอมแพ้/ออกจากห้อง
router.post('/:id/forfeit', async (req, res) => {
  const duel = await Duel.findById(req.params.id);
  if (duel && duel.state !== 'done') {
    const uid = req.session.user.id;
    const role = isHost(duel, uid) ? 'host' : isGuest(duel, uid) ? 'guest' : null;
    if (role) {
      duel.state = 'done';
      duel.winner = role === 'host' ? 'guest' : 'host'; // อีกฝ่ายชนะโดยปริยาย (ถ้ามี)
      if (!duel.guest) duel.winner = undefined; // ยังไม่มีคู่แข่ง — แค่ปิดห้อง
      await duel.save();
      await labSessions.stopSession(uid).catch(() => {});
    }
  }
  res.json({ ok: true });
});

export default router;
