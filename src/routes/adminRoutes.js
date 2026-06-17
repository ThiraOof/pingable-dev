import express from 'express';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Progress from '../models/Progress.js';
import LabSession from '../models/LabSession.js';
import LabAttempt from '../models/LabAttempt.js';
import UserStats from '../models/UserStats.js';
import XpEvent from '../models/XpEvent.js';
import ReviewItem from '../models/ReviewItem.js';
import Note from '../models/Note.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Certificate from '../models/Certificate.js';
import AdminAction from '../models/AdminAction.js';
import { stopSession, sweepOrphans } from '../services/labSessionService.js';
import { issueResetToken } from '../services/passwordResetService.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { levelFor } from '../config/xp.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();
router.use(requireAdmin);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Collections keyed by `user` that are removed when an account is deleted.
const USER_OWNED = [Progress, LabAttempt, UserStats, XpEvent, ReviewItem, Note, ExamAttempt, Certificate];

// Thai labels for the audit feed (key = AdminAction.action).
const AUDIT_LABELS = {
  'session.stop':        'หยุด lab session',
  'user.role':           'เปลี่ยนสิทธิ์',
  'user.unlock':         'ปลดล็อกบัญชี',
  'user.verify':         'ยืนยันอีเมล',
  'user.reset-password': 'ส่งลิงก์ตั้งรหัสผ่าน',
  'user.delete':         'ลบบัญชี',
  'course.publish':      'เผยแพร่/ซ่อนคอร์ส',
  'gns3.clean-orphans':  'เคลียร์ orphaned projects',
};

// Short human detail from an action's meta.
function auditDetail(a) {
  const m = a.meta || {};
  if (a.action === 'user.role') return m.role ? `→ ${m.role}` : '';
  if (a.action === 'course.publish') return m.published ? 'เผยแพร่' : 'ซ่อน';
  if (a.action === 'gns3.clean-orphans') return m.deleted == null ? 'GNS3 ไม่ตอบสนอง' : `ลบ ${m.deleted} รายการ`;
  return '';
}

// Append one audit-trail entry. Best-effort — a logging failure must never
// fail the action it records (mirrors achievementService's fire-and-forget).
async function audit(req, action, { targetId, targetLabel, meta } = {}) {
  try {
    await AdminAction.create({
      actor: req.session.user.id,
      actorName: req.session.user.username,
      action, targetId, targetLabel, meta,
    });
  } catch (err) {
    req.log.error({ err, action }, 'admin: audit log write failed');
  }
}

const USERS_PER_PAGE = 25;

