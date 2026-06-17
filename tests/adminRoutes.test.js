process.env.LOG_LEVEL = 'silent';

// /admin route logic: the requireAdmin gate (anon → login, student → 403,
// admin → page), the paginated users table + DB-computed stats/progress
// summary, and the role promote/demote action with its self-demote guard.
// HTTP is exercised end-to-end through a minimal app (helpers/routeApp) with a
// faked session carrying a role. GNS3 is faked only because adminRoutes pulls
// in labSessionService (which freezes the GNS3 base URL at import).

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startFakeGns3 } from './helpers/fakeGns3.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import { startRouteApp } from './helpers/routeApp.js';

// fake GNS3 must exist BEFORE the service is imported (it freezes the base URL).
const fake = await startFakeGns3();
process.env.GNS3_HOST = 'http://127.0.0.1';
process.env.GNS3_PORT = String(fake.port);
delete process.env.GNS3_PUBLIC_URL;

const { default: adminRoutes } = await import('../src/routes/adminRoutes.js');
const { default: User } = await import('../src/models/User.js');
const { default: Course } = await import('../src/models/Course.js');
const { default: Progress } = await import('../src/models/Progress.js');
const { default: LabSession } = await import('../src/models/LabSession.js');
const { default: LabAttempt } = await import('../src/models/LabAttempt.js');
const { default: UserStats } = await import('../src/models/UserStats.js');
const { default: AdminAction } = await import('../src/models/AdminAction.js');

const dbUp = await connectTestDb('pingable-test-adminroutes');
const opts = { skip: !dbUp && 'MongoDB not reachable' };

let app;
before(async () => { app = await startRouteApp((a) => { a.use('/admin', adminRoutes); }); });
after(async () => { await app?.close(); await disconnectTestDb(); await fake.close(); });
beforeEach(async () => {
  if (!dbUp) return;
  await Promise.all([User.deleteMany({}), Course.deleteMany({}), Progress.deleteMany({}),
    LabSession.deleteMany({}), LabAttempt.deleteMany({}), UserStats.deleteMany({}), AdminAction.deleteMany({})]);
  fake.projects.clear(); fake.deleted.length = 0;
});

const mkUser = (over = {}) => User.create({
  username: over.username || `u${Math.random().toString(36).slice(2, 9)}`,
  email: over.email || `${Math.random().toString(36).slice(2, 9)}@t.co`,
  password: 'pw123456',
  ...over,
});

// ── requireAdmin gate ─────────────────────────────────────────────────────────

test('anonymous → redirected to login', opts, async () => {
  const r = await app.request('/admin');
  assert.equal(r.status, 302);
  assert.match(r.location, /\/auth\/login/);
});

test('student → 403', opts, async () => {
  const r = await app.request('/admin', { user: String(new mongoose.Types.ObjectId()), role: 'student' });
  assert.equal(r.status, 403);
});

test('admin → renders admin.njk', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request('/admin', { user: String(admin._id), role: 'admin' });
  assert.equal(r.status, 200);
  assert.equal(r.json.__render, 'admin.njk');
});

// ── stats + progress summary ───────────────────────────────────────────────────

test('stats count users/admins and total lessons done', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const student = await mkUser();
  await Progress.create({ user: student._id, course: new mongoose.Types.ObjectId(), completed: [
    { moduleIdx: 0, lessonIdx: 0, type: 'reading' },
    { moduleIdx: 0, lessonIdx: 1, type: 'lab', score: 90 },
    { moduleIdx: 0, lessonIdx: 2, type: 'quiz', score: 80 },
  ] });

  const r = await app.request('/admin', { user: String(admin._id), role: 'admin' });
  assert.equal(r.json.stats.totalUsers, 2);
  assert.equal(r.json.stats.adminCount, 1);
  assert.equal(r.json.stats.totalLessonsDone, 3);

  const row = r.json.userRows.find((u) => String(u._id) === String(student._id));
  assert.equal(row.lessonsDone, 3);
  assert.equal(row.labsPassed, 1);
  assert.equal(row.quizzesPassed, 1);
});

