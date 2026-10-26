import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../scripts/lib/modules.mjs';
import { readSheet } from './helpers/sheets.mjs';

const M = loadModules(['reference', 'inventory']);
const inventory = M.buildInventory(readSheet('RoomInventory'));

test('changes become new absolute values, one field per write', () => {
  const items = [
    { inventory_changes: [{ inventory_key: '2026-11-02|Deluxe King Suite', field: 'early_ready_rooms', delta: -1 }] },
    { inventory_changes: [] },
    { inventory_changes: [
      { inventory_key: '2026-11-03|Ocean View Suite', field: 'active_holds', delta: 1 },
      { inventory_key: '2026-11-03|Ocean View Suite', field: 'active_holds', delta: 1 },
    ] },
  ];
  assert.deepEqual(M.collectInventoryChanges(items, inventory), [
    { inventory_key: '2026-11-02|Deluxe King Suite', early_ready_rooms: 0 },
    { inventory_key: '2026-11-03|Ocean View Suite', active_holds: 2 },
  ]);
});

test('no changes means no writes', () => {
  assert.deepEqual(M.collectInventoryChanges([{ inventory_changes: [] }, {}], inventory), []);
});
