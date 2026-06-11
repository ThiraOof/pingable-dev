export default function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  // Remember where the user was headed so login can send them back there.
  if (req.session && req.method === 'GET') req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
}
