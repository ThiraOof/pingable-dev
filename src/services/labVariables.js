// Mystery labs (§7) — randomize a lab's targets per attempt so answers can't
// be copied between learners and the lab stays fresh on replay.
//
// A lab declares `variables: [{ name, kind, ... }]`; startSession rolls a value
// per variable and stores them on `LabSession.vars`. Templates everywhere use
// `{{NAME}}` tokens:
//   - objectives / hints / scenario / setupCommands → interpolated RAW (the
//     literal value is what the learner types)
//   - gradingChecks.expect → interpolated REGEX-SAFE (the value is escaped, so
//     a dot in an IP can't act as a regex wildcard)
//
// Kinds:
//   pick    → choices: [..]          one of a fixed set (also fine for AS/VLAN)
//   int     → min, max               random integer in [min, max]
//   ipv4Net → choices: ['10.20', ..] one of the given /16 prefixes (value is
//             the two-octet prefix, e.g. '10.20'); templates build the rest:
//             '{{LAN}}.0.0/24', '{{LAN}}.0.1'

const TOKEN_RE = /\{\{(\w+)\}\}/g;
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Roll one concrete value per declared variable. Returns a plain {name: value} map. */
export function rollVariables(variables = []) {
  const vars = {};
  for (const v of variables || []) {
    if (!v?.name) continue;
    if (v.kind === 'int') vars[v.name] = String(randInt(Number(v.min) || 0, Number(v.max) || 0));
    else if (v.kind === 'ipv4Net' || v.kind === 'pick') vars[v.name] = String(pick(v.choices || ['']));
  }
  return vars;
}

/** Replace {{NAME}} tokens with their literal values (unknown tokens kept as-is). */
export function interpolate(str, vars = {}) {
  if (typeof str !== 'string') return str;
  return str.replace(TOKEN_RE, (m, k) => (k in vars ? vars[k] : m));
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Like interpolate, but values are regex-escaped — for substituting into `expect`. */
export function interpolateExpect(str, vars = {}) {
  if (typeof str !== 'string') return str;
  return str.replace(TOKEN_RE, (m, k) => (k in vars ? escapeRegex(vars[k]) : m));
}

/** Deep-interpolate the string fields of setupCommands groups. */
export function interpolateSetup(groups = [], vars = {}) {
  return (groups || []).map((g) => ({
    node: g.node,
    commands: (g.commands || []).map((c) => interpolate(c, vars)),
  }));
}

/** True if any variable name is missing from vars (used by validator with sample values). */
export function sampleVars(variables = []) {
  const vars = {};
  for (const v of variables || []) {
    if (!v?.name) continue;
    if (v.kind === 'int') vars[v.name] = String(v.min ?? 0);
    else vars[v.name] = String((v.choices || ['x'])[0]);
  }
  return vars;
}
