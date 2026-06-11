import express from 'express';
import Course from '../models/Course.js';
import Progress, { completedSet, coursePercent, totalLessons, lessonCounts } from '../models/Progress.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

function findNextUp(course, done) {
  for (let m = 0; m < (course.modules || []).length; m++) {
    const lessons = course.modules[m].lessons || [];
    for (let l = 0; l < lessons.length; l++) {
      if (!done.has(`${m}-${l}`)) return { m, l, lesson: lessons[l] };
    }
  }
  return null;
}

async function collectDashboardData(userId) {
  const progresses = await Progress.find({ user: userId }).sort({ updatedAt: -1 });
  const allCourses = await Course.find({ published: true });
  const courseById = new Map(allCourses.map((c) => [String(c._id), c]));

  const myCourses = [];
  const activity = [];
  let lessonsDone = 0, labsPassed = 0, quizzesPassed = 0;
  const scores = [];

  for (const p of progresses) {
    const course = courseById.get(String(p.course));
    if (!course) continue;

    lessonsDone += p.completed.length;
    for (const c of p.completed) {
      if (c.type === 'lab') labsPassed++;
      else if (c.type === 'quiz') quizzesPassed++;
      if (typeof c.score === 'number') scores.push(c.score);
      activity.push({
        at: c.at,
        type: c.type,
        score: c.score,
        courseId: course._id,
        courseTitle: course.title,
        m: c.moduleIdx,
        l: c.lessonIdx,
        lessonTitle: course.modules?.[c.moduleIdx]?.lessons?.[c.lessonIdx]?.title || course.title,
      });
    }

    myCourses.push({
      course,
      percent: coursePercent(course, p),
      doneCount: p.completed.length,
      lessonTotal: totalLessons(course),
      nextUp: findNextUp(course, completedSet(p)),
    });
  }

  activity.sort((a, b) => new Date(b.at) - new Date(a.at));

  const startedIds = new Set(progresses.map((p) => String(p.course)));
  const suggestions = allCourses
    .filter((c) => !startedIds.has(String(c._id)) && totalLessons(c) > 0)
    .slice(0, 3)
    .map((course) => ({
      course,
      moduleCount: (course.modules || []).length,
      counts: lessonCounts(course),
    }));

  return {
    myCourses,
    activity,
    suggestions,
    stats: {
      coursesStarted: myCourses.length,
      lessonsDone,
      labsPassed,
      quizzesPassed,
      avgScore: scores.length ? Math.round(scores.reduce((n, s) => n + s, 0) / scores.length) : null,
    },
  };
}

router.get('/', requireAuth, async (req, res) => {
  const data = await collectDashboardData(req.session.user.id);
  res.render('dashboard.njk', { ...data, activity: data.activity.slice(0, 50) });
});

// GET /dashboard/export — printable progress report (all activity, no truncation)
router.get('/export', requireAuth, async (req, res) => {
  const data = await collectDashboardData(req.session.user.id);
  res.render('export.njk', { ...data, now: new Date() });
});

export default router;
