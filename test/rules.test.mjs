import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModules } from '../scripts/lib/modules.mjs';
import { readSheet } from './helpers/sheets.mjs';

const M = loadModules(['time', 'text', 'reference', 'intake', 'rules']);
const payload = JSON.parse(readFileSync(new URL('../fixtures/guest-request-payload.json', import.meta.url)));
const edgeCases = JSON.parse(readFileSync(new URL('../fixtures/edge-cases.json', import.meta.url)));
const NOW = new Date('2026-10-26T12:00:00Z');

function makeCtx({ policyRows = readSheet('HotelPolicies'), inventoryRows = readSheet('RoomInventory') } = {}) {
  return {
    policies: M.buildPolicies(policyRows),
    inventory: M.buildInventory(inventoryRows),
    catalog: M.buildCatalog(readSheet('RequestCatalog')),
    now: NOW,
  };
}

function decideAll(submissions, ctx = makeCtx()) {
  const classified = M.classifyBatch(submissions.map(M.normalizeSubmission), { ...ctx, log: M.buildLogIndex([]) });
  const routes = [...new Set(classified.map(c => c.route))];
  return routes.flatMap(route => M.decideBatch(route, classified.filter(c => c.route === route), ctx));
}

const submission = id => structuredClone(payload.submissions.find(s => s.request_id === id));
const withBooking = (id, booking, newId = id) => ({ ...submission(id), request_id: newId, booking: { ...submission(id).booking, ...booking } });
const byId = (items, id) => items.find(r => r.request_id === id);
const decided = decideAll(payload.submissions);
const d = id => byId(decided, id);

test('organizer requests get the spec decision codes', () => {
  assert.equal(d('REQ-2026-101').decision_code, 'EARLY_CHECKIN_CONFIRMED');
  assert.equal(d('REQ-2026-101').requested_time, '10:30');
  assert.equal(d('REQ-2026-115').decision_code, 'NO_READY_ROOM');
  assert.equal(d('REQ-2026-102').decision_code, 'UPGRADE_UNAVAILABLE');
  assert.equal(d('REQ-2026-102').target_room_type, 'Ocean View Suite');
  assert.equal(d('REQ-2026-105').decision_code, 'LATE_CHECKOUT_CONFIRMED');
  assert.equal(d('REQ-2026-120').decision_code, 'LATE_CHECKOUT_UNAVAILABLE');
  assert.equal(d('REQ-2026-109').decision_code, 'PET_STAY_CONFIRMED');
  assert.equal(d('REQ-2026-109').pet_weight_lbs, 15);
  assert.equal(d('REQ-2026-111').decision_code, 'LINKED_BOOKING_CHECK');
  assert.equal(d('REQ-2026-108').decision_code, 'PREFERENCE_NOTED');
  assert.equal(d('REQ-2026-104').decision_code, 'SERVICE_ACCEPTED');
  assert.equal(d('REQ-2026-106').status, 'MANUAL_REVIEW');
  assert.equal(d('REQ-2026-106').decision_code, 'SPECIAL_CARE_REVIEW');
});

test('a confirmed early check-in consumes one ready room', () => {
  assert.deepEqual(d('REQ-2026-101').inventory_changes, [
    { inventory_key: '2026-11-02|Deluxe King Suite', field: 'early_ready_rooms', delta: -1 },
  ]);
  assert.deepEqual(d('REQ-2026-102').inventory_changes, []);
});

test('every decision has a reason, a staff action and an allowed status', () => {
  for (const item of decided) {
    assert.ok(['CONFIRMED', 'ALTERNATIVE_OFFERED', 'MANUAL_REVIEW', 'INVALID', 'DUPLICATE'].includes(item.status), item.request_id);
    assert.ok(item.decision_reason.length > 0, item.request_id);
    assert.ok(item.staff_action.length > 0, item.request_id);
  }
});

