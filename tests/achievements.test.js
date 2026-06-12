process.env.LOG_LEVEL = 'silent';

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import { award, getStats, bangkokDay } from '../src/services/achievementService.js';
import UserStats from '../src/models/UserStats.js';
import XpEvent from '../src/models/XpEvent.js';
import { XP } from '../src/config/xp.js';

const dbUp = await connectTestDb('pingable-test-achievements');
if (dbUp) await UserStats.init(); // unique index on user — the create-race fallback needs it
const opts = { skip: !dbUp && 'MongoDB not reachable' };

const oid = () => new mongoose.Types.ObjectId();
const yesterday = () => bangkokDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
const longAgo = () => bangkokDay(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));

// ctx ของการตรวจ lab ผ่านครั้งแรกแบบหมดจด (one-shot, ไม่ใช้ hint)
// hourBangkok ตรึงเป็นเที่ยงวัน — กัน night-owl ติดมาเมื่อรันเทสต์กลางดึก
const cleanPass = {
  passed: true, pct: 100, firstCompletion: true,
  passedChecks: 5, attemptNumber: 1, failedBefore: 0, hintsUsed: 0,
  durationMin: 30, estMinutes: 30, hourBangkok: 12,
};

beforeEach(async () => {
  if (!dbUp) return;
  await UserStats.deleteMany({});
  await XpEvent.deleteMany({});
});

after(disconnectTestDb);

test('first clean lab pass: full XP (base + no-hint + combo + daily), badges, streak day 1', opts, async () => {
  const user = oid();
  const r = await award(user, 'grade', cleanPass);

  assert.equal(r.xpGained, XP.labPass + XP.noHint + XP.combo + XP.daily);
  assert.equal(r.streak.current, 1);
  assert.equal(r.streak.daily, true);
  const ids = r.newBadges.map((b) => b.id).sort();
  assert.deepEqual(ids, ['first-ping', 'no-hint', 'one-shot']);

  const stats = await getStats(user);
  assert.equal(stats.xp, r.xpGained);
  assert.equal(stats.counters.labsPassed, 1);
  assert.equal(stats.counters.checksPassed, 5);
  assert.equal(stats.badges.length, 3);

  const events = await XpEvent.find({ user });
  assert.equal(events.length, 1);
  assert.equal(events[0].amount, r.xpGained);
});

test('re-grading the same lab gives no XP (anti-farm) and no duplicate badges', opts, async () => {
  const user = oid();
  await award(user, 'grade', cleanPass);
  const r = await award(user, 'grade', { ...cleanPass, firstCompletion: false, attemptNumber: 2 });

  assert.equal(r.xpGained, 0); // ไม่ใช่ first completion + daily ถูก claim ไปแล้ว
  assert.equal(r.newBadges.length, 0);
  const stats = await getStats(user);
  assert.equal(stats.badges.length, 3);
  assert.equal(stats.counters.checksPassed, 10); // counter สะสมยังเดิน
});

test('hints reduce lab XP (floor at labXpMin) and forfeit the no-hint bonus', opts, async () => {
  const user = oid();
  const r = await award(user, 'grade', { ...cleanPass, pct: 80, attemptNumber: 2, hintsUsed: 2 });
  // base = max(min, 50 - 2*5) = 40, ไม่มี no-hint, ไม่มี combo (+daily)
  assert.equal(r.xpGained, XP.labPass - 2 * XP.hintPenalty + XP.daily);
  assert.ok(!r.newBadges.some((b) => b.id === 'no-hint' || b.id === 'one-shot'));

  const many = await award(oid(), 'grade', { ...cleanPass, pct: 70, attemptNumber: 3, hintsUsed: 20 });
  assert.equal(many.xpGained, XP.labXpMin + XP.daily); // ติด floor
});

test('streak: consecutive day increments, gap resets, longest is kept', opts, async () => {
  const user = oid();
  await award(user, 'grade', cleanPass);
  await UserStats.updateOne({ user }, { $set: { 'streak.lastActiveDay': yesterday(), 'streak.current': 6, 'streak.longest': 6 } });

  const r = await award(user, 'reading', { firstCompletion: true });
  assert.equal(r.streak.current, 7);
  assert.ok(r.newBadges.some((b) => b.id === 'streak-7')); // trigger 'streak' จากเหตุการณ์ใดก็ได้

  await UserStats.updateOne({ user }, { $set: { 'streak.lastActiveDay': longAgo() } });
  const r2 = await award(user, 'reading', { firstCompletion: false });
  assert.equal(r2.streak.current, 1); // ขาด → รีเซ็ต
  const stats = await getStats(user);
  assert.equal(stats.streak.longest, 7); // สถิติสูงสุดไม่หาย
});

test('daily bonus is claimed once per Bangkok day across events', opts, async () => {
  const user = oid();
  const a = await award(user, 'reading', { firstCompletion: true });
  const b = await award(user, 'reading', { firstCompletion: true });
  assert.equal(a.xpGained, XP.reading + XP.daily);
  assert.equal(b.xpGained, XP.reading); // วันเดียวกัน — ไม่มีโบนัสซ้ำ
});

test('perfect quiz: pass XP + perfect bonus + badge; repeat completion gives 0', opts, async () => {
  const user = oid();
  const r = await award(user, 'quiz', { passed: true, pct: 100, firstCompletion: true });
  assert.equal(r.xpGained, XP.quizPass + XP.quizPerfectBonus + XP.daily);
  assert.ok(r.newBadges.some((b) => b.id === 'perfect-quiz'));

  const again = await award(user, 'quiz', { passed: true, pct: 100, firstCompletion: false });
  assert.equal(again.xpGained, 0);
});

test('comeback badge: passing after >= 3 failed attempts', opts, async () => {
  const r = await award(oid(), 'grade', { ...cleanPass, pct: 80, attemptNumber: 5, failedBefore: 4, hintsUsed: 1 });
  assert.ok(r.newBadges.some((b) => b.id === 'comeback'));
});

test('level up is reported when xp crosses a threshold', opts, async () => {
  const user = oid();
  await UserStats.create({ user, xp: 90, streak: { current: 1, longest: 1, lastActiveDay: bangkokDay() } });
  const r = await award(user, 'quiz', { passed: true, pct: 80, firstCompletion: true }); // +20 → ข้าม 100
  assert.ok(r.levelUp);
  assert.equal(r.levelUp.title, 'Junior NOC');
});
