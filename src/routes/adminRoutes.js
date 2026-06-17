import express from 'express';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Progress from '../models/Progress.js';
import LabSession from '../models/LabSession.js';
import LabAttempt from '../models/LabAttempt.js';
import { stopSession, sweepOrphans } from '../services/labSessionService.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();
router.use(requireAdmin);

const USERS_PER_PAGE = 25;

router.get('/', async (req, res) => {
  // Users are paginated — the table is the only unbounded list here (sessions
  // are capped by LAB_MAX_CONCURRENT, lab stats are $limit-ed). Stats and the
  // per-user progress summary are computed in the DB instead of loading every
  // Progress doc into memory.
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const [totalUsers, adminCount, courses, lessonsAgg, sessions, labAgg] = await Promise.all([
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
  ]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const users = await User.find({})
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

  const pagination = { page: safePage, totalPages, totalUsers };

  // One-shot notice after an orphan sweep (?orphans=N | unreachable).
  let notice = null;
  if (req.query.orphans === 'unreachable') {
    notice = { kind: 'warn', text: 'เชื่อมต่อ GNS3 ไม่ได้ — ข้ามการเคลียร์' };
  } else if (req.query.orphans != null) {
    const n = parseInt(req.query.orphans, 10) || 0;
    notice = { kind: 'ok', text: n ? `เคลียร์ orphaned project ${n} รายการ` : 'ไม่มี orphaned project ให้เคลียร์' };
  }

  res.render('admin.njk', { stats, userRows, sessionRows, labRows, pagination, courses, notice });
});

router.post('/sessions/:id/stop', async (req, res) => {
  const session = await LabSession.findById(req.params.id).select('user').lean();
  if (!session) return res.status(404).json({ ok: false, error: 'ไม่พบ session' });
  await stopSession(String(session.user));
  req.log.info({ sessionId: req.params.id, by: req.session.user.id }, 'admin: stopped lab session');
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
  const user = await User.findById(req.params.id).select('role');
  if (!user) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบผู้ใช้' });
  if (user.role !== role) {
    user.role = role;
    await user.save();
    req.log.info({ userId: req.params.id, role, by: req.session.user.id }, 'admin: changed user role');
  }
  res.redirect('/admin');
});

// Publish/unpublish a course. Unpublished courses drop out of the public
// catalog (/courses) but keep their _id so progress/seed refs stay valid.
router.post('/courses/:id/publish', async (req, res) => {
  const published = req.body.published === 'true';
  const course = await Course.findById(req.params.id).select('published');
  if (!course) return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบคอร์ส' });
  if (course.published !== published) {
    course.published = published;
    await course.save();
    req.log.info({ courseId: req.params.id, published, by: req.session.user.id }, 'admin: toggled course publish');
  }
  res.redirect('/admin');
});

// Manually reap orphaned pingable_* GNS3 projects (same logic as the sweeper).
// Useful after a GNS3 restart leaves projects no session references.
router.post('/gns3/clean-orphans', async (req, res) => {
  const deleted = await sweepOrphans();
  req.log.info({ deleted, by: req.session.user.id }, 'admin: manual orphan sweep');
  res.redirect('/admin?orphans=' + (deleted == null ? 'unreachable' : deleted));
});

export default router;
