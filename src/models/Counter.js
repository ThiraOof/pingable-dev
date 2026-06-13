import mongoose from 'mongoose';

// Tiny atomic sequence generator. One doc per named counter (`_id`), e.g.
// 'cert-2026'. `nextSeq` increments and returns the new value in a single
// atomic op, so two concurrent issuances can never get the same number.
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
}, { versionKey: false });

const Counter = mongoose.model('Counter', counterSchema);

/** Atomically bump `id`'s counter and return the new value (starts at 1). */
export async function nextSeq(id) {
  const doc = await Counter.findOneAndUpdate(
    { _id: id },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return doc.seq;
}

export default Counter;