test('two early check-ins cannot both take the last ready room', () => {
  const out = decideAll([
    withBooking('REQ-2026-101', { confirmation_number: 'HTL-1' }, 'T-1'),
    withBooking('REQ-2026-101', { confirmation_number: 'HTL-2' }, 'T-2'),
  ]);
  assert.equal(byId(out, 'T-1').decision_code, 'EARLY_CHECKIN_CONFIRMED');
  assert.equal(byId(out, 'T-2').decision_code, 'NO_READY_ROOM');
});

test('an available upgrade is held but not confirmed', () => {
  const inventoryRows = readSheet('RoomInventory').map(r =>
    r.room_type === 'Ocean View Suite' ? { ...r, reserved_rooms: '2', blocked_rooms: '0' } : r);
  const [item] = decideAll([submission('REQ-2026-102')], makeCtx({ inventoryRows }));
  assert.equal(item.status, 'ALTERNATIVE_OFFERED');
  assert.equal(item.decision_code, 'UPGRADE_HELD_AWAITING_APPROVAL');
  assert.deepEqual(item.inventory_changes, [
    { inventory_key: '2026-11-03|Ocean View Suite', field: 'active_holds', delta: 1 },
    { inventory_key: '2026-11-04|Ocean View Suite', field: 'active_holds', delta: 1 },
  ]);
});

test('a blanked policy sends the request to review', () => {
  const policyRows = readSheet('HotelPolicies').map(r => r.policy_key === 'earliest_early_checkin' ? { ...r, value: '' } : r);
  const [item] = decideAll([submission('REQ-2026-101')], makeCtx({ policyRows }));
  assert.equal(item.status, 'MANUAL_REVIEW');
  assert.equal(item.decision_code, 'POLICY_NOT_CONFIGURED');
});

test('a missing inventory row sends the request to review', () => {
  const inventoryRows = readSheet('RoomInventory').filter(r => r.inventory_key !== '2026-11-08|Penthouse Suite');
  const [item] = decideAll([submission('REQ-2026-105')], makeCtx({ inventoryRows }));
  assert.equal(item.decision_code, 'INVENTORY_NOT_FOUND');
});

test('pet weight above the limit or missing is not auto-confirmed', () => {
  const [heavy] = decideAll([withBooking('REQ-2026-109', { request_details: 'Bringing a 60-pound dog.' })]);
  assert.equal(heavy.decision_code, 'PET_OVER_LIMIT');
  assert.equal(heavy.status, 'ALTERNATIVE_OFFERED');
  const [unknown] = decideAll([withBooking('REQ-2026-109', { request_details: 'Bringing a small dog.' })]);
  assert.equal(unknown.decision_code, 'PET_WEIGHT_NOT_FOUND');
});

test('an arrival at or after standard check-in needs no early room', () => {
  const [item] = decideAll([withBooking('REQ-2026-101', { request_details: 'We arrive 3:00 PM.' })]);
  assert.equal(item.status, 'CONFIRMED');
  assert.equal(item.decision_code, 'STANDARD_CHECKIN_APPLIES');
  assert.deepEqual(item.inventory_changes, []);
});

test('an early check-in without a time goes to review', () => {
  const [item] = decideAll([withBooking('REQ-2026-101', { request_details: 'Arriving early if possible.' })]);
  assert.equal(item.decision_code, 'TIME_NOT_FOUND');
});

test('invalid, duplicate and unknown routes use the fixed decisions', () => {
  const out = decideAll(edgeCases);
  assert.equal(byId(out, 'EDGE-001').status, 'INVALID');
  assert.equal(byId(out, 'EDGE-001').decision_code, 'INVALID_REQUEST');
  assert.equal(byId(out, 'EDGE-001').decision_reason, 'invalid email');
  assert.equal(byId(out, 'EDGE-006').status, 'DUPLICATE');
  assert.equal(byId(out, 'EDGE-006').decision_reason, 'Same booking and request type as EDGE-005');
  assert.equal(byId(out, 'EDGE-004').decision_code, 'UNRECOGNIZED_REQUEST_TYPE');
  assert.equal(M.FIXED_DECISIONS.other.status, 'MANUAL_REVIEW');
});
