import express from 'express';
import Course from '../models/Course.js';
import * as gns3 from '../services/gns3Service.js';
import { runChecks } from '../services/gradingService.js';
import requireAuth from '../middleware/requireAuth.js';
import { markComplete } from '../models/Progress.js';

const router = express.Router();

// Active lab sessions: userId -> { projectId, webUiUrl, nodes }
const activeSessions = new Map();

// Resolve a lab lesson (type === 'lab') from course/module/lesson indices.
async function locateLab(courseId, m, l) {
  const course = await Course.findById(courseId);
  if (!course) return {};
  const lesson = course.modules?.[m]?.lessons?.[l];
  if (!lesson || lesson.type !== 'lab') return { course };
  return { course, lab: lesson };
}

// GET /lab/:courseId/:m/:l — render the lab page
router.get('/:courseId/:m/:l', requireAuth, async (req, res) => {
  const { courseId } = req.params;
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const { course, lab } = await locateLab(courseId, m, l);
  if (!course) return res.redirect('/courses');
  if (!lab) return res.redirect(`/courses/${courseId}`);

  res.render('lab.njk', { course, lab, m, l });
});

// POST /lab/:courseId/:m/:l/start — provision GNS3 lab
router.post('/:courseId/:m/:l/start', requireAuth, async (req, res) => {
  const { courseId } = req.params;
  const m = Number(req.params.m);
  const l = Number(req.params.l);
  const userId = req.session.user.id;

  // Tear down any existing session for this user
  if (activeSessions.has(userId)) {
    const old = activeSessions.get(userId);
    try { await gns3.deleteProject(old.projectId); } catch {}
    activeSessions.delete(userId);
  }

  try {
    const { lab } = await locateLab(courseId, m, l);
    if (!lab) return res.status(404).json({ ok: false, error: 'Lab not found.' });
    const result = await gns3.buildLab(lab, lab.title);
    // Store projectId, webUiUrl, AND nodes map for grading
    activeSessions.set(userId, result);
    res.json({ ok: true, gns3Url: result.webUiUrl });
  } catch (err) {
    console.error('GNS3 buildLab error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /lab/:courseId/:m/:l/grade — run automated grading checks
router.post('/:courseId/:m/:l/grade', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const session = activeSessions.get(userId);

  if (!session) {
    return res.status(400).json({ ok: false, error: 'No active lab session. Start the lab first.' });
  }

  try {
    const { courseId } = req.params;
    const m = Number(req.params.m);
    const l = Number(req.params.l);
    const { lab } = await locateLab(courseId, m, l);

    if (!lab) return res.status(404).json({ ok: false, error: 'Lab not found.' });
    if (!lab.gradingChecks?.length) {
      return res.json({ ok: true, score: 0, total: 0, results: [], message: 'No grading checks defined for this lab.' });
    }

    const { score, total, results } = await runChecks(session.nodes, lab.gradingChecks);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    if (pct >= 60) {
      try { await markComplete(userId, courseId, m, l, 'lab', pct); } catch (e) { console.error('progress save:', e); }
    }
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
