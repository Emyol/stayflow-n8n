import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWorkflow } from '../scripts/build-workflow.mjs';
import { readSheet } from './helpers/sheets.mjs';
import { loadModules } from '../scripts/lib/modules.mjs';

const wf = buildWorkflow('local.example');
const node = name => wf.nodes.find(n => n.name === name);
const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj[k]]));
const starter = JSON.parse(readFileSync(new URL('../fixtures/organizer-starter-template.json', import.meta.url)));

test('organizer nodes are copied unchanged', () => {
  for (const s of starter.nodes) {
    assert.ok(node(s.name), s.name);
    assert.deepEqual(pick(node(s.name), ['type', 'typeVersion', 'parameters']), pick(s, ['type', 'typeVersion', 'parameters']));
  }
});

test('all five required node categories are present', () => {
  for (const type of ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.switch', 'n8n-nodes-base.code', 'n8n-nodes-base.set',
    'n8n-nodes-base.googleSheets', 'n8n-nodes-base.googleCalendar', 'n8n-nodes-base.gmail']) {
    assert.ok(wf.nodes.some(n => n.type === type), type);
  }
});

test('the router has nine named outputs plus a fallback', () => {
  assert.equal(wf.connections['Route by Category'].main.length, 10);
});

test('side-effect nodes route failures to an error output', () => {
  assert.equal(node('Create Staff Task').onError, 'continueErrorOutput');
  assert.equal(node('Send Guest Email').onError, 'continueErrorOutput');
  assert.equal(wf.connections['Create Staff Task'].main[1][0].node, 'Calendar Failed');
  assert.equal(wf.connections['Send Guest Email'].main[1][0].node, 'Email Failed');
});

test('reference reads run once and still output when a tab is empty', () => {
  for (const name of ['Read Request Catalog', 'Read Hotel Policies', 'Read Room Inventory', 'Read Request Log']) {
    assert.equal(node(name).executeOnce, true, name);
    assert.equal(node(name).alwaysOutputData, true, name);
  }
});

// runs a generated Code node body against fake upstream node outputs
function runCode(name, outputs) {
  const $ = nodeName => ({ all: () => (outputs[nodeName] || [{}]).map(json => ({ json })) });
  return new Function('$', node(name).parameters.jsCode)($);
}

test('Classify stops the run with the names of empty reference tabs', () => {
  const sheets = { 'Read Request Catalog': readSheet('RequestCatalog'), 'Read Hotel Policies': readSheet('HotelPolicies'),
    'Read Room Inventory': readSheet('RoomInventory'), 'Read Request Log': [{}], 'Normalize Fields': [] };
  assert.deepEqual(runCode('Classify, Validate & Dedupe', sheets), []);
  assert.throws(() => runCode('Classify, Validate & Dedupe', { ...sheets, 'Read Request Catalog': [{}], 'Read Room Inventory': [{}] }),
    /RequestCatalog, RoomInventory/);
});

test('local build carries credential ids from config; cloud build carries names only', () => {
  assert.equal(node('Create Staff Task').credentials.googleCalendarOAuth2Api.id, 'YOUR_CALENDAR_CREDENTIAL_ID');
  const cloud = buildWorkflow('cloud');
  const gmail = cloud.nodes.find(n => n.name === 'Send Guest Email').credentials.gmailOAuth2;
  assert.equal(gmail.id, undefined);
  assert.equal(gmail.name, 'Gmail (StayFlow)');
  assert.equal(cloud.id, undefined);
});

test('every connection points at a real node and every node is reachable', () => {
  const names = new Set(wf.nodes.map(n => n.name));
  const targets = new Set();
  for (const [source, { main }] of Object.entries(wf.connections)) {
    assert.ok(names.has(source), source);
    for (const output of main) for (const link of output) {
      assert.ok(names.has(link.node), link.node);
      targets.add(link.node);
    }
  }
  for (const n of wf.nodes) {
    if (n.type === 'n8n-nodes-base.stickyNote' || n.type === 'n8n-nodes-base.manualTrigger') continue;
    assert.ok(targets.has(n.name), `${n.name} has no incoming connection`);
  }
});

test('every Code node body parses', () => {
  for (const n of wf.nodes.filter(x => x.type === 'n8n-nodes-base.code')) {
    assert.doesNotThrow(() => new Function(n.parameters.jsCode), n.name);
  }
});

test('calendar id is an email-style id that n8n accepts in id mode', () => {
  for (const env of ['local.example', 'cloud']) {
    const calendar = buildWorkflow(env).nodes.find(n => n.name === 'Create Staff Task').parameters.calendar.value;
    assert.match(calendar, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, env);
  }
});