router.get('/', async (req, res) => {
  // Users are paginated — the table is the only unbounded list here (sessions
  // are capped by LAB_MAX_CONCURRENT, lab stats are $limit-ed). Stats and the
  // per-user progress summary are computed in the DB instead of loading every
  // Progress doc into memory.
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  // Optional user search (username/email substring). Escaped so a stray regex
  // metachar can't blow up or scan oddly.
  const q = String(req.query.q || '').trim();
  const userFilter = q
    ? { $or: [{ username: { $regex: escapeRegex(q), $options: 'i' } },
              { email:    { $regex: escapeRegex(q), $options: 'i' } }] }
    : {};

  const [totalUsers, adminCount, courses, lessonsAgg, sessions, labAgg, matchedUsers, auditLog] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'admin' }),
    // Full course list (bounded — a dozen-ish) for the publish toggle.
    Course.find({}).select('title slug level track published').sort({ track: 1, title: 1 }).lean(),
    Progress.aggregate([{ $group: { _id: null, n: { $sum: { $size: '$completed' } } } }]),
    LabSession.find({}).populate('user', 'username').populate('course', 'title').sort({ lastActivityAt: -1 }).lean(),
    // Lab difficulty: which labs do learners fail? Steers hint/check tuning.
    LabAttempt.aggregate([
      { $group: {
        _id: { course: '$course', m: '$moduleIdx', l: '$lessonIdx' },
        attempts: { $sum: 1 },
        passed: { $sum: { $cond: ['$passed', 1, 0] } },
        avgPct: { $avg: '$pct' },
        users: { $addToSet: '$user' },
      } },
      { $sort: { attempts: -1 } },
      { $limit: 30 },
    ]),
    User.countDocuments(userFilter),
    AdminAction.find({}).sort({ at: -1 }).limit(50).lean(),
  ]);

  const totalPages = Math.max(1, Math.ceil(matchedUsers / USERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const users = await User.find(userFilter)
    .select('username email role createdAt')
    .sort({ createdAt: -1 })
    .skip((safePage - 1) * USERS_PER_PAGE)
    .limit(USERS_PER_PAGE)
    .lean();

  // Per-user progress summary — only for the users on this page.
  const pageUserIds = users.map((u) => u._id);
  const progressAgg = pageUserIds.length ? await Progress.aggregate([
    { $match: { user: { $in: pageUserIds } } },
    { $project: {
      user: 1,
      lessons: { $size: '$completed' },
      labs:    { $size: { $filter: { input: '$completed', as: 'c', cond: { $eq: ['$$c.type', 'lab'] } } } },
      quizzes: { $size: { $filter: { input: '$completed', as: 'c', cond: { $eq: ['$$c.type', 'quiz'] } } } },
    } },
    { $group: {
      _id: '$user',
      lessonsDone:   { $sum: '$lessons' },
      labsPassed:    { $sum: '$labs' },
      quizzesPassed: { $sum: '$quizzes' },
    } },
  ]) : [];

  // Resolve course/lab titles for the aggregated rows, hardest labs first.
  const aggCourseIds = [...new Set(labAgg.map((r) => String(r._id.course)))];
  const aggCourses = aggCourseIds.length
    ? await Course.find({ _id: { $in: aggCourseIds } })
        .select('title modules.title modules.lessons.title modules.lessons.type').lean()
    : [];
  const courseById = new Map(aggCourses.map((c) => [String(c._id), c]));
  const labRows = labAgg.map((r) => {
    const c = courseById.get(String(r._id.course));
    return {
      courseTitle: c?.title || '(คอร์สถูกลบ)',
      labTitle: c?.modules?.[r._id.m]?.lessons?.[r._id.l]?.title || `module ${r._id.m} / lesson ${r._id.l}`,
      attempts: r.attempts,
      userCount: r.users.length,
      passRate: Math.round((r.passed / r.attempts) * 100),
      avgPct: Math.round(r.avgPct),
    };
  }).sort((a, b) => a.passRate - b.passRate);

  const progressByUser = new Map(progressAgg.map((p) => [String(p._id), p]));

  const activeSessionUserIds = new Set(sessions.map((s) => String(s.user?._id)));
  const now = Date.now();

  const userRows = users.map((u) => ({
    ...u,
    ...(progressByUser.get(String(u._id)) || { lessonsDone: 0, labsPassed: 0, quizzesPassed: 0 }),
    hasActiveSession: activeSessionUserIds.has(String(u._id)),
  }));

  const sessionRows = sessions.map((s) => ({
    ...s,
    idleMinutes: Math.floor((now - new Date(s.lastActivityAt).getTime()) / 60_000),
  }));

  const stats = {
    totalUsers,
    adminCount,
    activeSessions: sessions.length,
    totalCourses: courses.filter((c) => c.published).length,
    totalLessonsDone: lessonsAgg[0]?.n || 0,
  };

  const pagination = { page: safePage, totalPages, totalUsers, matchedUsers, q };

  // Audit trail rows, each with a Thai action label + a short detail string.
  const auditRows = auditLog.map((a) => ({
    at: a.at,
    actorName: a.actorName || '(ถูกลบ)',
    label: AUDIT_LABELS[a.action] || a.action,
    target: a.targetLabel || (a.targetId ? String(a.targetId) : ''),
    detail: auditDetail(a),
  }));

  // One-shot notice after an orphan sweep (?orphans=N | unreachable) or a
  // user action that redirected back to the list.
  let notice = null;
  if (req.query.orphans === 'unreachable') {
    notice = { kind: 'warn', text: 'เชื่อมต่อ GNS3 ไม่ได้ — ข้ามการเคลียร์' };
  } else if (req.query.orphans != null) {
    const n = parseInt(req.query.orphans, 10) || 0;
    notice = { kind: 'ok', text: n ? `เคลียร์ orphaned project ${n} รายการ` : 'ไม่มี orphaned project ให้เคลียร์' };
  } else if (req.query.deleted) {
    notice = { kind: 'ok', text: `ลบบัญชี ${req.query.deleted} เรียบร้อย` };
  }

  res.render('admin.njk', { stats, userRows, sessionRows, labRows, pagination, courses, notice, auditRows });
});

