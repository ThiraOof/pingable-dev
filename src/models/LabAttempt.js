import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  description: { type: String },
  passed:      { type: Boolean },
  points:      { type: Number, default: 1 },
}, { _id: false });

const attemptSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course:    { type: mongoose.Schema.Types.ObjectId, required: true },
  moduleIdx: { type: Number, required: true },
  lessonIdx: { type: Number, required: true },
  pct:       { type: Number, required: true },
  passed:    { type: Boolean, required: true },
  score:     { type: Number, required: true },
  total:     { type: Number, required: true },
  results:    [resultSchema],
  shareToken: { type: String },
  at:         { type: Date, default: Date.now },
}, { timestamps: false });

attemptSchema.index({ user: 1, course: 1, moduleIdx: 1, lessonIdx: 1, at: -1 });
attemptSchema.index({ shareToken: 1 }, { sparse: true, unique: true });

export default mongoose.model('LabAttempt', attemptSchema);
