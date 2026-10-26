// Intake: flatten organizer submissions, validate, classify and de-duplicate.
// Depends on time.js, text.js and reference.js.

// [output field, path in the organizer submission]. The build script turns
// this same list into the "Normalize Fields" Set node.
var FIELD_MAP = [
  ['request_id', 'request_id'],
  ['received_at', 'timestamp'],
  ['confirmation_number', 'booking.confirmation_number'],
  ['guest_name', 'booking.guest_name'],
  ['guest_email', 'booking.email'],
  ['check_in_date', 'booking.check_in_date'],
  ['check_out_date', 'booking.check_out_date'],
  ['room_type', 'booking.room_type'],
  ['request_type', 'booking.request_type'],
  ['request_details', 'booking.request_details'],
];

var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readPath(obj, path) {
  return path.split('.').reduce(function (value, key) {
    return value == null ? undefined : value[key];
  }, obj);
}

function normalizeSubmission(submission) {
  var request = {};
  FIELD_MAP.forEach(function (pair) {
    var value = readPath(submission, pair[1]);
    request[pair[0]] = value == null ? '' : String(value).trim();
  });
  return request;
}

function validateRequest(request) {
  var errors = [];
  if (!request.request_id) errors.push('missing request_id');
  if (!request.confirmation_number) errors.push('missing confirmation_number');
  if (!request.guest_name) errors.push('missing guest_name');
  if (!EMAIL_PATTERN.test(request.guest_email || '')) errors.push('invalid email');
  var checkInOk = isIsoDate(request.check_in_date);
  var checkOutOk = isIsoDate(request.check_out_date);
  if (!checkInOk) errors.push('invalid check_in_date');
  if (!checkOutOk) errors.push('invalid check_out_date');
  if (checkInOk && checkOutOk && request.check_out_date <= request.check_in_date) {
    errors.push('check_out_date must be after check_in_date');
  }
  return errors;
}

function highPriorityKeywords(policies) {
  return String(policies.high_priority_keywords || '').split(',')
    .map(function (word) { return word.trim().toLowerCase(); })
    .filter(Boolean);
}

function classifyBatch(requests, ref) {
  var keywords = highPriorityKeywords(ref.policies);
  // Duplicates are the same booking asking for the same request type; two
  // different services on one booking are both handled.
  var openRequests = new Map();
  ref.log.rows.forEach(function (row) {
    if (row.status === 'INVALID' || row.status === 'DUPLICATE') return;
    var key = row.confirmation_number + '|' + labelKey(row.request_type);
    if (!openRequests.has(key)) openRequests.set(key, String(row.request_id));
  });
  var seenIds = new Set();

  return requests.map(function (original, index) {
    var request = Object.assign({}, original);
    var errors = validateRequest(request);
    if (!request.request_id) {
      request.request_id = 'NOID-' + (request.confirmation_number || 'UNKNOWN') + '-' + (request.received_at || index);
    }
    var entry = ref.catalog.get(labelKey(request.request_type));
    var details = String(request.request_details || '').toLowerCase();
    var keywordHit = keywords.some(function (word) { return details.indexOf(word) !== -1; });
    var result = Object.assign(request, {
      category: entry ? entry.category : 'other',
      base_priority: entry ? entry.base_priority : 'NORMAL',
      schedule_from_text: entry ? entry.schedule_from_text : false,
      validation_errors: errors,
      duplicate_of: '',
      email_valid: EMAIL_PATTERN.test(request.guest_email || ''),
    });
    result.priority = result.base_priority === 'HIGH' || keywordHit ? 'HIGH' : 'NORMAL';

    if (ref.log.byRequestId.has(result.request_id) || seenIds.has(result.request_id)) {
      result.route = 'already_processed';
    } else if (errors.length) {
      result.route = 'invalid';
    } else {
      var key = result.confirmation_number + '|' + labelKey(result.request_type);
      var earlier = openRequests.get(key);
      if (earlier && earlier !== result.request_id) {
        result.route = 'duplicate';
        result.duplicate_of = earlier;
      } else {
        result.route = result.category;
        openRequests.set(key, result.request_id);
      }
    }
    seenIds.add(result.request_id);
    return result;
  });
}
