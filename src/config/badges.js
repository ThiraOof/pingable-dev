// Badge registry — เพิ่ม badge ใหม่ = เพิ่ม entry เดียวที่นี่ achievementService
// จะ evaluate เฉพาะ badge ที่ trigger ตรงกับเหตุการณ์ และข้ามใบที่ได้ไปแล้ว
//
// check(ctx, stats) — ctx คือข้อมูลของเหตุการณ์นั้น, stats คือ UserStats
// "ก่อน" บวกผลของเหตุการณ์นี้ (ยกเว้น streak ที่อัปเดตแล้ว) — ดู achievementService
//
// triggers: 'grade' (ตรวจ lab), 'quiz' (ส่ง quiz), 'streak' (เช็คทุกเหตุการณ์)

export const BADGES = [
  {
    id: 'first-ping', icon: '🏓', title: 'First Ping!', trigger: 'grade',
    desc: 'ผ่านเช็คข้อแรกในชีวิตบน Pingable',
    check: (ctx, stats) => ctx.passedChecks > 0 && (stats.counters?.checksPassed || 0) === 0,
  },
  {
    id: 'one-shot', icon: '🎯', title: 'One-Shot', trigger: 'grade',
    desc: 'ได้ 100% ตั้งแต่ครั้งแรกที่กดตรวจ',
    check: (ctx) => ctx.pct === 100 && ctx.attemptNumber === 1,
  },
  {
    id: 'no-hint', icon: '🧠', title: 'ไม่ง้อคำใบ้', trigger: 'grade',
    desc: 'ผ่าน lab โดยไม่เปิดคำใบ้สักใบ',
    check: (ctx) => ctx.passed && ctx.hintsUsed === 0,
  },
  {
    id: 'speedrunner', icon: '⚡', title: 'Speedrunner', trigger: 'grade',
    desc: 'ผ่าน lab ในเวลาไม่ถึงครึ่งของที่ประเมินไว้',
    check: (ctx) => ctx.passed && ctx.estMinutes > 0 && ctx.durationMin != null && ctx.durationMin <= ctx.estMinutes / 2,
  },
  {
    id: 'night-owl', icon: '🦉', title: 'Night Owl', trigger: 'grade',
    desc: 'ผ่าน lab ช่วงตี 0–5 (เวลาไทย)',
    check: (ctx) => ctx.passed && ctx.hourBangkok >= 0 && ctx.hourBangkok < 5,
  },
  {
    id: 'comeback', icon: '💪', title: 'Comeback', trigger: 'grade',
    desc: 'ไม่ยอมแพ้ — ผ่าน lab หลัง fail มาแล้วอย่างน้อย 3 ครั้ง',
    check: (ctx) => ctx.passed && ctx.failedBefore >= 3,
  },
  {
    id: 'perfect-quiz', icon: '💯', title: 'Perfect Quiz', trigger: 'quiz',
    desc: 'ทำ quiz ได้เต็ม 100%',
    check: (ctx) => ctx.pct === 100,
  },
  {
    id: 'streak-7', icon: '🔥', title: 'ติดลม', trigger: 'streak',
    desc: 'เรียนต่อเนื่อง 7 วัน',
    check: (ctx, stats) => (stats.streak?.current || 0) >= 7,
  },
  {
    id: 'streak-30', icon: '🌋', title: 'สายแข็ง', trigger: 'streak',
    desc: 'เรียนต่อเนื่อง 30 วัน',
    check: (ctx, stats) => (stats.streak?.current || 0) >= 30,
  },
  {
    id: 'streak-100', icon: '🏆', title: 'ตำนาน', trigger: 'streak',
    desc: 'เรียนต่อเนื่อง 100 วัน',
    check: (ctx, stats) => (stats.streak?.current || 0) >= 100,
  },
];

export const badgeById = (id) => BADGES.find((b) => b.id === id);
