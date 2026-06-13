import mongoose from 'mongoose';

// หนึ่งครั้งการสอบจำลอง (§21) — ขับ lab ทีละข้อบน LabSession เดียวที่ผู้ใช้มีได้
// เวลาเป็น server-authoritative: deadline = startedAt + timeLimitMin; client timer
// เป็นแค่จอแสดงผล เซิร์ฟเวอร์ปฏิเสธ grade หลังหมดเวลาเสมอ
const examLabSchema = new mongoose.Schema({
  course:    { type: mongoose.Schema.Types.ObjectId, required: true },
  moduleIdx: { type: Number, required: true },
  lessonIdx: { type: Number, required: true },
  title:     { type: String },             // snapshot กันชื่อเปลี่ยนหลัง re-seed
  // ผลต่อข้อ (กรอกเมื่อ grade/skip)
  status:    { type: String, enum: ['pending', 'passed', 'failed', 'skipped'], default: 'pending' },
  pct:       { type: Number },
}, { _id: false });

const examAttemptSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  examId:      { type: String, required: true },
  title:       { type: String },
  labs:        { type: [examLabSchema], required: true },
  currentIdx:  { type: Number, default: 0 },
  timeLimitMin:{ type: Number, required: true },
  startedAt:   { type: Date, default: Date.now },
  state:       { type: String, enum: ['running', 'done', 'expired'], default: 'running' },
  finalPct:    { type: Number },           // กรอกตอนจบ (คะแนนถ่วงน้ำหนักเท่ากันทุกข้อ)
  durationSec: { type: Number },
  shareToken:  { type: String },
}, { timestamps: true });

examAttemptSchema.index({ user: 1, state: 1 });
examAttemptSchema.index({ shareToken: 1 }, { sparse: true, unique: true });

// เหลือกี่วินาที (อิงเวลา server) — ติดลบ = หมดเวลาแล้ว
examAttemptSchema.methods.secondsLeft = function () {
  return Math.round((this.startedAt.getTime() + this.timeLimitMin * 60_000 - Date.now()) / 1000);
};

export default mongoose.model('ExamAttempt', examAttemptSchema);
