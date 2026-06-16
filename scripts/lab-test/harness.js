// Lab test harness — drives a single lab end-to-end against the live GNS3 server,
// the same way the app does, but applies the *answer key* so we can confirm a lab
// actually builds, boots, (injects setup), grades to its passThreshold, and tears down.
//
//   build → wait-boot → inject setup (troubleshoot) → apply answer-key → settle → grade → teardown
//
// Run via scripts/lab-test/run.js. Not for production — `expect` here are answers.

import net from 'node:net';
import '../load-env.js';
import * as gns3 from '../../src/services/gns3Service.js';
import { probeNode, runCommands, runChecks } from '../../src/services/gradingService.js';
import { rollVariables, interpolateSetup, interpolate, interpolateExpect } from '../../src/services/labVariables.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimal telnet capture (test-only): connect, optional getty login, send one
// command, collect output for a moment, return it. Used to read dynamic values
// (e.g. a VPCS MAC) into solution vars before applying the answer key.
function captureOutput(host, port, command, { ms = 3500 } = {}) {
  return new Promise((resolve) => {
    const sock = net.connect(port, host);
    let buf = '';
    let sent = false;
    const finish = () => { try { sock.destroy(); } catch {} resolve(buf); };
    sock.on('data', (c) => {
      buf += c.toString('utf8');
      if (!sent && /[>#$]\s*$/.test(buf)) { sent = true; sock.write(command + '\n'); }
    });
    sock.on('connect', () => sock.write('\n'));
    sock.on('error', finish);
    setTimeout(finish, ms);
  });
}
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// Capture the transcript of several show-commands on one node (diagnostics).
function captureCmds(host, port, name, cmds, { cmdMs = 20000 } = {}) {
  return new Promise((resolve) => {
    const sock = net.connect(port, host);
    let buf = '', out = '', i = -1, sentU = false, sentP = false, phase = 'login';
    let timer;
    const finish = () => { clearTimeout(timer); try { sock.destroy(); } catch {} resolve(out); };
    const next = () => {
      i++;
      if (i >= cmds.length) return finish();
      buf = ''; out += `\n$ ${cmds[i]}\n`; sock.write(cmds[i] + '\n');
      clearTimeout(timer); timer = setTimeout(() => { out += buf; next(); }, cmdMs);
    };
    sock.on('data', (c) => {
      buf += c.toString('utf8');
      if (/--More--|\(END\)/.test(buf)) { buf = buf.replace(/--More--|\(END\)/g, ''); sock.write(' '); }
      if (phase === 'login') {
        if (/password\s*:\s*$/i.test(buf) && !sentP) { sentP = true; buf = ''; sock.write((process.env.GNS3_NODE_PASS || 'vyos') + '\n'); }
        else if (/(?:login|username)\s*:\s*$/i.test(buf) && !sentU) { sentU = true; buf = ''; sock.write((process.env.GNS3_NODE_USER || 'vyos') + '\n'); }
        else if (/[>#$]\s*$/.test(buf)) { phase = 'run'; next(); }
      } else if (/[>#$]\s*$/.test(buf)) { out += buf; next(); }
    });
    sock.on('connect', () => sock.write('\n'));
    sock.on('error', finish);
    timer = setTimeout(finish, 30000); // login guard
  });
}

// Robust injector (test-only): one persistent telnet session per node, getty
// auto-login, per-command timeout, and a LONG timeout for `commit` (a fresh
// IPsec/strongswan commit on a slow GNS3 host can take ~30–60s — longer than
// the grader's fixed 20s, which would tear the socket down mid-commit and leave
// a half-applied config). Also surfaces VyOS "Commit failed"/"Set failed" so a
// real syntax incompatibility is reported instead of silently "succeeding".
const PROMPT = /[>#$]\s*$/;
const LOGINP = /(?:login|username)\s*:\s*$/i;
const PASSP  = /password\s*:\s*$/i;
const PAGER  = /--More--|\(END\)|^:\s*$/m;
const NODE_USER = process.env.GNS3_NODE_USER || 'vyos';
const NODE_PASS = process.env.GNS3_NODE_PASS || 'vyos';

function injectSession(host, port, name, commands, { cmdMs = 20000, commitMs = 90000, log } = {}) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, host);
    let buf = '';
    let onData = null;
    let done = false;
    const fail = (e) => { if (!done) { done = true; try { sock.destroy(); } catch {} reject(e); } };
    sock.on('error', fail);
    sock.on('data', (c) => { buf += c.toString('utf8'); onData?.(); });

    const waitFor = (pred, ms, { pager = false } = {}) => new Promise((res, rej) => {
      const t = setTimeout(() => { onData = null; rej(new Error(`timeout ${ms}ms on ${name}`)); }, ms);
      onData = () => {
        if (pager && PAGER.test(buf)) { buf = buf.replace(/--More--|\(END\)|^:\s*$/gm, ''); sock.write(' '); }
        if (pred()) { clearTimeout(t); onData = null; res(); }
      };
      onData();
    });

    (async () => {
      let sentU = false, sentP = false;
      sock.write('\n');
      await waitFor(() => {
        if (PASSP.test(buf) && !sentP) { sentP = true; buf = ''; sock.write(NODE_PASS + '\n'); }
        else if (LOGINP.test(buf) && !sentU) { sentU = true; buf = ''; sock.write(NODE_USER + '\n'); }
        return PROMPT.test(buf);
      }, 30000);
      // Widen the PTY so the getty line discipline doesn't wrap (and mangle)
      // long config lines like the DHCP `range … start … stop …` (~110 chars).
      buf = ''; sock.write('stty cols 1000 rows 100 2>/dev/null\n');
      await waitFor(() => PROMPT.test(buf), 8000).catch(() => {});
      // A previous failed injection may have left the TTY in config mode
      // (prompt ends with '#', operational ends with '$'). Bail out cleanly so
      // the group's own `configure` isn't rejected as "Invalid command".
      if (/#\s*$/.test(buf) && !/\$\s*$/.test(buf)) {
        buf = ''; sock.write('exit discard\n');
        await waitFor(() => PROMPT.test(buf), 15000).catch(() => {});
      }
      for (const cmd of commands) {
        buf = '';
        sock.write(cmd + '\n');
        const isCommit = /^commit\b/.test(cmd.trim());
        // NO pager handling here: set/commit never page, and the pager's
        // `^:\s*$` matcher spuriously fired mid-output and injected a space into
        // the command stream (e.g. "10.0.12.0/24" → "10.0.12.0/2 4"), silently
        // corrupting config. That was the real source of the "flaky" failures.
        await waitFor(() => PROMPT.test(buf), isCommit ? commitMs : cmdMs);
        if (/Commit failed|Set failed|Configuration error|is not a valid|Invalid command/i.test(buf)) {
          throw new Error(`${name} "${cmd}" → ${buf.replace(/\s+/g, ' ').trim().slice(0, 200)}`);
        }
      }
      done = true; sock.destroy(); resolve();
    })().catch(fail);
  });
}

// Resolve a lab object from a seeded course module by module/lesson `order`.
export function resolveLab(course, modOrder, lesOrder) {
  const mod = course.modules.find((m) => m.order === modOrder) ?? course.modules[modOrder];
  if (!mod) throw new Error(`module order ${modOrder} not found in ${course.slug}`);
  const lesson = mod.lessons.find((l) => l.order === lesOrder) ?? mod.lessons[lesOrder];
  if (!lesson) throw new Error(`lesson order ${lesOrder} not found in ${course.slug} m${modOrder}`);
  if (lesson.type !== 'lab') throw new Error(`${course.slug} m${modOrder}/l${lesOrder} is ${lesson.type}, not a lab`);
  return { mod, lab: lesson };
}

async function waitForBoot(nodes, { timeoutMs = 300000, intervalMs = 6000, log } = {}) {
  const entries = Object.entries(nodes);
  const booted = new Set();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await Promise.all(entries.map(async ([name, info]) => {
      if (booted.has(name)) return;
      // console-less nodes (switch) have null consolePort → probeNode returns true
      if (await probeNode(info.consoleHost, info.consolePort)) booted.add(name);
    }));
    if (booted.size === entries.length) {
      log?.(`    all ${entries.length} node(s) booted in ${Math.round((Date.now() - start) / 1000)}s`);
      return true;
    }
    log?.(`    booted ${booted.size}/${entries.length} (${Object.keys(nodes).filter((n) => !booted.has(n)).join(',')})…`);
    await sleep(intervalMs);
  }
  throw new Error(`boot timeout: only ${booted.size}/${entries.length} booted (${[...booted].join(',')})`);
}

// A QEMU console answers TCP/getty long before VyOS's config daemon (vbash
// configure/commit) is up. Injecting a long config before then leaves a
// half-committed mess when a commit times out and the socket is torn down.
// Gate on the daemon actually accepting a configure/exit cycle.
async function waitConfigReady(nodes, vyosNames, { timeoutMs = 300000, intervalMs = 8000, log } = {}) {
  if (!vyosNames.length) return;
  const ready = new Set();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await Promise.all(vyosNames.map(async (name) => {
      if (ready.has(name)) return;
      const info = nodes[name];
      try { await runCommands(info.consoleHost, info.consolePort, name, ['configure', 'exit']); ready.add(name); }
      catch {}
    }));
    if (ready.size === vyosNames.length) {
      log?.(`    VyOS config daemon ready (${vyosNames.length}) in ${Math.round((Date.now() - start) / 1000)}s`);
      return;
    }
    log?.(`    waiting VyOS config daemon: ${ready.size}/${vyosNames.length}…`);
    await sleep(intervalMs);
  }
  throw new Error(`config-daemon timeout: ${ready.size}/${vyosNames.length} ready`);
}

// vbash (configure/commit) can be ready while FRR's daemons (zebra/bgpd/ospfd)
// are still starting — committing routing config then leaves the protocol not
// running ("% BGP instance not found", OSPF never forms). Gate on FRR answering
// `show ip route` (its Codes: header) before injecting routing config.
async function waitFrrReady(nodes, vyosNames, { timeoutMs = 180000, intervalMs = 8000, log } = {}) {
  if (!vyosNames.length) return;
  const ready = new Set();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await Promise.all(vyosNames.map(async (name) => {
      if (ready.has(name)) return;
      const info = nodes[name];
      const out = await captureOutput(info.consoleHost, info.consolePort, 'show ip route', { ms: 5000 });
      if (/Codes:/.test(out)) ready.add(name);
    }));
    if (ready.size === vyosNames.length) {
      log?.(`    FRR ready (${vyosNames.length}) in ${Math.round((Date.now() - start) / 1000)}s`);
      return;
    }
    log?.(`    waiting FRR: ${ready.size}/${vyosNames.length}…`);
    await sleep(intervalMs);
  }
  log?.(`    FRR readiness timed out (${ready.size}/${vyosNames.length}) — continuing`);
}

