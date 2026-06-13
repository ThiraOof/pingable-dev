// /events — Events hub: รวมอีเวนต์ที่เปิดเป็นรอบ ๆ (duel ฯลฯ) ไว้ที่เดียว
// อ่าน registry จาก config/events.js — เพิ่มอีเวนต์ใหม่ที่นั่น ไม่ต้องแตะที่นี่
import express from 'express';
import { eventList } from '../config/events.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /events — หน้า hub: การ์ดอีเวนต์ทั้งหมด (เปิด/เร็ว ๆ นี้)
router.get('/', (req, res) => {
  const events = eventList();
  res.render('events-index.njk', { events, anyOpen: events.some((e) => e.open) });
});

export default router;
