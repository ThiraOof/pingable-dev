import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import nunjucks from 'nunjucks';
import session from 'express-session';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import labRoutes from './routes/labRoutes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

connectDB();

// Nunjucks template engine
nunjucks.configure(join(__dirname, 'views'), {
  autoescape: true,
  express: app,
  noCache: process.env.NODE_ENV !== 'production',
});
app.set('view engine', 'njk');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));

// Pass user to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/lab', labRoutes);

app.get('/', (req, res) => res.render('index.njk'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pingable-Dev running at http://localhost:${PORT}`);
});
