// Category rules. Each "Rules: …" Code node calls decideBatch for its own
// route, so ledgers only need to span one category's items.
// Depends on time.js, text.js, reference.js.

// The build script turns these into the three "Decision: …" Set nodes.
var FIXED_DECISIONS = {
  invalid: { status: 'INVALID', decision_code: 'INVALID_REQUEST', staff_action: 'Ask guest for corrected details' },
  duplicate: { status: 'DUPLICATE', decision_code: 'DUPLICATE_REQUEST', staff_action: 'None: already handled under original request' },
  other: { status: 'MANUAL_REVIEW', decision_code: 'UNRECOGNIZED_REQUEST_TYPE', staff_action: 'Review request manually' },
};

var REQUIRED_POLICIES = {
  early_checkin: [['early_checkin_enabled', 'bool'], ['standard_checkin_time', 'time'], ['earliest_early_checkin', 'time']],
  late_checkout: [['late_checkout_enabled', 'bool'], ['standard_checkout_time', 'time'], ['latest_late_checkout', 'time']],
  room_upgrade: [['upgrades_enabled', 'bool'], ['upgrade_hold_hours', 'number']],
  service_request: [['services_enabled', 'bool']],
  pet_stay: [['pets_allowed', 'bool'], ['pet_max_weight_lbs', 'number'], ['pet_fee_per_night', 'text']],
};

var AVAILABILITY_FIELDS = ['total_rooms', 'reserved_rooms', 'blocked_rooms', 'active_holds'];

function incompleteInventory(key, row, fields, action, extra) {
  var blank = blankInventoryFields(row, fields);
  if (!blank.length) return null;
  return outcome('MANUAL_REVIEW', 'INVENTORY_INCOMPLETE',
    'Inventory row ' + key + ' has blank ' + blank.join(', '), action, extra);
}

function fixedDecisionReason(route, item) {
  if (route === 'invalid') return item.validation_errors.join('; ');
  if (route === 'duplicate') return 'Same booking and request type as ' + item.duplicate_of;
  // keep in step with DECISION_REASONS.other in scripts/build-workflow.mjs
  if (item.category && item.category !== 'other') return 'Request catalog category "' + item.category + '" has no rules branch';
  return 'Request type "' + item.request_type + '" is not in the request catalog';
}

function outcome(status, code, reason, action, extra) {
  return Object.assign({ status: status, decision_code: code, decision_reason: reason, staff_action: action }, extra || {});
}

function missingPolicy(route, policies) {
  var required = REQUIRED_POLICIES[route] || [];
  for (var i = 0; i < required.length; i++) {
    var key = required[i][0];
    var kind = required[i][1];
    var value = kind === 'bool' ? policyBool(policies, key)
      : kind === 'time' ? policyTime(policies, key)
        : kind === 'number' ? policyNumber(policies, key)
          : (String(policies[key] || '').trim() || null);
    if (value === null) return key;
  }
  return null;
}

function decideEarlyCheckin(item, ctx, state) {
  var p = ctx.policies;
  var standard = policyTime(p, 'standard_checkin_time');
  if (!policyBool(p, 'early_checkin_enabled')) {
    return outcome('ALTERNATIVE_OFFERED', 'EARLY_CHECKIN_DISABLED', 'Early check-in is not currently offered',
      'Offer luggage storage until ' + standard);
  }
  var time = lastTime(item.request_details);
  if (!time) {
    return outcome('MANUAL_REVIEW', 'TIME_NOT_FOUND', 'No arrival time found in the request', 'Contact guest for their arrival time');
  }
  var extra = { requested_time: time };
  var earliest = policyTime(p, 'earliest_early_checkin');
  if (toMinutes(time) >= toMinutes(standard)) {
    return outcome('CONFIRMED', 'STANDARD_CHECKIN_APPLIES',
      'Requested ' + time + ' is at or after standard check-in (' + standard + ')', 'None: standard check-in applies', extra);
  }
  if (toMinutes(time) < toMinutes(earliest)) {
    return outcome('ALTERNATIVE_OFFERED', 'TOO_EARLY',
      'Requested ' + time + ' is before the earliest early check-in (' + earliest + ')',
      'Hold luggage on arrival; room ready at ' + standard, extra);
  }
  var key = item.check_in_date + '|' + item.room_type;
  var row = ctx.inventory.get(key);
  if (!row) {
    return outcome('MANUAL_REVIEW', 'INVENTORY_NOT_FOUND',
      'No inventory row for ' + item.room_type + ' on ' + item.check_in_date, 'Check room readiness manually', extra);
  }
  var incomplete = incompleteInventory(key, row, ['early_ready_rooms'], 'Check room readiness manually', extra);
  if (incomplete) return incomplete;
  var allocated = state.earlyAllocated.get(key) || 0;
  if (row.early_ready_rooms - allocated > 0) {
    state.earlyAllocated.set(key, allocated + 1);
    extra.inventory_changes = [{ inventory_key: key, field: 'early_ready_rooms', delta: -1 }];
    return outcome('CONFIRMED', 'EARLY_CHECKIN_CONFIRMED',
      'A ready ' + item.room_type + ' is reserved for ' + time + ' on ' + item.check_in_date,
      'Prepare a ready ' + item.room_type + ' for ' + time, extra);
  }
  return outcome('ALTERNATIVE_OFFERED', 'NO_READY_ROOM',
    'No ' + item.room_type + ' will be ready early on ' + item.check_in_date,
    'Hold luggage on arrival; room ready at ' + standard, extra);
}

