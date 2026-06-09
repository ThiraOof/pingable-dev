import mongoose from 'mongoose';

// One document per (user, course). `completed` records every lesson the
// learner has finished, keyed by its position in the course (moduleIdx-lessonIdx).
const completedSchema = new mongoose.Schema({
  moduleIdx: { type: Number, required: true },
  lessonIdx: { type: Number, required: true },
  type:      { type: String },              // 'reading' | 'lab' | 'quiz'
  score:     { type: Number },              // % for graded lessons (quiz/lab)
  at:        { type: Date, default: Date.now },
}, { _id: false });

const progressSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  course:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  completed: [completedSchema],
}, { timestamps: true });

progressSchema.index({ user: 1, course: 1 }, { unique: true });

const Progress = mongoose.model('Progress', progressSchema);

const key = (m, l) => `${m}-${l}`;

/**
 * Idempotently mark a lesson complete for a user. For graded lessons the
 * highest score seen is kept. Returns the updated Progress document.
 */
export async function markComplete(userId, courseId, moduleIdx, lessonIdx, type, score) {
  let doc = await Progress.findOne({ user: userId, course: courseId });
  if (!doc) doc = new Progress({ user: userId, course: courseId, completed: [] });

  const existing = doc.completed.find((c) => c.moduleIdx === moduleIdx && c.lessonIdx === lessonIdx);
  if (existing) {
    if (typeof score === 'number' && (existing.score == null || score > existing.score)) {
      existing.score = score;
      existing.at = new Date();
    }
  } else {
    doc.completed.push({ moduleIdx, lessonIdx, type, score, at: new Date() });
  }
  await doc.save();
  return doc;
}

/** Fetch progress for a user+course (or null). */
export function getProgress(userId, courseId) {
  return Progress.findOne({ user: userId, course: courseId });
}

/** Build a Set of "m-l" keys the user has completed, for quick view lookups. */
export function completedSet(progressDoc) {
  const set = new Set();
  if (progressDoc) {
    for (const c of progressDoc.completed) set.add(key(c.moduleIdx, c.lessonIdx));
  }
  return set;
}

/** Total lesson count across all modules of a course. */
export function totalLessons(course) {
  return (course.modules || []).reduce((n, m) => n + (m.lessons ? m.lessons.length : 0), 0);
}

/** Overall completion percentage (0–100) for a course given a Progress doc. */
export function coursePercent(course, progressDoc) {
  const total = totalLessons(course);
  if (!total) return 0;
  const done = progressDoc ? progressDoc.completed.length : 0;
  return Math.round((Math.min(done, total) / total) * 100);
}

export { key as lessonKey };
export default Progress;
