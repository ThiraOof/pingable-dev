import express from 'express';
import Course from '../models/Course.js';
import requireAuth from '../middleware/requireAuth.js';
import { markComplete, getProgress, completedSet } from '../models/Progress.js';

const router = express.Router();

// Build a flat, ordered list of every lesson in the course so we can compute
// the previous / next lesson links for the in-lesson navigation.
function flatten(course) {
  const flat = [];
  course.modules.forEach((mod, m) => {
    mod.lessons.forEach((lesson, l) => flat.push({ m, l, lesson, moduleTitle: mod.title }));
  });
  return flat;
}

function neighbours(course, m, l) {
  const flat = flatten(course);
  const idx = flat.findIndex((f) => f.m === m && f.l === l);
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

// Resolve the course + lesson from route params, or null.
async function locate(courseId, m, l) {
  const course = await Course.findById(courseId);
  if (!course) return {};
  const mod = course.modules[m];
  const lesson = mod?.lessons[l];
  return { course, mod, lesson };
}

// GET /learn/:courseId/:m/:l — render a lesson (reading/quiz) or send labs to the lab runner
router.get('/:courseId/:m/:l', requireAuth, async (req, res) => {
  const courseId = req.params.courseId;
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const { course, mod, lesson } = await locate(courseId, m, l);
  if (!course) return res.redirect('/courses');
  if (!lesson) return res.redirect(`/courses/${courseId}`);

  if (lesson.type === 'lab') return res.redirect(`/lab/${courseId}/${m}/${l}`);

  const { prev, next } = neighbours(course, m, l);
  const progress = await getProgress(req.session.user.id, courseId);
  const done = completedSet(progress);
  const view = lesson.type === 'quiz' ? 'quiz.njk' : 'lesson.njk';

  res.render(view, {
    course, mod, lesson, m, l, prev, next,
    completed: done.has(`${m}-${l}`),
  });
});

// POST /learn/:courseId/:m/:l/complete — mark a reading lesson finished
router.post('/:courseId/:m/:l/complete', requireAuth, async (req, res) => {
  const courseId = req.params.courseId;
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const { course, lesson } = await locate(courseId, m, l);
  if (!lesson) return res.status(404).json({ ok: false, error: 'Lesson not found.' });

  await markComplete(req.session.user.id, courseId, m, l, lesson.type);
  res.json({ ok: true });
});

// POST /learn/:courseId/:m/:l/quiz — grade quiz answers server-side
router.post('/:courseId/:m/:l/quiz', requireAuth, async (req, res) => {
  const courseId = req.params.courseId;
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const { lesson } = await locate(courseId, m, l);
  if (!lesson || lesson.type !== 'quiz') {
    return res.status(404).json({ ok: false, error: 'Quiz not found.' });
  }

  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  let score = 0, total = 0;
  const results = lesson.questions.map((q, i) => {
    total += q.points || 1;
    const correct = [...(q.answer || [])].sort();
    const given = [...(answers[i] || [])].map(Number).sort();
    const passed = correct.length === given.length && correct.every((v, k) => v === given[k]);
    if (passed) score += q.points || 1;
    return {
      passed,
      correct: q.answer,
      explanation: q.explanation || '',
      points: q.points || 1,
    };
  });

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = pct >= (lesson.passThreshold ?? 60);
  if (passed) await markComplete(req.session.user.id, courseId, m, l, 'quiz', pct);

  res.json({ ok: true, score, total, pct, passed, threshold: lesson.passThreshold ?? 60, results });
});

export default router;
