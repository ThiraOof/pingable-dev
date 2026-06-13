import mongoose from 'mongoose';

// Lab Duel (§14) — สองคนได้ troubleshoot lab เดียวกัน ใครตรวจผ่าน 100% ก่อนชนะ
// Event-only (กิน 2 slot จาก LAB_MAX_CONCURRENT ต่อคู่) — เปิดด้วย DUELS_ENABLED
// แต่ละผู้เล่นใช้ LabSession ของตัวเอง (unique per user เดิม) duel แค่ประสานคะแนน
const playerSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:  { type: String },
  bestPct:   { type: Number, default: 0 },
  gradedAt:  { type: Date },
}, { _id: false });

const duelSchema = new mongoose.Schema({
  // lab ที่ดวลกัน (อ้างถึง lab ที่มีอยู่)
  course:    { type: mongoose.Schema.Types.ObjectId, required: true },
  moduleIdx: { type: Number, required: true },
  lessonIdx: { type: Number, required: true },
  labTitle:  { type: String },
  host:      { type: playerSchema, required: true },
  guest:     { type: playerSchema },
  state:     { type: String, enum: ['open', 'running', 'done'], default: 'open' },
  winner:    { type: String, enum: ['host', 'guest', 'draw'] }, // draw = หมดเวลา/ยกเลิก
  startedAt: { type: Date },
}, { timestamps: true });

duelSchema.index({ state: 1, createdAt: -1 });

export default mongoose.model('Duel', duelSchema);
