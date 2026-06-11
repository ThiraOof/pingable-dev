const GNS3_BASE = `${process.env.GNS3_HOST || 'http://localhost'}:${process.env.GNS3_PORT || 3080}/v2`;

function authHeader() {
  if (!process.env.GNS3_USER) return {};
  const creds = Buffer.from(`${process.env.GNS3_USER}:${process.env.GNS3_PASS || ''}`).toString('base64');
  return { Authorization: `Basic ${creds}` };
}

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GNS3_BASE}${path}`, opts);
  const text = await res.text();

  if (!res.ok) {
    let msg = res.statusText;
    try { msg = JSON.parse(text)?.message ?? text ?? msg; } catch {}
    throw new Error(`GNS3 ${method} ${path} → HTTP ${res.status}: ${msg}`);
  }

  if (!text) return null;
  return JSON.parse(text);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function createProject(name) {
  // auto_close (GNS3 default: true) closes the project — powering off every
  // node and invalidating console ports — the moment the Web-UI's
  // notification socket disconnects (i.e. the user closes the lab tab).
  // Our sweeper / stop button governs project lifetime instead.
  return request('POST', '/projects', { name, auto_close: false });
}

export async function deleteProject(projectId) {
  return request('DELETE', `/projects/${projectId}`);
}

export async function openProject(projectId) {
  return request('POST', `/projects/${projectId}/open`);
}

// ── Nodes ─────────────────────────────────────────────────────────────────────

export async function createNode(projectId, nodeConfig) {
  return request('POST', `/projects/${projectId}/nodes`, nodeConfig);
}

// Instantiate a node from a registered GNS3 template (appliance / qemu image,
// e.g. VyOS). This is a different endpoint than createNode — templates cannot
// be created through POST /nodes with a template_id.
export async function createNodeFromTemplate(projectId, templateId, { x = 0, y = 0, computeId = 'local' } = {}) {
  return request('POST', `/projects/${projectId}/templates/${templateId}`, { x, y, compute_id: computeId });
}

export async function updateNode(projectId, nodeId, patch) {
  return request('PUT', `/projects/${projectId}/nodes/${nodeId}`, patch);
}

export async function startAllNodes(projectId) {
  return request('POST', `/projects/${projectId}/nodes/start`);
}

export async function stopAllNodes(projectId) {
  return request('POST', `/projects/${projectId}/nodes/stop`);
}

export async function getNodes(projectId) {
  return request('GET', `/projects/${projectId}/nodes`);
}

// ── Links ─────────────────────────────────────────────────────────────────────

export async function createLink(projectId, linkConfig) {
  return request('POST', `/projects/${projectId}/links`, linkConfig);
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function getTemplates() {
  return request('GET', '/templates');
}

export async function getProjects() {
  return request('GET', '/projects');
}

// ── High-level: Build a lab topology from a Course lab definition ──────────────

export async function buildLab(labDefinition, labTitle) {
  const safeTitle = labTitle.replace(/[/\\]/g, '-').replace(/\s+/g, '_');
  const project = await createProject(`pingable_${Date.now()}_${safeTitle}`);
  const projectId = project.project_id;

  // From here on, never leave a half-built project running on the GNS3 server.
  try {
    return await buildLabInProject(projectId, labDefinition);
  } catch (err) {
    try { await deleteProject(projectId); } catch {}
    throw err;
  }
}

async function buildLabInProject(projectId, labDefinition) {
  await openProject(projectId);

  const nameToNode = {};
  const nameToDef = {};

  for (const nodeDef of labDefinition.topology.nodes) {
    nameToDef[nodeDef.name] = nodeDef;

    let node;
    if (nodeDef.templateId) {
      // Appliance / qemu image (e.g. VyOS) — instantiate from its template,
      // then rename it so links and grading can address it by lab name.
      node = await createNodeFromTemplate(projectId, nodeDef.templateId, {
        x: nodeDef.x || 0,
        y: nodeDef.y || 0,
        computeId: nodeDef.computeId || 'local',
      });
      if (node.name !== nodeDef.name) {
        node = await updateNode(projectId, node.node_id, { name: nodeDef.name });
      }
    } else {
      node = await createNode(projectId, {
        name:       nodeDef.name,
        node_type:  nodeDef.nodeType || 'vpcs',
        compute_id: nodeDef.computeId || 'local',
        x:          nodeDef.x || 0,
        y:          nodeDef.y || 0,
      });
    }
    nameToNode[nodeDef.name] = node;
  }

  // Map a lab "port" number to GNS3 (adapter_number, port_number).
  // Template/qemu nodes (VyOS) expose each NIC as a separate adapter with a
  // single port (ethN → adapter N, port 0). Built-in VPCS/ethernet_switch use
  // one adapter with the port number selecting the interface.
  const portMapping = (def, port) =>
    def?.templateId
      ? { adapter_number: port || 0, port_number: 0 }
      : { adapter_number: 0, port_number: port || 0 };

  for (const linkDef of labDefinition.topology.links || []) {
    const n1 = nameToNode[linkDef.node1];
    const n2 = nameToNode[linkDef.node2];
    if (!n1 || !n2) continue;

    await createLink(projectId, {
      nodes: [
        { node_id: n1.node_id, ...portMapping(nameToDef[linkDef.node1], linkDef.port1) },
        { node_id: n2.node_id, ...portMapping(nameToDef[linkDef.node2], linkDef.port2) },
      ],
    });
  }

  await startAllNodes(projectId);

  // GNS3's canonical Web-UI entry is the `bundled` route: it bootstraps a
  // "local server" from the page's own origin (location.hostname:port) and
  // lands on that server's project list. We point it at our origin so every
  // /v2 call flows through our auth proxy (src/middleware/gns3Proxy.js) — GNS3
  // can stay on a private network. The project list is filtered by the proxy
  // to just this user's project. (The web-ui uses path-based routing, so a
  // "#/project/<id>" deep link does nothing here; deep-linking needs a
  // client-generated server uuid we don't have, so we land on the list.)
  // Setting GNS3_PUBLIC_URL opts into direct mode against an exposed GNS3
  // origin (keep CSP frame-src in sync).
  const webUiUrl = process.env.GNS3_PUBLIC_URL
    ? `${process.env.GNS3_PUBLIC_URL.replace(/\/+$/, '')}/static/web-ui/bundled`
    : `/static/web-ui/bundled`;

  // Build name → console info map for grading service.
  // GNS3 returns console_host "0.0.0.0" (listen-all), so fall back to the
  // GNS3 server's own hostname so we can actually connect.
  const gns3Host = new URL(GNS3_BASE).hostname || '127.0.0.1';
  const nodes = {};
  for (const [name, node] of Object.entries(nameToNode)) {
    const rawHost = node.console_host;
    // GNS3 allocates a console port number even for console-less nodes
    // (ethernet_switch reports console: <port> with console_type "none" and
    // nothing listening), so only record consoles we can actually telnet to —
    // the boot probe and grader treat a null consolePort as "no console".
    const hasTelnetConsole = node.console && /telnet/.test(node.console_type || '');
    nodes[name] = {
      consoleHost: (!rawHost || rawHost === '0.0.0.0') ? gns3Host : rawHost,
      consolePort: hasTelnetConsole ? node.console : null,
    };
  }

  return { projectId, webUiUrl, nodes };
}
