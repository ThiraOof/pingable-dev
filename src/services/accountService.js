// Account deletion — removes a user and every document that references them.
// Tears down any live lab (GNS3 project) first so we don't orphan a running VM.
// This backs the "ลบบัญชี" flow promised in the public Data Deletion policy.
import User from '../models/User.js';
import Progress from '../models/Progress.js';
import UserStats from '../models/UserStats.js';
import XpEvent from '../models/XpEvent.js';
import ReviewItem from '../models/ReviewItem.js';
import Note from '../models/Note.js';
import Certificate from '../models/Certificate.js';
import ExamAttempt from '../models/ExamAttempt.js';
import LabAttempt from '../models/LabAttempt.js';
import Duel from '../models/Duel.js';
import { stopSession } from './labSessionService.js';
import logger from '../config/logger.js';

export async function deleteAccount(userId) {
  // Best-effort: stop any running lab (also deletes the user's LabSession doc).
  // A teardown failure must not block account deletion — the sweeper reaps any
  // orphaned project later.
  try {
    await stopSession(userId);
  } catch (err) {
    logger.warn({ err: err.message, user: String(userId) }, 'lab teardown during account deletion failed');
  }

  // Every collection that references the user by ObjectId. Duel embeds the user
  // inside host/guest sub-docs, so it needs an $or match.
  await Promise.all([
    Progress.deleteMany({ user: userId }),
    UserStats.deleteMany({ user: userId }),
    XpEvent.deleteMany({ user: userId }),
    ReviewItem.deleteMany({ user: userId }),
    Note.deleteMany({ user: userId }),
    Certificate.deleteMany({ user: userId }),
    ExamAttempt.deleteMany({ user: userId }),
    LabAttempt.deleteMany({ user: userId }),
    Duel.deleteMany({ $or: [{ 'host.user': userId }, { 'guest.user': userId }] }),
  ]);

  await User.deleteOne({ _id: userId });
  logger.info({ user: String(userId) }, 'account deleted');
}
