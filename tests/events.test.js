process.env.LOG_LEVEL = 'silent';
delete process.env.DUELS_ENABLED;     // each test sets the flags it needs
delete process.env.TIME_ATTACK_ENABLED;

// Events hub registry (src/config/events.js): pure flag logic — enabled() is
// read live (so toggling env after import takes effect), only events with a
// real href count as "active" for the nav link, and the stub event stays
// closed regardless of its flag because it has no href yet.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { eventList, anyEventActive } from '../src/config/events.js';

beforeEach(() => {
  delete process.env.DUELS_ENABLED;
  delete process.env.TIME_ATTACK_ENABLED;
});

test('all events report closed when no flags are set', () => {
  assert.equal(anyEventActive(), false);
  assert.ok(eventList().every((e) => !e.open));
});

test('enabling DUELS_ENABLED opens the duel event and lights the nav', () => {
  process.env.DUELS_ENABLED = '1';
  const duel = eventList().find((e) => e.key === 'duel');
  assert.equal(duel.enabled, true);
  assert.equal(duel.open, true);
  assert.equal(anyEventActive(), true);
});

test('enabled() is read live — re-import not needed to pick up a flag flip', () => {
  assert.equal(anyEventActive(), false);
  process.env.DUELS_ENABLED = 'true';
  assert.equal(anyEventActive(), true);
});

test('the time-attack stub stays closed even when its flag is on (no href yet)', () => {
  process.env.TIME_ATTACK_ENABLED = '1';
  const ta = eventList().find((e) => e.key === 'time-attack');
  assert.equal(ta.enabled, true);
  assert.equal(ta.open, false);       // href is null → not enterable
  assert.equal(anyEventActive(), false); // and so it never lights the nav
});
