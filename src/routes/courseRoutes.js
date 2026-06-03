import express from 'express';
import Course from '../models/Course.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const courses = await Course.find({ published: true }).select('-labs.topology');
  res.render('courses.njk', { courses });
});

router.get('/:courseId', requireAuth, async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.redirect('/courses');
  res.render('course-detail.njk', { course });
});

export default router;
