// Load .env first so seed-data modules (e.g. GNS3_VYOS_TEMPLATE) read it.
import './load-env.js';

import mongoose from 'mongoose';
import Course from '../src/models/Course.js';
import { validateCourses, reportValidation } from './validate-seed.js';

// Each course lives in its own file under seed-data/ so content stays readable
// and new courses can be added later simply by dropping in another module.
import networkingBasics from './seed-data/networking-basics.js';
import ipSubnetting from './seed-data/ip-subnetting.js';
import ccnaIntro from './seed-data/ccna-intro.js';
import ccnpCore from './seed-data/ccnp-core.js';
import ccnpAdvancedRouting from './seed-data/ccnp-advanced-routing.js';
import networkTroubleshooting from './seed-data/network-troubleshooting.js';
import networkSecurity from './seed-data/network-security.js';
import ospfHandsOn from './seed-data/ospf-hands-on.js';
import playground from './seed-data/playground.js';

const courses = [
  networkingBasics,
  ipSubnetting,
  ccnaIntro,
  ccnpCore,
  ccnpAdvancedRouting,
  networkTroubleshooting,
  networkSecurity,
  ospfHandsOn,
  playground,
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
  // Refuse to write broken content — these mistakes only surface at runtime.
  if (!reportValidation(validateCourses(courses))) process.exit(1);

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pingable-dev');
  console.log('MongoDB connected');

  // Upsert by slug so course _ids survive re-seeding — Progress and LabSession
  // reference courses by _id, so replacing the collection would orphan every
  // user's progress. Courses from before slugs existed are matched by title.
  const keptIds = [];
  for (const data of courses) {
    let doc = await Course.findOne({ slug: data.slug })
      || await Course.findOne({ slug: null, title: data.title });
    if (doc) {
      doc.set(data);
      await doc.save();
      console.log(`  updated  ${data.slug}`);
    } else {
      doc = await Course.create(data);
      console.log(`  created  ${data.slug}`);
    }
    keptIds.push(doc._id);
  }

  // Remove courses that are no longer in the seed set.
  const { deletedCount } = await Course.deleteMany({ _id: { $nin: keptIds } });
  if (deletedCount) console.log(`  removed  ${deletedCount} stale course(s)`);

  const all = await Course.find({ _id: { $in: keptIds } });
  console.log(`Seeded ${all.length} course(s):`);
  all.forEach((c) => {
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
