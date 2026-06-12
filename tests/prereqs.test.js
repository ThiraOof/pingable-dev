process.env.LOG_LEVEL = 'silent';

import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import Course from '../src/models/Course.js';
import Progress, { markComplete } from '../src/models/Progress.js';
import { checkPrerequisites } from '../src/utils/prereqs.js';

const dbUp = await connectTestDb('pingable-test-prereqs');
if (dbUp) await Progress.init(); // markComplete's upsert race relies on the unique index
const opts = { skip: !dbUp && 'MongoDB not reachable' };

const oid = () => new mongoose.Types.ObjectId();
const lesson = (type, title = 'บทเรียน') => ({ type, title });

// A 4-lesson prerequisite course: each completed lesson = 25%.
async function makeRequiredCourse() {
  return Course.create({
    title: 'พื้นฐานเครือข่าย', slug: `basics-${oid()}`,
    modules: [
      { title: 'M1', lessons: [lesson('reading'), lesson('quiz')] },
      { title: 'M2', lessons: [lesson('reading'), lesson('lab')] },
    ],
  });
}

async function complete(userId, courseId, n) {
  for (let i = 0; i < n; i++) await markComplete(userId, courseId, 0, i, 'reading');
}

beforeEach(async () => {
  if (!dbUp) return;
  await Promise.all([Course.deleteMany({}), Progress.deleteMany({})]);
});

after(disconnectTestDb);

// ── checkPrerequisites ───────────────────────────────────────────────────────

test('a course without requiredCourses is always met', opts, async () => {
  const course = await Course.create({ title: 'เปิดเสรี', slug: `open-${oid()}` });
  assert.deepEqual(await checkPrerequisites(oid(), course), { met: true, items: [] });
});

test('unauthenticated user gets actual 0 / met false per item', opts, async () => {
  const rc = await makeRequiredCourse();
  const course = await Course.create({
    title: 'ต่อยอด', slug: `adv-${oid()}`, requiredCourses: [rc._id], requiredPercent: 50,
  });

  const { met, items } = await checkPrerequisites(null, course);
  assert.equal(met, false);
  assert.equal(items.length, 1);
  assert.equal(items[0].actual, 0);
  assert.equal(items[0].required, 50);
  assert.equal(items[0].course.title, 'พื้นฐานเครือข่าย');
});

test('progress below / at the threshold flips met', opts, async () => {
  const rc = await makeRequiredCourse();
  const course = await Course.create({
    title: 'ต่อยอด', slug: `adv-${oid()}`, requiredCourses: [rc._id], requiredPercent: 50,
  });
  const userId = oid();

  await complete(userId, rc._id, 1); // 25% < 50%
  let res = await checkPrerequisites(userId, course);
  assert.equal(res.met, false);
  assert.equal(res.items[0].actual, 25);

  await markComplete(userId, rc._id, 0, 1, 'quiz', 80); // 50% — at the threshold
  res = await checkPrerequisites(userId, course);
  assert.equal(res.met, true);
  assert.equal(res.items[0].actual, 50);
});

test('requiredPercent defaults to 100', opts, async () => {
  const rc = await makeRequiredCourse();
  const course = await Course.create({
    title: 'เข้ม', slug: `strict-${oid()}`, requiredCourses: [rc._id],
  });
  const userId = oid();

  await complete(userId, rc._id, 2); // 2 of 4
  await markComplete(userId, rc._id, 1, 0, 'reading');
  assert.equal((await checkPrerequisites(userId, course)).met, false); // 75%

  await markComplete(userId, rc._id, 1, 1, 'lab', 100);
  assert.equal((await checkPrerequisites(userId, course)).met, true); // 100%
});

test('all required courses must be met, with one items entry each', opts, async () => {
  const rc1 = await makeRequiredCourse();
  const rc2 = await makeRequiredCourse();
  const course = await Course.create({
    title: 'รวม', slug: `multi-${oid()}`, requiredCourses: [rc1._id, rc2._id], requiredPercent: 25,
  });
  const userId = oid();

  await complete(userId, rc1._id, 1); // rc1 25% ✓, rc2 0% ✗
  const { met, items } = await checkPrerequisites(userId, course);
  assert.equal(met, false);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((i) => i.met).sort(), [false, true]);
});

// ── markComplete (atomic progress recording) ─────────────────────────────────

test('markComplete is idempotent — double submit records one entry', opts, async () => {
  const userId = oid(), courseId = oid();
  await markComplete(userId, courseId, 0, 0, 'reading');
  await markComplete(userId, courseId, 0, 0, 'reading');

  const doc = await Progress.findOne({ user: userId, course: courseId });
  assert.equal(doc.completed.length, 1);
});

test('markComplete keeps the best score for graded lessons', opts, async () => {
  const userId = oid(), courseId = oid();
  await markComplete(userId, courseId, 0, 0, 'quiz', 60);
  await markComplete(userId, courseId, 0, 0, 'quiz', 40); // worse retry — keep 60
  let doc = await Progress.findOne({ user: userId, course: courseId });
  assert.equal(doc.completed[0].score, 60);

  await markComplete(userId, courseId, 0, 0, 'quiz', 90); // better retry — take 90
  doc = await Progress.findOne({ user: userId, course: courseId });
  assert.equal(doc.completed[0].score, 90);
  assert.equal(doc.completed.length, 1);
});

test('markComplete survives concurrent calls without duplicating entries', opts, async () => {
  const userId = oid(), courseId = oid();
  await Promise.all([
    markComplete(userId, courseId, 0, 0, 'lab', 50),
    markComplete(userId, courseId, 0, 0, 'lab', 70),
    markComplete(userId, courseId, 0, 1, 'reading'),
  ]);

  const doc = await Progress.findOne({ user: userId, course: courseId });
  assert.equal(doc.completed.length, 2);
  const lab = doc.completed.find((c) => c.lessonIdx === 0);
  assert.ok([50, 70].includes(lab.score)); // best-effort under race; never duplicated
});
