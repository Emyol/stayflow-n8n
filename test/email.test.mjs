import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../scripts/lib/modules.mjs';
import { readSheet } from './helpers/sheets.mjs';

const M = loadModules(['time', 'text', 'reference', 'email']);
const policies = M.buildPolicies(readSheet('HotelPolicies'));
const item = {
  request_id: 'REQ-2026-101', confirmation_number: 'HTL-88219', guest_name: 'Eleanor Vance',
  guest_email: 'eleanor.vance@example.com', email_to: 'eleanor.vance@example.com',
  check_in_date: '2026-11-02', check_out_date: '2026-11-06', room_type: 'Deluxe King Suite',
  request_type: 'Early Check-In', request_details: 'Landing early at 9:00 AM.',
  status: 'CONFIRMED', decision_code: 'EARLY_CHECKIN_CONFIRMED', requested_time: '10:30',
  email_template: 'confirmed',
};

test('confirmed email has the confirmed subject, pill colour and decision fact', () => {
  const { subject, html } = M.renderEmail(item, policies);
  assert.equal(subject, 'Harborlight Hotel | Request confirmed — REQ-2026-101');
  assert.ok(html.includes('#2E7D32'));
  assert.ok(html.includes('#1F3864'));
  assert.ok(html.includes('10:30'));
  assert.ok(html.includes('HTL-88219'));
});

test('review and needs-info subjects', () => {
  assert.equal(M.renderEmail({ ...item, email_template: 'review' }, policies).subject,
    "Harborlight Hotel | We're reviewing your request — REQ-2026-101");
  assert.equal(M.renderEmail({ ...item, email_template: 'needs_info', validation_errors: ['invalid email'] }, policies).subject,
    'Harborlight Hotel | We need a few more details — REQ-2026-101');
});

test('pet confirmation quotes the policy fee', () => {
  const { html } = M.renderEmail({ ...item, decision_code: 'PET_STAY_CONFIRMED', request_type: 'Pet Accommodation' }, policies);
  assert.ok(html.includes('PHP 1,500'));
});
