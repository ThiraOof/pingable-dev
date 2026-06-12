import express from 'express';
import { randomBytes } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import User from '../models/User.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { issueResetToken, findUserByResetToken, resetPassword } from '../services/passwordResetService.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const view = req.path.includes('register') ? 'register.njk'
      : req.path.includes('password') ? 'forgot-password.njk'
      : 'login.njk';
    res.status(429).render(view, { error: 'พยายามมากเกินไป — กรุณารอ 15 นาทีแล้วลองใหม่', info: null });
  },
});

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared by register and reset-password — keep the policy in one place.
function passwordError(password, confirmPassword) {
  return (password.length < 8) ? 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'
    : (password.length > 72) ? 'รหัสผ่านยาวเกินไป (สูงสุด 72 ตัวอักษร)'
    : (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) ? 'รหัสผ่านต้องมีตัวอักษรและตัวเลขอย่างน้อย 1 ตัว'
    : (password !== confirmPassword) ? 'รหัสผ่านไม่ตรงกัน'
    : null;
}

function consumeReturnTo(req) {
  const dest = req.session.returnTo;
  delete req.session.returnTo;
  return (typeof dest === 'string' && dest.startsWith('/') && !dest.startsWith('//')) ? dest : '/dashboard';
}

function makeVerificationToken() {
  return randomBytes(32).toString('hex');
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  const next = req.query.next;
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    req.session.returnTo = next;
  }
  const info = req.query.info === 'verified' ? 'ยืนยันอีเมลสำเร็จแล้ว — กรุณาเข้าสู่ระบบ'
    : req.query.info === 'reset' ? 'ตั้งรหัสผ่านใหม่สำเร็จ — เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย'
    : null;
  res.render('login.njk', { error: null, info });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.render('login.njk', { error: 'กรุณากรอกอีเมลและรหัสผ่าน', info: null });
  }
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.render('login.njk', { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', info: null });
    }
    req.session.user = {
      id: user._id, username: user.username, role: user.role,
      email: user.email, emailVerified: user.emailVerified ?? true,
    };
    res.redirect(consumeReturnTo(req));
  } catch {
    res.render('login.njk', { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่', info: null });
  }
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
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
    : passwordError(password, confirmPassword);
  if (error) return res.render('register.njk', { error });

  try {
    const token = makeVerificationToken();
    const user = new User({
      username, email, password,
      emailToken: token,
      emailTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await user.save();
    req.session.user = {
      id: user._id, username: user.username, role: user.role,
      email: user.email, emailVerified: false,
    };
    // Fire-and-forget: don't block registration if SMTP is misconfigured.
    sendVerificationEmail(user.email, token).catch((e) =>
      req.log.error({ err: e }, 'failed to send verification email'),
    );
    res.redirect(consumeReturnTo(req));
  } catch (err) {
    const msg = err.code === 11000
      ? 'อีเมลหรือชื่อผู้ใช้นี้ถูกใช้ไปแล้ว'
      : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    res.render('register.njk', { error: msg });
  }
});

// GET /auth/verify/:token — confirm email ownership
router.get('/verify/:token', async (req, res) => {
  const user = await User.findOne({
    emailToken: req.params.token,
    emailTokenExp: { $gt: new Date() },
  });
  if (!user) {
    return res.render('login.njk', { error: 'ลิงก์ยืนยันหมดอายุหรือไม่ถูกต้อง — กรุณาขอลิงก์ใหม่', info: null });
  }
  user.emailVerified = true;
  user.emailToken = undefined;
  user.emailTokenExp = undefined;
  await user.save();
  if (req.session.user) {
    req.session.user.emailVerified = true;
    return res.redirect('/dashboard');
  }
  res.redirect('/auth/login?info=verified');
});

// POST /auth/resend — re-send verification email (auth-gated, rate-limited)
router.post('/resend', authLimiter, async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const user = await User.findById(req.session.user.id);
  if (!user || user.emailVerified) return res.redirect('/dashboard');
  const token = makeVerificationToken();
  user.emailToken = token;
  user.emailTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  sendVerificationEmail(user.email, token).catch((e) =>
    req.log.error({ err: e }, 'resend verification failed'),
  );
  res.redirect('/dashboard');
});

// ── Password reset ────────────────────────────────────────────────────────────

router.get('/forgot-password', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('forgot-password.njk', { error: null, info: null });
});

// Always answer with the same message whether the account exists or not —
// this endpoint must not leak which emails are registered.
router.post('/forgot-password', authLimiter, async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.render('forgot-password.njk', { error: 'รูปแบบอีเมลไม่ถูกต้อง', info: null });
  }
  const token = await issueResetToken(email);
  if (token) {
    sendPasswordResetEmail(email, token).catch((e) =>
      req.log.error({ err: e }, 'failed to send password reset email'),
    );
  }
  res.render('forgot-password.njk', {
    error: null,
    info: 'ถ้าอีเมลนี้มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว (ลิงก์ใช้ได้ 1 ชั่วโมง) — เช็คกล่องจดหมายและสแปมด้วยนะ',
  });
});

// GET /auth/reset-password/:token — the emailed link; show the new-password form
router.get('/reset-password/:token', async (req, res) => {
  const user = await findUserByResetToken(req.params.token);
  if (!user) {
    return res.render('forgot-password.njk', {
      error: 'ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้ไปแล้ว — กรุณาขอลิงก์ใหม่', info: null,
    });
  }
  res.render('reset-password.njk', { token: req.params.token, error: null });
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const token = str(req.body.token);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';

  const error = passwordError(password, confirmPassword);
  if (error) return res.render('reset-password.njk', { token, error });

  const user = await resetPassword(token, password);
  if (!user) {
    return res.render('forgot-password.njk', {
      error: 'ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้ไปแล้ว — กรุณาขอลิงก์ใหม่', info: null,
    });
  }
  req.log.info({ user: String(user._id) }, 'password reset completed');
  res.redirect('/auth/login?info=reset');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

export default router;
