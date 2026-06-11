import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import nunjucks from 'nunjucks';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import { marked } from 'marked';

import connectDB from './config/db.js';
import { injectDSD } from './dsd.js';
import { startSweeper } from './services/labSessionService.js';
import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import learnRoutes from './routes/learnRoutes.js';
import labRoutes from './routes/labRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pingable-dev';
if (PROD && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}
if (PROD) app.set('trust proxy', 1); // behind the HTTPS load balancer

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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use(session({
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
}));

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

// Pass user to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
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

// Routes
app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/learn', learnRoutes);
app.use('/lab', labRoutes);
app.use('/dashboard', dashboardRoutes);

app.get('/', (req, res) => res.render('index.njk'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pingable-Dev running at http://localhost:${PORT}`);
  // Reconcile lab sessions left over from a previous run, then keep sweeping
  // idle sessions / orphaned GNS3 projects.
  startSweeper();
});