function decideLateCheckout(item, ctx, state) {
  var p = ctx.policies;
  var standard = policyTime(p, 'standard_checkout_time');
  var latest = policyTime(p, 'latest_late_checkout');
  if (!policyBool(p, 'late_checkout_enabled')) {
    return outcome('ALTERNATIVE_OFFERED', 'LATE_CHECKOUT_DISABLED', 'Late check-out is not currently offered',
      'Offer luggage storage after ' + standard + ' check-out');
  }
  var time = lastTime(item.request_details);
  if (!time) {
    return outcome('MANUAL_REVIEW', 'TIME_NOT_FOUND', 'No check-out time found in the request', 'Contact guest for their check-out time');
  }
  var extra = { requested_time: time };
  if (toMinutes(time) <= toMinutes(standard)) {
    return outcome('CONFIRMED', 'STANDARD_CHECKOUT_APPLIES',
      'Requested ' + time + ' is within standard check-out (' + standard + ')', 'None: standard check-out applies', extra);
  }
  var key = item.check_out_date + '|' + item.room_type;
  var row = ctx.inventory.get(key);
  if (!row) {
    return outcome('MANUAL_REVIEW', 'INVENTORY_NOT_FOUND',
      'No inventory row for ' + item.room_type + ' on ' + item.check_out_date, 'Check departure-day occupancy manually', extra);
  }
  var incomplete = incompleteInventory(key, row, AVAILABILITY_FIELDS, 'Check departure-day occupancy manually', extra);
  if (incomplete) return incomplete;
  // a confirmed or offered late check-out keeps a room off the market on the
  // departure day, so it takes a hold like an upgrade and later ones see one fewer
  if (available(row) - (state.holds.get(key) || 0) <= 0) {
    return outcome('ALTERNATIVE_OFFERED', 'LATE_CHECKOUT_UNAVAILABLE',
      item.room_type + ' is fully booked on ' + item.check_out_date,
      'Offer luggage storage after ' + standard + ' check-out', extra);
  }
  state.holds.set(key, (state.holds.get(key) || 0) + 1);
  extra.inventory_changes = [{ inventory_key: key, field: 'active_holds', delta: 1 }];
  if (toMinutes(time) > toMinutes(latest)) {
    extra.offered_time = latest;
    return outcome('ALTERNATIVE_OFFERED', 'LATE_CHECKOUT_TOO_LATE',
      'Requested ' + time + ' is later than the latest late check-out (' + latest + '); room held for the offer',
      'Offer late check-out until ' + latest + ' plus luggage storage; release the hold if declined', extra);
  }
  return outcome('CONFIRMED', 'LATE_CHECKOUT_CONFIRMED',
    'Late check-out until ' + time + ' on ' + item.check_out_date + ' fits ' + item.room_type + ' availability',
    'Tell housekeeping: late check-out until ' + time, extra);
}

function decideRoomUpgrade(item, ctx, state) {
  var p = ctx.policies;
  if (!policyBool(p, 'upgrades_enabled')) {
    return outcome('ALTERNATIVE_OFFERED', 'UPGRADES_DISABLED', 'Room upgrades are not currently offered', 'Keep guest in booked room');
  }
  var target = findTargetRoomType(item.request_details, inventoryRoomTypes(ctx.inventory), item.room_type);
  if (!target) {
    return outcome('MANUAL_REVIEW', 'TARGET_ROOM_NOT_FOUND', 'No known room type named in the request', 'Ask guest which room type they want');
  }
  var extra = { target_room_type: target };
  var keys = stayNights(item.check_in_date, item.check_out_date).map(function (night) { return night + '|' + target; });
  var missing = keys.filter(function (key) { return !ctx.inventory.has(key); });
  if (missing.length) {
    return outcome('MANUAL_REVIEW', 'INVENTORY_NOT_FOUND',
      'No inventory row for ' + missing.join(', '), 'Check ' + target + ' availability manually', extra);
  }
  for (var i = 0; i < keys.length; i++) {
    var incomplete = incompleteInventory(keys[i], ctx.inventory.get(keys[i]), AVAILABILITY_FIELDS,
      'Check ' + target + ' availability manually', extra);
    if (incomplete) return incomplete;
  }
  var full = keys.filter(function (key) {
    return available(ctx.inventory.get(key)) - (state.holds.get(key) || 0) <= 0;
  });
  if (full.length) {
    return outcome('ALTERNATIVE_OFFERED', 'UPGRADE_UNAVAILABLE',
      target + ' has no availability on ' + full[0].split('|')[0],
      'Keep current room; re-check ' + target + ' availability on arrival', extra);
  }
  extra.inventory_changes = keys.map(function (key) {
    state.holds.set(key, (state.holds.get(key) || 0) + 1);
    return { inventory_key: key, field: 'active_holds', delta: 1 };
  });
  return outcome('ALTERNATIVE_OFFERED', 'UPGRADE_HELD_AWAITING_APPROVAL',
    target + ' is held for ' + policyNumber(p, 'upgrade_hold_hours') + ' hours pending guest approval of the rate',
    'Quote the ' + target + ' rate; confirm or release the hold', extra);
}