test('each rules node calls decideBatch with its own route', () => {
  const routes = { 'Rules: Early Check-In': 'early_checkin', 'Rules: Room Upgrade': 'room_upgrade', 'Rules: Special Care': 'special_care' };
  for (const [name, route] of Object.entries(routes)) {
    const code = node(name).parameters.jsCode;
    assert.ok(code.includes(`decideBatch('${route}'`), name);
    assert.ok(!code.includes('__ROUTE__'), name);
  }
});

test('node names are unique', () => {
  assert.equal(new Set(wf.nodes.map(n => n.name)).size, wf.nodes.length);
});

test('a missing per-machine config explains how to create it', () => {
  assert.throws(() => buildWorkflow('does-not-exist'), /config\/local\.example\.json/);
});

test('every branch that takes inventory feeds Collect Inventory Changes', () => {
  for (const name of ['Rules: Early Check-In', 'Rules: Late Check-Out', 'Rules: Room Upgrade']) {
    assert.ok(wf.connections[name].main[0].some(l => l.node === 'Collect Inventory Changes'), name);
  }
});

test('the Manual Review reason expression matches rules.js', () => {
  const { fixedDecisionReason } = loadModules(['time', 'text', 'reference', 'rules']);
  const expr = node('Decision: Manual Review').parameters.assignments.assignments
    .find(a => a.name === 'decision_reason').value.replace(/^=\{\{([\s\S]*)\}\}$/, '$1');
  const evaluate = $json => new Function('$json', `return (${expr});`)($json);
  for (const item of [{ request_type: 'Spa Booking', category: 'spa' }, { request_type: 'Valet', category: 'other' }, { request_type: 'Valet', category: '' }]) {
    assert.equal(evaluate(item), fixedDecisionReason('other', item), item.category);
  }
});

test('the canvas carries the three Track C answers', () => {
  const answers = {
    'Note: Q1 Routing': ['Route by Category', 'HotelPolicies', 'decision_code'],
    'Note: Q2 Edge cases': ['duplicate', 'active_holds', 'INVENTORY_INCOMPLETE'],
    'Note: Q3 Impact and scale': ['PMS', 'RoomInventory'],
  };
  for (const [name, terms] of Object.entries(answers)) {
    const note = node(name);
    assert.ok(note, name);
    for (const term of terms) assert.ok(note.parameters.content.includes(term), `${name}: ${term}`);
  }
});

test('inventory writes add up holds from every branch, even when Collect runs once per branch', () => {
  const late = [{ inventory_changes: [{ inventory_key: '2026-11-08|Penthouse Suite', field: 'active_holds', delta: 1 }] }];
  const upgrade = [{ inventory_changes: [{ inventory_key: '2026-11-08|Penthouse Suite', field: 'active_holds', delta: 1 }] }];
  const outputs = { 'Read Room Inventory': readSheet('RoomInventory'), 'Rules: Late Check-Out': late };
  // like n8n: an unexecuted node reports isExecuted false and throws on all()
  const collect = ran => {
    const $ = name => ({
      isExecuted: name in ran,
      all: () => { if (!(name in ran)) throw new Error(`Referenced node is unexecuted: ${name}`); return ran[name].map(json => ({ json })); },
    });
    return new Function('$', '$input', node('Collect Inventory Changes').parameters.jsCode)($, { all: () => [] }).map(i => i.json);
  };
  assert.deepEqual(collect(outputs), [{ inventory_key: '2026-11-08|Penthouse Suite', active_holds: 1 }]);
  assert.deepEqual(collect({ ...outputs, 'Rules: Room Upgrade': upgrade }), [{ inventory_key: '2026-11-08|Penthouse Suite', active_holds: 2 }]);
});

test('Collect Inventory Changes does not hide a failed read of a branch that ran', () => {
  const $ = name => ({ isExecuted: true, all: () => { if (name.startsWith('Rules')) throw new Error('read failed'); return readSheet('RoomInventory').map(json => ({ json })); } });
  assert.throws(() => new Function('$', '$input', node('Collect Inventory Changes').parameters.jsCode)($, { all: () => [] }), /read failed/);
});

