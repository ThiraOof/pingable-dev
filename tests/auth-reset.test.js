process.env.LOG_LEVEL = 'silent';

import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import User from '../src/models/User.js';
import { issueResetToken, findUserByResetToken, resetPassword } from '../src/services/passwordResetService.js';

// authRoutes pulls in the logger via emailService — import it dynamically so
// the LOG_LEVEL above (static imports are hoisted past it) is in effect first.
const { default: authRoutes } = await import('../src/routes/authRoutes.js');

const dbUp = await connectTestDb('pingable-test-authreset');
const opts = { skip: !dbUp && 'MongoDB not reachable' };

// Minimal harness around the real authRoutes: session + body parsing as in
// server.js, but res.render is stubbed to JSON so views aren't exercised here.
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

const postForm = (path, fields) => fetch(`${BASE}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields),
  redirect: 'manual',
});

let seq = 0;
const makeUser = () => User.create({
  username: `user${++seq}`,
  email: `user${seq}@example.com`,
  password: 'oldpass123',
});

beforeEach(async () => {
  if (!dbUp) return;
  await User.deleteMany({});
});

after(async () => {
  await new Promise((r) => server.close(r));
  await disconnectTestDb();
});

// ── passwordResetService ─────────────────────────────────────────────────────

test('issueResetToken: unknown email yields null, no user touched', opts, async () => {
  assert.equal(await issueResetToken('nobody@example.com'), null);
});

test('only the sha256 of the token is stored, never the raw token', opts, async () => {
  const user = await makeUser();
  const token = await issueResetToken(user.email);
  const doc = await User.findById(user._id);
  assert.equal(token.length, 64); // 32 random bytes, hex
  assert.notEqual(doc.resetTokenHash, token);
  assert.match(doc.resetTokenHash, /^[0-9a-f]{64}$/);
  assert.ok(doc.resetTokenExp > new Date());
});

test('full cycle: issue → reset → new password works, token consumed, email verified', opts, async () => {
  const user = await makeUser();
  const token = await issueResetToken(user.email);

  const updated = await resetPassword(token, 'newpass456');
  assert.equal(String(updated._id), String(user._id));
  assert.equal(await updated.comparePassword('newpass456'), true);
  assert.equal(await updated.comparePassword('oldpass123'), false);
  assert.equal(updated.emailVerified, true); // the link proved mailbox ownership
  assert.equal(updated.resetTokenHash, undefined);

  // single-use: the same link can't reset again
  assert.equal(await resetPassword(token, 'anotherpass1'), null);
});

test('a wrong or expired token resets nothing', opts, async () => {
  const user = await makeUser();
  const token = await issueResetToken(user.email);

  assert.equal(await resetPassword('f'.repeat(64), 'newpass456'), null);

  await User.updateOne({ _id: user._id }, { resetTokenExp: new Date(Date.now() - 1000) });
  assert.equal(await findUserByResetToken(token), null);
  assert.equal(await resetPassword(token, 'newpass456'), null);
  assert.equal(await (await User.findById(user._id)).comparePassword('oldpass123'), true);
});

test('re-issuing invalidates the previous link (only the newest works)', opts, async () => {
  const user = await makeUser();
  const first = await issueResetToken(user.email);
  const second = await issueResetToken(user.email);

  assert.equal(await findUserByResetToken(first), null);
  assert.ok(await findUserByResetToken(second));
});

// ── HTTP routes ──────────────────────────────────────────────────────────────

test('POST /auth/forgot-password answers identically for known and unknown emails', opts, async () => {
  const user = await makeUser();

  const known = await (await postForm('/auth/forgot-password', { email: user.email })).json();
  const unknown = await (await postForm('/auth/forgot-password', { email: 'ghost@example.com' })).json();
  assert.deepEqual(known, unknown); // no account enumeration

  const doc = await User.findById(user._id);
  assert.ok(doc.resetTokenHash); // but the real account did get a token
});

test('GET /auth/reset-password/:token shows the form only for a valid token', opts, async () => {
  const user = await makeUser();
  const token = await issueResetToken(user.email);

  const good = await (await fetch(`${BASE}/auth/reset-password/${token}`)).json();
  assert.equal(good.view, 'reset-password.njk');
  assert.equal(good.token, token);

  const bad = await (await fetch(`${BASE}/auth/reset-password/${'f'.repeat(64)}`)).json();
  assert.equal(bad.view, 'forgot-password.njk');
  assert.ok(bad.error);
});

test('POST /auth/reset-password enforces the same password policy as register', opts, async () => {
  const user = await makeUser();
  const token = await issueResetToken(user.email);

  const weak = await (await postForm('/auth/reset-password', {
    token, password: 'short', confirmPassword: 'short',
  })).json();
  assert.equal(weak.view, 'reset-password.njk');
  assert.ok(weak.error);
  assert.equal(weak.token, token); // form keeps the token for the retry

  const mismatch = await (await postForm('/auth/reset-password', {
    token, password: 'newpass456', confirmPassword: 'newpass457',
  })).json();
  assert.ok(mismatch.error);

  // policy failures must not consume the token
  assert.ok(await findUserByResetToken(token));
});

test('POST /auth/reset-password with a valid token redirects to login and changes the password', opts, async () => {
  const user = await makeUser();
  const token = await issueResetToken(user.email);

  const res = await postForm('/auth/reset-password', {
    token, password: 'newpass456', confirmPassword: 'newpass456',
  });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/auth/login?info=reset');
  assert.equal(await (await User.findById(user._id)).comparePassword('newpass456'), true);
});