// ── pagination ─────────────────────────────────────────────────────────────────

test('users table paginates at 25 per page', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  // 24 more + admin = 25 on page 1; add 5 more → 30 total, page 2 has 5.
  for (let i = 0; i < 29; i++) await mkUser();

  const p1 = await app.request('/admin', { user: String(admin._id), role: 'admin' });
  assert.equal(p1.json.pagination.totalUsers, 30);
  assert.equal(p1.json.pagination.totalPages, 2);
  assert.equal(p1.json.pagination.page, 1);
  assert.equal(p1.json.userRows.length, 25);

  const p2 = await app.request('/admin?page=2', { user: String(admin._id), role: 'admin' });
  assert.equal(p2.json.pagination.page, 2);
  assert.equal(p2.json.userRows.length, 5);
});

test('out-of-range page clamps to last page', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request('/admin?page=999', { user: String(admin._id), role: 'admin' });
  assert.equal(r.json.pagination.page, 1); // only one page exists
});

// ── role promote / demote ──────────────────────────────────────────────────────

test('admin promotes a student to admin', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const target = await mkUser();
  const r = await app.request(`/admin/users/${target._id}/role`, {
    method: 'POST', user: String(admin._id), role: 'admin', body: { role: 'admin' },
  });
  assert.equal(r.status, 302);
  const after = await User.findById(target._id).select('role').lean();
  assert.equal(after.role, 'admin');
});

test('admin demotes another admin to student', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const target = await mkUser({ role: 'admin' });
  await app.request(`/admin/users/${target._id}/role`, {
    method: 'POST', user: String(admin._id), role: 'admin', body: { role: 'student' },
  });
  const after = await User.findById(target._id).select('role').lean();
  assert.equal(after.role, 'student');
});

test('admin cannot self-demote (lockout guard)', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request(`/admin/users/${admin._id}/role`, {
    method: 'POST', user: String(admin._id), role: 'admin', body: { role: 'student' },
  });
  assert.equal(r.status, 400);
  const after = await User.findById(admin._id).select('role').lean();
  assert.equal(after.role, 'admin'); // unchanged
});

test('student cannot change roles (403)', opts, async () => {
  const actor = await mkUser();
  const target = await mkUser();
  const r = await app.request(`/admin/users/${target._id}/role`, {
    method: 'POST', user: String(actor._id), role: 'student', body: { role: 'admin' },
  });
  assert.equal(r.status, 403);
  const after = await User.findById(target._id).select('role').lean();
  assert.equal(after.role, 'student'); // unchanged
});

test('role change on missing user → 404', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request(`/admin/users/${new mongoose.Types.ObjectId()}/role`, {
    method: 'POST', user: String(admin._id), role: 'admin', body: { role: 'admin' },
  });
  assert.equal(r.status, 404);
});

// ── stop session ───────────────────────────────────────────────────────────────

test('stopping a missing session → 404', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request(`/admin/sessions/${new mongoose.Types.ObjectId()}/stop`, {
    method: 'POST', user: String(admin._id), role: 'admin',
  });
  assert.equal(r.status, 404);
});

test('student cannot stop sessions (403)', opts, async () => {
  const r = await app.request(`/admin/sessions/${new mongoose.Types.ObjectId()}/stop`, {
    method: 'POST', user: String(new mongoose.Types.ObjectId()), role: 'student',
  });
  assert.equal(r.status, 403);
});

// ── course publish toggle ──────────────────────────────────────────────────────

test('admin publishes a hidden course', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const c = await Course.create({ title: 'C', slug: 'c', published: false });
  const r = await app.request(`/admin/courses/${c._id}/publish`, {
    method: 'POST', user: String(admin._id), role: 'admin', body: { published: 'true' },
  });
  assert.equal(r.status, 302);
  const after = await Course.findById(c._id).select('published').lean();
  assert.equal(after.published, true);
});

