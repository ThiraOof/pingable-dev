process.env.LOG_LEVEL = 'silent';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startFakeConsole, closedPort } from './helpers/fakeConsole.js';

const { runChecks, probeNode } = await import('../src/services/gradingService.js');

// ── probeNode ─────────────────────────────────────────────────────────────────

test('probeNode: console-less node (no port) counts as booted', async () => {
  assert.equal(await probeNode('127.0.0.1', null), true);
  assert.equal(await probeNode('127.0.0.1', 0), true);
});

test('probeNode: booted console (CLI prompt) answers true', async () => {
  const con = await startFakeConsole({ prompt: 'R1> ' });
  try {
    assert.equal(await probeNode('127.0.0.1', con.port), true);
  } finally {
    await con.close();
  }
});

test('probeNode: getty login prompt counts as booted (OS is up)', async () => {
  const con = await startFakeConsole({ login: true });
  try {
    assert.equal(await probeNode('127.0.0.1', con.port), true);
  } finally {
    await con.close();
  }
});

test('probeNode: nothing listening → false (never throws)', async () => {
  assert.equal(await probeNode('127.0.0.1', await closedPort(), 1000), false);
});

test('probeNode: TCP accepts but OS not booted (no prompt) → false', async () => {
  const con = await startFakeConsole({ silent: true });
  try {
    assert.equal(await probeNode('127.0.0.1', con.port, 500), false);
  } finally {
    await con.close();
  }
});

// ── runChecks ─────────────────────────────────────────────────────────────────

const check = (node, command, expect, points = 1, description = `${node}: ${command}`) =>
  ({ description, node, command, expect, points });

test('runChecks: one console session per node, commands sequential, results in original order', async () => {
  const con = await startFakeConsole({
    prompt: 'PC1> ',
    responses: {
      'ping 10.0.0.2': '84 bytes from 10.0.0.2 icmp_seq=1 ttl=64 time=1.2 ms',
      'show ip': 'IP/MASK : 10.0.0.1/24\nGATEWAY : 10.0.0.254',
    },
  });
  try {
    const nodes = { PC1: { consoleHost: '127.0.0.1', consolePort: con.port } };
    const { score, total, results } = await runChecks(nodes, [
      check('PC1', 'ping 10.0.0.2', 'bytes from 10\\.0\\.0\\.2', 2),
      check('PC1', 'show ip', 'GATEWAY\\s*:\\s*10\\.0\\.0\\.254', 3),
      check('PC1', 'ping 10.0.0.2', 'host unreachable', 5), // should fail
    ]);

    assert.equal(con.connections, 1); // one telnet session for all three checks
    assert.deepEqual(con.commands, ['ping 10.0.0.2', 'show ip', 'ping 10.0.0.2']);
    assert.deepEqual(results.map((r) => r.passed), [true, true, false]);
    assert.deepEqual(results.map((r) => r.points), [2, 3, 0]);
    assert.equal(score, 5);
    assert.equal(total, 10);
  } finally {
    await con.close();
  }
});

test('runChecks: expect regex is matched case-insensitively', async () => {
  const con = await startFakeConsole({
    prompt: 'R1> ',
    responses: { 'show interfaces': 'eth0 STATE: UP' },
  });
  try {
    const nodes = { R1: { consoleHost: '127.0.0.1', consolePort: con.port } };
    const { results } = await runChecks(nodes, [check('R1', 'show interfaces', 'state:\\s*up')]);
    assert.equal(results[0].passed, true);
  } finally {
    await con.close();
  }
});

test('runChecks: auto-login at a getty (VyOS-style) with default vyos/vyos', async () => {
  const con = await startFakeConsole({
    login: true,
    prompt: 'vyos@vyos:~$ ', // VyOS op-mode prompt ends with $
    responses: { 'show ip route': 'S>* 0.0.0.0/0 [1/0] via 192.168.1.254' },
  });
  try {
    const nodes = { R1: { consoleHost: '127.0.0.1', consolePort: con.port } };
    const { results } = await runChecks(nodes, [check('R1', 'show ip route', 'S>\\*\\s+0\\.0\\.0\\.0/0')]);
    assert.equal(results[0].passed, true);
    assert.deepEqual(con.logins, [{ user: 'vyos', pass: 'vyos' }]);
  } finally {
    await con.close();
  }
});

test('runChecks: pager output (--More--) is auto-advanced and fully captured', async () => {
  const con = await startFakeConsole({
    prompt: 'vyos@vyos:~$ ',
    responses: {
      'show configuration': { pages: ['nat {\n  source {', '    rule 10 {\n      translation address masquerade'] },
    },
  });
  try {
    const nodes = { R1: { consoleHost: '127.0.0.1', consolePort: con.port } };
    const { results } = await runChecks(nodes, [
      // matches text from the SECOND page — only reachable past the pager
      check('R1', 'show configuration', 'translation\\s+address\\s+masquerade'),
    ]);
    assert.equal(results[0].passed, true);
    assert.ok(!results[0].output.includes('--More--')); // marker stripped from stored output
  } finally {
    await con.close();
  }
});

test('runChecks: ANSI escape codes are stripped before matching', async () => {
  const con = await startFakeConsole({
    prompt: 'R1> ',
    // colour codes between "state:" and "UP" would break the regex if kept
    responses: { 'show int eth0': 'eth0 state: \x1B[32mUP\x1B[0m' },
  });
  try {
    const nodes = { R1: { consoleHost: '127.0.0.1', consolePort: con.port } };
    const { results } = await runChecks(nodes, [check('R1', 'show int eth0', 'state:\\s*UP')]);
    assert.equal(results[0].passed, true);
    assert.ok(!results[0].output.includes('\x1B'));
  } finally {
    await con.close();
  }
});

test('runChecks: node missing from the session fails its checks with 0 points', async () => {
  const { score, total, results } = await runChecks({}, [check('GHOST', 'ping 1.1.1.1', '.', 4)]);
  assert.equal(results[0].passed, false);
  assert.match(results[0].output, /not found in active session/);
  assert.equal(score, 0);
  assert.equal(total, 4);
});

test('runChecks: unreachable console fails that node only; other nodes still graded', async () => {
  const con = await startFakeConsole({ prompt: 'PC2> ', responses: { 'show ip': 'IP/MASK : 10.0.0.2/24' } });
  try {
    const nodes = {
      PC1: { consoleHost: '127.0.0.1', consolePort: await closedPort() },
      PC2: { consoleHost: '127.0.0.1', consolePort: con.port },
    };
    const { results } = await runChecks(nodes, [
      check('PC1', 'show ip', '10\\.0\\.0\\.1'),
      check('PC2', 'show ip', '10\\.0\\.0\\.2'),
    ]);
    assert.equal(results[0].passed, false);
    assert.match(results[0].output, /^Error: /);
    assert.equal(results[1].passed, true);
  } finally {
    await con.close();
  }
});

test('runChecks: stored output is capped at 500 chars', async () => {
  const con = await startFakeConsole({
    prompt: 'R1> ',
    responses: { 'show log': 'x'.repeat(2000) },
  });
  try {
    const nodes = { R1: { consoleHost: '127.0.0.1', consolePort: con.port } };
    const { results } = await runChecks(nodes, [check('R1', 'show log', 'x{100}')]);
    assert.equal(results[0].passed, true);
    assert.ok(results[0].output.length <= 500);
  } finally {
    await con.close();
  }
});