test('Rules: Room Upgrade sees the holds Rules: Late Check-Out took earlier in the run', () => {
  const upgrade = { request_id: 'T-UPG', route: 'room_upgrade', category: 'room_upgrade', request_type: 'Room Upgrade',
    confirmation_number: 'HTL-7777', room_type: 'Standard Queen', check_in_date: '2026-11-08', check_out_date: '2026-11-09',
    request_details: 'Please upgrade us to the Penthouse Suite.', priority: 'NORMAL' };
  const ran = {
    'Read Hotel Policies': readSheet('HotelPolicies'), 'Read Room Inventory': readSheet('RoomInventory'), 'Read Request Catalog': readSheet('RequestCatalog'),
    'Rules: Late Check-Out': [{ inventory_changes: [{ inventory_key: '2026-11-08|Penthouse Suite', field: 'active_holds', delta: 1 }] }],
  };
  const $ = name => ({
    isExecuted: name in ran,
    all: () => { if (!(name in ran)) throw new Error(`Referenced node is unexecuted: ${name}`); return ran[name].map(json => ({ json })); },
  });
  const [out] = new Function('$', '$input', node('Rules: Room Upgrade').parameters.jsCode)($, { all: () => [{ json: upgrade }] });
  assert.equal(out.json.decision_code, 'UPGRADE_UNAVAILABLE');
});

test('rules nodes that take no holds never read the hold branches', () => {
  for (const name of ['Rules: Early Check-In', 'Rules: Room Preference', 'Rules: Service Request', 'Rules: Pet Stay', 'Rules: Special Care']) {
    const $ = n => {
      if (n.startsWith('Rules')) throw new Error(`${name} read ${n}`);
      return { all: () => readSheet({ 'Read Hotel Policies': 'HotelPolicies', 'Read Room Inventory': 'RoomInventory', 'Read Request Catalog': 'RequestCatalog' }[n]).map(json => ({ json })) };
    };
    assert.doesNotThrow(() => new Function('$', '$input', node(name).parameters.jsCode)($, { all: () => [] }), name);
  }
});

// ---- Notion staff board mirror (optional, blueprint v2 §17) ----

// a config object with the Notion mirror switched off
const withoutNotion = env => ({ ...JSON.parse(readFileSync(new URL(`../config/${env}.json`, import.meta.url), 'utf8')), notion: { databaseId: '' } });

const notionNodes = ['Prepare Notion Payload', 'Find Notion Page', 'Pick Notion Page', 'Existing Notion Page?',
  'Update Notion Card', 'Create Notion Card', 'Notion Synced', 'Notion Failed', 'Store Notion Sync Outcome'];

test('the Notion mirror hangs off the final audit and is left out until a database id is configured', () => {
  for (const name of notionNodes) assert.ok(node(name), name);
  assert.equal(wf.connections['Update Request Log'].main[0][0].node, 'Prepare Notion Payload');
  const off = buildWorkflow(withoutNotion('cloud'));
  assert.ok(!off.nodes.some(n => notionNodes.includes(n.name)), 'no Notion nodes without a database id');
  assert.equal(off.connections['Update Request Log'], undefined);
});

test('Notion calls are best-effort: errors go to Notion Failed, never back into Calendar or Gmail', () => {
  for (const name of ['Find Notion Page', 'Update Notion Card', 'Create Notion Card']) {
    const n = node(name);
    assert.equal(n.onError, 'continueErrorOutput', name);
    assert.equal(n.retryOnFail, true, name);
    assert.equal(n.credentials.notionApi.name, 'Notion (StayFlow)', name);
    assert.equal(n.parameters.nodeCredentialType, 'notionApi', name);
    assert.equal(wf.connections[name].main[1][0].node, 'Notion Failed', name);
  }
  // nothing downstream of the Notion branch can reach a guest-facing node again
  const seen = new Set();
  const walk = name => { if (seen.has(name)) return; seen.add(name); for (const out of wf.connections[name]?.main || []) for (const l of out) walk(l.node); };
  walk('Prepare Notion Payload');
  for (const name of ['Create Staff Task', 'Send Guest Email', 'Update Room Inventory', 'Log Request', 'Update Request Log']) {
    assert.ok(!seen.has(name), `${name} is reachable from the Notion branch`);
  }
});

test('the Notion lookup queries the configured database by Request ID and updates or creates by what it found', () => {
  assert.equal(node('Find Notion Page').parameters.url, '=https://api.notion.com/v1/databases/YOUR_NOTION_DATABASE_ID/query');
  assert.equal(node('Update Notion Card').parameters.method, 'PATCH');
  assert.match(node('Update Notion Card').parameters.url, /\/v1\/pages\/\{\{ \$json\.notion_page_id \}\}$/);
  assert.equal(node('Create Notion Card').parameters.method, 'POST');
  assert.equal(wf.connections['Existing Notion Page?'].main[0][0].node, 'Update Notion Card');
  assert.equal(wf.connections['Existing Notion Page?'].main[1][0].node, 'Create Notion Card');
  assert.ok(node('Prepare Notion Payload').parameters.jsCode.includes('"YOUR_NOTION_DATABASE_ID"'));
});