function decideRoomPreference(item) {
  var linked = findLinkedBookings(item.request_details, item.confirmation_number);
  if (linked.length) {
    return outcome('MANUAL_REVIEW', 'LINKED_BOOKING_CHECK',
      'Request references other booking(s): ' + linked.join(', '), 'Verify linked bookings before assigning rooms');
  }
  return outcome('CONFIRMED', 'PREFERENCE_NOTED',
    'Preference noted for room assignment; not guaranteed until check-in', 'Assign room per preference: ' + item.request_type);
}

function decideServiceRequest(item, ctx) {
  if (!policyBool(ctx.policies, 'services_enabled')) {
    return outcome('MANUAL_REVIEW', 'SERVICES_DISABLED', 'Service requests are paused', 'Review service request manually');
  }
  return outcome('CONFIRMED', 'SERVICE_ACCEPTED',
    'Accepted into the staff work queue', 'Prepare: ' + item.request_type);
}

function decidePetStay(item, ctx) {
  var p = ctx.policies;
  if (!policyBool(p, 'pets_allowed')) {
    return outcome('ALTERNATIVE_OFFERED', 'PETS_NOT_ALLOWED', 'Pets are not currently accepted', 'Share local pet boarding options');
  }
  var weight = parseWeightLbs(item.request_details);
  if (weight === null) {
    return outcome('MANUAL_REVIEW', 'PET_WEIGHT_NOT_FOUND', 'Pet weight not stated in the request', 'Ask guest for the pet weight');
  }
  var limit = policyNumber(p, 'pet_max_weight_lbs');
  var extra = { pet_weight_lbs: weight };
  if (weight > limit) {
    return outcome('ALTERNATIVE_OFFERED', 'PET_OVER_LIMIT',
      'Pet weight ' + weight + ' lb is over the ' + limit + ' lb limit', 'Share local pet boarding options', extra);
  }
  return outcome('CONFIRMED', 'PET_STAY_CONFIRMED',
    'Pet of ' + weight + ' lb is within the ' + limit + ' lb limit; fee ' + p.pet_fee_per_night + ' per night',
    'Prepare pet amenities and add the pet fee to the folio', extra);
}

function decideSpecialCare(item) {
  return outcome('MANUAL_REVIEW', 'SPECIAL_CARE_REVIEW',
    'Dietary and accessibility needs are confirmed by staff, not automatically',
    'Confirm arrangements with guest: ' + item.request_type);
}

var CATEGORY_RULES = {
  early_checkin: decideEarlyCheckin,
  late_checkout: decideLateCheckout,
  room_upgrade: decideRoomUpgrade,
  room_preference: decideRoomPreference,
  service_request: decideServiceRequest,
  pet_stay: decidePetStay,
  special_care: decideSpecialCare,
};

function decideBatch(route, items, ctx) {
  var state = { earlyAllocated: new Map(), holds: new Map() };
  return items.map(function (item) {
    var decision;
    var fixedRoute = FIXED_DECISIONS[route] ? route : (CATEGORY_RULES[route] ? null : 'other');
    if (fixedRoute) {
      decision = Object.assign({}, FIXED_DECISIONS[fixedRoute], { decision_reason: fixedDecisionReason(fixedRoute, item) });
    } else {
      var missing = missingPolicy(route, ctx.policies);
      decision = missing
        ? outcome('MANUAL_REVIEW', 'POLICY_NOT_CONFIGURED', 'Policy "' + missing + '" is not configured',
          'Set the policy in HotelPolicies, then review this request')
        : CATEGORY_RULES[route](item, ctx, state);
    }
    return Object.assign({}, item,
      { requested_time: '', offered_time: '', target_room_type: '', pet_weight_lbs: '', inventory_changes: [] }, decision);
  });
}