// Inject a group list ([{node, commands}]) over the grader telnet, with retries.
async function injectGroups(nodes, groups, { attempts = 6, settleMs = 3000, log, label } = {}) {
  for (const group of groups) {
    const info = nodes[group.node];
    if (!info?.consolePort) throw new Error(`${label}: node "${group.node}" has no console`);
    let lastErr;
    for (let a = 1; a <= attempts; a++) {
      try {
        await injectSession(info.consoleHost, info.consolePort, group.node, group.commands, { log });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        log?.(`    ${label} ${group.node} attempt ${a}/${attempts} failed: ${err.message}`);
        await sleep(settleMs);
      }
    }
    if (lastErr) throw new Error(`${label} ${group.node}: ${lastErr.message}`);
  }
}

/**
 * Drive one lab. `solution` = { settleMs?, bootTimeoutMs?, groups: [{node, commands[]}], note? }.
 * Returns a result report; never throws (errors captured in report).
 */
export async function driveLab({ course, modOrder, lesOrder, solution, log = () => {} }) {
  const t0 = Date.now();
  const report = { key: `${course.slug}/${modOrder}/${lesOrder}`, ok: false, phase: 'resolve' };
  let projectId = null;
  try {
    const { lab } = resolveLab(course, modOrder, lesOrder);
    report.title = lab.title;
    report.mode = lab.mode || 'config';
    report.passThreshold = lab.passThreshold || 60;

    const vars = lab.variables?.length ? rollVariables(lab.variables) : {};
    report.vars = vars;
    if (Object.keys(vars).length) log(`    vars: ${JSON.stringify(vars)}`);

    // 1) build
    report.phase = 'build';
    log(`  [build] ${lab.title}`);
    const built = await gns3.buildLab(lab, lab.title);
    projectId = built.projectId;
    report.projectId = projectId;

    // 2) wait boot (console answers), then wait VyOS config daemon to be ready
    report.phase = 'boot';
    await waitForBoot(built.nodes, { timeoutMs: solution?.bootTimeoutMs || 300000, log });
    const vyosNames = lab.topology.nodes.filter((n) => n.templateId).map((n) => n.name);
    report.phase = 'ready';
    await waitConfigReady(built.nodes, vyosNames, { timeoutMs: solution?.bootTimeoutMs || 300000, log });
    // (waitFrrReady gate removed: the probe needs getty login to work, and FRR
    // startup-lag isn't the cause — config daemon is ready ~4s and bgpd still
    // fails to instantiate setup-injected BGP after 40s+. See report.)

    // 3) inject setup (troubleshoot) — same as labSessionService.ensureSetup
    let stagedSetup = [];
    if (lab.setupCommands?.length) {
      report.phase = 'setup';
      log('  [setup] injecting broken config…');
      stagedSetup = interpolateSetup(lab.setupCommands, vars);
      await injectGroups(built.nodes, stagedSetup, { log, label: 'setup', attempts: 8 });
      await sleep(3000);
    }

    // 3b) capture dynamic values (e.g. a VPCS MAC) into vars for interpolation
    for (const cap of solution?.capture || []) {
      const info = built.nodes[cap.node];
      const out = await captureOutput(info.consoleHost, info.consolePort, cap.command);
      const m = out.match(new RegExp(cap.regex, 'i'));
      if (!m) throw new Error(`capture ${cap.var}: regex ${cap.regex} not found on ${cap.node}`);
      vars[cap.var] = m[1] ?? m[0];
      log(`  [capture] ${cap.var} = ${vars[cap.var]}`);
    }

    // 4) apply answer key
    report.phase = 'solve';
    log('  [solve] applying answer key…');
    const groups = (solution?.groups || []).map((g) => ({
      node: g.node,
      commands: g.commands.map((c) => interpolate(c, vars)),
    }));
    await injectGroups(built.nodes, groups, { log, label: 'solve', attempts: 8 });

    // 5) settle (convergence: BGP/OSPF/IPsec need time)
    const settleMs = solution?.settleMs ?? 8000;
    report.phase = 'settle';
    log(`  [settle] ${settleMs}ms…`);
    await sleep(settleMs);

    // 6) grade — interpolate command + expect with rolled vars
    report.phase = 'grade';
    const checks = lab.gradingChecks.map((c) => ({
      ...c,
      command: interpolate(c.command, vars),
      expect: interpolateExpect(c.expect, vars),
    }));
    const { score, total, results } = await runChecks(built.nodes, checks);
    report.score = score;
    report.total = total;
    report.percent = pct(score, total);
    report.passed = report.percent >= report.passThreshold;
    report.results = results.map((r) => ({ description: r.description, passed: r.passed, points: r.points }));
    report.ok = true;

    // Guard against flaky VyOS injection: a `commit` occasionally doesn't
    // persist config on a loaded 3×VyOS lab with no error thrown (e.g. BGP RR
    // left C1/C2 with no BGP at all). `set` is idempotent, so if we're not
    // passing yet, re-apply the answer key once — the second pass usually
    // sticks now that the nodes are fully warmed up — then re-grade.
    if (!report.passed && groups.length && vyosNames.length) {
      log('  [re-solve] not passed; re-applying answer key once (safety net)…');
      try {
        await injectGroups(built.nodes, groups, { log, label: 're-solve', attempts: 4 });
        await sleep(settleMs);
        const r2 = await runChecks(built.nodes, checks);
        if (r2.score > report.score) {
          report.score = r2.score;
          report.percent = pct(r2.score, total);
          report.passed = report.percent >= report.passThreshold;
          report.results = r2.results.map((r) => ({ description: r.description, passed: r.passed, points: r.points }));
          report.resolved = true;
        }
      } catch (err) { log(`  [re-solve] ${err.message}`); }
    }

    // Poll-regrade until passed or the convergence budget runs out — FRR/IPsec
    // on a slow GNS3 host can take 90–120s to converge, far longer than one
    // fixed settle. Cheaper than padding every lab's initial settle.
    if (!report.passed && solution?.regradeMs) {
      const deadline = Date.now() + (solution.maxRegradeMs || 150000);
      while (!report.passed && Date.now() < deadline) {
        log(`  [regrade] ${report.percent}% < ${report.passThreshold}%, waiting ${solution.regradeMs}ms…`);
        await sleep(solution.regradeMs);
        const r2 = await runChecks(built.nodes, checks);
        if (r2.score > report.score) {
          report.score = r2.score;
          report.percent = pct(r2.score, total);
          report.passed = report.percent >= report.passThreshold;
          report.results = r2.results.map((r) => ({ description: r.description, passed: r.passed, points: r.points }));
          report.regraded = true;
        }
      }
    }
    // 6b) optional diagnostics — dump real device state
    for (const d of solution?.diag || []) {
      const info = built.nodes[d.node];
      if (!info?.consolePort) continue;
      const out = await captureCmds(info.consoleHost, info.consolePort, d.node, d.commands);
      log(`  [diag ${d.node}]\n${out.split('\n').map((l) => '      ' + l).join('\n')}`);
    }
  } catch (err) {
    report.error = err.message;
  } finally {
    // 7) teardown
    if (projectId) {
      try { await gns3.deleteProject(projectId); report.tornDown = true; }
      catch (err) { report.teardownError = err.message; }
    }
    report.elapsedS = Math.round((Date.now() - t0) / 1000);
  }
  return report;
}
