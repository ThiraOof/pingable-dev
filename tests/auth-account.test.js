process.env.LOG_LEVEL = 'silent';
process.env.LOGIN_LOCK_AFTER = '3'; // keep lockout tests inside the IP rate-limit budget

import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import User from '../src/models/User.js';

const { default: authRoutes } = await import('../src/routes/authRoutes.js');

const dbUp = await connectTestDb('pingable-test-authaccount');
const opts = { skip: !dbUp && 'MongoDB not reachable' };

// Same harness as auth-reset.test.js: real authRoutes, stubbed render.
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
app.use((req, res, next) => {
  req.log = { info: () => {}, warn: () => {}, error: () => {} };
  res.render = (view, locals) => res.json({ view, ...locals });
  next();
});
app.use('/auth', authRoutes);

const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const postForm = (path, fields, cookie) => fetch(`${BASE}${path}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(cookie ? { Cookie: cookie } : {}),
  },
  body: new URLSearchParams(fields),
  redirect: 'manual',
});

const login = (email, password) => postForm('/auth/login', { email, password });

let seq = 0;
const makeUser = () => User.create({
  username: `acct${++seq}`,
  email: `acct${seq}@example.com`,
  password: 'correct1pass',
});

beforeEach(async () => {
  if (!dbUp) return;
  await User.deleteMany({});
});

after(async () => {
  await new Promise((r) => server.close(r));
  await disconnectTestDb();
});

// ── Account lockout ──────────────────────────────────────────────────────────

test('N wrong passwords lock the account — even the right password is then rejected', opts, async () => {
  const user = await makeUser();

  for (let i = 0; i < 3; i++) {
    const d = await (await login(user.email, 'wrong9pass')).json();
    assert.equal(d.error, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'); // generic until the lock trips
  }

  const locked = await (await login(user.email, 'correct1pass')).json();
  assert.match(locked.error, /ล็อกชั่วคราว/);
  const doc = await User.findById(user._id);
  assert.ok(doc.lockUntil > new Date());
});

test('a successful login resets the failure counter', opts, async () => {
  const user = await makeUser();

  await login(user.email, 'wrong9pass');
  await login(user.email, 'wrong9pass');
  const ok = await login(user.email, 'correct1pass');
  assert.equal(ok.status, 302); // 2 failures < 3 → still allowed in, counter cleared

  // two more misses would have locked if the counter had carried over
  await login(user.email, 'wrong9pass');
  await login(user.email, 'wrong9pass');
  const okAgain = await login(user.email, 'correct1pass');
  assert.equal(okAgain.status, 302);
});

test('an expired lock opens again', opts, async () => {
  const user = await makeUser();
  await User.updateOne({ _id: user._id }, { lockUntil: new Date(Date.now() - 1000) });

  const res = await login(user.email, 'correct1pass');
  assert.equal(res.status, 302);
});

// ── Settings / change password ───────────────────────────────────────────────

test('GET /auth/settings requires login', opts, async () => {
  const res = await fetch(`${BASE}/auth/settings`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/auth/login');
});

test('change password: wrong current password and weak new password are rejected', opts, async () => {
  const user = await makeUser();
  const cookie = (await login(user.email, 'correct1pass')).headers.get('set-cookie').split(';')[0];

  const page = await (await fetch(`${BASE}/auth/settings`, { headers: { Cookie: cookie } })).json();
  assert.equal(page.view, 'settings.njk');
  assert.equal(page.account.email, user.email);

  const wrongCurrent = await (await postForm('/auth/settings/password', {
    currentPassword: 'nope9pass', password: 'brandnew99', confirmPassword: 'brandnew99',
  }, cookie)).json();
  assert.equal(wrongCurrent.error, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');

  const weak = await (await postForm('/auth/settings/password', {
    currentPassword: 'correct1pass', password: 'short', confirmPassword: 'short',
  }, cookie)).json();
  assert.ok(weak.error); // same policy as register

  assert.equal(await (await User.findById(user._id)).comparePassword('correct1pass'), true);
});

test('change password: valid request changes the hash', opts, async () => {
  const user = await makeUser();
  const cookie = (await login(user.email, 'correct1pass')).headers.get('set-cookie').split(';')[0];

  const ok = await (await postForm('/auth/settings/password', {
    currentPassword: 'correct1pass', password: 'brandnew99', confirmPassword: 'brandnew99',
  }, cookie)).json();
  assert.equal(ok.info, 'เปลี่ยนรหัสผ่านสำเร็จ');

  const doc = await User.findById(user._id);
  assert.equal(await doc.comparePassword('brandnew99'), true);
  assert.equal(await doc.comparePassword('correct1pass'), false);
});