router.post('/sessions/:id/stop', async (req, res) => {
  const session = await LabSession.findById(req.params.id).select('user').populate('user', 'username').lean();
  if (!session) return res.status(404).json({ ok: false, error: 'ไม่พบ session' });
  await stopSession(String(session.user?._id || session.user));
  req.log.info({ sessionId: req.params.id, by: req.session.user.id }, 'admin: stopped lab session');
  await audit(req, 'session.stop', { targetId: session.user?._id, targetLabel: session.user?.username });
  res.redirect('/admin');
});

// Promote/demote a user. `role` comes from the table's two buttons.
router.post('/users/:id/role', async (req, res) => {
  const role = req.body.role === 'admin' ? 'admin' : 'student';
  // Guard against an admin locking themselves out by self-demoting — they'd
  // lose access to this very page and could only recover via the DB/CLI.
  if (String(req.params.id) === String(req.session.user.id) && role === 'student') {
    return res.status(400).render('error.njk', { code: 400, message: 'คุณไม่สามารถถอดสิทธิ์ admin ของตัวเองได้' });
  }
  const user = await User.findById(req.params.id).select('role username');
  if (!user) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผู้ใช้' });
  if (user.role !== role) {
    user.role = role;
    await user.save();
    req.log.info({ userId: req.params.id, role, by: req.session.user.id }, 'admin: changed user role');
    await audit(req, 'user.role', { targetId: user._id, targetLabel: user.username, meta: { role } });
  }
  res.redirect('/admin');
});

// ── Single-user detail + account actions ──────────────────────────────────────

router.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('username email role createdAt emailVerified identities goal hideFromLeaderboard profilePublic lockUntil failedLogins password')
    .lean();
  if (!user) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผู้ใช้' });

  const [progresses, attempts, session, ustats] = await Promise.all([
    Progress.find({ user: user._id }).populate('course', 'title slug').sort({ updatedAt: -1 }).lean(),
    LabAttempt.find({ user: user._id }).populate('course', 'title').sort({ at: -1 }).limit(20).lean(),
    LabSession.findOne({ user: user._id }).populate('course', 'title').lean(),
    UserStats.findOne({ user: user._id }).lean(),
  ]);

  const progressRows = progresses.map((p) => ({
    courseTitle: p.course?.title || '(คอร์สถูกลบ)',
    lessonsDone: p.completed.length,
    labsPassed:  p.completed.filter((c) => c.type === 'lab').length,
    quizzesPassed: p.completed.filter((c) => c.type === 'quiz').length,
    updatedAt: p.updatedAt,
  }));

  const detail = {
    ...user,
    isSelf: String(user._id) === String(req.session.user.id),
    locked: !!(user.lockUntil && new Date(user.lockUntil) > new Date()),
    hasPassword: !!user.password,
    providers: (user.identities || []).map((i) => i.provider),
  };
  delete detail.password; // never leak the hash to the template

  const level = ustats ? levelFor(ustats.xp) : null;

  // One-shot action notice.
  const NOTICES = {
    unlock: { kind: 'ok', text: 'ปลดล็อกบัญชีแล้ว' },
    verify: { kind: 'ok', text: 'ยืนยันอีเมลให้แล้ว' },
    reset:  { kind: 'ok', text: 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปทางอีเมลแล้ว' },
  };
  const notice = NOTICES[req.query.done] || null;

  res.render('admin-user.njk', { detail, progressRows, attempts, session, ustats, level, notice });
});