test('admin unpublishes a course', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const c = await Course.create({ title: 'C', slug: 'c', published: true });
  await app.request(`/admin/courses/${c._id}/publish`, {
    method: 'POST', user: String(admin._id), role: 'admin', body: { published: 'false' },
  });
  const after = await Course.findById(c._id).select('published').lean();
  assert.equal(after.published, false);
});

test('student cannot toggle course publish (403)', opts, async () => {
  const c = await Course.create({ title: 'C', slug: 'c', published: false });
  const r = await app.request(`/admin/courses/${c._id}/publish`, {
    method: 'POST', user: String(new mongoose.Types.ObjectId()), role: 'student', body: { published: 'true' },
  });
  assert.equal(r.status, 403);
  const after = await Course.findById(c._id).select('published').lean();
  assert.equal(after.published, false); // unchanged
});

test('publish toggle on missing course → 404', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request(`/admin/courses/${new mongoose.Types.ObjectId()}/publish`, {
    method: 'POST', user: String(admin._id), role: 'admin', body: { published: 'true' },
  });
  assert.equal(r.status, 404);
});

test('admin page lists all courses incl. unpublished, stats count only published', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  await Course.create({ title: 'Pub', slug: 'pub', published: true });
  await Course.create({ title: 'Hidden', slug: 'hid', published: false });
  const r = await app.request('/admin', { user: String(admin._id), role: 'admin' });
  assert.equal(r.json.courses.length, 2);
  assert.equal(r.json.stats.totalCourses, 1);
});

// ── manual orphan sweep ────────────────────────────────────────────────────────

test('clean-orphans deletes aged orphans, spares fresh, reports count', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  // Project name embeds creation ms — old (>10 min) is reaped, fresh is spared.
  fake.seedProject('old', `pingable_${Date.now() - 3600_000}_lab`);
  fake.seedProject('fresh', `pingable_${Date.now()}_lab`);
  fake.seedProject('foreign', 'someone-elses-project');

  const r = await app.request('/admin/gns3/clean-orphans', {
    method: 'POST', user: String(admin._id), role: 'admin',
  });
  assert.equal(r.status, 302);
  assert.equal(r.location, '/admin?orphans=1');
  assert.deepEqual(fake.deleted, ['old']);
});

test('clean-orphans skips a project a session still references', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  fake.seedProject('busy', `pingable_${Date.now() - 3600_000}_lab`);
  await LabSession.create({ user: admin._id, course: new mongoose.Types.ObjectId(), moduleIdx: 0, lessonIdx: 0, projectId: 'busy', status: 'ready' });

  const r = await app.request('/admin/gns3/clean-orphans', {
    method: 'POST', user: String(admin._id), role: 'admin',
  });
  assert.equal(r.location, '/admin?orphans=0');
  assert.equal(fake.deleted.length, 0);
});

test('student cannot clean orphans (403)', opts, async () => {
  const r = await app.request('/admin/gns3/clean-orphans', {
    method: 'POST', user: String(new mongoose.Types.ObjectId()), role: 'student',
  });
  assert.equal(r.status, 403);
});

// ── user search ────────────────────────────────────────────────────────────────

test('search filters users by username/email substring', opts, async () => {
  const admin = await mkUser({ role: 'admin', username: 'rootadmin', email: 'root@x.co' });
  await mkUser({ username: 'alice', email: 'alice@example.com' });
  await mkUser({ username: 'bob', email: 'bob@example.com' });

  const r = await app.request('/admin?q=alice', { user: String(admin._id), role: 'admin' });
  assert.equal(r.json.pagination.matchedUsers, 1);
  assert.equal(r.json.userRows.length, 1);
  assert.equal(r.json.userRows[0].username, 'alice');
  // global stat stays the full count, not the filtered one
  assert.equal(r.json.stats.totalUsers, 3);
});

