process.env.LOG_LEVEL = 'silent';
// Provider creds so google counts as "enabled" for the route guards.
process.env.GOOGLE_CLIENT_ID = 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.APP_URL = 'http://localhost:3000';

import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import User from '../src/models/User.js';

const { findOrCreateUser, linkIdentity } = await import('../src/services/oauthService.js');
const { buildAuthUrl } = await import('../src/services/oauthService.js');
const { isEnabled, enabledProviders } = await import('../src/config/oauth.js');
const { default: authRoutes } = await import('../src/routes/authRoutes.js');

const dbUp = await connectTestDb('pingable-test-oauth');
const opts = { skip: !dbUp && 'MongoDB not reachable' };

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

beforeEach(async () => {
  if (!dbUp) return;
  await User.deleteMany({});
});

after(async () => {
  await new Promise((r) => server.close(r));
  await disconnectTestDb();
});

const profile = (over = {}) => ({
  sub: 'sub-1', email: 'jane@example.com', emailVerified: true, name: 'Jane Doe', ...over,
});

// ── config ────────────────────────────────────────────────────────────────────

test('a provider is enabled only when both id and secret are set', () => {
  assert.equal(isEnabled('google'), true);   // creds set at top
  assert.equal(isEnabled('nope'), false);
  assert.deepEqual(enabledProviders().map((p) => p.key), ['google']);
});

test('buildAuthUrl carries client_id, redirect_uri, scope and state', () => {
  const url = new URL(buildAuthUrl('google', 'xyz'));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'test-google-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/auth/oauth/google/callback');
  assert.equal(url.searchParams.get('state'), 'xyz');
  assert.equal(url.searchParams.get('response_type'), 'code');
});

// ── findOrCreateUser ────────────────────────────────────────────────────────────

test('creates a new account from a verified profile, deriving a username', opts, async () => {
  const user = await findOrCreateUser('google', profile());
  assert.equal(user.email, 'jane@example.com');
  assert.equal(user.emailVerified, true);
  assert.equal(user.username, 'janedoe');
  assert.deepEqual(user.identities.map((i) => i.provider + ':' + i.sub), ['google:sub-1']);
});

test('an existing identity returns the same user (idempotent)', opts, async () => {
  const a = await findOrCreateUser('google', profile());
  const b = await findOrCreateUser('google', profile({ email: 'changed@example.com' }));
  assert.equal(String(a._id), String(b._id));
  assert.equal(await User.countDocuments(), 1);
});

test('links onto an existing password account when the provider email is verified', opts, async () => {
  const existing = await User.create({ username: 'jane', email: 'jane@example.com', password: 'secret12' });
  const linked = await findOrCreateUser('google', profile());
  assert.equal(String(linked._id), String(existing._id)); // same account
  assert.equal(await User.countDocuments(), 1);
  assert.equal(linked.identities[0].provider, 'google');
  assert.equal(linked.emailVerified, true);
});

test('does NOT link (and does not collide) when the provider email is unverified', opts, async () => {
  const existing = await User.create({ username: 'jane', email: 'jane@example.com', password: 'secret12' });
  const created = await findOrCreateUser('google', profile({ emailVerified: false }));
  assert.notEqual(String(created._id), String(existing._id)); // separate account
  assert.equal(await User.countDocuments(), 2);
  assert.notEqual(created.email, 'jane@example.com'); // placeholder, not the taken email
  assert.equal(created.emailVerified, false);
});

test('an OAuth-only account has no password and refuses password login', opts, async () => {
  const user = await findOrCreateUser('google', profile());
  const doc = await User.findById(user._id);
  assert.equal(doc.password, undefined);
  assert.equal(await doc.comparePassword('anything'), false);
});

// ── linkIdentity ─────────────────────────────────────────────────────────────

test('linkIdentity attaches an identity to a logged-in account', opts, async () => {
  const user = await User.create({ username: 'bob', email: 'bob@example.com', password: 'secret12' });
  await linkIdentity(user._id, 'google', profile({ sub: 'bob-sub', email: 'bob@example.com' }));
  const doc = await User.findById(user._id);
  assert.equal(doc.identities.length, 1);
  assert.equal(doc.identities[0].sub, 'bob-sub');
});

test('linkIdentity refuses an identity already claimed by another account', opts, async () => {
  await findOrCreateUser('google', profile({ sub: 'shared' }));
  const other = await User.create({ username: 'bob', email: 'bob@example.com', password: 'secret12' });
  await assert.rejects(
    () => linkIdentity(other._id, 'google', profile({ sub: 'shared', email: 'bob@example.com' })),
    (e) => e.code === 'IDENTITY_TAKEN',
  );
});

// ── route guards (no network) ──────────────────────────────────────────────────

test('GET /auth/oauth/google redirects to the provider authorize URL', async () => {
  const res = await fetch(`${BASE}/auth/oauth/google`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^https:\/\/accounts\.google\.com\/o\/oauth2/);
});

test('GET /auth/oauth/<unconfigured> is a 404', async () => {
  const res = await fetch(`${BASE}/auth/oauth/nope`, { redirect: 'manual' });
  assert.equal(res.status, 404);
});

test('callback with a mismatched state is rejected before any token exchange', async () => {
  const res = await fetch(`${BASE}/auth/oauth/google/callback?code=abc&state=wrong`, { redirect: 'manual' });
  const body = await res.json();
  assert.equal(body.view, 'login.njk');
  assert.match(body.error, /หมดอายุหรือไม่ถูกต้อง/);
});
