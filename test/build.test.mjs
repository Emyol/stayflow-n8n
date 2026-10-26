import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWorkflow } from '../scripts/build-workflow.mjs';

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

test('reference reads run once and the log read tolerates an empty tab', () => {
  for (const name of ['Read Request Catalog', 'Read Hotel Policies', 'Read Room Inventory', 'Read Request Log']) {
    assert.equal(node(name).executeOnce, true, name);
  }
  assert.equal(node('Read Request Log').alwaysOutputData, true);
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
