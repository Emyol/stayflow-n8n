// Free-text extraction for guest request details. Depends on time.js.

var MONTH_PATTERN = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseTimes(text) {
  var re = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
  var times = [];
  var m;
  while ((m = re.exec(String(text || ''))) !== null) {
    var hour = Number(m[1]);
    var minute = Number(m[2] || 0);
    if (hour < 1 || hour > 12 || minute > 59) continue;
    hour = hour % 12 + (m[3].toLowerCase() === 'pm' ? 12 : 0);
    times.push(fromMinutes(hour * 60 + minute));
  }
  return times;
}

function lastTime(text) {
  var times = parseTimes(text);
  return times.length ? times[times.length - 1] : null;
}

function parseTextDate(text, year) {
  var m = MONTH_PATTERN.exec(String(text || ''));
  if (!m) return null;
  var date = year + '-' + pad2(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1) + '-' + pad2(Number(m[2]));
  return isIsoDate(date) ? date : null;
}

function parseWeightLbs(text) {
  var m = /(\d+(?:\.\d+)?)\s*-?\s*(lbs?|pounds?|kg)\b/i.exec(String(text || ''));
  if (!m) return null;
  var value = Number(m[1]);
  if (m[2].toLowerCase() === 'kg') value = value * 2.20462;
  return Math.round(value * 100) / 100;
}

function findLinkedBookings(text, own) {
  var found = String(text || '').match(/\bHTL-\d+\b/g) || [];
  return found.filter(function (number, i) {
    return number !== own && found.indexOf(number) === i;
  });
}

function findTargetRoomType(text, roomTypes, current) {
  var haystack = String(text || '').toLowerCase();
  var matches = roomTypes.filter(function (type) {
    return type.toLowerCase() !== String(current || '').toLowerCase() &&
      haystack.indexOf(type.toLowerCase()) !== -1;
  });
  matches.sort(function (a, b) { return b.length - a.length; });
  return matches.length ? matches[0] : null;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Lookup key for request labels: "Late Checkout" and "Late Check-Out" match.
function labelKey(s) {
  return normalizeLabel(s).replace(/ /g, '');
}

function normalizeLabel(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
