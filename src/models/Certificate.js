import mongoose from 'mongoose';

// A verifiable completion credential, issued once per (user, course) when the
// course hits 100% AND its Boss Lab is passed (see certificateService). The
// public page /cert/:serial lets anyone (an employer) confirm it is real, so
// the serial is human-readable and unique. Course fields are snapshotted at
// issue time so the credential survives a later unpublish / rename / delete.
const certificateSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  course:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  serial:      { type: String, required: true, unique: true }, // 'PNG-2026-000123'
  displayName: { type: String },                               // defaults to username; editable
  courseTitle: { type: String },                               // snapshot
  courseLevel: { type: String },                               // snapshot
  lessonTotal: { type: Number },                               // snapshot
  issuedAt:    { type: Date, default: Date.now },
}, { timestamps: true });

// One certificate per user+course; a racing duplicate loses on this index.
certificateSchema.index({ user: 1, course: 1 }, { unique: true });

export default mongoose.model('Certificate', certificateSchema);
