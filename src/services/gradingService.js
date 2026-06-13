import net from 'net';

const CONNECT_TIMEOUT_MS = 25000; // connect + (optional) getty login + first prompt
const COMMAND_TIMEOUT_MS = 20000; // one command's output (ping can take ~5s)
const PROBE_TIMEOUT_MS   = 4000;  // boot probe: console answers fast once getty/CLI is up

// Strip ANSI escape codes and non-printable chars (except newline/tab)
function stripAnsi(str) {
  return str
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

// Detect any CLI prompt: a line ending with >, # or $ (VPCS/IOS use >/#,
// VyOS operational mode ends with "vyos@vyos:~$"). Avoids relying on the exact
// node name since the device hostname may differ from the GNS3 node name.
const PROMPT_RE = /[>#$]\s*$/;

// Login prompts presented by appliances that boot to a getty (e.g. VyOS).
const LOGIN_RE    = /(?:login|username)\s*:\s*$/i;
const PASSWORD_RE = /password\s*:\s*$/i;

// Pager markers (VyOS pipes long output through a pager; IOS uses --More--).
const PAGER_RE = /--More--|\(END\)|^:\s*$/m;

// Default appliance console credentials (VyOS ships vyos/vyos). Override per
// deployment if the image was hardened.
const NODE_USER = process.env.GNS3_NODE_USER || 'vyos';
const NODE_PASS = process.env.GNS3_NODE_PASS || 'vyos';

// AggregateError (e.g. ECONNREFUSED on both IPv4+IPv6) has an empty .message.
const errMsg = (err) =>
  err.message || err.errors?.[0]?.message || err.code || 'connection failed';

/**
 * One telnet session to a GNS3 node console: connect + log in once, then run
 * any number of commands over the same socket (one login per node instead of
 * one per grading check).
 */
class ConsoleSession {
  constructor(host, port, nodeName) {
    this.host = host;
    this.port = port;
    this.nodeName = nodeName;
    this.buffer = '';
    this.closed = false;
    this.error = null;
    this._notify = null;
    this.socket = new net.Socket();
    this.socket.on('data', (chunk) => {
      this.buffer += stripAnsi(chunk.toString('utf8'));
      this._notify?.();
    });
    this.socket.on('error', (err) => { this.error = err; this._notify?.(); });
    this.socket.on('close', () => { this.closed = true; this._notify?.(); });
  }

  close() {
    if (!this.socket.destroyed) this.socket.destroy();
  }

  // Resolve once predicate() is true; reject on socket error, close (unless
  // closeResolves) or timeout. onData may consume login/pager prompts first.
  _waitFor(predicate, timeoutMs, { onData, closeResolves = false } = {}) {
    return new Promise((resolve, reject) => {
      const done = (fn, arg) => { clearTimeout(timer); this._notify = null; fn(arg); };
      const timer = setTimeout(
        () => done(reject, new Error(`Timeout (${timeoutMs}ms) on ${this.nodeName} at ${this.host}:${this.port}`)),
        timeoutMs,
      );
      const check = () => {
        if (this.error) return done(reject, this.error);
        onData?.();
        if (predicate()) return done(resolve);
        if (this.closed) {
          if (closeResolves) return done(resolve);
          return done(reject, new Error(`Connection closed before prompt on ${this.nodeName}`));
        }
      };
      this._notify = check;
      check();
    });
  }

  // Connect, answer an optional getty login (VyOS), wait for the CLI prompt.
  async connect(timeoutMs = CONNECT_TIMEOUT_MS) {
    let sentUser = false;
    let sentPass = false;
    this.socket.connect(this.port, this.host, () => this.socket.write('\n'));
    await this._waitFor(() => PROMPT_RE.test(this.buffer), timeoutMs, {
      onData: () => {
        if (PASSWORD_RE.test(this.buffer) && !sentPass) {
          sentPass = true;
          this.buffer = '';
          this.socket.write(NODE_PASS + '\n');
        } else if (LOGIN_RE.test(this.buffer) && !sentUser) {
          sentUser = true;
          this.buffer = '';
          this.socket.write(NODE_USER + '\n');
        }
      },
    });
    this.buffer = '';
  }

  // Send one command, auto-advance any pager, collect output until the prompt.
  async run(command, timeoutMs = COMMAND_TIMEOUT_MS) {
    if (this.closed || this.error) {
      throw this.error || new Error(`Connection to ${this.nodeName} already closed`);
    }
    this.buffer = '';
    this.socket.write(command + '\n');
    await this._waitFor(() => PROMPT_RE.test(this.buffer), timeoutMs, {
      closeResolves: true, // some consoles drop the link after output; keep what we got
      onData: () => {
        if (!this.closed && PAGER_RE.test(this.buffer)) {
          // Advance the pager and drop the marker so it can't re-trigger.
          this.buffer = this.buffer.replace(/--More--|\(END\)|^:\s*$/gm, '');
          this.socket.write(' ');
        }
      },
    });
    return this.buffer;
  }
}

/**
 * Boot probe: a node counts as booted once its console answers with a getty
 * login or CLI prompt (a QEMU console accepts TCP long before the OS is up,
 * so a plain connect is not enough). Console-less nodes (built-in switches)
 * pass immediately. Never throws.
 */
export async function probeNode(host, port, timeoutMs = PROBE_TIMEOUT_MS) {
  if (!port) return true;
  const s = new ConsoleSession(host, port, 'probe');
  s.socket.connect(port, host, () => s.socket.write('\n'));
  try {
    await s._waitFor(
      () => PROMPT_RE.test(s.buffer) || LOGIN_RE.test(s.buffer) || PASSWORD_RE.test(s.buffer),
      timeoutMs,
    );
    return true;
  } catch {
    return false;
  } finally {
    s.close();
  }
}

/**
 * Run a command sequence on one node console (same telnet machinery as the
 * grader: connect + auto-login once, commands run sequentially). Used by the
 * lab setup injector to stage "broken" configs for troubleshoot labs.
 * Throws on connect/command failure — the caller decides about retries.
 */
export async function runCommands(host, port, nodeName, commands) {
  const session = new ConsoleSession(host, port, nodeName);
  try {
    await session.connect();
    for (const cmd of commands) {
      await session.run(cmd);
    }
  } finally {
    session.close();
  }
}

/**
 * Run all grading checks against the active GNS3 session.
 *
 * Checks are grouped by target node: each node gets ONE console session
 * (one connect + login), its commands run sequentially on that socket, and
 * the node groups run in parallel. Results keep the original check order.
 *
 * @param {Object} nodes  - name → { consoleHost, consolePort }  (from buildLab)
 * @param {Array}  checks - [{ description, node, command, expect, points }]
 * @returns {{ score, total, results[] }}
 */
export async function runChecks(nodes, checks) {
  const results = new Array(checks.length);
  let total = 0;

  const byNode = new Map();
  checks.forEach((check, i) => {
    total += check.points ?? 1;
    if (!byNode.has(check.node)) byNode.set(check.node, []);
    byNode.get(check.node).push(i);
  });

  const failAll = (indices, message) => {
    for (const i of indices) {
      results[i] = { description: checks[i].description, passed: false, output: message, points: 0 };
    }
  };

  await Promise.all([...byNode.entries()].map(async ([nodeName, indices]) => {
    const nodeInfo = nodes?.[nodeName];
    if (!nodeInfo?.consolePort) {
      return failAll(indices, `Node "${nodeName}" not found in active session`);
    }

    const session = new ConsoleSession(nodeInfo.consoleHost, nodeInfo.consolePort, nodeName);
    try {
      await session.connect();
    } catch (err) {
      session.close();
      return failAll(indices, `Error: ${errMsg(err)}`);
    }

    for (const i of indices) {
      const check = checks[i];
      try {
        const raw = await session.run(check.command);
        const passed = new RegExp(check.expect, 'i').test(raw);
        results[i] = {
          description: check.description,
          passed,
          output: raw.trim().slice(0, 500), // cap output for storage
          points: passed ? (check.points ?? 1) : 0,
        };
      } catch (err) {
        results[i] = { description: check.description, passed: false, output: `Error: ${errMsg(err)}`, points: 0 };
      }
    }
    session.close();
  }));

  const score = results.reduce((n, r) => n + r.points, 0);
  return { score, total, results };
}
