import express from 'express';
import http from 'http';

/**
 * Mount a router in a minimal in-process Express app so its HTTP endpoints can
 * be exercised with `fetch` — no supertest dependency, no real session store.
 *
 * Auth is faked per-request: send headers `x-test-user` (and optionally
 * `x-test-username`) and the app sets `req.session.user = { id, username }`,
 * which is exactly what `requireAuth` and the routes read. Omit the header to
 * exercise the unauthenticated path: `requireAuth` redirects to `/auth/login`
 * (observable as a 302 with that Location, since redirects are NOT followed).
 *
 * `res.render(view, locals)` is stubbed to `res.json({ __render: view, ...locals })`
 * so route logic (which view, what data) is testable without Nunjucks. `req.log`
 * is a no-op pino-shaped stub.
 *
 * Returns { base, request(path, opts), close }. `request` sends opts.user
 * (string id) / opts.username as auth, JSON-encodes opts.body, and exposes the
 * raw status + Location of any redirect rather than following it.
 */
export async function startRouteApp(mount) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    req.log = { error() {}, warn() {}, info() {}, debug() {}, child() { return req.log; } };
    const uid = req.headers['x-test-user'];
    req.session = uid ? { user: { id: uid, username: req.headers['x-test-username'] || 'user' } } : {};
    const render = (view, locals = {}) => res.json({ __render: view, ...locals });
    res.render = render;
    next();
  });

  mount(app);

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(path, { method = 'GET', user, username, body } = {}) {
    const headers = {};
    if (user) headers['x-test-user'] = String(user);
    if (username) headers['x-test-username'] = username;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(base + path, {
      method, headers, redirect: 'manual',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON (e.g. redirect body) */ }
    return { status: res.status, json, text, location: res.headers.get('location') };
  }

  return { base, request, close: () => new Promise((r) => server.close(r)) };
}
