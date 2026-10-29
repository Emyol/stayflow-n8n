import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../scripts/lib/modules.mjs';
import { runPipeline } from './helpers/pipeline.mjs';
import { readSheet } from './helpers/sheets.mjs';
import { readFileSync } from 'node:fs';

const M = loadModules(['time', 'notion']);
const NOW = new Date('2026-10-26T12:00:00Z');
const payload = JSON.parse(readFileSync(new URL('../fixtures/guest-request-payload.json', import.meta.url)));
const sheets = { catalog: readSheet('RequestCatalog'), policies: readSheet('HotelPolicies'), inventory: readSheet('RoomInventory'), log: [] };
const planned = runPipeline({ submissions: payload.submissions, sheets, now: NOW }).planned;
const row = id => ({ ...planned.find(p => p.request_id === id), calendar_event_id: 'evt-1', email_status: 'SENT' });

test('every property the payload writes is in the board schema, with the matching type', () => {
  const props = M.notionProperties(row('REQ-2026-101'), NOW.toISOString());
  for (const [name, value] of Object.entries(props)) {
    const type = M.NOTION_SCHEMA[name];
    assert.ok(type, `${name} missing from NOTION_SCHEMA`);
    assert.ok(type in value, `${name} should be written as ${type}`);
  }
});

test('the card carries the decision, not guest contact details', () => {
  const props = M.notionProperties(row('REQ-2026-101'), NOW.toISOString());
  assert.equal(props.Request.title[0].text.content, 'REQ-2026-101 — Early Check-In');
  assert.equal(props['Request ID'].rich_text[0].text.content, 'REQ-2026-101');
  assert.equal(props['Booking ID'].rich_text[0].text.content, 'HTL-88219');
  assert.equal(props.Status.select.name, 'CONFIRMED');
  assert.equal(props['Arrival Date'].date.start, '2026-11-02');
  assert.equal(props['Email Delivery'].select.name, 'SENT');
  assert.equal(props.Priority.select.name, 'Normal');
  assert.equal(props['Last Sync'].date.start, NOW.toISOString());
  const text = JSON.stringify(props);
  assert.ok(!text.includes('eleanor.vance@example.com'), 'guest email must not reach Notion');
  assert.ok(!text.includes('international flight'), 'free-text guest notes must not reach Notion');
});

test('a fully booked upgrade shows ALTERNATIVE_OFFERED and HIGH priority shows High', () => {
  assert.equal(M.notionProperties(row('REQ-2026-102'), '').Status.select.name, 'ALTERNATIVE_OFFERED');
  assert.equal(M.notionProperties({ ...row('REQ-2026-101'), priority: 'HIGH' }, '').Priority.select.name, 'High');
});

test('blank and bad values clear the property instead of failing the Notion call', () => {
  const props = M.notionProperties({ request_id: 'R-1', request_type: 'Spa, Massage', check_in_date: '2026-13-40' }, '');
  assert.deepEqual(props['Booking ID'].rich_text, []);
  assert.equal(props['Arrival Date'].date, null);
  assert.equal(props['Last Sync'].date, null);
  assert.equal(props.Status.select, null);
  // Notion rejects commas in select option names
  assert.equal(props['Request Type'].select.name, 'Spa Massage');
  const long = M.notionProperties({ request_id: 'R-2', decision_reason: 'x'.repeat(5000) }, '');
  assert.equal(long['Decision Reason'].rich_text[0].text.content.length, 2000);
});

test('the lookup matches the exact Request ID, never the title', () => {
  assert.deepEqual(M.notionLookupQuery('REQ-2026-101'), {
    filter: { property: 'Request ID', rich_text: { equals: 'REQ-2026-101' } },
    page_size: 1,
  });
});

test('the payload keeps the log row and adds create and update bodies for the board', () => {
  const p = M.notionPayload(row('REQ-2026-101'), 'db-123', NOW.toISOString());
  assert.equal(p.request_id, 'REQ-2026-101');
  assert.equal(p.status, 'CONFIRMED');
  assert.deepEqual(p.notion_create.parent, { database_id: 'db-123' });
  assert.deepEqual(p.notion_create.properties, p.notion_update.properties);
  assert.deepEqual(p.notion_query, M.notionLookupQuery('REQ-2026-101'));
});

test('an existing card is found from the query result, skipping archived pages', () => {
  assert.equal(M.foundNotionPage({ results: [{ id: 'page-1', archived: false }] }), 'page-1');
  assert.equal(M.foundNotionPage({ results: [{ id: 'old', archived: true }] }), '');
  assert.equal(M.foundNotionPage({ results: [] }), '');
  assert.equal(M.foundNotionPage({}), '');
});

test('the sync outcome writes back the full log row with only the Notion columns changed', () => {
  const p = M.notionPayload(row('REQ-2026-101'), 'db-123', NOW.toISOString());
  const synced = M.notionSyncOutcome(p, 'page-9', true, NOW);
  assert.equal(synced.notion_page_id, 'page-9');
  assert.equal(synced.notion_sync_status, 'SYNCED');
  assert.equal(synced.notion_last_synced_at, NOW.toISOString());
  assert.equal(synced.status, 'CONFIRMED');
  assert.equal(synced.email_status, 'SENT');
  for (const key of ['notion_query', 'notion_create', 'notion_update']) assert.ok(!(key in synced), key);

  const failed = M.notionSyncOutcome({ ...p, notion_page_id: 'page-old', notion_last_synced_at: 'earlier' }, '', false, NOW);
  assert.equal(failed.notion_sync_status, 'FAILED');
  assert.equal(failed.notion_page_id, 'page-old', 'a known page id survives a failed sync');
  assert.equal(failed.notion_last_synced_at, 'earlier', 'only a successful sync moves the timestamp');
});

test('the resync picks processed rows that are not yet SYNCED', () => {
  const rows = [
    { request_id: 'A', status: 'CONFIRMED', notion_sync_status: 'SYNCED' },
    { request_id: 'B', status: 'CONFIRMED', notion_sync_status: 'FAILED' },
    { request_id: 'C', status: 'MANUAL_REVIEW', notion_sync_status: '' },
    { request_id: 'D', status: '' },
    {},
  ];
  assert.deepEqual(M.rowsToResync(rows).map(r => r.request_id), ['B', 'C']);
});

test('the setup script creates every board property with its schema type', async () => {
  const { databaseBody } = await import('../scripts/notion-setup.mjs');
  const body = databaseBody('parent-1');
  assert.deepEqual(Object.keys(body.properties), Object.keys(M.NOTION_SCHEMA));
  for (const [name, type] of Object.entries(M.NOTION_SCHEMA)) assert.ok(type in body.properties[name], name);
  assert.ok(body.properties.Status.select.options.some(o => o.name === 'ALTERNATIVE_OFFERED'));
});
