import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  // Optional: OAuth-only accounts (Google/Apple) never set a local
  // password. Still required for accounts created the classic email+password
  // way — the conditional keeps both paths honest.
  password: { type: String, required: function () { return !(this.identities && this.identities.length); } },
  // Linked external sign-in identities. `sub` is the provider's stable user id
  // (never reused, unlike email). One user can link several providers.
  identities: [{
    _id: false,
    provider: { type: String, enum: ['google', 'apple'] },
    sub:      { type: String },
  }],
  role:          { type: String, enum: ['student', 'admin'], default: 'student' },
  // เป้าหมายการเรียน (src/config/goals.js) — ใช้จัดลำดับคอร์สแนะนำบน dashboard
  goal:          { type: String, enum: ['exam-ccna', 'job-noc', 'job-neteng', 'career-switch', 'hobby'] },
  // opt-out จาก leaderboard (ยังนับอันดับ แต่ชื่อแสดงเป็น "ผู้ไม่ประสงค์ออกนาม")
  hideFromLeaderboard: { type: Boolean, default: false },
  // opt-in โปรไฟล์สาธารณะ /u/:username (โชว์ level/badge/คอร์สที่จบ — แนบใน resume ได้)
  profilePublic: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  emailToken:    { type: String },
  emailTokenExp: { type: Date },
  // Password reset: only the sha256 of the emailed token is stored, so a DB
  // leak can't be used to take over accounts (see passwordResetService).
  resetTokenHash: { type: String },
  resetTokenExp:  { type: Date },
  // Per-account brute-force lockout (the IP rate limit alone is dodgeable).
  failedLogins: { type: Number, default: 0 },
  lockUntil:    { type: Date },
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
}, { timestamps: true });

// Look up a linked external identity by (provider, sub).
userSchema.index({ 'identities.provider': 1, 'identities.sub': 1 });

userSchema.pre('save', async function () {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.comparePassword = function (plain) {
  if (!this.password) return Promise.resolve(false); // OAuth-only account — no local password
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);
