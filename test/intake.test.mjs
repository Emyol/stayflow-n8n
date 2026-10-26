import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModules } from '../scripts/lib/modules.mjs';
import { readSheet } from './helpers/sheets.mjs';

const {
  buildPolicies, buildCatalog, buildLogIndex, normalizeSubmission, validateRequest, classifyBatch,
} = loadModules(['time', 'text', 'reference', 'intake']);

const payload = JSON.parse(readFileSync(new URL('../fixtures/guest-request-payload.json', import.meta.url)));
const edgeCases = JSON.parse(readFileSync(new URL('../fixtures/edge-cases.json', import.meta.url)));
const ctx = {
  catalog: buildCatalog(readSheet('RequestCatalog')),
  policies: buildPolicies(readSheet('HotelPolicies')),
  log: buildLogIndex([]),
};
const reqs = payload.submissions.map(normalizeSubmission);
const byId = (items, id) => items.find(r => r.request_id === id);
const countBy = (items, key) => items.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] || 0) + 1 }), {});

test('normalizeSubmission flattens the booking', () => {
  assert.equal(reqs[0].confirmation_number, 'HTL-88219');
  assert.equal(reqs[0].guest_email, 'eleanor.vance@example.com');
  assert.equal(reqs[0].received_at, '2026-10-26T08:00:00Z');
});

test('organizer payload routes to the expected categories', () => {
  assert.deepEqual(countBy(classifyBatch(reqs, ctx), 'route'), {
    early_checkin: 2, room_upgrade: 1, special_care: 3, service_request: 8,
    late_checkout: 2, room_preference: 3, pet_stay: 1,
  });
});

test('priority comes from catalog and high-priority keywords', () => {
  const out = classifyBatch(reqs, ctx);
  assert.equal(byId(out, 'REQ-2026-103').priority, 'HIGH');
  assert.equal(byId(out, 'REQ-2026-106').priority, 'HIGH');
  assert.equal(byId(out, 'REQ-2026-115').priority, 'HIGH');
  assert.equal(byId(out, 'REQ-2026-117').priority, 'NORMAL');
});

test('re-run marks every logged request as already processed', () => {
  const log = buildLogIndex(reqs.map(r => ({ request_id: r.request_id, status: 'CONFIRMED' })));
  assert.ok(classifyBatch(reqs, { ...ctx, log }).every(r => r.route === 'already_processed'));
});

test('validateRequest names each problem', () => {
  const good = reqs[0];
  assert.deepEqual(validateRequest(good), []);
  assert.deepEqual(validateRequest({ ...good, guest_email: 'not-an-email' }), ['invalid email']);
  assert.deepEqual(validateRequest({ ...good, check_out_date: good.check_in_date }), ['check_out_date must be after check_in_date']);
  assert.deepEqual(validateRequest({ ...good, guest_name: '' }), ['missing guest_name']);
});

test('label variants still classify', () => {
  for (const label of ['early check in', 'LATE CHECK-OUT', 'Laundry and Dry Cleaning']) {
    const [out] = classifyBatch([{ ...reqs[0], request_type: label }], ctx);
    assert.notEqual(out.category, 'other', label);
  }
});

test('edge-case batch: invalid, unknown, in-batch duplicate, lowercase label', () => {
  const out = classifyBatch(edgeCases.map(normalizeSubmission), ctx);
  assert.equal(byId(out, 'EDGE-001').route, 'invalid');
  assert.deepEqual(byId(out, 'EDGE-001').validation_errors, ['invalid email']);
  assert.equal(byId(out, 'EDGE-001').email_valid, false);
  assert.equal(byId(out, 'EDGE-002').route, 'invalid');
  assert.equal(byId(out, 'EDGE-003').route, 'invalid');
  assert.equal(byId(out, 'EDGE-004').route, 'other');
  assert.equal(byId(out, 'EDGE-005').route, 'early_checkin');
  assert.equal(byId(out, 'EDGE-006').route, 'duplicate');
  assert.equal(byId(out, 'EDGE-006').duplicate_of, 'EDGE-005');
  assert.equal(byId(out, 'EDGE-007').route, 'early_checkin');
});

test('different request types on one booking are not duplicates', () => {
  const base = reqs.find(r => r.request_id === 'REQ-2026-110');
  const out = classifyBatch([
    { ...base, request_id: 'B-1', request_type: 'Airport Transfer' },
    { ...base, request_id: 'B-2', request_type: 'In-Room Dining Booking' },
    { ...base, request_id: 'B-3', request_type: 'Dietary Preference' },
    { ...base, request_id: 'B-4', request_type: 'Accessibility Request' },
  ], ctx);
  assert.deepEqual(out.map(r => r.route), ['service_request', 'service_request', 'special_care', 'special_care']);
});

test('the same request_id twice in one batch is processed once', () => {
  const out = classifyBatch([reqs[0], { ...reqs[0] }], ctx);
  assert.equal(out[0].route, 'early_checkin');
  assert.equal(out[1].route, 'already_processed');
});

test('labels without spaces still classify', () => {
  for (const label of ['Late Checkout', 'Early Checkin', 'Inroom Dining Booking']) {
    const [out] = classifyBatch([{ ...reqs[0], request_type: label }], ctx);
    assert.notEqual(out.category, 'other', label);
  }
});

test('a logged request for the same booking and request type is a duplicate', () => {
  const log = buildLogIndex([{ request_id: 'REQ-OLD', confirmation_number: 'HTL-88219', request_type: 'Early Check-In', category: 'early_checkin', status: 'CONFIRMED' }]);
  const out = classifyBatch(reqs, { ...ctx, log });
  assert.equal(byId(out, 'REQ-2026-101').route, 'duplicate');
  assert.equal(byId(out, 'REQ-2026-101').duplicate_of, 'REQ-OLD');
});

test('a missing request_id gets a stable fallback id', () => {
  const [out] = classifyBatch([{ ...reqs[0], request_id: '' }], ctx);
  assert.equal(out.route, 'invalid');
  assert.equal(out.request_id, 'NOID-HTL-88219-2026-10-26T08:00:00Z');
});
