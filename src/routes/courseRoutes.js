import express from 'express';
import Course from '../models/Course.js';
import requireAuth from '../middleware/requireAuth.js';
import { getProgress, completedSet, coursePercent, totalLessons } from '../models/Progress.js';

const router = express.Router();

// Display order + Thai labels for the level lanes shown on /courses
const LEVELS = [
  { key: 'beginner',     label: 'ระดับเริ่มต้น' },
  { key: 'intermediate', label: 'ระดับกลาง' },
  { key: 'advanced',     label: 'ระดับสูง' },
  { key: 'expert',       label: 'ระดับผู้เชี่ยวชาญ' },
];

// Count lessons of a given type across a course (for catalog badges)
function lessonCounts(course) {
  let readings = 0, labs = 0, quizzes = 0;
  for (const m of course.modules || []) {
    for (const l of m.lessons || []) {
      if (l.type === 'reading') readings++;
      else if (l.type === 'lab') labs++;
      else if (l.type === 'quiz') quizzes++;
    }
  }
  return { readings, labs, quizzes };
}

// GET /courses — catalog laned by level, with per-course progress
router.get('/', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const courses = await Course.find({ published: true }).select('-modules.lessons.topology');

  const enriched = await Promise.all(courses.map(async (course) => {
    const progress = await getProgress(userId, course._id);
    return {
      doc: course,
      moduleCount: (course.modules || []).length,
      lessonTotal: totalLessons(course),
      counts: lessonCounts(course),
      percent: coursePercent(course, progress),
    };
  }));

  const lanes = LEVELS
    .map(({ key, label }) => ({ key, label, courses: enriched.filter((c) => c.doc.level === key) }))
    .filter((lane) => lane.courses.length > 0);

  res.render('courses.njk', { lanes });
});

// GET /courses/:courseId — course detail: modules, lessons, progress
router.get('/:courseId', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.redirect('/courses');

  const progress = await getProgress(userId, course._id);
  const done = completedSet(progress);
  const percent = coursePercent(course, progress);

  // Annotate modules/lessons with completion + find the "next up" lesson
  let nextUp = null;
  const modules = course.modules.map((mod, m) => {
    let modDone = 0;
    const lessons = mod.lessons.map((lesson, l) => {
      const completed = done.has(`${m}-${l}`);
      if (completed) modDone++;
      if (!completed && !nextUp) nextUp = { m, l, lesson };
      return { lesson, m, l, completed };
    });
    return {
      mod, m,
      lessons,
      doneCount: modDone,
      total: mod.lessons.length,
      percent: mod.lessons.length ? Math.round((modDone / mod.lessons.length) * 100) : 0,
    };
  });

  res.render('course-detail.njk', {
    course, modules, percent,
    lessonTotal: totalLessons(course),
    doneTotal: progress ? progress.completed.length : 0,
    nextUp,
  });
});

export default router;
