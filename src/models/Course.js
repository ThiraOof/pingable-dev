import mongoose from 'mongoose';

const nodeSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  nodeType:   { type: String, default: 'vpcs' },
  templateId: { type: String },
  x:          { type: Number, default: 0 },
  y:          { type: Number, default: 0 },
});

const linkSchema = new mongoose.Schema({
  node1: { type: String, required: true },
  port1: { type: Number, default: 0 },
  node2: { type: String, required: true },
  port2: { type: Number, default: 0 },
});

const checkSchema = new mongoose.Schema({
  description: { type: String, required: true }, // shown to user e.g. "PC1 ping PC2 ได้"
  node:        { type: String, required: true }, // GNS3 node name e.g. "PC1"
  command:     { type: String, required: true }, // CLI command to run e.g. "ping 192.168.1.2"
  expect:      { type: String, required: true }, // regex to match against output
  failHint:    { type: String },                 // Thai guidance shown when this check fails
                                                 // (never expose `expect` itself — it is the answer)
  points:      { type: Number, default: 1 },
});

// Optional story wrapper for a lab, rendered as a helpdesk ticket above the
// objectives ("คุณคือวิศวกรใหม่ สาขาเชียงใหม่ ping ไม่ได้ ลูกค้าโวยมา 20 นาทีแล้ว").
const scenarioSchema = new mongoose.Schema({
  from:     { type: String },                                  // ผู้แจ้ง
  priority: { type: String, enum: ['low', 'medium', 'high'] }, // ความเร่งด่วนบน ticket
  body:     { type: String },                                  // เนื้อเรื่อง (plain text, Thai)
}, { _id: false });

// ── Theory reading content ──────────────────────────────────────────
const readingSectionSchema = new mongoose.Schema({
  heading: { type: String },           // section sub-heading (Thai)
  body:    { type: String },           // Markdown body (Thai) → rendered with `markdown` filter
  image:   { type: String },           // optional diagram URL (/img/... or external)
}, { _id: false });

// ── Quiz question ───────────────────────────────────────────────────
const quizQuestionSchema = new mongoose.Schema({
  prompt:      { type: String, required: true }, // question text (markdown allowed)
  choices:     { type: [String], required: true },
  answer:      { type: [Number], required: true }, // index(es) of correct choice(s)
  explanation: { type: String },                   // shown after submit
  points:      { type: Number, default: 1 },
}, { _id: false });

// ── A lesson is one of: reading | lab | quiz ────────────────────────
const lessonSchema = new mongoose.Schema({
  type:        { type: String, enum: ['reading', 'lab', 'quiz'], required: true },
  title:       { type: String, required: true },
  description: { type: String },       // lab sidebar subtitle (seed data has it; was being stripped)
  order:       { type: Number, default: 0 },
  estMinutes:  { type: Number },       // shown in UI ("~10 นาที")

  // type === 'reading'
  sections:   [readingSectionSchema],

  // type === 'lab' (the existing GNS3 lab fields)
  topology: {
    nodes: [nodeSchema],
    links: [linkSchema],
  },
  // 'config' = สร้างจากศูนย์ (ค่าเริ่มต้น), 'troubleshoot' = ระบบถูกตั้งค่า
  // "พังมาแล้ว" ด้วย setupCommands — ผู้เรียนต้องหาจุดพังและซ่อม
  mode: { type: String, enum: ['config', 'troubleshoot'], default: 'config' },
  // ฉีด config หลังอุปกรณ์บูตครบ (ผ่าน telnet เดียวกับ grader) — ใช้จัดฉาก
  // โจทย์ troubleshoot; ปุ่มตรวจถูกล็อกจนกว่า setup จะสำเร็จ
  setupCommands: [new mongoose.Schema({
    node:     { type: String, required: true },
    commands: { type: [String], required: true },
  }, { _id: false })],
  isBoss:        { type: Boolean, default: false }, // Boss Lab ท้ายคอร์ส (UI เน้นพิเศษ มัก passThreshold สูง)
  scenario:      scenarioSchema,
  objectives:    [String],
  hints:         [String],
  gradingChecks: [checkSchema],

  // type === 'quiz'
  questions:     [quizQuestionSchema],
  passThreshold: { type: Number, default: 60 }, // % to mark the quiz complete
});

const moduleSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  order:       { type: Number, default: 0 },
  objectives:  [String],               // "เมื่อจบโมดูลนี้ คุณจะ…"
  lessons:     [lessonSchema],
});

const courseSchema = new mongoose.Schema({
  // Stable identifier for the seeder: re-seeding upserts by slug so course
  // _ids survive and Progress/LabSession refs stay valid.
  slug:           { type: String, unique: true, sparse: true },
  title:          { type: String, required: true },
  description:    { type: String },
  level:          { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'beginner' },
  track:          { type: String },    // catalog grouping label e.g. "Enterprise Networking"
  estimatedHours: { type: Number },
  prerequisites:  [String],            // free-text Thai prereq lines (display only)
  requiredCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }], // enforced prereqs
  requiredPercent: { type: Number, default: 100, min: 0, max: 100 }, // min completion % of each required course
  thumbnail:      { type: String, default: '/img/default-course.svg' },
  modules:        [moduleSchema],
  published:      { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Course', courseSchema);
