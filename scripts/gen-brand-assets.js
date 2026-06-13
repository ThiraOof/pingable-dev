/* ════════════════════════════════════════════════════════════════════
   Generate Pingable brand raster assets from the Echo mascot.
   Outputs (src/public/img/):
     favicon.svg        — self-contained compact mark (themeable browsers)
     favicon-32.png     — classic tab icon
     favicon-180.png    — apple-touch-icon
     og-image.png       — 1200×630 social share card

   Reuses the canonical mascot geometry from the shared component module so
   the brand assets never drift from the in-app mascot. Run once after any
   mascot change:  node scripts/gen-brand-assets.js
   ════════════════════════════════════════════════════════════════════ */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Resvg } from '@resvg/resvg-js';
import { mascot } from '../src/public/js/components/shared.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imgDir = join(root, 'src/public/img');

// Bundle the brand Thai face (same as shareCardService) so the OG card can use
// authentic Thai copy without relying on system fonts.
const fontsDir = join(root, 'src/assets/fonts');
const fontBuffers = ['Regular', 'SemiBold', 'Bold'].map((w) =>
  readFileSync(join(fontsDir, `IBMPlexSansThai-${w}.ttf`)));
const FONT = { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'IBM Plex Sans Thai' };

/* Literal-colour stylesheet mirroring the CSS tokens — standalone assets
   have no access to styles.css. No animations (rasterisers freeze frame 0,
   so core rings get a fixed visible opacity here). */
const ECHO_STYLE = `
.echo-armor{fill:#182539;stroke:#314563;stroke-width:1.2}
.echo-armor-lt{fill:#111a2b;stroke:#314563;stroke-width:1}
.echo-fin{fill:#314563}
.echo-sensor{fill:#22c55e}
.echo-visor{fill:#050a14;stroke:#20304a;stroke-width:1}
.echo-eye{fill:#4ade80}
.echo-eye-arc{fill:none;stroke:#4ade80;stroke-width:2.4;stroke-linecap:round}
.echo-core{fill:#a855f7;stroke:#22c55e;stroke-width:1.4}
.echo-core-hot{fill:#f3e8ff}
.echo-spark{fill:#c084fc}
.echo-core-ring{fill:none;stroke:#22c55e;stroke-width:1.3;opacity:.42}
.echo-core-ring.ring-2{opacity:.2}`;

/* ── Favicon: compact mark on a rounded tile (self-contained, no CSS) ── */
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
<rect width="32" height="32" rx="7" fill="#0c1320"/>
<polygon points="10,8 12,2.5 14,8.5" fill="#314563"/>
<polygon points="22,8 20,2.5 18,8.5" fill="#314563"/>
<rect x="5" y="5" width="22" height="17" rx="8" fill="#182539" stroke="#314563" stroke-width="1.2"/>
<rect x="8" y="9" width="16" height="7.5" rx="3.75" fill="#050a14" stroke="#20304a" stroke-width="1"/>
<rect x="11" y="10.6" width="2.4" height="4.6" rx="1.2" fill="#4ade80"/>
<rect x="18.6" y="10.6" width="2.4" height="4.6" rx="1.2" fill="#4ade80"/>
<circle cx="16" cy="26" r="4.2" fill="none" stroke="#22c55e" stroke-width="1.3" opacity=".5"/>
<circle cx="16" cy="26" r="2.8" fill="#a855f7" stroke="#22c55e" stroke-width="1.2"/>
<circle cx="16" cy="26" r="1.1" fill="#f3e8ff"/>
</svg>`;

/* ── OG card: full character + wordmark on the NOC backdrop ──────────── */
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
<style>${ECHO_STYLE}</style>
<defs>
<pattern id="grid" width="46" height="46" patternUnits="userSpaceOnUse">
<path d="M46 0H0V46" fill="none" stroke="#94a3b8" stroke-width="1" stroke-opacity="0.05"/>
</pattern>
<radialGradient id="glowG" cx="20%" cy="0%" r="80%">
<stop offset="0%" stop-color="#22c55e" stop-opacity="0.16"/><stop offset="60%" stop-color="#22c55e" stop-opacity="0"/>
</radialGradient>
<radialGradient id="glowV" cx="85%" cy="55%" r="70%">
<stop offset="0%" stop-color="#a855f7" stop-opacity="0.2"/><stop offset="60%" stop-color="#a855f7" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="1200" height="630" fill="#080d17"/>
<rect width="1200" height="630" fill="url(#grid)"/>
<rect width="1200" height="630" fill="url(#glowG)"/>
<rect width="1200" height="630" fill="url(#glowV)"/>
<g transform="translate(40,32)"><rect width="210" height="40" rx="20" fill="#22c55e" fill-opacity="0.12" stroke="#22c55e" stroke-opacity="0.4"/>
<circle cx="26" cy="20" r="5" fill="#22c55e"/>
<text x="44" y="27" font-family="IBM Plex Sans Thai" font-size="18" font-weight="700" letter-spacing="1" fill="#4ade80">แล็บเรียลไทม์</text></g>
<text x="70" y="296" font-family="IBM Plex Sans Thai" font-size="116" font-weight="700" letter-spacing="-3" fill="#e9eef7">Pingable</text>
<text x="74" y="366" font-family="IBM Plex Sans Thai" font-size="36" font-weight="600" fill="#94a3b8">เรียน Network ผ่าน Lab จริง</text>
<text x="74" y="420" font-family="IBM Plex Sans Thai" font-size="25" font-weight="500" fill="#5b6b85">อุปกรณ์จริงบน GNS3 · ตรวจคำตอบอัตโนมัติ · ฟรี</text>
<svg x="700" y="70" width="470" height="470" viewBox="0 0 64 64">${mascot('happy', 470).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>
</svg>`;

function renderPng(svg, width, outName, font) {
  const opts = { fitTo: { mode: 'width', value: width } };
  if (font) opts.font = font;
  const r = new Resvg(svg, opts);
  writeFileSync(join(imgDir, outName), r.render().asPng());
  console.log(`  → ${outName} (${width}px wide)`);
}

writeFileSync(join(imgDir, 'favicon.svg'), faviconSvg);
console.log('  → favicon.svg');
renderPng(faviconSvg, 32, 'favicon-32.png');
renderPng(faviconSvg, 180, 'favicon-180.png');
renderPng(ogSvg, 1200, 'og-image.png', FONT);
console.log('brand assets generated.');
