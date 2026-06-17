import mongoose from 'mongoose';

// Append-only audit trail of privileged admin actions (role changes, account
// deletions, course publish toggles, session/orphan teardown). Fields are
// denormalized (actorName, targetLabel) so an entry stays readable even after
// the actor or target is deleted — the whole point of an audit log.
const adminActionSchema = new mongoose.Schema({
  actor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // may dangle if the admin is later deleted
  actorName:   { type: String },                                       // …so we keep their name too
  action:      { type: String, required: true }, // e.g. 'user.role', 'user.delete', 'course.publish'
  targetId:    { type: mongoose.Schema.Types.ObjectId },               // affected entity (user/course/session), if any
  targetLabel: { type: String },                                       // human-readable name of the target
  meta:        { type: mongoose.Schema.Types.Mixed },                  // action-specific details (new role, count, …)
  at:          { type: Date, default: Date.now },
}, { timestamps: false });

adminActionSchema.index({ at: -1 }); // recent-first feed

export default mongoose.model('AdminAction', adminActionSchema);
