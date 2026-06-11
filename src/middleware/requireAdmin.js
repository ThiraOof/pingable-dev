export default function requireAdmin(req, res, next) {
  if (req.session.user?.role === 'admin') return next();
  if (!req.session.user) return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
  res.status(403).render('error.njk', { code: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้' });
}
