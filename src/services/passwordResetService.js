import { randomBytes, createHash } from 'crypto';
import User from '../models/User.js';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour — reset links are short-lived

const sha256 = (token) => createHash('sha256').update(String(token)).digest('hex');

/**
 * Issue a password-reset token for the account behind `email` (if any).
 * Only the sha256 of the token touches the database; the raw token exists
 * solely in the email link. Returns the raw token, or null when no account
 * matches — callers must respond identically either way (no enumeration).
 */
export async function issueResetToken(email) {
  const user = await User.findOne({ email });
  if (!user) return null;
  const token = randomBytes(32).toString('hex');
  user.resetTokenHash = sha256(token);
  user.resetTokenExp = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  return token;
}

/** The user behind a still-valid reset token, or null. */
export function findUserByResetToken(token) {
  return User.findOne({
    resetTokenHash: sha256(token),
    resetTokenExp: { $gt: new Date() },
  });
}

/**
 * Consume the token: set the new password (the User pre-save hook hashes it)
 * and invalidate the token so the link is single-use. Clicking an emailed
 * link also proves mailbox ownership, so the address counts as verified.
 * Returns the user, or null when the token is invalid/expired.
 */
export async function resetPassword(token, newPassword) {
  const user = await findUserByResetToken(token);
  if (!user) return null;
  user.password = newPassword;
  user.resetTokenHash = undefined;
  user.resetTokenExp = undefined;
  user.emailVerified = true;
  await user.save();
  return user;
}
