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
 * highest score seen is kept. Atomic — concurrent calls (double-click on
 * "เรียนจบ", parallel grades) can't duplicate an entry.
 */
export async function markComplete(userId, courseId, moduleIdx, lessonIdx, type, score) {
  const owner = { user: userId, course: courseId };

  // Ensure the per-(user, course) doc exists; a racing upsert loses on the
  // unique index, which is fine — the doc is there either way.
  try {
    await Progress.updateOne(owner, { $setOnInsert: { completed: [] } }, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  // Append the entry only if this lesson isn't recorded yet (single atomic op).
  const { modifiedCount } = await Progress.updateOne(
    { ...owner, completed: { $not: { $elemMatch: { moduleIdx, lessonIdx } } } },
    { $push: { completed: { moduleIdx, lessonIdx, type, score, at: new Date() } } },
  );

  // Already recorded → just keep the best score for graded lessons.
  if (!modifiedCount && typeof score === 'number') {
    await Progress.updateOne(
      owner,
      { $max: { 'completed.$[e].score': score } },
      { arrayFilters: [{ 'e.moduleIdx': moduleIdx, 'e.lessonIdx': lessonIdx }] },
    );
  }
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

/** Count lessons by type across all modules (for catalog/dashboard badges). */
export function lessonCounts(course) {
  let readings = 0, labs = 0, quizzes = 0;
  for (const m of course.modules || []) {
    for (const l of m.lessons || []) {
      if (l.type === 'reading') readings++;
      else if (l.type === 'lab') labs++;
      else if (l.type === 'quiz') quizzes++;
    }
  }
  return { readings, labs, quizzes };
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
