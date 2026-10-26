import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModules } from '../scripts/lib/modules.mjs';
import { readSheet } from './helpers/sheets.mjs';

const M = loadModules(['time', 'text', 'reference', 'intake', 'rules', 'email', 'plan']);
const payload = JSON.parse(readFileSync(new URL('../fixtures/guest-request-payload.json', import.meta.url)));
const edgeCases = JSON.parse(readFileSync(new URL('../fixtures/edge-cases.json', import.meta.url)));
const NOW = new Date('2026-10-26T12:00:00Z');

function makeCtx(override = '') {
  const policyRows = readSheet('HotelPolicies').map(r =>
    r.policy_key === 'demo_recipient_override' ? { ...r, value: override } : r);
  return {
    policies: M.buildPolicies(policyRows),
    inventory: M.buildInventory(readSheet('RoomInventory')),
    catalog: M.buildCatalog(readSheet('RequestCatalog')),
    now: NOW,
  };
}

function decideAll(submissions, ctx) {
  const classified = M.classifyBatch(submissions.map(M.normalizeSubmission), { ...ctx, log: M.buildLogIndex([]) });
  const routes = [...new Set(classified.map(c => c.route))];
  return routes.flatMap(route => M.decideBatch(route, classified.filter(c => c.route === route), ctx));
}

const ctx = makeCtx();
const decided = decideAll(payload.submissions, ctx);
const edgeDecided = decideAll(edgeCases, ctx);
const byId = (items, id) => items.find(r => r.request_id === id);
const plan = id => M.planActions(byId(decided, id), ctx);

test('early check-in prep starts an hour before the requested time', () => {
  assert.equal(plan('REQ-2026-101').calendar_start, '2026-11-02T09:30:00+08:00');
  assert.equal(plan('REQ-2026-101').calendar_end, '2026-11-02T10:30:00+08:00');
});

test('text-scheduled services use the guest date and time for 60 minutes', () => {
  assert.equal(plan('REQ-2026-110').calendar_start, '2026-11-01T14:30:00+08:00');
  assert.equal(plan('REQ-2026-110').calendar_end, '2026-11-01T15:30:00+08:00');
  assert.equal(plan('REQ-2026-118').calendar_start, '2026-11-08T20:00:00+08:00');
});

test('reviews are scheduled by priority SLA from now', () => {
  assert.equal(plan('REQ-2026-103').calendar_start, '2026-10-26T22:00:00+08:00');
  assert.equal(plan('REQ-2026-111').calendar_start, '2026-10-27T20:00:00+08:00');
});

test('calendar summary flags priority and names the request', () => {
  assert.ok(plan('REQ-2026-103').calendar_summary.startsWith('[HIGH] '));
  assert.ok(plan('REQ-2026-103').calendar_summary.endsWith(' — REQ-2026-103 (HTL-90312)'));
  assert.ok(!plan('REQ-2026-104').calendar_summary.startsWith('[HIGH]'));
});

test('alternative outcome selects the alternative template and subject', () => {
  assert.equal(plan('REQ-2026-102').email_template, 'alternative');
  assert.equal(plan('REQ-2026-102').email_subject, 'Harborlight Hotel | An option for your request — REQ-2026-102');
});

test('email goes to the guest unless a demo override is set', () => {
  assert.equal(plan('REQ-2026-101').email_to, 'eleanor.vance@example.com');
  const overridden = M.planActions(byId(decided, 'REQ-2026-101'), makeCtx('team@example.com'));
  assert.equal(overridden.email_to, 'team@example.com');
  assert.equal(overridden.email_recipient, 'team@example.com');
  assert.match(overridden.email_html, /eleanor\.vance@example\.com/);
});

test('duplicates create no event and no email', () => {
  const p = M.planActions(byId(edgeDecided, 'EDGE-006'), ctx);
  assert.equal(p.calendar_needed, false);
  assert.equal(p.email_needed, false);
  assert.equal(p.calendar_status, 'NOT_NEEDED');
  assert.equal(p.email_status, 'SKIPPED');
});

test('invalid requests ask for details only when the address is usable', () => {
  assert.equal(M.planActions(byId(edgeDecided, 'EDGE-002'), ctx).email_template, 'needs_info');
  assert.equal(M.planActions(byId(edgeDecided, 'EDGE-001'), ctx).email_needed, false);
});

test('a too-late check-out gets an offer task and an email naming the offered time', () => {
  const sub = structuredClone(payload.submissions.find(s => s.request_id === 'REQ-2026-105'));
  sub.booking.request_details = 'Can we stay until 6:00 PM?';
  const p = M.planActions(decideAll([sub], ctx)[0], ctx);
  assert.equal(p.calendar_start, '2026-11-08T11:00:00+08:00');
  assert.ok(p.calendar_summary.startsWith('Offer late check-out until 16:00'));
  assert.ok(p.email_html.includes('16:00'));
  assert.ok(!p.email_html.includes('unable to extend'));
});

test('guest text is escaped in the email', () => {
  const html = M.planActions(byId(edgeDecided, 'EDGE-008'), ctx).email_html;
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
});

test('planned items carry every GuestRequests column', () => {
  const columns = readFileSync(new URL('../sheets/GuestRequests.csv', import.meta.url), 'utf8').trim().split(',');
  const p = plan('REQ-2026-101');
  for (const column of columns) assert.ok(column in p, column);
  assert.equal(p.calendar_status, 'PENDING');
  assert.equal(p.email_status, 'PENDING');
  assert.equal(p.processed_at, NOW.toISOString());
});
