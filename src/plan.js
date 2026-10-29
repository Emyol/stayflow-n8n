// Turns a decision into the staff Calendar task, the guest email and the
// full GuestRequests log row. Depends on time.js, text.js, reference.js, email.js.

var LOG_COLUMNS = [
  'request_id', 'received_at', 'confirmation_number', 'guest_name', 'guest_email', 'request_type',
  'category', 'priority', 'check_in_date', 'check_out_date', 'room_type', 'request_details',
  'requested_time', 'status', 'decision_code', 'decision_reason', 'staff_action', 'calendar_status',
  'calendar_event_id', 'email_status', 'email_recipient', 'email_sent_at', 'processed_at', 'last_updated_at',
  // optional Notion mirror; blank when the board is not configured
  'notion_page_id', 'notion_sync_status', 'notion_last_synced_at',
];

var STATUS_TEMPLATES = { CONFIRMED: 'confirmed', ALTERNATIVE_OFFERED: 'alternative', MANUAL_REVIEW: 'review' };

function slot(date, hhmm, minutes, offset) {
  var start = localIso(date, hhmm, offset);
  return { start: start, end: addMinutesIso(start, minutes) };
}

function nowSlot(now, hours, offset) {
  var start = nowPlusHoursIso(now, hours, offset);
  return { start: start, end: addMinutesIso(start, 30) };
}

function calendarPlan(item, ctx) {
  var p = ctx.policies;
  var offset = policyOffset(p);
  var prep = policyTime(p, 'service_prep_time') || '09:00';
  var checkout = policyTime(p, 'standard_checkout_time');
  switch (item.decision_code) {
    case 'EARLY_CHECKIN_CONFIRMED':
      return { title: 'Prepare early check-in',
        when: slot(item.check_in_date, fromMinutes(toMinutes(item.requested_time) - 60), 60, offset) };
    case 'NO_READY_ROOM':
    case 'TOO_EARLY':
      return { title: 'Early arrival: hold luggage', when: slot(item.check_in_date, item.requested_time, 30, offset) };
    case 'LATE_CHECKOUT_CONFIRMED':
      return { title: 'Late check-out approved until ' + item.requested_time + ': notify housekeeping',
        when: slot(item.check_out_date, checkout, 30, offset) };
    case 'LATE_CHECKOUT_TOO_LATE':
      return { title: 'Offer late check-out until ' + item.offered_time, when: slot(item.check_out_date, checkout, 30, offset) };
    case 'LATE_CHECKOUT_UNAVAILABLE':
      return { title: 'Offer luggage storage at check-out', when: slot(item.check_out_date, checkout, 30, offset) };
    case 'UPGRADE_UNAVAILABLE':
      return { title: 'Re-check upgrade availability', when: slot(item.check_in_date, prep, 30, offset) };
    case 'UPGRADE_HELD_AWAITING_APPROVAL':
      return { title: 'Upgrade hold expires: confirm or release',
        when: nowSlot(ctx.now, policyNumber(p, 'upgrade_hold_hours'), offset) };
    case 'PREFERENCE_NOTED':
    case 'PET_STAY_CONFIRMED':
    case 'SERVICE_ACCEPTED':
      var when = slot(item.check_in_date, prep, 30, offset);
      if (item.schedule_from_text) {
        var date = parseTextDate(item.request_details, Number(item.check_in_date.slice(0, 4)));
        var time = lastTime(item.request_details);
        if (date && time) when = slot(date, time, 60, offset);
      }
      return { title: 'Prepare: ' + item.request_type, when: when };
  }
  if (item.status === 'MANUAL_REVIEW') {
    var hours = item.priority === 'HIGH'
      ? (policyNumber(p, 'review_sla_hours_high') || 2)
      : (policyNumber(p, 'review_sla_hours_normal') || 24);
    return { title: 'Review: ' + item.request_type, when: nowSlot(ctx.now, hours, offset) };
  }
  return null;
}

function calendarDescription(item, policies) {
  // a malformed offset falls back to +08:00 to keep the run going; staff still
  // need to see that it did. A blank one is the documented Manila default
  var raw = String(policies.hotel_timezone_offset == null ? '' : policies.hotel_timezone_offset).trim();
  var warning = raw && raw !== policyOffset(policies)
    ? ['Warning: hotel_timezone_offset "' + raw + '" is not a valid +HH:MM offset; times use ' + policyOffset(policies) + '. Fix it in HotelPolicies.']
    : [];
  return warning.concat([
    'Guest: ' + item.guest_name + ' <' + item.guest_email + '>',
    'Booking: ' + item.confirmation_number + ', ' + item.room_type + ', ' + item.check_in_date + ' to ' + item.check_out_date,
    'Request: ' + item.request_type,
    'Details: ' + item.request_details,
    'Decision: ' + item.status + ' (' + item.decision_code + ')',
    'Reason: ' + item.decision_reason,
    'Staff action: ' + item.staff_action,
  ]).join('\n');
}

function planActions(item, ctx) {
  var p = ctx.policies;
  var planned = Object.assign({}, item);
  LOG_COLUMNS.forEach(function (column) {
    if (planned[column] == null) planned[column] = '';
  });

  var calendar = calendarPlan(item, ctx);
  planned.calendar_needed = Boolean(calendar);
  planned.calendar_summary = calendar
    ? (item.priority === 'HIGH' ? '[HIGH] ' : '') + calendar.title + ' — ' + item.request_id + ' (' + item.confirmation_number + ')'
    : '';
  planned.calendar_start = calendar ? calendar.when.start : '';
  planned.calendar_end = calendar ? calendar.when.end : '';
  planned.calendar_description = calendar ? calendarDescription(item, p) : '';
  planned.calendar_status = calendar ? 'PENDING' : 'NOT_NEEDED';

  var template = STATUS_TEMPLATES[item.status] || (item.status === 'INVALID' && item.email_valid ? 'needs_info' : '');
  planned.email_template = template;
  planned.email_needed = Boolean(template);
  planned.email_to = template ? (String(p.demo_recipient_override || '').trim() || item.guest_email) : '';
  planned.email_recipient = planned.email_to;
  planned.sender_name = p.hotel_name || '';
  var rendered = template ? renderEmail(planned, p) : { subject: '', html: '' };
  planned.email_subject = rendered.subject;
  planned.email_html = rendered.html;
  planned.email_status = template ? 'PENDING' : 'SKIPPED';

  planned.processed_at = ctx.now.toISOString();
  planned.last_updated_at = planned.processed_at;
  return planned;
}
