// Load .env first so seed-data modules (e.g. GNS3_VYOS_TEMPLATE) read it.
import './load-env.js';

import mongoose from 'mongoose';
import Course from '../src/models/Course.js';

// Each course lives in its own file under seed-data/ so content stays readable
// and new courses can be added later simply by dropping in another module.
import networkingBasics from './seed-data/networking-basics.js';
import ipSubnetting from './seed-data/ip-subnetting.js';
import ccnaIntro from './seed-data/ccna-intro.js';
import ccnpCore from './seed-data/ccnp-core.js';
import ccnpAdvancedRouting from './seed-data/ccnp-advanced-routing.js';

const courses = [
  networkingBasics,
  ipSubnetting,
  ccnaIntro,
  ccnpCore,
  ccnpAdvancedRouting,
];

function lessonStats(course) {
  let reading = 0, lab = 0, quiz = 0;
  for (const m of course.modules || []) {
    for (const l of m.lessons || []) {
      if (l.type === 'reading') reading++;
      else if (l.type === 'lab') lab++;
      else if (l.type === 'quiz') quiz++;
    }
  }
  return { reading, lab, quiz };
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pingable-dev');
  console.log('MongoDB connected');

  await Course.deleteMany({});
  console.log('Cleared existing courses');

  const inserted = await Course.insertMany(courses);
  console.log(`Seeded ${inserted.length} course(s):`);
  inserted.forEach((c) => {
    const s = lessonStats(c);
    console.log(`  [${c.level.padEnd(12)}] ${c.title}`);
    console.log(`     ${c.modules.length} modules · 📖 ${s.reading} reading · 🧪 ${s.lab} lab · ❓ ${s.quiz} quiz`);
  });

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
