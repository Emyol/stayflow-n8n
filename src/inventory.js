// Folds per-request inventory deltas into absolute RoomInventory updates.
// Each write carries only the field that changed, so an early check-in and
// an upgrade hold on the same row never overwrite each other.

function collectInventoryChanges(items, inventory) {
  var totals = new Map();
  items.forEach(function (item) {
    (item.inventory_changes || []).forEach(function (change) {
      var id = change.inventory_key + '|' + change.field;
      var entry = totals.get(id) || { inventory_key: change.inventory_key, field: change.field, delta: 0 };
      entry.delta += change.delta;
      totals.set(id, entry);
    });
  });
  var writes = [];
  totals.forEach(function (entry) {
    var row = inventory.get(entry.inventory_key);
    if (!row) return;
    var write = { inventory_key: entry.inventory_key };
    write[entry.field] = row[entry.field] + entry.delta;
    writes.push(write);
  });
  return writes;
}