test('search matches on email too', opts, async () => {
  const admin = await mkUser({ role: 'admin', email: 'root@x.co' });
  await mkUser({ username: 'carol', email: 'special@domain.io' });
  const r = await app.request('/admin?q=special@domain', { user: String(admin._id), role: 'admin' });
  assert.equal(r.json.userRows.length, 1);
  assert.equal(r.json.userRows[0].username, 'carol');
});

// ── user detail ────────────────────────────────────────────────────────────────

test('user detail renders with progress + attempts', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const u = await mkUser();
  const courseId = new mongoose.Types.ObjectId();
  await Progress.create({ user: u._id, course: courseId, completed: [{ moduleIdx: 0, lessonIdx: 0, type: 'lab', score: 90 }] });
  await LabAttempt.create({ user: u._id, course: courseId, moduleIdx: 0, lessonIdx: 0, pct: 90, passed: true, score: 9, total: 10 });
  await UserStats.create({ user: u._id, xp: 120 });

  const r = await app.request(`/admin/users/${u._id}`, { user: String(admin._id), role: 'admin' });
  assert.equal(r.status, 200);
  assert.equal(r.json.__render, 'admin-user.njk');
  assert.equal(r.json.detail.username, u.username);
  assert.equal(r.json.progressRows.length, 1);
  assert.equal(r.json.attempts.length, 1);
  assert.equal(r.json.level.level >= 1, true);
});

test('user detail never leaks the password hash', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const u = await mkUser();
  const r = await app.request(`/admin/users/${u._id}`, { user: String(admin._id), role: 'admin' });
  assert.equal(r.json.detail.password, undefined);
  assert.equal(r.json.detail.hasPassword, true);
});

test('user detail on missing user → 404', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request(`/admin/users/${new mongoose.Types.ObjectId()}`, { user: String(admin._id), role: 'admin' });
  assert.equal(r.status, 404);
});

test('student cannot view user detail (403)', opts, async () => {
  const u = await mkUser();
  const r = await app.request(`/admin/users/${u._id}`, { user: String(new mongoose.Types.ObjectId()), role: 'student' });
  assert.equal(r.status, 403);
});

// ── account actions ─────────────────────────────────────────────────────────────

test('unlock clears lock + failed-login counter', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const u = await mkUser({ failedLogins: 9, lockUntil: new Date(Date.now() + 600_000) });
  const r = await app.request(`/admin/users/${u._id}/unlock`, { method: 'POST', user: String(admin._id), role: 'admin' });
  assert.equal(r.status, 302);
  const after = await User.findById(u._id).select('failedLogins lockUntil').lean();
  assert.equal(after.failedLogins, 0);
  assert.equal(after.lockUntil, undefined);
});

test('verify marks email verified', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const u = await mkUser({ emailVerified: false });
  await app.request(`/admin/users/${u._id}/verify`, { method: 'POST', user: String(admin._id), role: 'admin' });
  const after = await User.findById(u._id).select('emailVerified').lean();
  assert.equal(after.emailVerified, true);
});

test('reset-password issues a reset token', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const u = await mkUser();
  const r = await app.request(`/admin/users/${u._id}/reset-password`, { method: 'POST', user: String(admin._id), role: 'admin' });
  assert.match(r.location, /done=reset/);
  const after = await User.findById(u._id).select('resetTokenHash resetTokenExp').lean();
  assert.ok(after.resetTokenHash, 'reset token hash was stored');
  assert.ok(after.resetTokenExp > new Date(), 'token has a future expiry');
});

test('student cannot run account actions (403)', opts, async () => {
  const u = await mkUser();
  const r = await app.request(`/admin/users/${u._id}/unlock`, { method: 'POST', user: String(new mongoose.Types.ObjectId()), role: 'student' });
  assert.equal(r.status, 403);
});

// ── delete account ───────────────────────────────────────────────────────────────

