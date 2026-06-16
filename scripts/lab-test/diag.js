// One-off diagnostic: run a lab with a LONG settle and dump real device state
// (show ip ospf neighbor / show ip bgp / routes / ping) to tell timing apart
// from config/platform issues.  node scripts/lab-test/diag.js <slug/mod/les> [settleSec]
import '../load-env.js';
import { driveLab } from './harness.js';
import { SOLUTIONS } from './solutions.js';
import networkTroubleshooting from '../seed-data/network-troubleshooting.js';
import ospfHandsOn from '../seed-data/ospf-hands-on.js';
import ccnpAdvancedRouting from '../seed-data/ccnp-advanced-routing.js';

const COURSES = Object.fromEntries([networkTroubleshooting, ospfHandsOn, ccnpAdvancedRouting].map((c) => [c.slug, c]));

const DIAG = {
  'network-troubleshooting/0/2': [
    { node: 'R1', commands: ['show ip bgp summary', 'show ip route bgp', 'show configuration commands | match "bgp neighbor"'] },
    { node: 'R2', commands: ['show ip bgp summary', 'show configuration commands | match "bgp neighbor"'] },
  ],
  'ospf-hands-on/1/0': [
    { node: 'R2', commands: ['show ip ospf neighbor', 'show ip route ospf', 'show interfaces'] },
    { node: 'R1', commands: ['show ip ospf neighbor', 'show ip route ospf', 'ping 192.168.3.1 count 3'] },
  ],
  'ccnp-advanced-routing/3/1': [
    { node: 'RR', commands: ['show ip bgp summary', 'show ip bgp'] },
    { node: 'C1', commands: ['show configuration commands | match bgp', 'show interfaces', 'show ip bgp summary'] },
    { node: 'C2', commands: ['show configuration commands | match bgp', 'show interfaces'] },
  ],
  'ccnp-advanced-routing/3/0': [
    { node: 'R1', commands: ['show ip bgp summary', 'show ip route bgp', 'show configuration commands | match bgp'] },
  ],
  'ccnp-advanced-routing/2/2': [
    { node: 'R1', commands: ['show nat source rules', 'show nat source translations', 'show configuration commands | match "nat source"'] },
    { node: 'R2', commands: ['show ip route'] },
    { node: 'PC1', commands: ['show ip', 'ping 10.0.12.2'] },
  ],
  'ccnp-advanced-routing/2/0': [
    { node: 'R1', commands: ['show configuration commands | match dhcp-server', 'show configuration commands | match "eth1 address"'] },
    { node: 'PC1', commands: ['show ip'] },
  ],
  'ospf-hands-on/4/1': [
    { node: 'R1', commands: ['show ip ospf neighbor', 'show configuration commands | match "ospf area"'] },
    { node: 'R2', commands: ['show ip ospf neighbor', 'show configuration commands | match "ospf area"'] },
  ],
  'ospf-hands-on/4/3': [
    { node: 'R1', commands: ['show ip ospf neighbor', 'show ip ospf interface eth1', 'show interfaces'] },
    { node: 'R2', commands: ['show ip ospf neighbor', 'show interfaces ethernet eth1', 'show configuration commands'] },
  ],
};

async function main() {
  const key = process.argv[2];
  const settleSec = Number(process.argv[3] || 120);
  const [slug, m, l] = key.split('/');
  const base = SOLUTIONS[key];
  const solution = { ...base, settleMs: settleSec * 1000, regradeMs: 0, diag: DIAG[key] || [] };
  const r = await driveLab({ course: COURSES[slug], modOrder: +m, lesOrder: +l, solution, log: (s) => console.log(s) });
  console.log(`\n→ ${r.error ? 'ERR ' + r.error : (r.passed ? 'PASS' : 'FAIL') + ' ' + r.percent + '%'} [${r.elapsedS}s]`);
  if (r.results) for (const x of r.results) console.log(`   ${x.passed ? '✓' : '✗'} ${x.points}pt ${x.description}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
