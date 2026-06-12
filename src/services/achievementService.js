// Gamification core — จุดเดียวที่ Streak/XP/Badge ถูกคิดและบันทึก
//
// award(userId, type, ctx) ถูกเรียกจาก route หลังเหตุการณ์สำคัญ (ตรวจ lab,
// ส่ง quiz, อ่านบทจบ) แล้วคืนผลให้ UI เด้งบอกผู้ใช้ ({ xpGained, levelUp,
// newBadges, streak }) — ผู้เรียกควร .catch() เสมอ: สถิติพังต้องไม่ทำให้
// การตรวจคำตอบล้มไปด้วย
//
// กติกาสำคัญ:
// - XP ให้เฉพาะ first-completion ต่อบทเรียน (ctx.firstCompletion จากผลของ
//   markComplete) — ตรวจซ้ำเพื่ออัปคะแนน % ได้ แต่ไม่ได้ XP เพิ่ม
// - วันของ streak คิดแบบ Asia/Bangkok เสมอ
// - hint หักจากโบนัสของ lab นั้น (ขั้นต่ำ labXpMin) ไม่หักจากยอดสะสม

import UserStats from '../models/UserStats.js';
import XpEvent from '../models/XpEvent.js';
import { XP, levelFor } from '../config/xp.js';
import { BADGES } from '../config/badges.js';

const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }); // → YYYY-MM-DD
const HOUR_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: 'numeric', hour12: false });

export const bangkokDay = (d = new Date()) => DAY_FMT.format(d);
export const bangkokHour = (d = new Date()) => Number(HOUR_FMT.format(d)) % 24;

// XP ของเหตุการณ์ตามตารางใน config/xp.js
function xpFor(type, ctx) {
  if (!ctx.firstCompletion) return 0;
  if (type === 'reading') return XP.reading;
  if (type === 'quiz') return ctx.passed ? XP.quizPass + (ctx.pct === 100 ? XP.quizPerfectBonus : 0) : 0;
  if (type === 'grade') {
    if (!ctx.passed) return 0;
    let amount = Math.max(XP.labXpMin, XP.labPass - XP.hintPenalty * (ctx.hintsUsed || 0));
    if ((ctx.hintsUsed || 0) === 0) amount += XP.noHint;
    if (ctx.pct === 100 && ctx.attemptNumber === 1) amount += XP.combo; // first-try combo
    return amount;
  }
  return 0;
}

// counters ที่ต้อง $inc ตามเหตุการณ์ (ใช้เป็นเงื่อนไข badge สะสม)
function counterIncs(type, ctx) {
  const inc = {};
  if (type === 'grade') {
    if (ctx.passedChecks) inc['counters.checksPassed'] = ctx.passedChecks;
    if (ctx.passed && ctx.firstCompletion) inc['counters.labsPassed'] = 1;
  } else if (type === 'quiz' && ctx.passed && ctx.firstCompletion) {
    inc['counters.quizzesPassed'] = 1;
    if (ctx.pct === 100) inc['counters.quizzesPerfect'] = 1;
  } else if (type === 'reading' && ctx.firstCompletion) {
    inc['counters.lessonsDone'] = 1;
  }
  return inc;
}

/**
 * บันทึกเหตุการณ์หนึ่งครั้ง: อัปเดต streak (atomic ต่อวัน), คิด XP,
 * ไล่เช็ค badge แล้วคืนสิ่งที่ UI ควรเอาไปอวดผู้ใช้
 */
export async function award(userId, type, ctx = {}) {
  const today = bangkokDay();
  const yesterday = bangkokDay(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // 1) streak + daily-first-activity ใน update เดียว (pipeline) — เงื่อนไข
  //    lastActiveDay != today ทำให้สอง request พร้อมกันได้โบนัสรายวันครั้งเดียว
  const dailyClaim = await UserStats.findOneAndUpdate(
    { user: userId, 'streak.lastActiveDay': { $ne: today } },
    [
      {
        $set: {
          'streak.current': {
            $cond: [{ $eq: ['$streak.lastActiveDay', yesterday] }, { $add: [{ $ifNull: ['$streak.current', 0] }, 1] }, 1],
          },
          'streak.lastActiveDay': today,
        },
      },
      { $set: { 'streak.longest': { $max: [{ $ifNull: ['$streak.longest', 0] }, '$streak.current'] } } },
    ],
    { new: true },
  );

  // ไม่มี doc เลย (ผู้ใช้ใหม่) → สร้างพร้อม streak วันแรก; ชน unique กับ
  // request คู่ขนานก็แค่ไปอ่านของที่อีกฝั่งสร้าง
  let stats = dailyClaim;
  let dailyBonus = !!dailyClaim;
  if (!stats) {
    stats = await UserStats.findOne({ user: userId });
    if (!stats) {
      try {
        stats = await UserStats.create({
          user: userId,
          streak: { current: 1, longest: 1, lastActiveDay: today },
        });
        dailyBonus = true;
      } catch (err) {
        if (err.code !== 11000) throw err;
        stats = await UserStats.findOne({ user: userId });
      }
    }
  }

  // 2) คิด XP (โบนัสรายวันให้เฉพาะตอนเหตุการณ์นี้เป็นคน claim วันสำเร็จ)
  const baseXp = xpFor(type, ctx);
  const xpGained = baseXp + (dailyBonus ? XP.daily : 0);

  // 3) badges — เช็คเฉพาะ trigger ของเหตุการณ์นี้ + กลุ่ม streak, ข้ามใบที่มีแล้ว
  //    (stats ตอนนี้ = streak อัปเดตแล้ว แต่ counters ยังเป็นค่าก่อนเหตุการณ์
  //    ซึ่งตรงกับสัญญาของ badge registry)
  const owned = new Set((stats.badges || []).map((b) => b.id));
  const evalCtx = { hourBangkok: bangkokHour(), ...ctx }; // ctx ทับได้ (ใช้ในเทสต์)
  const newBadges = BADGES
    .filter((b) => (b.trigger === type || b.trigger === 'streak') && !owned.has(b.id))
    .filter((b) => {
      try { return b.check(evalCtx, stats); } catch { return false; }
    })
    .map(({ id, icon, title, desc }) => ({ id, icon, title, desc }));

  // 4) เขียนผลทั้งหมด + ledger
  const update = {};
  const incs = { ...(xpGained ? { xp: xpGained } : {}), ...counterIncs(type, ctx) };
  if (Object.keys(incs).length) update.$inc = incs;
  if (newBadges.length) update.$push = { badges: { $each: newBadges.map((b) => ({ id: b.id, at: new Date() })) } };
  if (Object.keys(update).length) {
    await UserStats.updateOne({ user: userId }, update);
  }
  if (xpGained > 0) {
    await XpEvent.create({
      user: userId, type, amount: xpGained,
      course: ctx.courseId, moduleIdx: ctx.moduleIdx, lessonIdx: ctx.lessonIdx,
    }).catch(() => {}); // ledger พังไม่ควรล้มเหตุการณ์หลัก
  }

  // 5) level up?
  const before = levelFor(stats.xp || 0);
  const after = levelFor((stats.xp || 0) + xpGained);
  return {
    xpGained,
    levelUp: after.level > before.level ? { title: after.title, level: after.level } : null,
    newBadges,
    streak: { current: stats.streak?.current || 0, daily: dailyBonus },
  };
}

/** สถิติสำหรับ dashboard (null ถ้ายังไม่เคยมีเหตุการณ์) */
export function getStats(userId) {
  return UserStats.findOne({ user: userId }).lean();
}
