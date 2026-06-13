import mongoose from 'mongoose';

// Backup TTL: 2× the idle window so the sweeper (labSessionService) always
// wins, but a crashed sweeper can't leave sessions alive forever.
// Changing LAB_IDLE_MINUTES requires dropping/recreating the TTL index:
//   db.labsessions.dropIndex('lastActivityAt_1')
const BACKUP_EXPIRE_SECONDS = (parseInt(process.env.LAB_IDLE_MINUTES) || 45) * 60 * 2;

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
  // hint indexes the user opened this run — recorded server-side so the
  // no-hint XP bonus/badge can't be gamed from the client (one doc per user,
  // reset on every startSession)
  hintsUsed: { type: [Number], default: [] },
  // mystery-lab randomized values for this attempt ({name: value}); the source
  // of truth for interpolating expect/setup/hints/objectives — never trust the client
  vars: { type: mongoose.Schema.Types.Mixed, default: {} },
  // asked the AI mentor this run — counts as a hint (forfeits the no-hint bonus)
  mentorUsed: { type: Boolean, default: false },
  // when this run's build was claimed — basis for the speedrunner badge
  // (createdAt is useless here: the one-doc-per-user upsert keeps it forever)
  startedAt: { type: Date },
  // troubleshoot-lab setup injection state machine (see labSessionService.ensureSetup):
  // idle → running → done | (fail → idle, retry; 3 fails → failed)
  setup: {
    state:    { type: String, enum: ['idle', 'running', 'done', 'failed'], default: 'idle' },
    attempts: { type: Number, default: 0 },
  },
  lastActivityAt: { type: Date, default: Date.now, expires: BACKUP_EXPIRE_SECONDS }, // bumped by heartbeat; sweeper key + TTL backup
}, { timestamps: true });

export default mongoose.model('LabSession', labSessionSchema);
