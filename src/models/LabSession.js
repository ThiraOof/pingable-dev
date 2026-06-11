import mongoose from 'mongoose';

// One live GNS3 lab per user (unique index), persisted so sessions survive
// server restarts and orphaned projects can be reconciled/swept. `building`
// doubles as the start lock — see labSessionService.startSession().
const labSessionSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  course:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  moduleIdx: { type: Number, required: true },
  lessonIdx: { type: Number, required: true },
  status:    { type: String, enum: ['building', 'ready'], default: 'building' },
  projectId: { type: String },
  webUiUrl:  { type: String },
  nodes:     { type: mongoose.Schema.Types.Mixed, default: {} }, // name -> { consoleHost, consolePort }
  bootedNodes:    { type: [String], default: [] },  // nodes whose console already answered a probe
  lastActivityAt: { type: Date, default: Date.now }, // bumped by the lab page heartbeat; sweeper key
}, { timestamps: true });

export default mongoose.model('LabSession', labSessionSchema);
