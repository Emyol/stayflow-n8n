import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runPipeline } from './helpers/pipeline.mjs';
import { readSheet } from './helpers/sheets.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const payload = read('../fixtures/guest-request-payload.json');
const expected = read('../fixtures/expected-decisions.json');
const edgeCases = read('../fixtures/edge-cases.json');
const NOW = new Date('2026-10-26T12:00:00Z');
const sheets = {
  catalog: readSheet('RequestCatalog'),
  policies: readSheet('HotelPolicies'),
  inventory: readSheet('RoomInventory'),
  log: [],
};
const byId = (items, id) => items.find(r => r.request_id === id);
const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj[k]]));
const countBy = (items, key) => items.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] || 0) + 1 }), {});
const first = runPipeline({ submissions: payload.submissions, sheets, now: NOW });

test('each organizer request matches the spec outcome table', () => {
  for (const exp of expected) {
    assert.deepEqual(pick(byId(first.planned, exp.request_id), Object.keys(exp)), exp, exp.request_id);
  }
});

test('the batch splits 13 confirmed, 3 alternative, 4 review', () => {
  assert.deepEqual(countBy(first.planned, 'status'), { CONFIRMED: 13, ALTERNATIVE_OFFERED: 3, MANUAL_REVIEW: 4 });
});

test('the confirmed early check-in and late check-out change inventory', () => {
  assert.deepEqual(first.inventoryWrites, [
    { inventory_key: '2026-11-02|Deluxe King Suite', early_ready_rooms: 0 },
    { inventory_key: '2026-11-08|Penthouse Suite', active_holds: 1 },
  ]);
});

test('a second run with the first run logged does nothing', () => {
  const second = runPipeline({ submissions: payload.submissions, sheets: { ...sheets, log: first.planned }, now: NOW });
  assert.equal(second.planned.length, 0);
  assert.equal(second.alreadyProcessed.length, 20);
  assert.deepEqual(second.inventoryWrites, []);
});

test('edge-case submissions all get an allowed status', () => {
  const result = runPipeline({ submissions: edgeCases, sheets, now: NOW });
  assert.equal(result.planned.length, edgeCases.length);
  for (const item of result.planned) {
    assert.ok(['CONFIRMED', 'ALTERNATIVE_OFFERED', 'MANUAL_REVIEW', 'INVALID', 'DUPLICATE'].includes(item.status), item.request_id);
  }
});
