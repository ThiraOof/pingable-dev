process.env.LOG_LEVEL = 'silent';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  totalLessons, lessonCounts, coursePercent, completedSet, lessonKey,
} from '../src/models/Progress.js';

const lesson = (type) => ({ type, title: 't' });
const course = {
  modules: [
    { title: 'M1', lessons: [lesson('reading'), lesson('lab'), lesson('quiz')] },
    { title: 'M2', lessons: [lesson('reading'), lesson('reading')] },
    { title: 'M3 (no lessons)' },
  ],
};

test('totalLessons counts across modules, tolerating missing arrays', () => {
  assert.equal(totalLessons(course), 5);
  assert.equal(totalLessons({}), 0);
  assert.equal(totalLessons({ modules: [] }), 0);
});

test('lessonCounts tallies by type', () => {
  assert.deepEqual(lessonCounts(course), { readings: 3, labs: 1, quizzes: 1 });
});

test('coursePercent rounds and clamps', () => {
  const done = (n) => ({ completed: new Array(n).fill({ moduleIdx: 0, lessonIdx: 0 }) });
  assert.equal(coursePercent(course, null), 0);
  assert.equal(coursePercent(course, done(1)), 20);
  assert.equal(coursePercent(course, done(2)), 40);
  // stale progress can hold more entries than the (re-seeded) course has lessons → cap at 100
  assert.equal(coursePercent(course, done(7)), 100);
  // a course with no lessons can't be divided by zero
  assert.equal(coursePercent({ modules: [] }, done(3)), 0);
});

test('completedSet / lessonKey give "m-l" lookup keys', () => {
  assert.equal(lessonKey(2, 3), '2-3');
  const set = completedSet({ completed: [{ moduleIdx: 0, lessonIdx: 1 }, { moduleIdx: 2, lessonIdx: 0 }] });
  assert.deepEqual([...set].sort(), ['0-1', '2-0']);
  assert.deepEqual(completedSet(null), new Set());
});
