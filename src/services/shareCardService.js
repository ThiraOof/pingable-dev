// §13 Share Card — renders a "brag card" for a shared LabAttempt as either an
// SVG (crisp, tiny, great for direct viewing / Twitter) or a PNG (LINE & Facebook
// don't rasterize SVG og:image, so the social preview points at the PNG variant).
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '../assets/fonts');

// Alpine production images carry no Thai system fonts, so we bundle the brand
// face (IBM Plex Sans Thai — same as the web UI) and feed it to resvg directly.
// Loaded once into memory; loadSystemFonts:false keeps rendering deterministic.
const fontBuffers = ['Regular', 'SemiBold', 'Bold'].map((w) =>
  readFileSync(join(fontsDir, `IBMPlexSansThai-${w}.ttf`)),
);

// Escape text for safe inclusion in SVG/XML text nodes.
function escapeXml(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  ));
}

// Trim a string to a max length, adding an ellipsis (SVG can't auto-wrap text).
function clip(s, max) {
  const str = String(s ?? '');
  return str.length > max ? str.slice(0, max - 1).trimEnd() + '…' : str;
}

// Build a 1200×630 brag-card SVG for an attempt — pass/fail badge, big score,
// progress ring, lab/course title — so a shared link previews as an image.
export function buildShareCard(attempt, course, labTitle) {
  const pass = !!attempt.passed;
  const accent = pass ? '#22c55e' : '#f43f5e';
  const accentDim = pass ? '#16a34a' : '#be123c';
  const verdict = pass ? 'ผ่านแล้ว!' : 'ยังไม่ผ่าน';
  const pct = Math.round(attempt.pct ?? 0);
  const courseTitle = clip(course?.title || '', 46);
  const lab = clip(labTitle || '', 42);
  const ring = 2 * Math.PI * 155;
  const offset = ring * (1 - Math.min(Math.max(pct, 0), 100) / 100);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(verdict)} ${pct}%">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#080d17"/>
      <stop offset="1" stop-color="#111a2b"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="${accentDim}"/>
    </linearGradient>
    <style>text{font-family:'IBM Plex Sans Thai','Segoe UI',system-ui,sans-serif;}</style>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="10" fill="url(#ring)"/>

  <g transform="translate(80,90)">
    <circle cx="13" cy="13" r="6" fill="${accent}"/>
    <text x="32" y="20" font-size="30" font-weight="700" fill="#e9eef7" letter-spacing="3">PINGABLE</text>
  </g>

  <g transform="translate(80,230)">
    <rect x="0" y="-44" width="${pass ? 200 : 220}" height="60" rx="30" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-opacity="0.5"/>
    <text x="${pass ? 100 : 110}" y="-4" font-size="32" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(verdict)}</text>
  </g>

  <text x="80" y="430" font-size="220" font-weight="800" fill="#e9eef7">${pct}<tspan font-size="120" fill="${accent}">%</tspan></text>
  <text x="80" y="495" font-size="34" fill="#94a3b8">${escapeXml(attempt.score ?? 0)} จาก ${escapeXml(attempt.total ?? 0)} คะแนน</text>

  ${lab ? `<text x="80" y="560" font-size="38" font-weight="600" fill="#e9eef7">${escapeXml(lab)}</text>` : ''}
  ${courseTitle ? `<text x="80" y="${lab ? 600 : 560}" font-size="28" fill="#5b6b85">${escapeXml(courseTitle)}</text>` : ''}

  <g transform="translate(940,315)">
    <circle r="155" fill="none" stroke="#20304a" stroke-width="22"/>
    <circle r="155" fill="none" stroke="url(#ring)" stroke-width="22" stroke-linecap="round"
      stroke-dasharray="${ring.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
      transform="rotate(-90)"/>
  </g>
</svg>`;
}

// Rasterize a card SVG to a PNG Buffer at native 1200×630 using the bundled font.
export function renderCardPng(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'IBM Plex Sans Thai' },
  });
  return resvg.render().asPng();
}
