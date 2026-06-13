process.env.LOG_LEVEL = 'silent';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareCard, renderCardPng } from '../src/services/shareCardService.js';

const passAttempt = { passed: true, pct: 87, score: 13, total: 15 };
const course = { title: 'Enterprise Core Networking' };

test('buildShareCard: well-formed SVG with score, verdict and progress ring', () => {
  const svg = buildShareCard(passAttempt, course, 'Lab 3: BGP eBGP Peering');
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  assert.match(svg, /1200/);            // OG dimensions
  assert.match(svg, />87</);            // big score
  assert.match(svg, /ผ่านแล้ว!/);       // pass verdict
  assert.match(svg, /13 จาก 15 คะแนน/); // score line
  assert.match(svg, /#22c55e/);         // green accent for pass
  // ring is filled to the score: dashoffset = circumference * (1 - 0.87)
  const ring = 2 * Math.PI * 155;
  assert.ok(svg.includes(`stroke-dashoffset="${(ring * 0.13).toFixed(1)}"`));
});

test('buildShareCard: fail state uses red accent and the "ยังไม่ผ่าน" verdict', () => {
  const svg = buildShareCard({ passed: false, pct: 40, score: 4, total: 10 }, course, 'Boss');
  assert.match(svg, /ยังไม่ผ่าน/);
  assert.match(svg, /#f43f5e/);
  assert.doesNotMatch(svg, /ผ่านแล้ว/);
});

test('buildShareCard: escapes XML metacharacters in titles (answers/markup safe)', () => {
  const svg = buildShareCard(passAttempt, { title: 'A & B' }, 'fix <STP> "now"');
  assert.match(svg, /&lt;STP&gt;/);
  assert.match(svg, /A &amp; B/);
  assert.doesNotMatch(svg, /<STP>/); // never an unescaped element
});

test('buildShareCard: clips over-long titles with an ellipsis', () => {
  const long = 'ก'.repeat(80);
  const svg = buildShareCard(passAttempt, { title: long }, '');
  assert.match(svg, /…/);
  assert.ok(!svg.includes('ก'.repeat(80)));
});

test('renderCardPng: rasterizes to a real PNG at 1200×630 using the bundled Thai font', () => {
  const png = renderCardPng(buildShareCard(passAttempt, course, 'Lab 3: BGP'));
  assert.ok(Buffer.isBuffer(png));
  assert.equal(png.subarray(0, 4).toString('hex'), '89504e47'); // PNG signature
  // IHDR width/height live at byte offsets 16 and 20 (big-endian uint32)
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
