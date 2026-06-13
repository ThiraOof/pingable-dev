import express from 'express';
import mongoose from 'mongoose';
import Course from '../models/Course.js';
import Certificate from '../models/Certificate.js';
import Progress, { getProgress, completedSet, coursePercent, totalLessons, lessonCounts } from '../models/Progress.js';
import { checkPrerequisites } from '../utils/prereqs.js';
import { countActiveLabs } from '../services/labSessionService.js';
import { eligible, maybeIssue } from '../services/certificateService.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

// In-memory cache for the published course list (topology excluded).
// Progress is still fetched per-user on every request; only the shared
// Course.find() result is cached. TTL of 60s keeps the catalog fresh
// enough after a re-seed without hammering Mongo on every page load.
const CATALOG_TTL_MS = 60_000;
let catalogCache = null; // { data: Course[], expiresAt: number }

// Display order + Thai labels for the level lanes shown on /courses
const LEVELS = [
  { key: 'beginner',     label: 'ระดับเริ่มต้น' },
  { key: 'intermediate', label: 'ระดับกลาง' },
  { key: 'advanced',     label: 'ระดับสูง' },
  { key: 'expert',       label: 'ระดับผู้เชี่ยวชาญ' },
];

// GET /courses — catalog laned by level, with per-course progress.
// Public: guests can browse; progress only shows when logged in.
router.get('/', async (req, res) => {
  const userId = req.session.user?.id;

  const now = Date.now();
  if (!catalogCache || catalogCache.expiresAt <= now) {
    catalogCache = {
      data: await Course.find({ published: true }).select('-modules.lessons.topology'),
      expiresAt: now + CATALOG_TTL_MS,
    };
  }
  const courses = catalogCache.data;

  // One query for all progress docs instead of one per course.
  const progresses = userId
    ? await Progress.find({ user: userId, course: { $in: courses.map((c) => c._id) } })
    : [];
  const byCourse = new Map(progresses.map((p) => [String(p.course), p]));

  const enriched = courses.map((course) => ({
    doc: course,
    moduleCount: (course.modules || []).length,
    lessonTotal: totalLessons(course),
    counts: lessonCounts(course),
    percent: coursePercent(course, byCourse.get(String(course._id))),
  }));

  const lanes = LEVELS
    .map(({ key, label }) => ({ key, label, courses: enriched.filter((c) => c.doc.level === key) }))
    .filter((lane) => lane.courses.length > 0);

  res.render('courses.njk', { lanes, activeLabs: await countActiveLabs() });
});

// GET /courses/:courseId — course detail: modules, lessons, progress (public)
router.get('/:courseId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.courseId)) return res.redirect('/courses');
  const userId = req.session.user?.id;
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.redirect('/courses');

  const [progress, prereqsInfo] = await Promise.all([
    userId ? getProgress(userId, course._id) : null,
    checkPrerequisites(userId, course),
  ]);
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
    prereqsMet: prereqsInfo.met,
    prereqsInfo,
  });
});

// GET /courses/:courseId/certificate — the owner's printable certificate.
// Only courses that are 100% complete AND have a passed Boss Lab earn one
// (eligible()); the certificate is persisted (issued on the spot if the user
// reached eligibility before this feature existed) so it carries a verifiable
// serial and an editable display name.
router.get('/:courseId/certificate', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.courseId)) return res.redirect('/courses');
  const course = await Course.findById(req.params.courseId).select('title description level track estimatedHours modules');
  if (!course) return res.redirect('/courses');

  const userId = req.session.user.id;
  const progress = await getProgress(userId, course._id);
  if (!eligible(course, progress)) return res.redirect(`/courses/${req.params.courseId}`);

  const cert = await maybeIssue(userId, course, progress);
  if (!cert) return res.redirect(`/courses/${req.params.courseId}`);

  const verifyUrl = `${req.protocol}://${req.get('host')}/cert/${cert.serial}`;
  res.render('certificate.njk', {
    course,
    cert,
    verifyUrl,
    lessonTotal: totalLessons(course),
  });
});

// POST /courses/:courseId/certificate/name — let the owner set the name printed
// on their certificate (username is rarely a real name). CSRF-guarded globally.
router.post('/:courseId/certificate/name', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.courseId)) return res.redirect('/courses');
  const displayName = String(req.body?.displayName ?? '').trim().slice(0, 60);
  if (displayName) {
    await Certificate.updateOne(
      { user: req.session.user.id, course: req.params.courseId },
      { $set: { displayName } },
    );
  }
  res.redirect(`/courses/${req.params.courseId}/certificate`);
});

export default router;
