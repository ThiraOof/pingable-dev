import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:          { type: String, enum: ['student', 'admin'], default: 'student' },
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

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);