router.post('/users/:id/unlock', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id,
    { $set: { failedLogins: 0 }, $unset: { lockUntil: 1 } }, { new: true }).select('username').lean();
  if (!user) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผู้ใช้' });
  req.log.info({ userId: req.params.id, by: req.session.user.id }, 'admin: unlocked account');
  await audit(req, 'user.unlock', { targetId: user._id, targetLabel: user.username });
  res.redirect(`/admin/users/${req.params.id}?done=unlock`);
});

router.post('/users/:id/verify', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id,
    { $set: { emailVerified: true } }, { new: true }).select('username').lean();
  if (!user) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผู้ใช้' });
  req.log.info({ userId: req.params.id, by: req.session.user.id }, 'admin: force-verified email');
  await audit(req, 'user.verify', { targetId: user._id, targetLabel: user.username });
  res.redirect(`/admin/users/${req.params.id}?done=verify`);
});

router.post('/users/:id/reset-password', async (req, res) => {
  const user = await User.findById(req.params.id).select('email username').lean();
  if (!user) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผู้ใช้' });
  const token = await issueResetToken(user.email);
  if (token) {
    sendPasswordResetEmail(user.email, token).catch((e) =>
      req.log.error({ err: e }, 'admin: failed to send password reset email'));
  }
  req.log.info({ userId: req.params.id, by: req.session.user.id }, 'admin: triggered password reset');
  await audit(req, 'user.reset-password', { targetId: user._id, targetLabel: user.username });
  res.redirect(`/admin/users/${req.params.id}?done=reset`);
});

// Hard-delete an account and everything it owns. Irreversible; the live lab
// session (if any) is torn down first so GNS3 doesn't keep the project.
router.post('/users/:id/delete', async (req, res) => {
  if (String(req.params.id) === String(req.session.user.id)) {
    return res.status(400).render('error.njk', { code: 400, message: 'คุณไม่สามารถลบบัญชีของตัวเองได้' });
  }
  const user = await User.findById(req.params.id).select('username').lean();
  if (!user) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผู้ใช้' });

  await stopSession(req.params.id).catch(() => {}); // best-effort GNS3 teardown
  await Promise.all(USER_OWNED.map((M) => M.deleteMany({ user: req.params.id })));
  await User.deleteOne({ _id: req.params.id });

  req.log.warn({ userId: req.params.id, username: user.username, by: req.session.user.id }, 'admin: deleted account');
  await audit(req, 'user.delete', { targetId: req.params.id, targetLabel: user.username });
  res.redirect('/admin?deleted=' + encodeURIComponent(user.username));
});

// Publish/unpublish a course. Unpublished courses drop out of the public
// catalog (/courses) but keep their _id so progress/seed refs stay valid.
router.post('/courses/:id/publish', async (req, res) => {
  const published = req.body.published === 'true';
  const course = await Course.findById(req.params.id).select('published title');
  if (!course) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบคอร์ส' });
  if (course.published !== published) {
    course.published = published;
    await course.save();
    req.log.info({ courseId: req.params.id, published, by: req.session.user.id }, 'admin: toggled course publish');
    await audit(req, 'course.publish', { targetId: course._id, targetLabel: course.title, meta: { published } });
  }
  res.redirect('/admin');
});

// Manually reap orphaned pingable_* GNS3 projects (same logic as the sweeper).
// Useful after a GNS3 restart leaves projects no session references.
router.post('/gns3/clean-orphans', async (req, res) => {
  const deleted = await sweepOrphans();
  req.log.info({ deleted, by: req.session.user.id }, 'admin: manual orphan sweep');
  await audit(req, 'gns3.clean-orphans', { meta: { deleted } });
  res.redirect('/admin?orphans=' + (deleted == null ? 'unreachable' : deleted));
});

export default router;
