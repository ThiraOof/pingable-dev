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
const GNS3_ORIGIN = `${process.env.GNS3_HOST || 'http://localhost'}:${process.env.GNS3_PORT || 3080}`;
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

// CSRF guard: state-changing requests must come from our own origin. Modern
// browsers always send Origin (or at least Referer) on cross-site POSTs;
// requests with neither header (curl, native form posts in old browsers) pass
// — the sameSite=lax session cookie covers that hole.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const source = req.get('origin') || req.get('referer');
  // 'null' origin comes from sandboxed/redirected contexts — let sameSite=lax cover it
  if (!source || source === 'null') return next();
  const expected = `${req.protocol}://${req.get('host')}`;
  if (!PROD) console.log('[csrf]', { method: req.method, path: req.path, source, expected });
  if (source === expected || source.startsWith(expected + '/')) return next();
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

app.get('/', (req, res) => res.render('index.njk'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pingable-Dev running at http://localhost:${PORT}`);
  // Reconcile lab sessions left over from a previous run, then keep sweeping
  // idle sessions / orphaned GNS3 projects.
  startSweeper();
});
