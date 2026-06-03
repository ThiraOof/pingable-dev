import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/courses');
  res.render('login.njk', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
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

router.post('/register', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.render('register.njk', { error: 'รหัสผ่านไม่ตรงกัน' });
  }
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
  req.session.destroy();
  res.redirect('/');
});

export default router;
