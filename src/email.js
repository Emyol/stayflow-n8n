// Guest email rendering: one inline-styled, table-based HTML layout with a
// decision sentence per decision code. Depends on text.js and reference.js.

var EMAIL_TEMPLATES = {
  confirmed: { pill: 'Confirmed', color: '#2E7D32', subject: 'Request confirmed',
    next: 'No action is needed from you. Please keep this email for your reference.' },
  alternative: { pill: 'Alternative offered', color: '#B26A00', subject: 'An option for your request',
    next: 'Reply to this email or contact the front desk if you would like to discuss other options.' },
  review: { pill: 'Under review', color: '#1565C0', subject: "We're reviewing your request",
    next: 'Our front-desk team will follow up with you through our usual guest support process.' },
  needs_info: { pill: 'More details needed', color: '#616161', subject: 'We need a few more details',
    next: 'Reply to this email with the corrected details and we will take it from there.' },
};

function decisionSentence(item, policies) {
  var e = escapeHtml;
  var time = e(item.requested_time);
  var room = e(item.room_type);
  var type = e(item.request_type);
  var checkin = e(policyTime(policies, 'standard_checkin_time') || '');
  var checkout = e(policyTime(policies, 'standard_checkout_time') || '');
  switch (item.decision_code) {
    case 'EARLY_CHECKIN_CONFIRMED':
      return 'Your early check-in at ' + time + ' on ' + e(item.check_in_date) + ' is confirmed. Your ' + room + ' will be ready for you.';
    case 'STANDARD_CHECKIN_APPLIES':
      return 'Your arrival at ' + time + ' falls within our standard check-in from ' + checkin + ', so your room will be ready when you arrive.';
    case 'TOO_EARLY':
    case 'NO_READY_ROOM':
    case 'EARLY_CHECKIN_DISABLED':
      return 'We cannot guarantee a ready room' + (time ? ' at ' + time : '') + ' on ' + e(item.check_in_date) +
        '. We will gladly store your luggage when you arrive, and your room will be ready by ' + checkin + '.';
    case 'LATE_CHECKOUT_CONFIRMED':
      return 'Your late check-out until ' + time + ' on ' + e(item.check_out_date) + ' is confirmed.';
    case 'STANDARD_CHECKOUT_APPLIES':
      return 'Your departure at ' + time + ' is within our standard check-out time of ' + checkout + '.';
    case 'LATE_CHECKOUT_TOO_LATE':
      return 'We can\'t hold your room until ' + time + ', but we can offer late check-out until ' + e(item.offered_time) +
        ' on ' + e(item.check_out_date) + '. Reply to this email to accept, and we can store your luggage after that.';
    case 'LATE_CHECKOUT_UNAVAILABLE':
    case 'LATE_CHECKOUT_DISABLED':
      return 'We are unable to extend your check-out' + (time ? ' to ' + time : '') + ' on ' + e(item.check_out_date) +
        '. We would be happy to store your luggage after check-out at ' + checkout + '.';
    case 'UPGRADE_UNAVAILABLE':
      return 'The ' + e(item.target_room_type) + ' is fully booked for your dates, so your ' + room +
        ' booking stays as it is. We will check again on your arrival in case one becomes available.';
    case 'UPGRADE_HELD_AWAITING_APPROVAL':
      return 'We are holding a ' + e(item.target_room_type) + ' for you for ' + e(policyNumber(policies, 'upgrade_hold_hours')) +
        ' hours. Reply to accept the upgrade rate and we will confirm it.';
    case 'UPGRADES_DISABLED':
      return 'We are not offering room upgrades for your dates, so your ' + room + ' booking stays as it is.';
    case 'PREFERENCE_NOTED':
      return 'We have noted your request (' + type + ') for your room assignment. We will do our best to arrange it, and your room is confirmed at check-in.';
    case 'SERVICE_ACCEPTED':
      return 'Our team has your ' + type + ' request and will prepare it for your stay. Items are subject to availability on the day.';
    case 'PET_STAY_CONFIRMED':
      return 'Your pet is welcome to stay with you. A pet fee of ' + e(policies.pet_fee_per_night) + ' per night applies.';
    case 'PET_OVER_LIMIT':
    case 'PETS_NOT_ALLOWED':
      return 'We are unable to accommodate your pet for this stay. Our front desk can share nearby pet boarding options.';
    case 'SPECIAL_CARE_REVIEW':
      return 'Your ' + type + ' needs are being reviewed by our team so we can get every detail right before you arrive.';
    case 'LINKED_BOOKING_CHECK':
      return 'Your request involves more than one booking, so our team is checking them together before confirming.';
    case 'INVALID_REQUEST':
      return 'Some details in your request need correcting: ' + e((item.validation_errors || []).join('; ')) + '.';
    default:
      return 'Our front-desk team needs to confirm a few details before we can respond to your ' + type + ' request.';
  }
}

