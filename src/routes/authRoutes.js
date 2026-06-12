import express from 'express';
import { randomBytes } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import User from '../models/User.js';
import requireAuth from '../middleware/requireAuth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { issueResetToken, findUserByResetToken, resetPassword } from '../services/passwordResetService.js';
import { GOALS, GOAL_KEYS } from '../config/goals.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const msg = 'พยายามมากเกินไป — กรุณารอ 15 นาทีแล้วลองใหม่';
    // settings.njk needs the account loaded — use the plain error page there
    if (req.path.includes('settings')) {
      return res.status(429).render('error.njk', { code: 429, message: msg });
    }
    const view = req.path.includes('register') ? 'register.njk'
      : req.path.includes('password') ? 'forgot-password.njk'
      : 'login.njk';
    res.status(429).render(view, { error: msg, info: null });
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

// Account lockout: the per-IP rate limit can be dodged (botnets, IPv6 pools),
// so wrong passwords against one account also count per account. Read per call
// so tests can lower the threshold.
const LOCK_AFTER = () => Number(process.env.LOGIN_LOCK_AFTER || 10);
const LOCK_MINUTES = 15;

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
    if (!user) {
      return res.render('login.njk', { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', info: null });
    }

    // Saying "locked" does confirm the account exists, but only to someone who
    // already hammered it with wrong passwords — the owner needs to know why
    // the correct password suddenly fails.
    if (user.lockUntil && user.lockUntil > new Date()) {
      const mins = Math.max(1, Math.ceil((user.lockUntil - Date.now()) / 60000));
      return res.render('login.njk', {
        error: `บัญชีถูกล็อกชั่วคราวจากการพยายามเข้าสู่ระบบผิดหลายครั้ง — ลองใหม่ในอีก ${mins} นาที`,
        info: null,
      });
    }

    if (!(await user.comparePassword(password))) {
      const failed = (user.failedLogins || 0) + 1;
      await User.updateOne({ _id: user._id }, failed >= LOCK_AFTER()
        ? { $set: { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } }
        : { $set: { failedLogins: failed } });
      return res.render('login.njk', { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', info: null });
    }

    if (user.failedLogins || user.lockUntil) {
      await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0 }, $unset: { lockUntil: 1 } });
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
  res.render('register.njk', { error: null, goals: GOALS });
});

router.post('/register', authLimiter, async (req, res) => {
  const username = str(req.body.username);
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';
  const goal = GOAL_KEYS.includes(str(req.body.goal)) ? str(req.body.goal) : undefined; // optional

  const error =
    (username.length < 3 || username.length > 32) ? 'ชื่อผู้ใช้ต้องยาว 3–32 ตัวอักษร'
    : (!EMAIL_RE.test(email) || email.length > 254) ? 'รูปแบบอีเมลไม่ถูกต้อง'
    : passwordError(password, confirmPassword);
  if (error) return res.render('register.njk', { error, goals: GOALS });

  try {
    const token = makeVerificationToken();
    const user = new User({
      username, email, password, goal,
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
    res.render('register.njk', { error: msg, goals: GOALS });
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

// ── Account settings ─────────────────────────────────────────────────────────

const ACCOUNT_FIELDS = 'username email emailVerified createdAt goal hideFromLeaderboard';

router.get('/settings', requireAuth, async (req, res) => {
  const account = await User.findById(req.session.user.id).select(ACCOUNT_FIELDS).lean();
  if (!account) return res.redirect('/auth/login');
  res.render('settings.njk', { account, goals: GOALS, error: null, info: null });
});

// POST /auth/settings/leaderboard — opt-in/out จากการแสดงชื่อบน leaderboard
router.post('/settings/leaderboard', requireAuth, async (req, res) => {
  const hide = req.body.hideFromLeaderboard === 'on';
  await User.updateOne({ _id: req.session.user.id }, { $set: { hideFromLeaderboard: hide } });
  const account = await User.findById(req.session.user.id).select(ACCOUNT_FIELDS).lean();
  res.render('settings.njk', {
    account, goals: GOALS, error: null,
    info: hide ? 'ซ่อนชื่อจากตารางอันดับแล้ว' : 'แสดงชื่อบนตารางอันดับแล้ว',
  });
});

// POST /auth/settings/goal — เปลี่ยนเป้าหมายการเรียน (ใช้จัดลำดับคอร์สแนะนำ)
router.post('/settings/goal', requireAuth, async (req, res) => {
  const goal = str(req.body.goal);
  const update = GOAL_KEYS.includes(goal) ? { $set: { goal } } : { $unset: { goal: 1 } };
  await User.updateOne({ _id: req.session.user.id }, update);
  const account = await User.findById(req.session.user.id).select(ACCOUNT_FIELDS).lean();
  res.render('settings.njk', { account, goals: GOALS, error: null, info: 'บันทึกเป้าหมายการเรียนแล้ว' });
});

router.post('/settings/password', requireAuth, authLimiter, async (req, res) => {
  const account = await User.findById(req.session.user.id);
  if (!account) return res.redirect('/auth/login');

  const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';
  const respond = (error, info) => res.render('settings.njk', { account, error, info });

  if (!(await account.comparePassword(current))) {
    return respond('รหัสผ่านปัจจุบันไม่ถูกต้อง', null);
  }
  const error = passwordError(password, confirmPassword);
  if (error) return respond(error, null);

  account.password = password; // hashed by the pre-save hook
  await account.save();
  req.log.info({ user: String(account._id) }, 'password changed via settings');
  respond(null, 'เปลี่ยนรหัสผ่านสำเร็จ');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

export default router;
