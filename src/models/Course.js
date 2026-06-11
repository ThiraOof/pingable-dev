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
  points:      { type: Number, default: 1 },
});

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
  track:          { type: String },    // catalog grouping label e.g. "CCNP Enterprise"
  estimatedHours: { type: Number },
  prerequisites:  [String],            // free-text Thai prereq lines
  thumbnail:      { type: String, default: '/img/default-course.svg' },
  modules:        [moduleSchema],
  published:      { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Course', courseSchema);
