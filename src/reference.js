// Reference data from the Google Sheet tabs. Sheets may hand values over as
// strings or numbers, so everything is coerced here and nowhere else.

function buildPolicies(rows) {
  var policies = {};
  rows.forEach(function (row) {
    var key = String(row.policy_key == null ? '' : row.policy_key).trim();
    if (key) policies[key] = String(row.value == null ? '' : row.value).trim();
  });
  return policies;
}

function policyTime(policies, key) {
  var minutes = toMinutes(policies[key]);
  return minutes === null ? null : fromMinutes(minutes);
}

function policyNumber(policies, key) {
  var raw = policies[key];
  if (raw == null || String(raw).trim() === '') return null;
  var value = Number(String(raw).replace(/,/g, ''));
  return isFinite(value) ? value : null;
}

function policyBool(policies, key) {
  var raw = String(policies[key] == null ? '' : policies[key]).trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function buildCatalog(rows) {
  var catalog = new Map();
  rows.forEach(function (row) {
    var label = normalizeLabel(row.request_type_label);
    if (!label) return;
    catalog.set(label, {
      category: String(row.category || '').trim(),
      base_priority: String(row.base_priority || 'NORMAL').trim().toUpperCase() || 'NORMAL',
      schedule_from_text: String(row.schedule_from_text).trim().toLowerCase() === 'true',
    });
  });
  return catalog;
}

function buildInventory(rows) {
  var inventory = new Map();
  rows.forEach(function (row) {
    var date = String(row.date || '').trim();
    var roomType = String(row.room_type || '').trim();
    var key = String(row.inventory_key || '').trim() || (date && roomType ? date + '|' + roomType : '');
    if (!key) return;
    inventory.set(key, {
      date: date,
      room_type: roomType,
      total_rooms: Number(row.total_rooms) || 0,
      reserved_rooms: Number(row.reserved_rooms) || 0,
      blocked_rooms: Number(row.blocked_rooms) || 0,
      active_holds: Number(row.active_holds) || 0,
      early_ready_rooms: Number(row.early_ready_rooms) || 0,
    });
  });
  return inventory;
}

function available(row) {
  return Math.max(0, Number(row.total_rooms) - Number(row.reserved_rooms) -
    Number(row.blocked_rooms) - Number(row.active_holds));
}

function inventoryRoomTypes(inventory) {
  var types = [];
  inventory.forEach(function (row) {
    if (row.room_type && types.indexOf(row.room_type) === -1) types.push(row.room_type);
  });
  return types;
}

function buildLogIndex(rows) {
  var kept = rows.filter(function (row) { return row && String(row.request_id || '').trim(); });
  var byRequestId = new Map();
  kept.forEach(function (row) { byRequestId.set(String(row.request_id).trim(), row); });
  return { byRequestId: byRequestId, rows: kept };
}
