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

const labSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  order:       { type: Number, default: 0 },
  topology: {
    nodes: [nodeSchema],
    links: [linkSchema],
  },
  objectives:     [String],
  hints:          [String],
  gradingChecks:  [checkSchema],
});

const courseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  level:       { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  thumbnail:   { type: String, default: '/img/default-course.svg' },
  labs:        [labSchema],
  published:   { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Course', courseSchema);