function renderEmail(item, policies) {
  var t = EMAIL_TEMPLATES[item.email_template];
  var e = escapeHtml;
  var hotel = policies.hotel_name || 'Our hotel';
  var override = String(policies.demo_recipient_override || '').trim();
  var row = function (label, value) {
    return '<tr><td style="padding:6px 0;color:#5f6b7a;width:150px;">' + label + '</td>' +
      '<td style="padding:6px 0;color:#1d2733;font-weight:600;">' + e(value) + '</td></tr>';
  };
  var html =
    '<div style="background:#f3f5f8;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="background:#ffffff;border-radius:8px;overflow:hidden;">' +
    '<tr><td style="background:#1F3864;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700;">' + e(hotel) +
    '<div style="font-size:13px;font-weight:400;opacity:0.85;margin-top:4px;">Guest Services</div></td></tr>' +
    '<tr><td style="padding:24px 28px 8px;">' +
    '<span style="display:inline-block;background:' + t.color + ';color:#ffffff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:12px;">' + t.pill + '</span>' +
    '<p style="font-size:15px;color:#1d2733;margin:18px 0 0;">Hi ' + e(item.guest_name) + ',</p>' +
    '<p style="font-size:15px;color:#1d2733;line-height:1.5;">Thank you for your request. Here is where it stands.</p></td></tr>' +
    '<tr><td style="padding:0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #e3e7ec;border-bottom:1px solid #e3e7ec;">' +
    row('Request ID', item.request_id) + row('Confirmation', item.confirmation_number) +
    row('Stay', item.check_in_date + ' to ' + item.check_out_date) + row('Room', item.room_type) +
    row('Request', item.request_type) + '</table></td></tr>' +
    '<tr><td style="padding:20px 28px 0;"><div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;letter-spacing:0.5px;">What we decided</div>' +
    '<p style="font-size:15px;color:#1d2733;line-height:1.5;margin:6px 0 0;">' + decisionSentence(item, policies) + '</p></td></tr>' +
    '<tr><td style="padding:20px 28px 0;"><div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;letter-spacing:0.5px;">What happens next</div>' +
    '<p style="font-size:15px;color:#1d2733;line-height:1.5;margin:6px 0 0;">' + t.next + '</p></td></tr>' +
    '<tr><td style="padding:20px 28px 0;"><div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;letter-spacing:0.5px;">Your request</div>' +
    '<blockquote style="margin:6px 0 0;padding:10px 14px;border-left:3px solid #c9d2dc;background:#f7f9fb;color:#3b4652;font-size:14px;line-height:1.5;">' +
    e(item.request_details) + '</blockquote></td></tr>' +
    '<tr><td style="padding:24px 28px;font-size:12px;color:#7a8594;line-height:1.5;border-top:1px solid #e3e7ec;">' +
    'Questions? Contact the front desk at ' + e(policies.front_desk_contact || '') + '.' +
    (override ? '<br>Demo mode: originally addressed to ' + e(item.guest_email) + '.' : '') +
    '</td></tr></table></div>';
  return { subject: hotel + ' | ' + t.subject + ' — ' + item.request_id, html: html };
}
