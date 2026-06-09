import net from 'net';

const TOTAL_TIMEOUT_MS = 20000; // covers connect + prompt wait + command output (ping can take ~5s)

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

/**
 * Open a telnet session to a GNS3 node console, log in if prompted,
 * wait for the CLI prompt, send one command, collect output, return it.
 *
 * Works for both the built-in nodes (VPCS/IOS — no login, >/# prompt) and
 * appliances that require a getty login and use a $-terminated prompt (VyOS).
 */
function runCommand(host, port, nodeName, command) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = '';
    let stage = 'waiting_prompt'; // → 'waiting_output' → done
    let sentUser = false;
    let sentPass = false;

    const finish = (result) => {
      clearTimeout(globalTimer);
      if (!socket.destroyed) socket.destroy();
      resolve(result);
    };

    const fail = (err) => {
      clearTimeout(globalTimer);
      if (!socket.destroyed) socket.destroy();
      reject(err);
    };

    // One timer covers connect + login + prompt wait + command output
    const globalTimer = setTimeout(
      () => fail(new Error(`Timeout (${TOTAL_TIMEOUT_MS}ms) on ${nodeName} at ${host}:${port}`)),
      TOTAL_TIMEOUT_MS,
    );

    socket.connect(port, host);

    socket.on('connect', () => {
      socket.write('\n');
    });

    socket.on('data', (chunk) => {
      buffer += stripAnsi(chunk.toString('utf8'));

      if (stage === 'waiting_prompt') {
        // Handle an optional getty login before the shell prompt appears.
        if (PASSWORD_RE.test(buffer) && !sentPass) {
          sentPass = true;
          buffer = '';
          socket.write(NODE_PASS + '\n');
          return;
        }
        if (LOGIN_RE.test(buffer) && !sentUser) {
          sentUser = true;
          buffer = '';
          socket.write(NODE_USER + '\n');
          return;
        }
        if (PROMPT_RE.test(buffer)) {
          stage = 'waiting_output';
          buffer = '';
          socket.write(command + '\n');
        }
      } else {
        if (PAGER_RE.test(buffer)) {
          // Advance the pager and drop the marker so it can't re-trigger.
          buffer = buffer.replace(/--More--|\(END\)|^:\s*$/gm, '');
          socket.write(' ');
          return;
        }
        if (PROMPT_RE.test(buffer)) {
          finish(buffer);
        }
      }
    });

    socket.on('error', (err) => fail(err));

    socket.on('close', () => {
      if (stage === 'waiting_prompt') {
        fail(new Error(`Connection closed before prompt on ${nodeName}`));
      } else {
        finish(buffer);
      }
    });
  });
}

/**
 * Run all grading checks against the active GNS3 session.
 *
 * @param {Object} nodes  - name → { consoleHost, consolePort }  (from buildLab)
 * @param {Array}  checks - [{ description, node, command, expect, points }]
 * @returns {{ score, total, results[] }}
 */
export async function runChecks(nodes, checks) {
  let score = 0;
  let total = 0;
  const results = [];

  for (const check of checks) {
    const pts = check.points ?? 1;
    total += pts;

    const nodeInfo = nodes[check.node];
    if (!nodeInfo) {
      results.push({
        description: check.description,
        passed: false,
        output: `Node "${check.node}" not found in active session`,
        points: 0,
      });
      continue;
    }

    try {
      const raw = await runCommand(
        nodeInfo.consoleHost,
        nodeInfo.consolePort,
        check.node,
        check.command,
      );

      const passed = new RegExp(check.expect, 'i').test(raw);
      const earned = passed ? pts : 0;
      score += earned;

      results.push({
        description: check.description,
        passed,
        output: raw.trim().slice(0, 500), // cap output for storage
        points: earned,
      });
    } catch (err) {
      results.push({
        description: check.description,
        passed: false,
        output: `Error: ${err.message}`,
        points: 0,
      });
    }
  }

  return { score, total, results };
}
