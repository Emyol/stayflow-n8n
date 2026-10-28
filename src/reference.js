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

// Accepts "14:00", "14:00:00", "2:00 PM", or a Sheets time serial (0.625),
// since retyping a time cell in Sheets can turn it into any of these.
function policyTime(policies, key) {
  var raw = String(policies[key] == null ? '' : policies[key]).trim();
  if (!raw) return null;
  if (/^\d*\.\d+$|^0$/.test(raw) && Number(raw) < 1) return fromMinutes(Math.round(Number(raw) * 1440));
  var clock = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (clock) {
    var minutes = toMinutes(clock[1] + ':' + clock[2]);
    return minutes === null ? null : fromMinutes(minutes);
  }
  var spoken = parseTimes(raw);
  return spoken.length === 1 ? spoken[0] : null;
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

// Calendar timestamps need a strict "+HH:MM"; anything else would crash the
// offset arithmetic in time.js, so it falls back to Manila.
function policyOffset(policies) {
  var raw = String(policies.hotel_timezone_offset == null ? '' : policies.hotel_timezone_offset).trim();
  var m = /^[+-](\d{2}):(\d{2})$/.exec(raw);
  return m && Number(m[1]) <= 14 && Number(m[2]) <= 59 ? raw : '+08:00';
}

function buildCatalog(rows) {
  var catalog = new Map();
  rows.forEach(function (row) {
    var label = labelKey(row.request_type_label);
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
      total_rooms: inventoryCount(row.total_rooms),
      reserved_rooms: inventoryCount(row.reserved_rooms),
      blocked_rooms: inventoryCount(row.blocked_rooms),
      active_holds: inventoryCount(row.active_holds),
      early_ready_rooms: inventoryCount(row.early_ready_rooms),
    });
  });
  return inventory;
}

// Anything but a whole number of rooms is unknown (null), never 0: reading it
// as 0 would tell the guest "fully booked" when nobody knows.
function inventoryCount(raw) {
  var text = String(raw == null ? '' : raw).trim();
  if (text === '') return null;
  var value = Number(text);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function blankInventoryFields(row, fields) {
  return fields.filter(function (field) { return row[field] === null; });
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

// GuestRequests is left out: it is empty on every first run.
function emptyReferenceTabs(ref) {
  var empty = [];
  if (!ref.catalog.size) empty.push('RequestCatalog');
  if (!Object.keys(ref.policies).length) empty.push('HotelPolicies');
  if (!ref.inventory.size) empty.push('RoomInventory');
  return empty;
}

function buildLogIndex(rows) {
  var kept = rows.filter(function (row) { return row && String(row.request_id || '').trim(); });
  var byRequestId = new Map();
  kept.forEach(function (row) { byRequestId.set(String(row.request_id).trim(), row); });
  return { byRequestId: byRequestId, rows: kept };
}
