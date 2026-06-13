import 'dotenv/config';
import express from 'express';
import 'express-async-errors'; // patches Express 4 so async route errors hit the error handler instead of crashing the process
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import nunjucks from 'nunjucks';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { marked } from 'marked';

import logger from './config/logger.js';
import connectDB from './config/db.js';
import { injectDSD } from './dsd.js';
import { startSweeper } from './services/labSessionService.js';
import { gns3Gate, authorizeUpgrade, upgradeProxy } from './middleware/gns3Proxy.js';
import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import learnRoutes from './routes/learnRoutes.js';
import labRoutes from './routes/labRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import certRoutes from './routes/certRoutes.js';
import examRoutes, { sharedRouter as examSharedRouter } from './routes/examRoutes.js';
import duelRoutes from './routes/duelRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { anyEventActive } from './config/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

connectDB();

// Nunjucks template engine
const njkEnv = nunjucks.configure(join(__dirname, 'views'), {
  autoescape: true,
  express: app,
  noCache: process.env.NODE_ENV !== 'production',
});
app.set('view engine', 'njk');

// Render Thai Markdown theory to HTML: {{ section.body | markdown | safe }}
marked.setOptions({ breaks: true, gfm: true });
njkEnv.addFilter('markdown', (str) => marked.parse(str || ''));

// Thai date for the dashboard: {{ someDate | thaidate }} → "11 มิ.ย. 2569"
njkEnv.addFilter('thaidate', (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
});

const PROD = process.env.NODE_ENV === 'production';
njkEnv.addGlobal('isProd', PROD);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pingable-dev';
if (PROD && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}
if (PROD) app.set('trust proxy', 1); // behind the HTTPS load balancer

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI, touchAfter: 24 * 3600 }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax', // primary CSRF defence, backed by the origin guard below
    secure: PROD,
    maxAge: 7 * 24 * 3600 * 1000,
  },
});

// GNS3 proxy (Web-UI assets + project-scoped API). Mounted before helmet so
// the proxied Web-UI keeps its own inline scripts, and before the body
// parsers so request bodies stream through untouched.
app.use(gns3Gate(sessionMiddleware));

// Security headers. CSP notes: the DSD renderer injects inline <style> into
// every shadow template (hence style-src 'unsafe-inline'); the lab page
// iframes the GNS3 Web-UI (frame-src must allow the GNS3 origin); fonts come
// from Google Fonts. upgrade-insecure-requests is dropped so the http GNS3
// iframe keeps working in dev.
const GNS3_ORIGIN = (process.env.GNS3_PUBLIC_URL
  || `${process.env.GNS3_HOST || 'http://localhost'}:${process.env.GNS3_PORT || 3080}`).replace(/\/+$/, '');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameSrc: ["'self'", GNS3_ORIGIN],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false, // the GNS3 iframe is cross-origin
  // helmet's default no-referrer policy makes some browsers send
  // "Origin: null" even on same-origin form posts, which broke the CSRF
  // guard below — use the browser-default policy instead.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Request logging (skip static assets; quiet success lines, full error objects)
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => /^\/(css|js|img|favicon)/.test(req.url) },
  customLogLevel: (req, res, err) => ((err || res.statusCode >= 500) ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ status: res.statusCode }),
  },
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use(sessionMiddleware);

// CSRF guard: block state-changing requests only when a header positively
// names a FOREIGN origin. Missing or "null" Origin/Referer (curl, privacy
// extensions, sandboxed contexts, strict referrer policies) pass — a real
// cross-site browser request won't carry our sameSite=lax session cookie
// anyway, so that hole is covered.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const expected = `${req.protocol}://${req.get('host')}`;
  const origin = req.get('origin');
  const referer = req.get('referer');
  const originOk = !origin || origin === 'null' || origin === expected;
  const refererOk = !referer || referer === expected || referer.startsWith(expected + '/');
  if (originOk && refererOk) return next();
  res.status(403).json({ ok: false, error: 'Cross-origin request blocked' });
});

// Pass user to all templates. Normalize emailVerified for sessions that pre-date
// the field: treat absence as verified so the banner doesn't appear for old accounts.
app.use((req, res, next) => {
  const u = req.session.user || null;
  res.locals.user = u ? { ...u, emailVerified: u.emailVerified ?? true } : null;
  res.locals.mentorEnabled = !!process.env.ANTHROPIC_API_KEY; // AI mentor feature flag (§22)
  res.locals.eventsActive = !!u && anyEventActive(); // show Events nav link only when an event is live
  res.locals.origin = `${req.protocol}://${req.get('host')}`; // absolute base for og:image etc.
  next();
});

// Inject Declarative Shadow DOM into <png-*> elements after rendering (SSR + no-JS)
app.use((req, res, next) => {
  const orig = res.render.bind(res);
  res.render = (view, opts, cb) => {
    orig(view, opts, (err, html) => {
      if (err) return cb ? cb(err) : next(err);
      const out = injectDSD(html);
      if (cb) cb(null, out); else res.send(out);
    });
  };
  next();
});

app.get('/health', async (req, res) => {
  const db = mongoose.connection.readyState === 1;
  res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db });
});

// Routes
app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/learn', learnRoutes);
app.use('/lab', labRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/review', reviewRoutes);
app.use('/notes', noteRoutes);
app.use('/u', profileRoutes);
app.use('/cert', certRoutes);
app.use(examSharedRouter);          // /exam/shared/:token (public, before auth-gated /exam)
app.use('/exam', examRoutes);
app.use('/duel', duelRoutes);
app.use('/events', eventRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => res.render('index.njk'));

// 404 — anything that fell through the routes
app.use((req, res) => {
  if (req.method !== 'GET') return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).render('error.njk', { code: 404, message: 'ไม่พบหน้าที่คุณต้องการ — อาจถูกย้ายหรือลบไปแล้ว' });
});

// Global error handler (express-async-errors routes async failures here too).
// GETs are humans → error page; everything else is fetch() → JSON.
app.use((err, req, res, next) => {
  (req.log || logger).error({ err }, 'unhandled route error');
  if (res.headersSent) return next(err);
  if (req.method === 'GET') {
    return res.status(500).render('error.njk', { code: 500, message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
  res.status(500).json({ ok: false, error: 'เกิดข้อผิดพลาดภายในระบบ' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Pingable-Dev running at http://localhost:${PORT}`);
  // Reconcile lab sessions left over from a previous run, then keep sweeping
  // idle sessions / orphaned GNS3 projects.
  startSweeper();
});

// WebSocket upgrades for the proxied GNS3 Web-UI (project notifications +
// node consoles). Authenticate the session on the upgrade request, then only
// forward sockets aimed at the user's own lab project.
server.on('upgrade', (req, socket, head) => {
  sessionMiddleware(req, {}, async () => {
    try {
      if (await authorizeUpgrade(req)) return upgradeProxy(req, socket, head);
    } catch (err) {
      logger.error({ err }, 'gns3-proxy: upgrade authorization failed');
    }
    socket.destroy();
  });
});

// Graceful shutdown: stop accepting connections, let Mongo writes finish.
// Lab sessions live in MongoDB, so nothing is lost across a restart — the
// sweeper reconciles any GNS3 project state on the next boot.
function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    mongoose.disconnect().finally(() => process.exit(0));
  });
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(1), 10000).unref(); // safety net if a connection hangs
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception — exiting');
  process.exit(1);
});