test('delete removes the user and everything they own', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const u = await mkUser();
  const courseId = new mongoose.Types.ObjectId();
  await Progress.create({ user: u._id, course: courseId, completed: [] });
  await LabAttempt.create({ user: u._id, course: courseId, moduleIdx: 0, lessonIdx: 0, pct: 50, passed: false, score: 5, total: 10 });
  await UserStats.create({ user: u._id, xp: 10 });

  const r = await app.request(`/admin/users/${u._id}/delete`, { method: 'POST', user: String(admin._id), role: 'admin' });
  assert.equal(r.status, 302);
  assert.match(r.location, /\/admin\?deleted=/);
  assert.equal(await User.findById(u._id), null);
  assert.equal(await Progress.countDocuments({ user: u._id }), 0);
  assert.equal(await LabAttempt.countDocuments({ user: u._id }), 0);
  assert.equal(await UserStats.countDocuments({ user: u._id }), 0);
});

test('admin cannot delete their own account', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request(`/admin/users/${admin._id}/delete`, { method: 'POST', user: String(admin._id), role: 'admin' });
  assert.equal(r.status, 400);
  assert.ok(await User.findById(admin._id), 'account still exists');
});

test('delete on missing user → 404', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request(`/admin/users/${new mongoose.Types.ObjectId()}/delete`, { method: 'POST', user: String(admin._id), role: 'admin' });
  assert.equal(r.status, 404);
});

// ── audit log ────────────────────────────────────────────────────────────────

test('role change writes an audit entry', opts, async () => {
  const admin = await mkUser({ role: 'admin', username: 'theboss' });
  const target = await mkUser({ username: 'pawn' });
  await app.request(`/admin/users/${target._id}/role`, {
    method: 'POST', user: String(admin._id), username: 'theboss', role: 'admin', body: { role: 'admin' },
  });
  const log = await AdminAction.findOne({ action: 'user.role' }).lean();
  assert.ok(log, 'an audit entry was created');
  assert.equal(log.actorName, 'theboss');
  assert.equal(String(log.actor), String(admin._id));
  assert.equal(log.targetLabel, 'pawn');
  assert.equal(log.meta.role, 'admin');
});

test('delete writes an audit entry that survives the user', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const target = await mkUser({ username: 'goner' });
  await app.request(`/admin/users/${target._id}/delete`, { method: 'POST', user: String(admin._id), role: 'admin' });
  const log = await AdminAction.findOne({ action: 'user.delete' }).lean();
  assert.equal(log.targetLabel, 'goner'); // readable even though the user is gone
  assert.equal(await User.findById(target._id), null);
});

test('a no-op role change writes NO audit entry', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const target = await mkUser({ role: 'admin' }); // already admin
  await app.request(`/admin/users/${target._id}/role`, {
    method: 'POST', user: String(admin._id), role: 'admin', body: { role: 'admin' },
  });
  assert.equal(await AdminAction.countDocuments({ action: 'user.role' }), 0);
});

test('admin page surfaces recent audit rows, newest first', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const t1 = await mkUser({ username: 'first' });
  const t2 = await mkUser({ username: 'second' });
  await app.request(`/admin/users/${t1._id}/verify`, { method: 'POST', user: String(admin._id), role: 'admin' });
  await app.request(`/admin/users/${t2._id}/verify`, { method: 'POST', user: String(admin._id), role: 'admin' });

  const r = await app.request('/admin', { user: String(admin._id), role: 'admin' });
  assert.equal(r.json.auditRows.length, 2);
  assert.equal(r.json.auditRows[0].target, 'second'); // most recent on top
  assert.equal(r.json.auditRows[0].label, 'ยืนยันอีเมล');
});

test('orphan sweep writes an audit entry', opts, async () => {
  const admin = await mkUser({ role: 'admin' });
  const r = await app.request('/admin/gns3/clean-orphans', { method: 'POST', user: String(admin._id), role: 'admin' });
  assert.equal(r.status, 302);
  const log = await AdminAction.findOne({ action: 'gns3.clean-orphans' }).lean();
  assert.ok(log, 'orphan sweep was logged');
  assert.equal(log.meta.deleted, 0);
});
