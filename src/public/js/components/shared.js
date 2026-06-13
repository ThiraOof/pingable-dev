/* ════════════════════════════════════════════════════════════════════
   Pingable — shared pure helpers (no DOM / browser APIs)
   Safe to import from BOTH the Node server (DSD renderer) and the browser
   (client components). Keep this file free of HTMLElement / window / fetch.
   ════════════════════════════════════════════════════════════════════ */

/* ── Icon set (Lucide-derived, stroke 1.75, currentColor) ───────────── */
export const ICONS = {
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
  'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 1 1 1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  flask: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  stop: '<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  logout: '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  sparkles: '<path d="M9.94 14.32a1 1 0 0 0-.94-.66 1 1 0 0 0-.94.66l-.84 2.32-2.32.84a1 1 0 0 0 0 1.88l2.32.84.84 2.32a1 1 0 0 0 1.88 0l.84-2.32 2.32-.84a1 1 0 0 0 0-1.88l-2.32-.84z"/><path d="M18 5 16.5 8.5 13 10l3.5 1.5L18 15l1.5-3.5L23 10l-3.5-1.5z"/>',
  award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
};
export function svgIcon(name, size = 24, cls = '') {
  const p = ICONS[name] || '';
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
}

export const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── Echo — the Pingable mascot ───────────────────────────────────
   A sentinel-chibi mechanoid guardian: ancient armored helmet, glowing
   plasma energy core (the brand's "ping pulse"), no weapons. Themed via
   CSS classes (see .echo* in styles.css) so reaction states recolour the
   eyes + core. States: idle | happy | thinking | sad | celebrating.
   Pure string builder — safe on both the Node renderer and the browser. */
export const MASCOT_STATES = ['idle', 'happy', 'thinking', 'sad', 'celebrating'];

function echoEyes(state) {
  switch (state) {
    case 'happy':
    case 'celebrating': {
      const arcs = '<path class="echo-eye-arc" d="M22.5 28 Q26.5 23 30.5 28"/><path class="echo-eye-arc" d="M33.5 28 Q37.5 23 41.5 28"/>';
      const sparks = state === 'celebrating'
        ? '<path class="echo-spark" d="M15 18 l1.1 2.5 2.5 1.1 -2.5 1.1 -1.1 2.5 -1.1 -2.5 -2.5 -1.1 2.5 -1.1z"/><path class="echo-spark" d="M48 15 l.9 2.1 2.1 .9 -2.1 .9 -.9 2.1 -.9 -2.1 -2.1 -.9 2.1 -.9z"/>'
        : '';
      return arcs + sparks;
    }
    case 'sad':
      return '<path class="echo-eye-arc" d="M22.5 26 Q26.5 31 30.5 26"/><path class="echo-eye-arc" d="M33.5 26 Q37.5 31 41.5 26"/>';
    case 'thinking':
      return '<rect class="echo-eye" x="24.5" y="24" width="4" height="6" rx="2"/><rect class="echo-eye" x="34" y="26" width="6" height="2.4" rx="1.2"/>';
    default: // idle — calm sentinel slits
      return '<rect class="echo-eye" x="24.5" y="24" width="4" height="6" rx="2"/><rect class="echo-eye" x="35.5" y="24" width="4" height="6" rx="2"/>';
  }
}

/* Career tiers — Echo earns rank gear as the learner levels up (1–6, mirrors
   LEVELS in config/xp.js). Each tier owns an energy colour (--echo-accent in
   styles.css) and a signature silhouette. The label is what unlocks AT that
   tier — used for the dashboard "next rank" teaser. */
export const TIER_GEAR = [
  'ชุดมือใหม่ + หูฟัง support',         // 1 Helpdesk
  'จอสถานะ NOC + เสาอากาศ comms',       // 2 Junior NOC
  'เครื่องหมายยศ + ขอบ visor เรืองแสง', // 3 NOC Engineer
  'เกราะไหล่หนัก + การ์ดแก้ม',          // 4 Network Engineer
  'เคปผู้บังคับบัญชา + มงกุฎ',          // 5 Senior Network Engineer
  'ปีกทอง + รัศมี + ชุบทองทั้งตัว',     // 6 Network Architect
];

/* Rank gear for tier 1–6. Returns SVG split into `behind` (cape/wings, drawn
   under the body) and `front` (everything layered over it). Pieces are CSS-
   classed (.echo-g*) so styles.css themes them per data-tier; gear is purely
   additive, so the silhouette grows with seniority. */
function echoGear(t) {
  let behind = '';
  let front = '';

  // commander cape (5+) and architect wings (6) sit behind the body
  if (t >= 5) behind += '<path class="echo-cape" d="M15 39 Q4 58 10 75 L54 75 Q60 58 49 39 Q32 51 15 39 Z"/>';
  if (t >= 6) behind += '<g class="echo-gold-f"><path d="M17 37 L-9 28 L-1 37 L-10 44 L0 45 L-5 52 L7 50 L17 50 Z"/><path d="M47 37 L73 28 L65 37 L74 44 L64 45 L69 52 L57 50 L47 50 Z"/></g>';

  // energy halo rings around the core — more rings = higher rank
  const rings = Math.min(t - 1, 4);
  let rg = '';
  for (let i = 0; i < rings; i++) rg += `<circle cx="32" cy="47" r="${8 + i * 2}" opacity="${(0.5 - i * 0.08).toFixed(2)}"/>`;
  if (rg) front += `<g class="echo-genergy" stroke-width="1.2">${rg}</g>`;

  // Lv1 rookie kit — support headset + clip-on ID badge (dropped from Lv2)
  if (t === 1) {
    front += '<path class="echo-gstrut" stroke-width="2.4" d="M12 22 Q32 5 52 22"/>'
      + '<rect class="echo-gplate" x="9" y="20.5" width="6" height="10" rx="3"/><rect class="echo-gplate" x="49" y="20.5" width="6" height="10" rx="3"/>'
      + '<path class="echo-gstrut" stroke-width="1.8" d="M12 30.5 Q11 40 22 39"/><circle class="echo-genergy-f" cx="22" cy="39" r="2"/>'
      + '<rect class="echo-gbadge" x="20" y="49" width="9" height="6" rx="1.2"/><rect class="echo-gbadge-l" x="21.5" y="50.5" width="6" height="1.4"/><rect class="echo-gbadge-l" x="21.5" y="53" width="4" height="1.2"/>';
  }

  // Lv2+ NOC status LED row under the visor; Lv2 also gets a comms whip antenna
  if (t >= 2) front += '<g class="echo-genergy-f"><circle cx="25" cy="35.5" r="1.1"/><circle cx="29" cy="35.5" r="1.1"/><circle cx="33" cy="35.5" r="1.1"/><circle cx="37" cy="35.5" r="1.1"/></g>';
  if (t === 2) front += '<path class="echo-genergy" stroke-width="1.4" d="M46 14 Q52 8 50 2"/><circle class="echo-genergy-f" cx="50" cy="2" r="1.6"/>';

  // shoulder caps (2–3) thicken into heavy pauldrons (4+)
  if (t >= 2 && t < 4) front += '<path class="echo-gplate" d="M11 41 Q17.5 34 24 41 Z"/><path class="echo-gplate" d="M40 41 Q46.5 34 53 41 Z"/>';
  if (t >= 4) front += '<path class="echo-gplate-d" d="M7 44 Q7 31 18 31 Q25 31 25 41 Q16 36 7 44 Z"/><path class="echo-gplate-d" d="M57 44 Q57 31 46 31 Q39 31 39 41 Q48 36 57 44 Z"/>';

  // Lv3+ rank insignia — antenna scope, shoulder chevrons (1→3), glowing brow
  if (t >= 3) {
    front += '<circle class="echo-genergy" stroke-width="1.2" cx="32" cy="7.5" r="3.4" opacity=".85"/>';
    const n = Math.min(t - 2, 3);
    const sx = t >= 4 ? 12 : 14;
    let chev = '';
    for (let i = 0; i < n; i++) chev += `<path d="M${sx} ${39 + i * 3} l4 2.4 4 -2.4"/>`;
    front += `<g class="echo-genergy" stroke-width="1.6">${chev}</g>`;
    front += '<rect class="echo-genergy-f" x="17.5" y="19.5" width="29" height="2.2" rx="1.1" opacity=".75"/>';
  }

  // Lv4+ armoured-engineer face & body — cheek guards + intake vents
  if (t >= 4) {
    front += '<path class="echo-gplate" d="M15.5 23 L13.5 34 L18.5 33 L19 24 Z"/><path class="echo-gplate" d="M48.5 23 L50.5 34 L45.5 33 L45 24 Z"/>'
      + '<g class="echo-genergy" stroke-width="1.1" opacity=".8"><path d="M23 45 h3.5 M23 48 h3.5 M23 51 h3.5"/><path d="M37.5 45 h3.5 M37.5 48 h3.5 M37.5 51 h3.5"/></g>';
  }

  // Lv5 commander crest (dark); Lv6 architect gets the tall gold crown + halo
  if (t === 5) front += '<path class="echo-gplate" d="M23 14 L27 5 L32 11 L37 5 L41 14 Z"/><circle class="echo-genergy-f" cx="32" cy="6" r="1.8"/>';
  if (t >= 6) front += '<path class="echo-gold-f" d="M22 14 L25 4 L30 10 L32 2 L34 10 L39 4 L42 14 Z"/><ellipse class="echo-gold-s" cx="32" cy="45" rx="15" ry="5" opacity=".9"/>';

  return { behind, front };
}

/** Full Echo character (head + chest core). `tier` (1–6) layers career rank
    gear and an energy colour; omit it (null) for the plain brand mascot. */
export function mascot(state = 'idle', size = 96, cls = '', tier = null) {
  const s = MASCOT_STATES.includes(state) ? state : 'idle';
  const t = tier >= 1 && tier <= 6 ? Math.floor(tier) : null;
  const g = t ? echoGear(t) : { behind: '', front: '' };
  const vb = t ? '-14 -10 92 92' : '0 0 64 64'; // expand frame to fit cape/wings
  return `<svg class="echo echo-full ${cls}" data-state="${s}"${t ? ` data-tier="${t}"` : ''} width="${size}" height="${size}" viewBox="${vb}" fill="none" role="img" aria-hidden="true" focusable="false">`
    + g.behind
    + '<g class="echo-antennae"><polygon class="echo-fin" points="22,15 25,4 27.5,15"/><polygon class="echo-fin" points="42,15 39,4 36.5,15"/><circle class="echo-sensor" cx="32" cy="7.5" r="2"/></g>'
    + '<g class="echo-body"><ellipse class="echo-armor-lt" cx="17.5" cy="42" rx="6" ry="5.2"/><ellipse class="echo-armor-lt" cx="46.5" cy="42" rx="6" ry="5.2"/><rect class="echo-armor" x="21" y="37" width="22" height="20" rx="8"/></g>'
    + '<g class="echo-core-grp"><circle class="echo-core-ring" cx="32" cy="47" r="8"/><circle class="echo-core-ring ring-2" cx="32" cy="47" r="8"/><circle class="echo-core" cx="32" cy="47" r="5"/><circle class="echo-core-hot" cx="32" cy="47" r="2.1"/></g>'
    + '<g class="echo-head"><rect class="echo-armor" x="15" y="13" width="34" height="27" rx="12"/><rect class="echo-armor-lt" x="18" y="15" width="28" height="6" rx="3"/><rect class="echo-visor" x="18" y="21.5" width="28" height="12" rx="6"/></g>'
    + `<g class="echo-face">${echoEyes(s)}</g>`
    + g.front
    + '</svg>';
}

/** Compact emblem (helmet + visor + core gem). Use for navbar/footer/favicon — reads at ~24px. */
export function mascotMark(size = 26, cls = '') {
  return `<svg class="echo echo-mark ${cls}" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" role="img" aria-hidden="true" focusable="false">`
    + '<polygon class="echo-fin" points="10,8 12,2 14,8.5"/><polygon class="echo-fin" points="22,8 20,2 18,8.5"/>'
    + '<rect class="echo-armor" x="5" y="5" width="22" height="17" rx="8"/>'
    + '<rect class="echo-visor" x="8" y="9" width="16" height="7.5" rx="3.75"/>'
    + '<rect class="echo-eye" x="11" y="10.6" width="2.4" height="4.6" rx="1.2"/><rect class="echo-eye" x="18.6" y="10.6" width="2.4" height="4.6" rx="1.2"/>'
    + '<circle class="echo-core-ring" cx="16" cy="26" r="4.2"/><circle class="echo-core" cx="16" cy="26" r="2.8"/><circle class="echo-core-hot" cx="16" cy="26" r="1.1"/>'
    + '</svg>';
}

export const TYPE_ICON = { reading: 'book-open', lab: 'flask', quiz: 'help' };
export const TYPE_LABEL = { reading: 'บทเรียน', lab: 'แล็บ', quiz: 'แบบทดสอบ' };
