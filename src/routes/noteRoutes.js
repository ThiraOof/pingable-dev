// /notes — สมุดโน้ตส่วนตัว (markdown) จัดกลุ่มตามคอร์ส ค้นหาได้
// CRUD ครบผ่านฟอร์ม server-rendered + endpoint JSON สำหรับ "จดด่วน" จากหน้า lab

import express from 'express';
import mongoose from 'mongoose';
import Note from '../models/Note.js';
import Course from '../models/Course.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// GET /notes — รายการโน้ต (ค้นหาด้วย ?q=) จัดกลุ่มตามคอร์ส
router.get('/', async (req, res) => {
  const q = str(req.query.q, 100).trim();
  const filter = { user: req.session.user.id };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // escape ก่อนทำ regex
    filter.$or = [{ title: rx }, { body: rx }];
  }
  const notes = await Note.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  const courseIds = [...new Set(notes.filter((n) => n.course).map((n) => String(n.course)))];
  const courses = await Course.find({ _id: { $in: courseIds } }).select('title').lean();
  const titleById = new Map(courses.map((c) => [String(c._id), c.title]));

  // จัดกลุ่ม: คอร์ส → โน้ต (โน้ตไม่ผูกคอร์สอยู่กลุ่ม "ทั่วไป")
  const groups = new Map();
  for (const n of notes) {
    const key = n.course ? String(n.course) : '_general';
    if (!groups.has(key)) groups.set(key, { title: n.course ? (titleById.get(key) || 'คอร์ส') : 'โน้ตทั่วไป', notes: [] });
    groups.get(key).notes.push(n);
  }
  res.render('notes.njk', { groups: [...groups.values()], q, editing: null });
});

// GET /notes/:id/edit — ฟอร์มแก้ไขโน้ตเดียว
router.get('/:id/edit', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/notes');
  const note = await Note.findOne({ _id: req.params.id, user: req.session.user.id }).lean();
  if (!note) return res.redirect('/notes');
  res.render('notes.njk', { groups: null, q: '', editing: note });
});

// POST /notes — สร้างโน้ตใหม่ (จากฟอร์มหน้า /notes หรือปุ่มจดด่วนในหน้า lab)
router.post('/', async (req, res) => {
  const note = await Note.create({
    user: req.session.user.id,
    title: str(req.body.title, 200) || 'โน้ตใหม่',
    body: str(req.body.body, 20000),
    course: mongoose.isValidObjectId(req.body.course) ? req.body.course : undefined,
    sourceLabel: str(req.body.sourceLabel, 200) || undefined,
    sourceHref: (typeof req.body.sourceHref === 'string' && req.body.sourceHref.startsWith('/')) ? req.body.sourceHref : undefined,
  });
  // ปุ่มจดด่วนจากหน้า lab ยิงแบบ fetch — ตอบ JSON; ฟอร์มปกติ redirect
  if (req.get('accept')?.includes('application/json')) {
    return res.json({ ok: true, id: note._id });
  }
  res.redirect('/notes');
});

// POST /notes/:id — แก้ไข
router.post('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/notes');
  await Note.updateOne(
    { _id: req.params.id, user: req.session.user.id },
    { $set: { title: str(req.body.title, 200) || 'โน้ตใหม่', body: str(req.body.body, 20000) } },
  );
  res.redirect('/notes');
});

// POST /notes/:id/delete — ลบ
router.post('/:id/delete', async (req, res) => {
  if (mongoose.isValidObjectId(req.params.id)) {
    await Note.deleteOne({ _id: req.params.id, user: req.session.user.id });
  }
  res.redirect('/notes');
});

export default router;
