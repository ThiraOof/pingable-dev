import express from 'express';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Progress from '../models/Progress.js';
import LabSession from '../models/LabSession.js';
import { stopSession } from '../services/labSessionService.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();
router.use(requireAdmin);

router.get('/', async (req, res) => {
  const [users, progresses, sessions, courses] = await Promise.all([
    User.find({}).select('username email role createdAt').sort({ createdAt: -1 }).lean(),
    Progress.find({}).lean(),
    LabSession.find({}).populate('user', 'username').populate('course', 'title').sort({ lastActivityAt: -1 }).lean(),
    Course.find({ published: true }).select('title').lean(),
  ]);

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

  res.render('admin.njk', { stats, userRows, sessionRows });
});

router.post('/sessions/:id/stop', async (req, res) => {
  const session = await LabSession.findById(req.params.id).select('user').lean();
  if (!session) return res.status(404).json({ ok: false, error: 'ไม่พบ session' });
  await stopSession(String(session.user));
  req.log.info({ sessionId: req.params.id, by: req.session.user.id }, 'admin: stopped lab session');
  res.redirect('/admin');
});

export default router;
