import http from 'http';
import { randomUUID } from 'crypto';

/**
 * Minimal in-process GNS3 REST (/v2) server covering exactly the endpoints
 * gns3Service uses, so labSessionService/gns3Service can be tested without
 * module mocking: point GNS3_HOST/GNS3_PORT at this before importing them.
 *
 * Options:
 *   failOn - Set of route keys that should return HTTP 500. Keys:
 *            'create-project', 'open', 'create-node', 'template', 'rename',
 *            'start-nodes', 'stop-nodes', 'link', 'delete', 'list-projects'
 *
 * Returned handle:
 *   port, projects (Map id -> {name}), deleted (project ids), stopped (project
 *   ids that had nodes/stop called), calls ({method, path, body} log),
 *   seedProject(id, name), close()
 */
export function startFakeGns3({ failOn = new Set() } = {}) {
  const projects = new Map(); // project_id -> { name }
  const nodes = new Map();    // node_id -> node
  const deleted = [];
  const stopped = [];         // project ids that had nodes/stop called
  const calls = [];
  let nextConsole = 5000;

  const makeNode = (name, consoleType = 'telnet') => {
    const node = {
      node_id: randomUUID(),
      name,
      console: ++nextConsole,
      console_type: consoleType,
      console_host: '0.0.0.0',
    };
    nodes.set(node.node_id, node);
    return node;
  };

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      const path = req.url;
      calls.push({ method: req.method, path, body });

      const reply = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(obj === null ? '' : JSON.stringify(obj));
      };
      const fail = (key) => failOn.has(key) && (reply(500, { message: `fake failure: ${key}` }), true);

      let m;
      if (req.method === 'POST' && path === '/v2/projects') {
        if (fail('create-project')) return;
        const project_id = randomUUID();
        projects.set(project_id, { name: body.name });
        return reply(201, { project_id, name: body.name, auto_close: body.auto_close });
      }
      if (req.method === 'GET' && path === '/v2/projects') {
        if (fail('list-projects')) return;
        return reply(200, [...projects].map(([project_id, p]) => ({ project_id, name: p.name })));
      }
      if ((m = path.match(/^\/v2\/projects\/([^/]+)$/)) && req.method === 'DELETE') {
        if (fail('delete')) return;
        deleted.push(m[1]);
        projects.delete(m[1]);
        return reply(204, null);
      }
      if ((m = path.match(/^\/v2\/projects\/([^/]+)\/open$/)) && req.method === 'POST') {
        if (fail('open')) return;
        return reply(201, { project_id: m[1] });
      }
      if ((m = path.match(/^\/v2\/projects\/([^/]+)\/nodes$/)) && req.method === 'POST') {
        if (fail('create-node')) return;
        // Built-in switches report a console number but console_type "none".
        const type = body.node_type === 'ethernet_switch' ? 'none' : 'telnet';
        return reply(201, makeNode(body.name, type));
      }
      if ((m = path.match(/^\/v2\/projects\/([^/]+)\/templates\/([^/]+)$/)) && req.method === 'POST') {
        if (fail('template')) return;
        // Appliances come up with the template's own name; buildLab renames them.
        return reply(201, makeNode(`FakeAppliance-${nodes.size + 1}`));
      }
      if ((m = path.match(/^\/v2\/projects\/([^/]+)\/nodes\/([^/]+)$/)) && req.method === 'PUT') {
        if (fail('rename')) return;
        const node = { ...nodes.get(m[2]), ...body };
        nodes.set(m[2], node);
        return reply(200, node);
      }
      if (/^\/v2\/projects\/[^/]+\/nodes\/start$/.test(path) && req.method === 'POST') {
        if (fail('start-nodes')) return;
        return reply(204, null);
      }
      if ((m = path.match(/^\/v2\/projects\/([^/]+)\/nodes\/stop$/)) && req.method === 'POST') {
        if (fail('stop-nodes')) return;
        stopped.push(m[1]);
        return reply(204, null);
      }
      if (/^\/v2\/projects\/[^/]+\/links$/.test(path) && req.method === 'POST') {
        if (fail('link')) return;
        return reply(201, { link_id: randomUUID(), nodes: body.nodes });
      }
      reply(404, { message: `fake GNS3: no route for ${req.method} ${path}` });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        projects,
        deleted,
        stopped,
        calls,
        failOn, // mutable: add/delete keys between tests to inject failures
        seedProject: (id, name) => projects.set(id, { name }),
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
