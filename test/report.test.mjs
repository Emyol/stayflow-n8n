import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../scripts/lib/modules.mjs';

const M = loadModules(['time', 'report']);
const NOW = new Date('2026-10-29T05:00:00Z'); // 13:00 in Manila

const row = (overrides = {}) => ({
  request_id: 'REQ-2026-101', confirmation_number: 'HTL-88219', guest_name: 'Eleanor Vance', guest_email: 'eleanor.vance@example.com',
  request_type: 'Early Check-In', check_in_date: '2026-11-02', status: 'CONFIRMED', decision_reason: 'Ready room available',
  staff_action: 'Prepare room', email_status: 'SENT', calendar_event_id: 'evt-1', request_details: 'Landing early',
  processed_at: '2026-10-29T04:00:00.000Z', email_sent_at: '2026-10-29T04:01:30.000Z', notion_sync_status: 'SYNCED', ...overrides,
});

test('a valid range is accepted and an empty body defaults to the last 31 days in Manila', () => {
  assert.deepEqual(M.validateReportRange({ start_date: '2026-10-01', end_date: '2026-10-29' }, NOW),
    { ok: true, start_date: '2026-10-01', end_date: '2026-10-29', generated_on: '2026-10-29' });
  const fallback = M.validateReportRange({}, NOW);
  assert.equal(fallback.ok, true);
  assert.equal(fallback.start_date, '2026-09-29');
  assert.equal(fallback.end_date, '2026-10-29');
});

test('bad, reversed and oversized ranges are rejected with a 400 before any sheet is read', () => {
  for (const body of [
    { start_date: '2026-10-29', end_date: '2026-10-01' },
    { start_date: 'yesterday', end_date: '2026-10-29' },
    { start_date: '2026-02-30', end_date: '2026-03-01' },
    { start_date: '2026-08-01', end_date: '2026-10-29' },
    { start_date: '2026-10-01' },
  ]) {
    const result = M.validateReportRange(body, NOW);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.http_status, 400);
    assert.ok(result.message);
  }
});

test('report rows use the blueprint headers in order and leave out guest contact details', () => {
  const [item] = M.prepareReportRows([row()], { start_date: '2026-10-29', end_date: '2026-10-29' });
  assert.deepEqual(Object.keys(item), M.REPORT_COLUMNS);
  assert.equal(item['Booking ID'], 'HTL-88219');
  assert.equal(item['Stay Date'], '2026-11-02');
  assert.equal(item['Decision'], 'CONFIRMED');
  assert.equal(item['Calendar Event Created'], 'Yes');
  assert.equal(item['Response Minutes'], 1.5);
  assert.equal(item['Notion Synced'], 'SYNCED');
  const text = JSON.stringify(item);
  for (const secret of ['Eleanor', 'eleanor.vance', 'Landing early']) assert.ok(!text.includes(secret), secret);
});

test('rows are filtered by the Manila date they were processed on', () => {
  const rows = [
    row({ request_id: 'A', processed_at: '2026-10-28T15:59:00.000Z' }), // 23:59 on the 28th in Manila
    row({ request_id: 'B', processed_at: '2026-10-28T16:00:00.000Z' }), // 00:00 on the 29th in Manila
    row({ request_id: 'C', processed_at: 'not a date' }),
    {},
  ];
  assert.deepEqual(M.prepareReportRows(rows, { start_date: '2026-10-29', end_date: '2026-10-29' }).map(r => r['Request ID']), ['B']);
});

test('an empty selection returns one control item, never a fabricated row', () => {
  assert.deepEqual(M.prepareReportRows([{}], { start_date: '2026-10-29', end_date: '2026-10-29' }),
    [{ __report_control: true, http_status: 200, message: 'No guest requests were processed between 2026-10-29 and 2026-10-29.', count: 0 }]);
});

test('too many rows returns a size-limit control item instead of silently truncating', () => {
  const rows = Array.from({ length: M.REPORT_MAX_ROWS + 1 }, (_, i) => row({ request_id: `R-${i}` }));
  const [control] = M.prepareReportRows(rows, { start_date: '2026-10-29', end_date: '2026-10-29' });
  assert.equal(control.__report_control, true);
  assert.equal(control.http_status, 413);
  assert.equal(control.count, M.REPORT_MAX_ROWS + 1);
});

test('formula-like text is escaped so the workbook treats it as text', () => {
  const [item] = M.prepareReportRows([row({ decision_reason: '=HYPERLINK("http://evil")', staff_action: '+1+1', request_type: '@SUM(A1)' })],
    { start_date: '2026-10-29', end_date: '2026-10-29' });
  assert.equal(item['Reason'], `'=HYPERLINK("http://evil")`);
  assert.equal(item['Staff Action'], "'+1+1");
  assert.equal(item['Request Type'], "'@SUM(A1)");
});

test('response minutes are blank when a timestamp is missing or out of order', () => {
  assert.equal(M.responseMinutes('2026-10-29T04:00:00Z', ''), '');
  assert.equal(M.responseMinutes('2026-10-29T04:00:00Z', '2026-10-29T03:00:00Z'), '');
  assert.equal(M.responseMinutes('garbage', '2026-10-29T03:00:00Z'), '');
});

test('rows come out in processing order and a missing calendar event reads No', () => {
  const rows = [row({ request_id: 'late', processed_at: '2026-10-29T04:05:00Z' }), row({ request_id: 'early', calendar_event_id: '' })];
  const out = M.prepareReportRows(rows, { start_date: '2026-10-29', end_date: '2026-10-29' });
  assert.deepEqual(out.map(r => r['Request ID']), ['early', 'late']);
  assert.equal(out[0]['Calendar Event Created'], 'No');
});

test('the file name carries the generation date', () => {
  assert.equal(M.reportFileName('2026-10-29'), 'StayFlow_Guest_Requests_2026-10-29.xlsx');
});
