import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../scripts/lib/modules.mjs';

const {
  parseTimes, lastTime, parseTextDate, parseWeightLbs, findLinkedBookings,
  findTargetRoomType, escapeHtml, normalizeLabel,
} = loadModules(['time', 'text']);

test('parseTimes returns 24h times in order', () => {
  assert.deepEqual(parseTimes('Landing at 9:00 AM, check-in around 10:30 AM'), ['09:00', '10:30']);
});

test('parseTimes handles bare hours, lowercase and 12 AM/PM', () => {
  assert.deepEqual(parseTimes('10 AM, 4pm, 12 PM, 12:15 AM'), ['10:00', '16:00', '12:00', '00:15']);
});

test('lastTime picks the final time mentioned', () => {
  assert.equal(lastTime('extend from 11:00 AM to 4:00 PM'), '16:00');
  assert.equal(lastTime('no times here'), null);
});

test('parseTextDate reads month and day with the given year', () => {
  assert.equal(parseTextDate('Arriving at NAIA Terminal 3 at 2:30 PM on Nov 1.', 2026), '2026-11-01');
  assert.equal(parseTextDate('dinner on Nov 8th at 8:00 PM', 2026), '2026-11-08');
  assert.equal(parseTextDate('on November 6th', 2026), '2026-11-06');
});

test('parseWeightLbs reads pounds and converts kilograms', () => {
  assert.equal(parseWeightLbs('a 15-pound trained therapy dog'), 15);
  assert.equal(parseWeightLbs('a 10 kg dog'), 22.05);
});

test('findLinkedBookings ignores the request own confirmation number', () => {
  assert.deepEqual(findLinkedBookings('under HTL-11923 and HTL-11924', 'HTL-11923'), ['HTL-11924']);
});

test('findTargetRoomType finds a different known room type', () => {
  assert.equal(
    findTargetRoomType('upgrade to an Ocean View Suite', ['Standard Queen', 'Ocean View Suite', 'Penthouse Suite'], 'Standard Queen'),
    'Ocean View Suite',
  );
});

test('escapeHtml escapes markup characters', () => {
  assert.equal(escapeHtml('<b>"Tom" & \'Jo\'</b>'), '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jo&#39;&lt;/b&gt;');
});

test('normalizeLabel folds case, ampersands and punctuation', () => {
  assert.equal(normalizeLabel('  Laundry & Dry-Cleaning '), 'laundry and dry cleaning');
});
