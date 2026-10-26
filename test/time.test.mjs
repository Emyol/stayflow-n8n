import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../scripts/lib/modules.mjs';

const { toMinutes, fromMinutes, localIso, addMinutesIso, nowPlusHoursIso, stayNights, isIsoDate } =
  loadModules(['time', 'text']);

test('toMinutes parses HH:MM and rejects garbage', () => {
  assert.equal(toMinutes('10:30'), 630);
  assert.equal(toMinutes('bad'), null);
});

test('fromMinutes pads hours and minutes', () => {
  assert.equal(fromMinutes(570), '09:30');
});

test('localIso builds an offset timestamp', () => {
  assert.equal(localIso('2026-11-02', '09:30'), '2026-11-02T09:30:00+08:00');
});

test('addMinutesIso keeps the offset and rolls over midnight', () => {
  assert.equal(addMinutesIso('2026-11-02T09:30:00+08:00', 60), '2026-11-02T10:30:00+08:00');
  assert.equal(addMinutesIso('2026-11-02T23:30:00+08:00', 60), '2026-11-03T00:30:00+08:00');
});

test('nowPlusHoursIso expresses UTC now in hotel time', () => {
  assert.equal(nowPlusHoursIso(new Date('2026-10-26T12:00:00Z'), 2), '2026-10-26T22:00:00+08:00');
});

test('stayNights lists each night from check-in up to check-out', () => {
  assert.deepEqual(stayNights('2026-11-03', '2026-11-05'), ['2026-11-03', '2026-11-04']);
});

test('isIsoDate rejects impossible dates', () => {
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-11-02'), true);
});
