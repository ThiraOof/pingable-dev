import express from 'express';
import { rateLimit } from 'express-rate-limit';
import User from '../models/User.js';

const router = express.Router();

// Brute-force guard on credential endpoints (per IP).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const view = req.path.includes('register') ? 'register.njk' : 'login.njk';
    res.status(429).render(view, { error: 'พยายามมากเกินไป — กรุณารอ 15 นาทีแล้วลองใหม่' });
  },
});

// req.body fields can be objects (`email[$gt]=` parses to { $gt: '' }) —
// coerce to plain trimmed strings so nothing reaches Mongo as an operator.
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/courses');
  res.render('login.njk', { error: null });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.render('login.njk', { error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.render('login.njk', { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    req.session.user = { id: user._id, username: user.username, role: user.role };
    res.redirect('/courses');
  } catch (err) {
    res.render('login.njk', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/courses');
  res.render('register.njk', { error: null });
});

router.post('/register', authLimiter, async (req, res) => {
  const username = str(req.body.username);
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';

  const error =
    (username.length < 3 || username.length > 32) ? 'ชื่อผู้ใช้ต้องยาว 3–32 ตัวอักษร'
    : (!EMAIL_RE.test(email) || email.length > 254) ? 'รูปแบบอีเมลไม่ถูกต้อง'
    : (password.length < 8) ? 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'
    : (password.length > 72) ? 'รหัสผ่านยาวเกินไป (สูงสุด 72 ตัวอักษร)'
    : (password !== confirmPassword) ? 'รหัสผ่านไม่ตรงกัน'
    : null;
  if (error) return res.render('register.njk', { error });

  try {
    const user = new User({ username, email, password });
    await user.save();
    req.session.user = { id: user._id, username: user.username, role: user.role };
    res.redirect('/courses');
  } catch (err) {
    const msg = err.code === 11000
      ? 'อีเมลหรือชื่อผู้ใช้นี้ถูกใช้ไปแล้ว'
      : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    res.render('register.njk', { error: msg });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

export default router;
