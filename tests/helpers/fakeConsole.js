import net from 'net';

/**
 * A fake GNS3 node console (telnet-ish raw TCP) for exercising
 * gradingService without a real GNS3 server.
 *
 * Options:
 *   prompt    - CLI prompt to present, e.g. 'R1> ' or 'vyos@vyos:~$ '
 *   login     - when true, present a getty login/password before the prompt
 *   silent    - accept connections but never write anything (boot-probe case)
 *   responses - command -> output string, or { pages: [chunk1, chunk2, ...] }
 *               to simulate a pager (--More-- between chunks)
 *
 * Returns { port, connections, commands, logins, close } where `connections`
 * counts accepted sockets, `commands` records every command line received and
 * `logins` records { user, pass } pairs answered at the getty.
 */
export function startFakeConsole({
  prompt = 'R1> ',
  login = false,
  silent = false,
  responses = {},
} = {}) {
  const state = { connections: 0, commands: [], logins: [] };
  const sockets = new Set();

  const server = net.createServer((socket) => {
    state.connections++;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {}); // client may destroy mid-write
    if (silent) return;

    let stage = login ? 'user' : 'shell';
    let lineBuf = '';
    let pages = null; // remaining pager chunks for the in-flight command
    let pendingUser = null;

    const sendPrompt = () => socket.write('\r\n' + prompt);

    const handleLine = (line) => {
      if (stage === 'user') {
        if (!line) return; // getty ignores empty input
        pendingUser = line;
        stage = 'pass';
        socket.write('\r\nPassword: ');
        return;
      }
      if (stage === 'pass') {
        state.logins.push({ user: pendingUser, pass: line });
        stage = 'shell';
        socket.write('\r\nWelcome to FakeOS\r\n');
        sendPrompt();
        return;
      }
      // shell
      const cmd = line.trim();
      if (!cmd) return sendPrompt();
      state.commands.push(cmd);
      const resp = responses[cmd];
      if (resp && typeof resp === 'object' && Array.isArray(resp.pages)) {
        pages = resp.pages.slice(1);
        socket.write('\r\n' + resp.pages[0] + '\r\n--More--');
        stage = 'paging';
        return;
      }
      socket.write('\r\n' + (resp ?? `bad command: ${cmd}`));
      sendPrompt();
    };

    socket.on('data', (chunk) => {
      const text = chunk.toString('utf8');

      // The grader advances a pager by writing a bare space (no newline).
      if (stage === 'paging') {
        if (!text.includes(' ')) return;
        const next = pages.shift();
        if (pages.length === 0) {
          stage = 'shell';
          socket.write('\r\n' + next);
          sendPrompt();
        } else {
          socket.write('\r\n' + next + '\r\n--More--');
        }
        return;
      }

      lineBuf += text;
      let nl;
      while ((nl = lineBuf.indexOf('\n')) !== -1) {
        const line = lineBuf.slice(0, nl).replace(/\r$/, '');
        lineBuf = lineBuf.slice(nl + 1);
        handleLine(line);
      }
    });

    if (login) socket.write('\r\nfakeos login: ');
    else sendPrompt();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        get connections() { return state.connections; },
        get commands() { return state.commands; },
        get logins() { return state.logins; },
        // destroy live sockets first — an unread (paused) socket never consumes
        // the client's FIN, so a bare server.close() would wait forever
        close: () => new Promise((r) => {
          for (const s of sockets) s.destroy();
          server.close(r);
        }),
      });
    });
  });
}

/** A TCP port with nothing listening on it (for connection-refused cases). */
export async function closedPort() {
  const srv = net.createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  await new Promise((r) => srv.close(r));
  return port;
}
