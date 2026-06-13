// Certificate issuance (§5). A course earns a verifiable credential when it is
// 100% complete AND it has a Boss Lab the learner has passed. Issuance is
// idempotent (one cert per user+course, guarded by a unique index) and must
// never fail the request that triggers it — callers .catch()+log, exactly like
// the achievementService.award() calls.

import Certificate from '../models/Certificate.js';
import { nextSeq } from '../models/Counter.js';
import { coursePercent, completedSet } from '../models/Progress.js';
import User from '../models/User.js';
import { bangkokDay } from './achievementService.js';

/** The course's Boss Lab as { m, l } (first lab lesson with isBoss), or null. */
function bossLab(course) {
  const modules = course.modules || [];
  for (let m = 0; m < modules.length; m++) {
    const lessons = modules[m].lessons || [];
    for (let l = 0; l < lessons.length; l++) {
      if (lessons[l].type === 'lab' && lessons[l].isBoss) return { m, l };
    }
  }
  return null;
}

/**
 * Eligible = course is 100% complete. If the course has a Boss Lab it must also
 * have been passed (a lab lands in `completed` only when it cleared its
 * passThreshold, so the Boss key being present means it was passed). Courses
 * without a Boss Lab earn the certificate on 100% completion alone — this
 * matches the "ดูใบเกียรติบัตร" button, which only checks `percent == 100`.
 */
export function eligible(course, progress) {
  if (coursePercent(course, progress) !== 100) return false;
  const boss = bossLab(course);
  if (!boss) return true;
  return completedSet(progress).has(`${boss.m}-${boss.l}`);
}

/** A unique, human-readable serial like 'PNG-2026-000123' (Bangkok year). */
export async function issueSerial() {
  const year = bangkokDay().slice(0, 4); // 'YYYY-MM-DD' → 'YYYY'
  const seq = await nextSeq(`cert-${year}`);
  return `PNG-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * Issue the certificate for (user, course) if eligible and not already issued.
 * Returns the existing or newly-created cert, or null when not eligible.
 * `course` and `progress` are passed in (callers already have them loaded).
 */
export async function maybeIssue(userId, course, progress) {
  const existing = await Certificate.findOne({ user: userId, course: course._id });
  if (existing) return existing;
  if (!eligible(course, progress)) return null;

  const user = await User.findById(userId).select('username').lean();
  try {
    return await Certificate.create({
      user: userId,
      course: course._id,
      serial: await issueSerial(),
      displayName: user?.username || 'นักเรียน Pingable',
      courseTitle: course.title,
      courseLevel: course.level,
      lessonTotal: (course.modules || []).reduce((n, mod) => n + (mod.lessons?.length || 0), 0),
    });
  } catch (err) {
    // Lost the race against a concurrent issuance — return the winner's doc.
    if (err.code === 11000) return Certificate.findOne({ user: userId, course: course._id });
    throw err;
  }
}
