// /u/:username — โปรไฟล์สาธารณะแบบ opt-in: โชว์ตำแหน่ง (level), badges,
// คอร์สที่จบ + best lab scores ออกแบบให้แนบใน resume ได้ (URL สั้น, print-friendly)
// ระวัง: หน้านี้ public — ห้าม leak email หรือ timestamp ละเอียด (โชว์แค่เดือน-ปี)

import express from 'express';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Progress, { coursePercent, totalLessons } from '../models/Progress.js';
import { getStats } from '../services/achievementService.js';
import { levelFor } from '../config/xp.js';
import { BADGES, badgeById } from '../config/badges.js';

const router = express.Router();

router.get('/:username', async (req, res) => {
  // case-insensitive exact match กัน enumeration ด้วย regex anchored
  const uname = String(req.params.username).slice(0, 64);
  const user = await User.findOne({ username: new RegExp(`^${uname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
    .select('username profilePublic createdAt').lean();

  // โปรไฟล์ที่ไม่เปิด public ตอบ 404 เหมือนไม่มีตัวตน (ไม่ยืนยันว่า username มีอยู่)
  if (!user || !user.profilePublic) {
    return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบโปรไฟล์นี้ หรือเจ้าของตั้งเป็นส่วนตัว' });
  }

  const [stats, progresses, courses] = await Promise.all([
    getStats(user._id),
    Progress.find({ user: user._id }).lean(),
    Course.find({ published: true }).select('title level modules').lean(),
  ]);
  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  // คอร์สที่จบ 100% + คะแนน lab ที่ดีที่สุดในแต่ละคอร์ส
  const completedCourses = [];
  let bestLab = 0, totalLabsPassed = 0;
  for (const p of progresses) {
    const c = courseById.get(String(p.course));
    if (!c) continue;
    const pct = coursePercent(c, p);
    const labScores = p.completed.filter((x) => x.type === 'lab' && typeof x.score === 'number').map((x) => x.score);
    totalLabsPassed += labScores.length;
    if (labScores.length) bestLab = Math.max(bestLab, ...labScores);
    if (pct === 100 && totalLessons(c) > 0) {
      completedCourses.push({ title: c.title, level: c.level });
    }
  }

  const xp = stats?.xp || 0;
  const earnedIds = new Set((stats?.badges || []).map((b) => b.id));
  const badges = [...earnedIds].map(badgeById).filter(Boolean);

  res.render('profile.njk', {
    profile: {
      username: user.username,
      memberSince: user.createdAt,
      level: levelFor(xp),
      xp,
      streak: stats?.streak || {},
      badges,
      badgeTotal: BADGES.length,
      completedCourses,
      bestLab,
      totalLabsPassed,
    },
  });
});

export default router;
