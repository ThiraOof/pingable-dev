import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import * as gns3 from '../services/gns3Service.js';
import { getSession } from '../services/labSessionService.js';
import logger from '../config/logger.js';

/* ════════════════════════════════════════════════════════════════════
   GNS3 multi-tenancy proxy.

   The GNS3 Web-UI/API has no per-user authorization — anyone who can
   reach it can list, open and delete EVERY project. So the browser never
   talks to GNS3 directly: the lab iframe loads the Web-UI through our
   origin (/static/web-ui/...) and its API/WebSocket calls (/v2/...) are
   proxied here, allowed only when they target the caller's own lab
   project (from their LabSession). In production GNS3 can stay on a
   private network entirely.
   ════════════════════════════════════════════════════════════════════ */

const GNS3_TARGET = `${process.env.GNS3_HOST || 'http://localhost'}:${process.env.GNS3_PORT || 3080}`;

// Server-side GNS3 basic auth — injected into proxied requests so the
// browser never needs (or sees) GNS3 credentials.
function gns3AuthHeader() {
  if (!process.env.GNS3_USER) return null;
  return 'Basic ' + Buffer.from(`${process.env.GNS3_USER}:${process.env.GNS3_PASS || ''}`).toString('base64');
}
const setAuth = (proxyReq) => {
  const auth = gns3AuthHeader();
  if (auth) proxyReq.setHeader('Authorization', auth);
};

// Rate-limit non-GET proxy calls per authenticated user (keyed on session user
// id, falling back to IP for unauthenticated requests that slip through).
// 200 mutations per minute accommodates normal Web-UI bursts (drag-to-move
// nodes, start/stop buttons) while blocking automated scripts.
const proxyMutationLimit = rateLimit({
  windowMs: 60_000,
  max: 200,
  keyGenerator: (req) => String(req.session?.user?.id ?? req.ip),
  skip: (req) => req.method === 'GET' || req.path.startsWith('/static/web-ui'),
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ user: String(req.session?.user?.id), path: req.path }, 'gns3-proxy: rate limited');
    res.status(429).json({ message: 'too many requests' });
  },
});

const proxy = createProxyMiddleware({
  target: GNS3_TARGET,
  changeOrigin: true,
  ws: false, // upgrades are authorized + forwarded manually (see server.js)
  on: { proxyReq: setAuth, proxyReqWs: setAuth },
});

const PROJECT_RE = /^\/v2\/projects\/([0-9a-f-]{36})(\/|$)/i;

const isGns3Path = (p) => p.startsWith('/v2/') || p === '/v2' || p.startsWith('/static/web-ui');

// Authorization model. The isolation that matters: a user can only see/touch
// THEIR OWN lab project, can't create new projects (cost), and can't reach
// other users' projects. Read-only global GETs (version, computes, symbols,
// templates — server config, not user data) are allowed so the Web-UI works;
// any node/VM a user spawns can only land in their own project anyway.
async function authorize(req, res, next) {
  if (!req.session?.user) {
    if (req.path.startsWith('/static/web-ui')) return res.redirect('/auth/login');
    return res.status(401).json({ message: 'unauthorized' });
  }
  if (req.path.startsWith('/static/web-ui')) return next();

  const session = await getSession(req.session.user.id);
  const projectId = session?.projectId;

  // Project list: answer ourselves with just the caller's project.
  if (req.method === 'GET' && (req.path === '/v2/projects' || req.path === '/v2/projects/')) {
    if (!projectId) return res.json([]);
    const all = await gns3.getProjects().catch(() => []);
    return res.json(all.filter((p) => p.project_id === projectId));
  }

  // Any endpoint under a specific project → must be the caller's own project.
  const m = req.path.match(PROJECT_RE);
  if (m) {
    if (projectId && m[1].toLowerCase() === projectId.toLowerCase()) return next();
    logger.warn({ user: String(req.session.user.id), path: req.path, method: req.method }, 'gns3-proxy: blocked cross-project');
    return res.status(403).json({ message: 'forbidden' });
  }

  // Non-project endpoints: allow read-only GETs (global server config);
  // block creating projects and every other mutation.
  if (req.method === 'GET') return next();

  logger.warn({ user: String(req.session.user.id), path: req.path, method: req.method }, 'gns3-proxy: blocked mutation');
  res.status(403).json({ message: 'forbidden' });
}

/**
 * Mount-at-root gate: intercepts GNS3 paths, runs session + authorization,
 * then proxies. Mounted BEFORE helmet/body-parsers so the Web-UI keeps its
 * own (inline-script) pages and request bodies stream through untouched.
 */
export function gns3Gate(sessionMiddleware) {
  return (req, res, next) => {
    if (!isGns3Path(req.path)) return next();
    sessionMiddleware(req, res, (err) => {
      if (err) return next(err);
      authorize(req, res, (err2) => {
        if (err2) return next(err2);
        proxyMutationLimit(req, res, (err3) => (err3 ? next(err3) : proxy(req, res, next)));
      });
    });
  };
}

/** WebSocket upgrades (notifications + node consoles) — own project only. */
export async function authorizeUpgrade(req) {
  if (!req.session?.user) return false;
  const m = (req.url || '').match(PROJECT_RE);
  if (!m) return false;
  const session = await getSession(req.session.user.id);
  return !!session?.projectId && session.projectId.toLowerCase() === m[1].toLowerCase();
}

export const upgradeProxy = (req, socket, head) => proxy.upgrade(req, socket, head);
