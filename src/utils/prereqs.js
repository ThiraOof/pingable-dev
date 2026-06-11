import Course from '../models/Course.js';
import Progress, { coursePercent } from '../models/Progress.js';

/**
 * Check whether a user has met the prerequisites of `course`.
 *
 * Returns { met: boolean, items: [{ course, required, actual, met }] }.
 * `items` is empty when the course has no requiredCourses.
 * When userId is falsy (unauthenticated), every item gets actual: 0 / met: false.
 */
export async function checkPrerequisites(userId, course) {
  if (!course.requiredCourses?.length) return { met: true, items: [] };

  const ids = course.requiredCourses;
  const threshold = course.requiredPercent ?? 100;

  const [reqCourses, progresses] = await Promise.all([
    Course.find({ _id: { $in: ids } }).select('title slug modules').lean(),
    userId ? Progress.find({ user: userId, course: { $in: ids } }).lean() : [],
  ]);

  const progressMap = new Map(progresses.map((p) => [String(p.course), p]));
  const items = reqCourses.map((rc) => {
    const p = progressMap.get(String(rc._id));
    const pct = coursePercent(rc, p);
    return { course: rc, required: threshold, actual: pct, met: pct >= threshold };
  });

  return { met: items.every((i) => i.met), items };
}
