// /review — ทบทวนข้อ quiz ที่เคยตอบผิดแบบ spaced repetition (Leitner)
// Server-rendered ทีละข้อ (ฟอร์มธรรมดา ไม่พึ่ง JS): GET แสดงข้อที่ครบกำหนด
// ตัวแรก, POST ตรวจคำตอบ → เลื่อน/รีเซ็ตกล่อง → แสดงเฉลยพร้อมปุ่มข้อถัดไป
// เนื้อคำถามอ่านสดจาก Course เสมอ — ref ที่ตายแล้ว (re-seed) จะถูกลบทิ้งเงียบ ๆ

import express from 'express';
import Course from '../models/Course.js';
import ReviewItem, { BOX_DAYS, dueAfterDays } from '../models/ReviewItem.js';
import { award } from '../services/achievementService.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// อ่านคำถามจริงจากตำแหน่งที่ item ชี้ (null = ref ตายแล้ว)
async function loadQuestion(item) {
  const course = await Course.findById(item.course).select('title modules').lean();
  const lesson = course?.modules?.[item.moduleIdx]?.lessons?.[item.lessonIdx];
  const q = lesson?.questions?.[item.qIdx];
  if (!q) return null;
  return { q, courseTitle: course.title, lessonTitle: lesson.title };
}

// item ที่ครบกำหนดตัวแรกที่ยังชี้คำถามจริงได้ (ลบ ref ตายระหว่างทาง)
async function nextDueItem(userId) {
  const due = await ReviewItem.find({ user: userId, dueAt: { $lte: new Date() } })
    .sort({ dueAt: 1 }).limit(25);
  for (const item of due) {
    const loaded = await loadQuestion(item);
    if (loaded) return { item, ...loaded, dueCount: due.length };
    await ReviewItem.deleteOne({ _id: item._id });
  }
  return null;
}

router.get('/', async (req, res) => {
  const userId = req.session.user.id;
  const found = await nextDueItem(userId);
  if (found) {
    return res.render('review.njk', {
      item: found.item, q: found.q, multi: (found.q.answer || []).length > 1,
      courseTitle: found.courseTitle, lessonTitle: found.lessonTitle,
      dueCount: found.dueCount, feedback: null,
    });
  }
  const [total, next] = await Promise.all([
    ReviewItem.countDocuments({ user: userId }),
    ReviewItem.findOne({ user: userId }).sort({ dueAt: 1 }).lean(),
  ]);
  res.render('review.njk', { item: null, q: null, dueCount: 0, total, nextDueAt: next?.dueAt, feedback: null });
});

router.post('/:id/answer', async (req, res) => {
  const userId = req.session.user.id;
  const item = await ReviewItem.findOne({ _id: req.params.id, user: userId });
  if (!item) return res.redirect('/review');
  const loaded = await loadQuestion(item);
  if (!loaded) { await ReviewItem.deleteOne({ _id: item._id }); return res.redirect('/review'); }

  const { q } = loaded;
  const given = [].concat(req.body.choice ?? []).map(Number).filter(Number.isInteger).sort();
  const correct = [...(q.answer || [])].sort();
  const passed = given.length === correct.length && correct.every((v, i) => v === given[i]);

  let graduated = false;
  if (passed && item.box >= BOX_DAYS.length - 1) {
    graduated = true;
    await ReviewItem.deleteOne({ _id: item._id }); // จบหลักสูตรของข้อนี้
  } else if (passed) {
    item.box += 1;
    item.dueAt = dueAfterDays(BOX_DAYS[item.box]);
    await item.save();
  } else {
    // ตอบผิด: กลับกล่อง 0 และวนกลับมาเร็ว ๆ (10 นาที) ให้ย้ำในวันเดียวกัน
    item.box = 0;
    item.lapses += 1;
    item.dueAt = new Date(Date.now() + 10 * 60 * 1000);
    await item.save();
  }

  // เคลียร์คิวหมดรอบนี้ → XP เล็กน้อย + นับ streak (เหตุผลให้เปิดแอปทุกวัน)
  const remaining = await ReviewItem.countDocuments({ user: userId, dueAt: { $lte: new Date() } });
  const gamify = remaining === 0
    ? await award(userId, 'review', { firstCompletion: true }).catch(() => null)
    : null;

  res.render('review.njk', {
    item, q, multi: correct.length > 1,
    courseTitle: loaded.courseTitle, lessonTitle: loaded.lessonTitle,
    dueCount: remaining,
    feedback: { passed, graduated, given, correct: q.answer || [], explanation: q.explanation || '', gamify },
  });
});

export default router;
