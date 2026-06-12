import express from 'express';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Progress from '../models/Progress.js';
import LabSession from '../models/LabSession.js';
import LabAttempt from '../models/LabAttempt.js';
import { stopSession } from '../services/labSessionService.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();
router.use(requireAdmin);

router.get('/', async (req, res) => {
  const [users, progresses, sessions, courses, labAgg] = await Promise.all([
    User.find({}).select('username email role createdAt').sort({ createdAt: -1 }).lean(),
    Progress.find({}).lean(),
    LabSession.find({}).populate('user', 'username').populate('course', 'title').sort({ lastActivityAt: -1 }).lean(),
    Course.find({ published: true }).select('title').lean(),
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

  // Per-user progress summary
  const progressByUser = new Map();
  for (const p of progresses) {
    const uid = String(p.user);
    const acc = progressByUser.get(uid) || { lessonsDone: 0, labsPassed: 0, quizzesPassed: 0 };
    acc.lessonsDone  += p.completed.length;
    acc.labsPassed   += p.completed.filter((c) => c.type === 'lab').length;
    acc.quizzesPassed += p.completed.filter((c) => c.type === 'quiz').length;
    progressByUser.set(uid, acc);
  }

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
    totalUsers: users.length,
    adminCount: users.filter((u) => u.role === 'admin').length,
    activeSessions: sessions.length,
    totalCourses: courses.length,
    totalLessonsDone: progresses.reduce((n, p) => n + p.completed.length, 0),
  };

  res.render('admin.njk', { stats, userRows, sessionRows, labRows });
});

router.post('/sessions/:id/stop', async (req, res) => {
  const session = await LabSession.findById(req.params.id).select('user').lean();
  if (!session) return res.status(404).json({ ok: false, error: 'ไม่พบ session' });
  await stopSession(String(session.user));
  req.log.info({ sessionId: req.params.id, by: req.session.user.id }, 'admin: stopped lab session');
  res.redirect('/admin');
});

export default router;
