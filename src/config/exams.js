// Exam Simulator (§21) — ชุดข้อสอบจำลอง: ทำ lab ต่อเนื่องทีละข้อภายใต้เวลาจำกัด
// ไม่มี hint/failHint เห็นแค่ผ่าน/ไม่ผ่านรายข้อ จบแล้วค่อยดูรายงานเต็ม
//
// labs อ้าง lab ที่มีอยู่แล้วด้วย { slug, m, l } — resolve เป็น course _id ตอนเริ่มสอบ
// (เลือกเฉพาะ lab ที่ "เริ่มแล้วทำได้จบในเวลาสั้น" และครอบหลายทักษะ)

export const EXAMS = {
  'ccna-rapid': {
    id: 'ccna-rapid',
    title: 'CCNA Rapid — สอบจำลอง 3 ข้อ',
    desc: 'จำลองบรรยากาศสอบ lab: IP/subnet, สวิตช์หลายตัว, และซ่อมระบบที่พัง — ต่อเนื่องไม่มีคำใบ้ จับเวลา 60 นาที',
    timeLimitMin: 60,
    labs: [
      { slug: 'networking-basics', m: 1, l: 2 },     // Basic IP & Ping
      { slug: 'ccna-intro', m: 1, l: 1 },            // Multi-Switch LAN
      { slug: 'network-troubleshooting', m: 0, l: 1 }, // ซ่อม #1 ลิงก์เงียบ
    ],
  },
  'enterprise-gauntlet': {
    id: 'enterprise-gauntlet',
    title: 'Enterprise Gauntlet — ด่านหิน 3 ข้อ',
    desc: 'ระดับสูง: NAT, BGP peering และโจทย์ซ่อม GRE — สำหรับคนที่พร้อมพิสูจน์ฝีมือ จับเวลา 90 นาที',
    timeLimitMin: 90,
    labs: [
      { slug: 'ccnp-advanced-routing', m: 2, l: 2 }, // Static NAT
      { slug: 'network-troubleshooting', m: 0, l: 2 }, // ซ่อม #2 BGP peering
      { slug: 'network-troubleshooting', m: 1, l: 1 }, // ซ่อม #5 GRE
    ],
  },
};

export const examList = () => Object.values(EXAMS).map(({ id, title, desc, timeLimitMin, labs }) =>
  ({ id, title, desc, timeLimitMin, count: labs.length }));
