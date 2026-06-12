// เป้าหมายการเรียนของผู้ใช้ (เลือกตอนสมัคร/แก้ในตั้งค่า) — ใช้จัดลำดับ
// "คอร์สถัดไปที่น่าสนใจ" บน dashboard ให้ตรงกับสิ่งที่ผู้เรียนอยากไปถึง
// การ map ใช้ slug ของคอร์ส (คงที่ข้ามการ re-seed) คอร์สที่ไม่อยู่ในลิสต์ต่อท้ายตามเดิม

export const GOALS = {
  'exam-ccna': {
    label: 'เตรียมสอบ CCNA',
    order: ['networking-basics', 'ip-subnetting', 'ccna-intro', 'ccnp-core', 'ccnp-advanced-routing'],
  },
  'job-noc': {
    label: 'ทำงานสาย NOC / Support',
    order: ['networking-basics', 'ccna-intro', 'ip-subnetting', 'playground', 'ccnp-core'],
  },
  'job-neteng': {
    label: 'เป็น Network Engineer',
    order: ['ccna-intro', 'ccnp-core', 'ccnp-advanced-routing', 'ip-subnetting'],
  },
  'career-switch': {
    label: 'ย้ายสายมาทำเน็ตเวิร์ก',
    order: ['networking-basics', 'ip-subnetting', 'playground', 'ccna-intro', 'ccnp-core'],
  },
  hobby: {
    label: 'เรียนรู้เป็นงานอดิเรก',
    order: ['playground', 'networking-basics'],
  },
};

export const GOAL_KEYS = Object.keys(GOALS);

export const goalLabel = (goal) => GOALS[goal]?.label || null;

/** เรียงคอร์สตามลำดับของเป้าหมาย (ไม่รู้จัก slug → ต่อท้ายตามลำดับเดิม) */
export function sortCoursesByGoal(courses, goal) {
  const order = GOALS[goal]?.order;
  if (!order) return courses;
  const rank = (c) => {
    const i = order.indexOf(c.slug);
    return i === -1 ? order.length : i;
  };
  return [...courses].sort((a, b) => rank(a) - rank(b));
}
