import mongoose from 'mongoose';

// หนึ่ง doc ต่อ user — แกนของ gamification ทั้งหมด (XP, streak, badges)
// level ไม่เก็บ — คำนวณจาก xp ด้วย levelFor() (src/config/xp.js) เสมอ
const userStatsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  xp:   { type: Number, default: 0 },
  streak: {
    current:       { type: Number, default: 0 },
    longest:       { type: Number, default: 0 },
    // 'YYYY-MM-DD' ตามเวลา Asia/Bangkok เสมอ (ผู้ใช้ไทยทำแล็บ 23:30 แล้ว
    // streak ขาดเพราะนับเป็น UTC คือหายนะของ retention)
    lastActiveDay: { type: String },
  },
  badges: {
    type: [new mongoose.Schema({
      id: { type: String, required: true }, // อ้าง registry ใน src/config/badges.js
      at: { type: Date, default: Date.now },
    }, { _id: false })],
    default: [],
  },
  // ตัวนับสะสมสำหรับเงื่อนไข badge (อัปเดตแบบ $inc เท่านั้น)
  counters: {
    labsPassed:     { type: Number, default: 0 },
    quizzesPassed:  { type: Number, default: 0 },
    quizzesPerfect: { type: Number, default: 0 },
    checksPassed:   { type: Number, default: 0 },
    lessonsDone:    { type: Number, default: 0 },
  },
}, { timestamps: true });

export default mongoose.model('UserStats', userStatsSchema);
