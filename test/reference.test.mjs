import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../scripts/lib/modules.mjs';
import { readSheet } from './helpers/sheets.mjs';

const {
  buildPolicies, policyTime, policyNumber, policyBool, buildCatalog, buildInventory,
  available, inventoryRoomTypes, buildLogIndex, policyOffset, blankInventoryFields, emptyReferenceTabs,
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

test('a malformed timezone offset falls back to Manila time', () => {
  assert.equal(policyOffset({ hotel_timezone_offset: '+08:00' }), '+08:00');
  assert.equal(policyOffset({ hotel_timezone_offset: '-05:30' }), '-05:30');
  assert.equal(policyOffset({ hotel_timezone_offset: 'GMT+8' }), '+08:00');
  assert.equal(policyOffset({ hotel_timezone_offset: '+8' }), '+08:00');
  assert.equal(policyOffset({}), '+08:00');
});

test('a blank inventory count reads as unknown, not zero', () => {
  const [row] = [...buildInventory([{ date: '2026-11-08', room_type: 'Penthouse Suite', total_rooms: '2', reserved_rooms: '',
    blocked_rooms: '0', active_holds: ' ', early_ready_rooms: 0 }]).values()];
  assert.equal(row.total_rooms, 2);
  assert.equal(row.reserved_rooms, null);
  assert.equal(row.early_ready_rooms, 0);
  assert.deepEqual(blankInventoryFields(row, ['total_rooms', 'reserved_rooms', 'blocked_rooms', 'active_holds']),
    ['reserved_rooms', 'active_holds']);
  assert.deepEqual(blankInventoryFields(row, ['early_ready_rooms']), []);
});

test('empty reference tabs are named; the seeded sheets have none', () => {
  const seeded = {
    catalog: buildCatalog(readSheet('RequestCatalog')),
    policies: buildPolicies(readSheet('HotelPolicies')),
    inventory: buildInventory(readSheet('RoomInventory')),
  };
  assert.deepEqual(emptyReferenceTabs(seeded), []);
  // Sheets hands an empty tab over as a single {} item
  const empty = { catalog: buildCatalog([{}]), policies: buildPolicies([{}]), inventory: buildInventory([{}]) };
  assert.deepEqual(emptyReferenceTabs(empty), ['RequestCatalog', 'HotelPolicies', 'RoomInventory']);
});
