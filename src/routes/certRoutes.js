// Public certificate verification (§5). GET /cert/:serial — anyone (e.g. an
// employer) can confirm a certificate is genuine. No auth. Exposes only what
// belongs on a credential: serial, the holder's display name, course title +
// level, and the issue date. Never leaks email or the holder's username unless
// they've opted their profile public (same rule as profileRoutes).

import express from 'express';
import Certificate from '../models/Certificate.js';
import User from '../models/User.js';

const router = express.Router();

const SERIAL_RE = /^PNG-\d{4}-\d{6}$/;

router.get('/:serial', async (req, res) => {
  const serial = String(req.params.serial).toUpperCase();
  if (!SERIAL_RE.test(serial)) {
    return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบใบรับรองตามเลขที่นี้' });
  }

  const cert = await Certificate.findOne({ serial }).lean();
  if (!cert) {
    return res.status(404).render('error.njk', { code: 404, message: 'ไม่พบใบรับรองตามเลขที่นี้' });
  }

  // Link to the holder's public profile only when they opted in.
  const holder = await User.findById(cert.user).select('username profilePublic').lean();
  const profileUrl = holder?.profilePublic ? `/u/${holder.username}` : null;

  res.render('cert-verify.njk', { cert, profileUrl });
});

export default router;