test('the Notion outcome is written back as a request_id upsert of the full log row', () => {
  const store = node('Store Notion Sync Outcome');
  assert.equal(store.parameters.operation, 'appendOrUpdate');
  assert.deepEqual(store.parameters.columns.matchingColumns, ['request_id']);
  const columns = store.parameters.columns.schema.map(c => c.id);
  for (const c of ['notion_page_id', 'notion_sync_status', 'notion_last_synced_at', 'status', 'email_status']) assert.ok(columns.includes(c), c);
});

test('the Notion resync is its own workflow that retries rows not yet SYNCED', async () => {
  const { buildNotionResyncWorkflow } = await import('../scripts/build-workflow.mjs');
  const resync = buildNotionResyncWorkflow('local.example');
  const names = resync.nodes.map(n => n.name);
  for (const name of ['Read Request Log', 'Select Rows to Resync', ...notionNodes]) assert.ok(names.includes(name), name);
  assert.ok(!resync.nodes.some(n => ['n8n-nodes-base.gmail', 'n8n-nodes-base.googleCalendar'].includes(n.type)));
  assert.equal(buildNotionResyncWorkflow(withoutNotion('cloud')), null);
});

// ---- Excel report (optional, blueprint v2 §18) ----

test('the Excel report is a separate workflow behind an authenticated webhook', async () => {
  const { buildReportWorkflow } = await import('../scripts/build-workflow.mjs');
  const report = buildReportWorkflow('local.example');
  const r = name => report.nodes.find(n => n.name === name);
  const hook = r('Admin Export Request');
  assert.equal(hook.type, 'n8n-nodes-base.webhook');
  assert.equal(hook.parameters.authentication, 'headerAuth');
  assert.equal(hook.parameters.responseMode, 'responseNode');
  assert.equal(hook.credentials.httpHeaderAuth.name, 'StayFlow Report Key');
  assert.ok(!report.nodes.some(n => starter.nodes.some(s => s.name === n.name)), 'the organizer input stays in the judged workflow only');
  // read-only: no inventory or log writes, no calendar, and the only Gmail goes to staff
  assert.ok(!report.nodes.some(n => n.type === 'n8n-nodes-base.googleCalendar'));
  assert.ok(!report.nodes.some(n => n.type === 'n8n-nodes-base.googleSheets' && n.parameters.operation));
  assert.equal(r('Email Report').parameters.sendTo, 'your.google.account@gmail.com');
  const xlsx = r('Convert to XLSX');
  assert.equal(xlsx.parameters.operation, 'xlsx');
  assert.equal(xlsx.parameters.options.sheetName, 'Guest Requests');
  const respond = r('Respond With XLSX');
  assert.equal(respond.parameters.respondWith, 'binary');
  const headers = Object.fromEntries(respond.parameters.options.responseHeaders.entries.map(e => [e.name, e.value]));
  assert.equal(headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.match(headers['Content-Disposition'], /^=attachment; filename="\{\{/);
});

test('report control items never reach Convert to XLSX', async () => {
  const { buildReportWorkflow } = await import('../scripts/build-workflow.mjs');
  const report = buildReportWorkflow('local.example');
  const outputs = report.connections['Report Result'].main;
  assert.equal(outputs.length, 2);
  assert.equal(outputs[0][0].node, 'Webhook Request? (Message)');
  assert.equal(outputs[1][0].node, 'Convert to XLSX');
  assert.equal(report.connections['Range Valid?'].main[1][0].node, 'Webhook Request? (Message)');
});

test('every workflow is wired to real nodes and its Code nodes parse', async () => {
  const { buildReportWorkflow, buildNotionResyncWorkflow } = await import('../scripts/build-workflow.mjs');
  for (const w of [wf, buildReportWorkflow('local.example'), buildNotionResyncWorkflow('local.example')]) {
    const names = new Set(w.nodes.map(n => n.name));
    assert.equal(names.size, w.nodes.length, `${w.name}: node names are unique`);
    for (const [source, { main }] of Object.entries(w.connections)) {
      assert.ok(names.has(source), source);
      for (const out of main) for (const l of out) assert.ok(names.has(l.node), `${w.name}: ${l.node}`);
    }
    for (const n of w.nodes.filter(x => x.type === 'n8n-nodes-base.code')) assert.doesNotThrow(() => new Function(n.parameters.jsCode), n.name);
  }
});
