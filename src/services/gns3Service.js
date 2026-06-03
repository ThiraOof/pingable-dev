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
  return request('POST', '/projects', { name });
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

// ── High-level: Build a lab topology from a Course lab definition ──────────────

export async function buildLab(labDefinition, labTitle) {
  const project = await createProject(`pingable_${Date.now()}_${labTitle.replace(/\s+/g, '_')}`);
  const projectId = project.project_id;

  await openProject(projectId);

  const nameToNode = {};

  for (const nodeDef of labDefinition.topology.nodes) {
    const payload = {
      name:        nodeDef.name,
      node_type:   nodeDef.nodeType || 'vpcs',
      compute_id:  nodeDef.computeId || 'local',
      x:           nodeDef.x || 0,
      y:           nodeDef.y || 0,
    };
    if (nodeDef.templateId) payload.template_id = nodeDef.templateId;

    const node = await createNode(projectId, payload);
    nameToNode[nodeDef.name] = node;
  }

  for (const linkDef of labDefinition.topology.links || []) {
    const n1 = nameToNode[linkDef.node1];
    const n2 = nameToNode[linkDef.node2];
    if (!n1 || !n2) continue;

    await createLink(projectId, {
      nodes: [
        { node_id: n1.node_id, adapter_number: 0, port_number: linkDef.port1 || 0 },
        { node_id: n2.node_id, adapter_number: 0, port_number: linkDef.port2 || 0 },
      ],
    });
  }

  await startAllNodes(projectId);

  const base = new URL(GNS3_BASE);
  const webUiUrl = `${base.protocol}//${base.hostname}:${base.port}/#/project/${projectId}`;

  // Build name → console info map for grading service.
  // GNS3 returns console_host "0.0.0.0" (listen-all), so fall back to the
  // GNS3 server's own hostname so we can actually connect.
  const gns3Host = base.hostname || '127.0.0.1';
  const nodes = {};
  for (const [name, node] of Object.entries(nameToNode)) {
    const rawHost = node.console_host;
    nodes[name] = {
      consoleHost: (!rawHost || rawHost === '0.0.0.0') ? gns3Host : rawHost,
      consolePort: node.console,
    };
  }

  return { projectId, webUiUrl, nodes };
}
