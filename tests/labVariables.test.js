process.env.LOG_LEVEL = 'silent';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollVariables, interpolate, interpolateExpect, interpolateSetup, sampleVars,
} from '../src/services/labVariables.js';

test('rollVariables: pick / int / ipv4Net produce in-range string values', () => {
  const vars = rollVariables([
    { name: 'NET', kind: 'pick', choices: ['10.0.0', '172.16.0'] },
    { name: 'VID', kind: 'int', min: 10, max: 12 },
    { name: 'WAN', kind: 'ipv4Net', choices: ['203.0.113'] },
  ]);
  assert.ok(['10.0.0', '172.16.0'].includes(vars.NET));
  assert.ok(['10', '11', '12'].includes(vars.VID));
  assert.equal(vars.WAN, '203.0.113');
  assert.equal(typeof vars.VID, 'string'); // ค่าทุกตัวเป็น string เพื่อ interpolate ตรง ๆ
});

test('rollVariables tolerates empty/missing declarations', () => {
  assert.deepEqual(rollVariables(), {});
  assert.deepEqual(rollVariables([{ kind: 'pick' }]), {}); // ไม่มี name → ข้าม
});

test('interpolate replaces known tokens, keeps unknown ones literal', () => {
  assert.equal(interpolate('ตั้ง {{NET}}.1/24', { NET: '10.40.12' }), 'ตั้ง 10.40.12.1/24');
  assert.equal(interpolate('{{A}}-{{B}}', { A: 'x' }), 'x-{{B}}'); // B ไม่รู้จัก → คงไว้
  assert.equal(interpolate(undefined, {}), undefined);
});

test('interpolateExpect regex-escapes substituted values (dots are literal)', () => {
  const out = interpolateExpect('bytes from {{NET}}\\.2', { NET: '10.40.12' });
  assert.equal(out, 'bytes from 10\\.40\\.12\\.2');
  // ค่าจริงที่ตรงเท่านั้นจึง match — จุดไม่ทำหน้าที่ wildcard
  assert.ok(new RegExp(out, 'i').test('64 bytes from 10.40.12.2: icmp_seq=1'));
  assert.ok(!new RegExp(out, 'i').test('bytes from 10X40X12X2'));
});

test('interpolateSetup deep-interpolates command strings per group', () => {
  const out = interpolateSetup(
    [{ node: 'R1', commands: ['set address {{NET}}.1/24', 'commit'] }],
    { NET: '172.20.5' },
  );
  assert.deepEqual(out, [{ node: 'R1', commands: ['set address 172.20.5.1/24', 'commit'] }]);
});

test('sampleVars gives deterministic placeholder values for the validator', () => {
  const s = sampleVars([
    { name: 'NET', kind: 'pick', choices: ['10.0.0', '172.16.0'] },
    { name: 'VID', kind: 'int', min: 7, max: 99 },
  ]);
  assert.equal(s.NET, '10.0.0'); // ตัวแรกของ choices
  assert.equal(s.VID, '7');      // min
  // expect ที่ผ่าน sample ต้อง compile เป็น regex ได้
  assert.doesNotThrow(() => new RegExp(interpolateExpect('vlan {{VID}} on {{NET}}\\.1', s), 'i'));
});
