import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../scripts/lib/modules.mjs';
import { readSheet } from './helpers/sheets.mjs';

const {
  buildPolicies, policyTime, policyNumber, policyBool, buildCatalog, buildInventory,
  available, inventoryRoomTypes, buildLogIndex,
} = loadModules(['time', 'text', 'reference']);

test('policies are read as typed values', () => {
  const p = buildPolicies(readSheet('HotelPolicies'));
  assert.equal(policyTime(p, 'standard_checkin_time'), '14:00');
  assert.equal(policyNumber(p, 'upgrade_hold_hours'), 24);
  assert.equal(policyBool(p, 'pets_allowed'), true);
});

test('policy times survive Sheets reformatting a retyped cell', () => {
  assert.equal(policyTime({ t: '14:00:00' }, 't'), '14:00');
  assert.equal(policyTime({ t: '2:00 PM' }, 't'), '14:00');
  assert.equal(policyTime({ t: 0.625 }, 't'), '15:00');
  assert.equal(policyTime({ t: '0.4166666667' }, 't'), '10:00');
});

test('a blank or missing policy reads as null', () => {
  assert.equal(policyTime({ earliest_early_checkin: '' }, 'earliest_early_checkin'), null);
  assert.equal(policyNumber({}, 'upgrade_hold_hours'), null);
  assert.equal(policyBool({ pets_allowed: 'maybe' }, 'pets_allowed'), null);
});

test('catalog is keyed by normalized label', () => {
  const catalog = buildCatalog(readSheet('RequestCatalog'));
  assert.deepEqual(catalog.get('laundryanddrycleaning'), {
    category: 'service_request', base_priority: 'NORMAL', schedule_from_text: false,
  });
  assert.equal(catalog.get('airporttransfer').schedule_from_text, true);
});

test('inventory availability subtracts reserved, blocked and holds', () => {
  const inv = buildInventory(readSheet('RoomInventory'));
  assert.equal(available(inv.get('2026-11-08|Penthouse Suite')), 1);
  assert.equal(available({ total_rooms: '3', reserved_rooms: '5', blocked_rooms: 0, active_holds: 0 }), 0);
  assert.equal(inv.get('2026-11-02|Deluxe King Suite').early_ready_rooms, 1);
});

test('inventoryRoomTypes lists each room type once', () => {
  const inv = buildInventory(readSheet('RoomInventory'));
  assert.deepEqual(inventoryRoomTypes(inv).sort(), ['Deluxe King Suite', 'Ocean View Suite', 'Penthouse Suite', 'Standard Queen']);
});

test('log index ignores the empty item Sheets emits for an empty tab', () => {
  assert.equal(buildLogIndex([{}]).rows.length, 0);
  const log = buildLogIndex([{ request_id: 'REQ-1', status: 'CONFIRMED' }]);
  assert.equal(log.byRequestId.get('REQ-1').status, 'CONFIRMED');
});
