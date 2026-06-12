import mongoose from 'mongoose';

// Append-only XP ledger — ใช้ทำ leaderboard รายสัปดาห์ (sum ตั้งแต่จันทร์)
// และเป็น audit trail ว่า XP แต่ละก้อนมาจากไหน
const xpEventSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:      { type: String, required: true }, // 'reading' | 'quiz' | 'grade' | 'daily' | ...
  amount:    { type: Number, required: true },
  course:    { type: mongoose.Schema.Types.ObjectId },
  moduleIdx: { type: Number },
  lessonIdx: { type: Number },
  at:        { type: Date, default: Date.now },
}, { timestamps: false });

xpEventSchema.index({ at: -1 });          // leaderboard window scan
xpEventSchema.index({ user: 1, at: -1 }); // ประวัติรายคน

export default mongoose.model('XpEvent', xpEventSchema);
