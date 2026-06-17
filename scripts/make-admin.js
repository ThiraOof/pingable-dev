// Promote (or demote) a user to/from admin by email.
//
// The admin role can only be set on an account by directly touching the DB —
// there is no self-service path (by design). This script is that path.
//
// Usage:
//   npm run make-admin <email>            promote to admin
//   npm run make-admin <email> --demote   demote back to student
import './load-env.js';

import mongoose from 'mongoose';
import User from '../src/models/User.js';

const email = (process.argv[2] || '').trim().toLowerCase();
const demote = process.argv.includes('--demote');

if (!email || email.startsWith('--')) {
  console.error('usage: npm run make-admin <email> [--demote]');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pingable-dev');

const role = demote ? 'student' : 'admin';
const user = await User.findOne({ email });

if (!user) {
  console.error(`! no user with email ${email}`);
  await mongoose.disconnect();
  process.exit(1);
}

if (user.role === role) {
  console.log(`• ${email} is already ${role} — nothing to do`);
} else {
  user.role = role;
  await user.save();
  console.log(`✓ ${email} is now ${role}`);
}

await mongoose.disconnect();
