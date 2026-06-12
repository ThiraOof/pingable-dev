// Leaderboard รายสัปดาห์ — sum XpEvent ตั้งแต่จันทร์ 00:00 (เวลาไทย)
// รีเซ็ตทุกสัปดาห์เพื่อให้คนมาใหม่มีลุ้นเสมอ (ตารางตลอดชีพจะโดนคนเก่าผูกขาด)
// ผล aggregate ถูก cache ในหน่วยความจำ 5 นาที — per-instance เหมือน rate limit

import express from 'express';
import XpEvent from '../models/XpEvent.js';
import User from '../models/User.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null; // { weekStart, rows: [{ user, xp }], expiresAt }

// จันทร์ 00:00 ตามเวลาไทย (UTC+7 คงที่ ไม่มี DST) ในรูป Date (UTC)
export function weekStartBangkok(now = Date.now()) {
  const shifted = new Date(now + 7 * 3600e3); // เลื่อนให้ getUTC* อ่านเป็นเวลาไทย
  const dow = (shifted.getUTCDay() + 6) % 7;  // จันทร์ = 0
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - dow) - 7 * 3600e3);
}

async function weeklyRows() {
  const now = Date.now();
  const weekStart = weekStartBangkok(now);
  if (cache && cache.expiresAt > now && cache.weekStart.getTime() === weekStart.getTime()) {
    return { weekStart, rows: cache.rows };
  }
  const rows = await XpEvent.aggregate([
    { $match: { at: { $gte: weekStart } } },
    { $group: { _id: '$user', xp: { $sum: '$amount' } } },
    { $sort: { xp: -1 } },
  ]);
  cache = { weekStart, rows, expiresAt: now + CACHE_TTL_MS };
  return { weekStart, rows };
}

router.get('/', requireAuth, async (req, res) => {
  const me = String(req.session.user.id);
  const { weekStart, rows } = await weeklyRows();

  // ใส่ชื่อ + เคารพ opt-out (คนซ่อนตัวยังนับอันดับอยู่ แต่ไม่โชว์ชื่อในตาราง)
  const users = await User.find({ _id: { $in: rows.slice(0, 60).map((r) => r._id) } })
    .select('username hideFromLeaderboard').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const board = [];
  let myRank = null, myXp = 0;
  rows.forEach((r, i) => {
    const id = String(r._id);
    if (id === me) { myRank = i + 1; myXp = r.xp; }
    if (board.length >= 20) return;
    const u = byId.get(id);
    board.push({
      rank: i + 1,
      xp: r.xp,
      isMe: id === me,
      username: (!u || u.hideFromLeaderboard) && id !== me ? 'ผู้ไม่ประสงค์ออกนาม' : (u?.username || '—'),
    });
  });

  res.render('leaderboard.njk', { board, myRank, myXp, weekStart, totalPlayers: rows.length });
});

export default router;
