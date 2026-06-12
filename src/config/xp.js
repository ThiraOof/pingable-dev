// ตาราง XP และบันไดตำแหน่ง (level = career path) — จูนตัวเลขได้ที่ไฟล์เดียวนี้
// หลักการ: XP ให้เฉพาะ "ครั้งแรกที่ทำสำเร็จ" ต่อบทเรียน (กัน farm จากการตรวจซ้ำ)
// และ hint หักจาก "โบนัสที่จะได้" ของแล็บนั้น ไม่หักจากยอดสะสม

export const XP = {
  reading: 10,          // อ่านบทเรียนจบ (ครั้งแรก)
  quizPass: 20,         // ผ่าน quiz (ครั้งแรก)
  quizPerfectBonus: 10, // quiz เต็ม 100%
  labPass: 50,          // ผ่าน lab (ครั้งแรก)
  combo: 25,            // 100% ตั้งแต่ attempt แรกของ lab
  noHint: 15,           // ผ่าน lab โดยไม่เปิดคำใบ้เลย
  daily: 5,             // กิจกรรมแรกของวัน
  hintPenalty: 5,       // เปิดคำใบ้ 1 ใบ ลด XP ของ lab ลงเท่านี้
  labXpMin: 10,         // ผ่าน lab ครั้งแรกได้อย่างน้อยเท่านี้เสมอ
  review: 5,            // ทำชุดทบทวนจบ (เผื่อ Phase 3 spaced repetition)
};

// Level คำนวณจาก xp สะสมเสมอ (ไม่ denormalize) — แก้ threshold ได้โดยไม่ต้อง migrate
export const LEVELS = [
  { xp: 0, title: 'Helpdesk' },
  { xp: 100, title: 'Junior NOC' },
  { xp: 300, title: 'NOC Engineer' },
  { xp: 700, title: 'Network Engineer' },
  { xp: 1500, title: 'Senior Network Engineer' },
  { xp: 3000, title: 'Network Architect' },
];

/** แปลง xp สะสม → ข้อมูล level ปัจจุบัน + ระยะทางไป level ถัดไป */
export function levelFor(xp = 0) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) idx = i;
  }
  const next = LEVELS[idx + 1] || null;
  return {
    level: idx + 1,
    title: LEVELS[idx].title,
    next: next ? { title: next.title, xpNeeded: next.xp - xp } : null,
    progressPct: next
      ? Math.min(100, Math.round(((xp - LEVELS[idx].xp) / (next.xp - LEVELS[idx].xp)) * 100))
      : 100,
  };
}
