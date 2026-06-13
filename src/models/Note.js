import mongoose from 'mongoose';

// สมุดโน้ตส่วนตัวของผู้เรียน — จดระหว่างทำ lab/อ่านบทเรียนได้โดยไม่ต้องสลับแท็บ
// ผูกกับ course (ไม่บังคับ) เพื่อจัดกลุ่มในหน้า /notes; เนื้อหาเป็น markdown
const noteSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // optional grouping
  // ตำแหน่ง lab/บทที่จดมาจาก (ไว้ลิงก์กลับ) — เก็บเป็น label อ่านง่ายพอ
  sourceLabel: { type: String },
  sourceHref:  { type: String },
  title: { type: String, default: 'โน้ตใหม่', maxlength: 200 },
  body:  { type: String, default: '', maxlength: 20000 },
}, { timestamps: true });

noteSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model('Note', noteSchema);
