// Events hub (§14+) — ทะเบียนอีเวนต์แบบ declarative สำหรับหน้า /events
//
// อีเวนต์คือฟีเจอร์ที่ "เปิดเป็นรอบ ๆ" (กินทรัพยากร Lab มากกว่าปกติ หรือเป็น
// กิจกรรมตามฤดูกาล) จึง gate ด้วย feature flag แทนที่จะเปิดตลอด — เพิ่มอีเวนต์
// ใหม่ = เพิ่ม 1 entry ที่นี่ (เหมือน badges.js / exams.js) แล้วหน้า /events กับ
// เมนูนำทางจะอัปเดตเองตาม enabled()
import { duelsEnabled } from '../routes/duelRoutes.js';

// แต่ละ event: { key, title, tagline, desc, icon (emoji), href|null, enabled() }
// href = null → ยังไม่เปิดให้เข้า (แสดงเป็น "เร็ว ๆ นี้" บนการ์ด)
export const EVENTS = {
  duel: {
    key: 'duel',
    title: 'Lab Duel',
    tagline: 'ดวล 1v1',
    desc: 'ดวลซ่อมระบบกับเพื่อน — ได้โจทย์พังเหมือนกัน ใครซ่อมผ่าน 100% ก่อนชนะ',
    icon: '⚔️',
    href: '/duel',
    enabled: duelsEnabled,
  },
  'time-attack': {
    key: 'time-attack',
    title: 'Time Attack',
    tagline: 'แข่งกับเวลา',
    desc: 'ทำ lab ให้ผ่านเร็วที่สุด — เวลาที่ดีที่สุดขึ้นกระดานผู้นำประจำสัปดาห์',
    icon: '⏱️',
    href: null, // stub — ยังไม่เปิดให้เข้า
    enabled: () => process.env.TIME_ATTACK_ENABLED === '1' || process.env.TIME_ATTACK_ENABLED === 'true',
  },
};

// รายการอีเวนต์ทั้งหมดพร้อมสถานะ enabled ที่คำนวณแล้ว (สำหรับ render หน้า hub)
export const eventList = () => Object.values(EVENTS).map(({ key, title, tagline, desc, icon, href }) => {
  const enabled = EVENTS[key].enabled();
  return { key, title, tagline, desc, icon, href, enabled, open: enabled && !!href };
});

// มีอีเวนต์ที่ "เข้าได้จริง" อย่างน้อยหนึ่งอันไหม — ใช้ตัดสินใจโชว์เมนูนำทาง
export const anyEventActive = () => Object.values(EVENTS).some((e) => e.enabled() && !!e.href);
