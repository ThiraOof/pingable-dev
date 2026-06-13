import mongoose from 'mongoose';

// Spaced repetition (Leitner 3 กล่อง): ข้อ quiz ที่ตอบผิดถูกจับเข้าคิวทบทวน
// box 0 → ครบกำหนด +3 วัน, ตอบถูกเลื่อนกล่อง (+7, +21 วัน), ถูกในกล่องสุดท้าย
// = จบหลักสูตร (ลบทิ้ง), ตอบผิดเมื่อไหร่กลับกล่อง 0
//
// เก็บเฉพาะ "ตำแหน่ง" ของคำถาม (course/m/l/qIdx) — เนื้อคำถามอ่านสดจาก Course
// เสมอ จะได้ไม่ค้างของเก่าเมื่อ re-seed; ถ้า ref ชี้ไม่เจอแล้วให้ลบ item ทิ้ง
const reviewItemSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  moduleIdx: { type: Number, required: true },
  lessonIdx: { type: Number, required: true },
  qIdx:      { type: Number, required: true },
  box:       { type: Number, default: 0, min: 0, max: 2 },
  dueAt:     { type: Date, required: true },
  lapses:    { type: Number, default: 0 }, // จำนวนครั้งที่ตอบผิดสะสม (วิเคราะห์ภายหลัง)
}, { timestamps: true });

reviewItemSchema.index({ user: 1, course: 1, moduleIdx: 1, lessonIdx: 1, qIdx: 1 }, { unique: true });
reviewItemSchema.index({ user: 1, dueAt: 1 });

// วันครบกำหนดของแต่ละกล่อง
export const BOX_DAYS = [3, 7, 21];
export const dueAfterDays = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

export default mongoose.model('ReviewItem', reviewItemSchema);
