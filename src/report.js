// Excel report of processed guest requests, built from the GuestRequests log.
// Read-only: it never touches inventory, Calendar or Gmail. Depends on time.js.

var REPORT_COLUMNS = [
  'Request ID', 'Booking ID', 'Request Type', 'Stay Date', 'Decision', 'Reason', 'Staff Action', 'Email Status',
  'Calendar Event Created', 'Created At', 'Email Sent At', 'Response Minutes', 'Notion Synced',
];
var REPORT_MAX_DAYS = 31;
var REPORT_MAX_ROWS = 500;
var REPORT_OFFSET = '+08:00';
var REPORT_TEXT_LIMIT = 500;

function reportDay(ms) {
  return formatWithOffset(ms, REPORT_OFFSET).slice(0, 10);
}

function reportRejection(message) {
  return { ok: false, http_status: 400, message: message };
}

// body: { start_date, end_date } from the admin request; both blank means the last 31 days
function validateReportRange(body, now) {
  var start = String((body && body.start_date) || '').trim();
  var end = String((body && body.end_date) || '').trim();
  var today = reportDay(now.getTime());
  if (!start && !end) {
    end = today;
    start = reportDay(now.getTime() - (REPORT_MAX_DAYS - 1) * 86400000);
  }
  if (!isIsoDate(start) || !isIsoDate(end)) return reportRejection('start_date and end_date must both be real dates as YYYY-MM-DD.');
  if (start > end) return reportRejection('start_date must be on or before end_date.');
  var days = (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000 + 1;
  if (days > REPORT_MAX_DAYS) return reportRejection('The range covers ' + days + ' days; the limit is ' + REPORT_MAX_DAYS + '.');
  return { ok: true, start_date: start, end_date: end, generated_on: today };
}

function excelText(value) {
  var text = String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim();
  // a leading = + - @ or tab would make Excel read guest-supplied text as a formula
  if (/^[=+\-@\t]/.test(text)) text = "'" + text;
  return text.slice(0, REPORT_TEXT_LIMIT);
}

function responseMinutes(from, to) {
  var a = Date.parse(from);
  var b = Date.parse(to);
  if (!from || !to || isNaN(a) || isNaN(b) || b < a) return '';
  return Math.round((b - a) / 600) / 100;
}

function reportControl(httpStatus, message, count) {
  return { __report_control: true, http_status: httpStatus, message: message, count: count };
}

function prepareReportRows(rows, range) {
  var selected = rows.filter(function (row) {
    var ms = Date.parse(row.processed_at);
    if (!row.request_id || isNaN(ms)) return false;
    var day = reportDay(ms);
    return day >= range.start_date && day <= range.end_date;
  });
  if (!selected.length) {
    return [reportControl(200, 'No guest requests were processed between ' + range.start_date + ' and ' + range.end_date + '.', 0)];
  }
  if (selected.length > REPORT_MAX_ROWS) {
    return [reportControl(413, selected.length + ' requests match; the report limit is ' + REPORT_MAX_ROWS + '. Choose a shorter range.', selected.length)];
  }
  selected.sort(function (a, b) {
    return Date.parse(a.processed_at) - Date.parse(b.processed_at) || String(a.request_id).localeCompare(String(b.request_id));
  });
  return selected.map(function (r) {
    var values = [
      excelText(r.request_id), excelText(r.confirmation_number), excelText(r.request_type), excelText(r.check_in_date),
      excelText(r.status), excelText(r.decision_reason), excelText(r.staff_action), excelText(r.email_status),
      String(r.calendar_event_id || '').trim() ? 'Yes' : 'No', excelText(r.processed_at), excelText(r.email_sent_at),
      responseMinutes(r.processed_at, r.email_sent_at), excelText(r.notion_sync_status),
    ];
    var out = {};
    REPORT_COLUMNS.forEach(function (column, i) { out[column] = values[i]; });
    return out;
  });
}

function reportFileName(generatedOn) {
  return 'StayFlow_Guest_Requests_' + generatedOn + '.xlsx';
}
