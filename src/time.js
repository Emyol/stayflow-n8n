// Time helpers. Hotel-local times are "HH:MM"; timestamps carry an explicit
// offset such as +08:00 so Google Calendar never guesses the timezone.

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

function toMinutes(hhmm) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm == null ? '' : hhmm).trim());
  if (!m) return null;
  var hours = Number(m[1]);
  var minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function fromMinutes(total) {
  var m = ((total % 1440) + 1440) % 1440;
  return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
}

function localIso(date, hhmm, offset) {
  return date + 'T' + hhmm + ':00' + (offset || '+08:00');
}

function offsetMinutes(offset) {
  var m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  var value = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -value : value;
}

function formatWithOffset(utcMs, offset) {
  var d = new Date(utcMs + offsetMinutes(offset) * 60000);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) +
    'T' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':00' + offset;
}

function addMinutesIso(iso, minutes) {
  return formatWithOffset(Date.parse(iso) + minutes * 60000, iso.slice(-6));
}

function nowPlusHoursIso(now, hours, offset) {
  return formatWithOffset(now.getTime() + hours * 3600000, offset || '+08:00');
}

function isIsoDate(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s));
  if (!m) return false;
  var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3]);
}

function stayNights(checkIn, checkOut) {
  var nights = [];
  var day = Date.parse(checkIn + 'T00:00:00Z');
  var end = Date.parse(checkOut + 'T00:00:00Z');
  for (; day < end; day += 86400000) nights.push(new Date(day).toISOString().slice(0, 10));
  return nights;
}
