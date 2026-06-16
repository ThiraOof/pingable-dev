// Lab-test runner: drives labs end-to-end against the live GNS3 server using the
// answer-key solutions, one at a time (teardown between to bound RAM).
//
//   node scripts/lab-test/run.js tierA
//   node scripts/lab-test/run.js smoke
//   node scripts/lab-test/run.js network-troubleshooting/0/1 ospf-hands-on/0/1
//
// A bare arg that matches a GROUPS name expands to its keys; otherwise it's a
// literal slug/mod/les key. `expect` regexes here are answers — test use only.

import '../load-env.js';
import { driveLab } from './harness.js';
import { SOLUTIONS, GROUPS } from './solutions.js';

// Course seed-data (authoritative lab definitions).
import networkingBasics from '../seed-data/networking-basics.js';
import ipSubnetting from '../seed-data/ip-subnetting.js';
import ccnaIntro from '../seed-data/ccna-intro.js';
import ccnpCore from '../seed-data/ccnp-core.js';
import ccnpAdvancedRouting from '../seed-data/ccnp-advanced-routing.js';
import networkTroubleshooting from '../seed-data/network-troubleshooting.js';
import networkSecurity from '../seed-data/network-security.js';
import ospfHandsOn from '../seed-data/ospf-hands-on.js';
import ipServices from '../seed-data/ip-services.js';
import ipv6DeepDive from '../seed-data/ipv6-deep-dive.js';
import playground from '../seed-data/playground.js';

const COURSES = Object.fromEntries(
  [networkingBasics, ipSubnetting, ccnaIntro, ccnpCore, ccnpAdvancedRouting,
   networkTroubleshooting, networkSecurity, ospfHandsOn, ipServices, ipv6DeepDive, playground]
    .map((c) => [c.slug, c]),
);

function expandArgs(args) {
  const keys = [];
  for (const a of args) {
    if (GROUPS[a]) keys.push(...GROUPS[a]);
    else keys.push(a);
  }
  return [...new Set(keys)];
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('usage: run.js <group|slug/mod/les> [...]\n  groups: ' + Object.keys(GROUPS).join(', '));
    process.exit(1);
  }
  const keys = expandArgs(args);
  console.log(`\n=== lab-test: ${keys.length} lab(s) ===\n`);
  const reports = [];

  for (const key of keys) {
    const [slug, m, l] = key.split('/');
    const course = COURSES[slug];
    const solution = SOLUTIONS[key];
    console.log(`\n──── ${key} ────`);
    if (!course) { console.log(`  SKIP: unknown course ${slug}`); reports.push({ key, ok: false, error: 'unknown course' }); continue; }
    if (!solution && course) {
      // sandbox / no-solution labs: still build+boot+teardown to verify the topology
      console.log('  (no answer key — build/boot/teardown only)');
    }
    const report = await driveLab({
      course, modOrder: Number(m), lesOrder: Number(l),
      solution: solution || { groups: [], settleMs: 0 },
      log: (s) => console.log(s),
    });
    const verdict = report.error ? `ERROR@${report.phase}: ${report.error}`
      : report.passed ? `PASS ${report.percent}% (≥${report.passThreshold})`
      : report.ok ? `FAIL ${report.percent}% (<${report.passThreshold})`
      : 'INCOMPLETE';
    console.log(`  → ${verdict}  [${report.elapsedS}s]`);
    if (report.results) for (const r of report.results) console.log(`      ${r.passed ? '✓' : '✗'} ${r.points}pt ${r.description}`);
    reports.push(report);
  }

  // summary
  console.log('\n\n================ SUMMARY ================');
  for (const r of reports) {
    const v = r.error ? `ERR (${r.phase}): ${r.error}`
      : r.passed ? `PASS ${r.percent}%` : r.ok ? `FAIL ${r.percent}%` : 'INCOMPLETE';
    console.log(`  ${r.passed ? '✅' : r.error ? '🟥' : '🟨'} ${r.key.padEnd(34)} ${v}`);
  }
  const pass = reports.filter((r) => r.passed).length;
  console.log(`\n  ${pass}/${reports.length} passed\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
