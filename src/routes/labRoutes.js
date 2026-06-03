import express from 'express';
import Course from '../models/Course.js';
import * as gns3 from '../services/gns3Service.js';
import { runChecks } from '../services/gradingService.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

// Active lab sessions: userId -> { projectId, nodes }
const activeSessions = new Map();

// GET /lab/:courseId/:labIndex — render the lab page
router.get('/:courseId/:labIndex', requireAuth, async (req, res) => {
  const { courseId, labIndex } = req.params;
  const course = await Course.findById(courseId);
  if (!course) return res.redirect('/courses');

  const lab = course.labs[Number(labIndex)];
  if (!lab) return res.redirect(`/courses/${courseId}`);

  res.render('lab.njk', { course, lab, labIndex: Number(labIndex) });
});

// POST /lab/:courseId/:labIndex/start — provision GNS3 lab
router.post('/:courseId/:labIndex/start', requireAuth, async (req, res) => {
  const { courseId, labIndex } = req.params;
  const userId = req.session.user.id;

  // Tear down any existing session for this user
  if (activeSessions.has(userId)) {
    const old = activeSessions.get(userId);
    try { await gns3.deleteProject(old.projectId); } catch {}
    activeSessions.delete(userId);
  }

  try {
    const course = await Course.findById(courseId);
    const lab = course.labs[Number(labIndex)];
    const result = await gns3.buildLab(lab, lab.title);
    // Store projectId, webUiUrl, AND nodes map for grading
    activeSessions.set(userId, result);
    res.json({ ok: true, gns3Url: result.webUiUrl });
  } catch (err) {
    console.error('GNS3 buildLab error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /lab/:courseId/:labIndex/grade — run automated grading checks
router.post('/:courseId/:labIndex/grade', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const session = activeSessions.get(userId);

  if (!session) {
    return res.status(400).json({ ok: false, error: 'No active lab session. Start the lab first.' });
  }

  try {
    const { courseId, labIndex } = req.params;
    const course = await Course.findById(courseId);
    const lab = course?.labs[Number(labIndex)];

    if (!lab) return res.status(404).json({ ok: false, error: 'Lab not found.' });
    if (!lab.gradingChecks?.length) {
      return res.json({ ok: true, score: 0, total: 0, results: [], message: 'No grading checks defined for this lab.' });
    }

    const { score, total, results } = await runChecks(session.nodes, lab.gradingChecks);
    res.json({ ok: true, score, total, results });
  } catch (err) {
    console.error('Grading error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /lab/stop — destroy GNS3 project and free resources
router.post('/stop', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  if (activeSessions.has(userId)) {
    const { projectId } = activeSessions.get(userId);
    try {
      await gns3.deleteProject(projectId);
    } catch (err) {
      console.error('GNS3 deleteProject error:', err);
    }
    activeSessions.delete(userId);
  }
  res.json({ ok: true });
});

export default router;
