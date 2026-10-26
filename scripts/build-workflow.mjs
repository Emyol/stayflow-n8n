// Builds the StayFlow n8n workflow JSON from src/ modules.
// Usage: npm run build -- local|cloud   →   dist/stayflow-<env>.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { concatModules, loadModules } from './lib/modules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const readGlue = name => readFileSync(join(ROOT, 'src', 'glue', `${name}.js`), 'utf8');

const { FIELD_MAP, FIXED_DECISIONS } = loadModules(['time', 'text', 'reference', 'intake', 'rules']);

const LOG_COLUMNS = readFileSync(join(ROOT, 'sheets', 'GuestRequests.csv'), 'utf8').trim().split(',');
const INVENTORY_COLUMNS = ['inventory_key', 'date', 'room_type', 'total_rooms', 'reserved_rooms', 'blocked_rooms', 'active_holds', 'early_ready_rooms'];

const ROUTES = [
  ['invalid', 'Decision: Invalid'],
  ['duplicate', 'Decision: Duplicate'],
  ['early_checkin', 'Rules: Early Check-In'],
  ['late_checkout', 'Rules: Late Check-Out'],
  ['room_upgrade', 'Rules: Room Upgrade'],
  ['room_preference', 'Rules: Room Preference'],
  ['service_request', 'Rules: Service Request'],
  ['pet_stay', 'Rules: Pet Stay'],
  ['special_care', 'Rules: Special Care'],
  ['other', 'Decision: Manual Review'],
];

const DECISION_REASONS = {
  invalid: "={{ $json.validation_errors.join('; ') }}",
  duplicate: "={{ 'Same booking and request type as ' + $json.duplicate_of }}",
  other: "={{ 'Request type \"' + $json.request_type + '\" is not in the request catalog' }}",
};

// Stable ids so rebuilding and re-importing does not churn the workflow.
function stableId(name) {
  const h = createHash('md5').update(`stayflow:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function codeNode(name, position, modules, glue, extraHeader = '') {
  const jsCode = [
    `// StayFlow: ${name}. Generated from src/ by scripts/build-workflow.mjs; edit the source, not this node.`,
    extraHeader,
    modules.length ? concatModules(modules) : '',
    glue,
  ].filter(Boolean).join('\n');
  return { name, type: 'n8n-nodes-base.code', typeVersion: 2, position, parameters: { jsCode } };
}

function eachItemCode(name, position, jsCode) {
  return { name, type: 'n8n-nodes-base.code', typeVersion: 2, position, parameters: { mode: 'runOnceForEachItem', jsCode } };
}

function condition(leftValue, operator, rightValue = '') {
  return {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: stableId(`${leftValue}${operator.operation}${rightValue}`), leftValue, rightValue, operator }],
    combinator: 'and',
  };
}

function ifNode(name, position, leftValue, operator, rightValue) {
  return { name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
    parameters: { conditions: condition(leftValue, operator, rightValue), options: {} } };
}

function setNode(name, position, assignments, includeOtherFields) {
  return {
    name, type: 'n8n-nodes-base.set', typeVersion: 3.4, position,
    parameters: {
      assignments: { assignments: assignments.map(([field, value]) => ({ id: stableId(`${name}:${field}`), name: field, value, type: 'string' })) },
      includeOtherFields,
      options: {},
    },
  };
}

function sheetLocator(config, tab) {
  return {
    authentication: 'oAuth2',
    documentId: { __rl: true, value: config.spreadsheetId, mode: 'id' },
    sheetName: { __rl: true, value: tab, mode: 'name' },
  };
}

function sheetSchema(columns) {
  return columns.map(id => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }));
}

function readNode(name, position, config, tab) {
  return { name, type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position, executeOnce: true,
    parameters: { ...sheetLocator(config, tab), options: {} } };
}

function upsertLogNode(name, position, config) {
  return {
    name, type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position,
    parameters: {
      operation: 'appendOrUpdate',
      ...sheetLocator(config, 'GuestRequests'),
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['request_id'], schema: sheetSchema(LOG_COLUMNS) },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' },
    },
  };
}

function sticky(name, position, width, height, content, color) {
  return { name, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position, parameters: { content, width, height, color } };
}

const isString = { type: 'string', operation: 'equals' };
const isTrue = { type: 'boolean', operation: 'true', singleValue: true };

export function buildWorkflow(env) {
  const config = readJson(`config/${env}.json`);
  const starter = readJson('fixtures/organizer-starter-template.json');
  const [trigger, http] = starter.nodes;
  const branchY = i => 300 + (i - 4.5) * 140;
  const rulesModules = ['time', 'text', 'reference', 'rules'];

  const nodes = [
    sticky('Note: Intake', [-60, 140], 900, 320, '## Intake\nOrganizer HTTP Request (unchanged), split into one item per guest request, then flattened by a Set node.', 7),
    sticky('Note: Reference data', [860, 140], 860, 320, '## Reference data\nPolicies, request catalog, room inventory and the request log, read once per run from Google Sheets.', 5),
    sticky('Note: Rules', [1720, -460], 920, 1520, '## Rules\nValidate, de-duplicate and classify, then route by category. Each branch applies the hotel policy and inventory rules for that request type.', 4),
    sticky('Note: Inventory', [2680, -460], 520, 320, '## Inventory\nConfirmed early check-ins and upgrade holds are written back to RoomInventory.', 3),
    sticky('Note: Actions', [2680, -60], 2000, 520, '## Actions\nPlan the staff task and guest email, log the request, create the Calendar task, send the Gmail. Failures go to their own branch and are recorded, never hidden.', 6),
    sticky('Note: Audit', [4700, -60], 300, 520, '## Audit\nFinal delivery status written back to GuestRequests.', 2),
    { ...trigger, position: [0, 300] },
    { ...http, position: [220, 300] },
    { name: 'Split Out Submissions', type: 'n8n-nodes-base.splitOut', typeVersion: 1, position: [440, 300],
      parameters: { fieldToSplitOut: 'submissions', options: {} } },
    setNode('Normalize Fields', [660, 300],
      FIELD_MAP.map(([field, path]) => [field, `={{ String($json.${path.replace(/\./g, '?.')} ?? '').trim() }}`]), false),
    readNode('Read Request Catalog', [900, 300], config, 'RequestCatalog'),
    readNode('Read Hotel Policies', [1110, 300], config, 'HotelPolicies'),
    readNode('Read Room Inventory', [1320, 300], config, 'RoomInventory'),
    { ...readNode('Read Request Log', [1530, 300], config, 'GuestRequests'), alwaysOutputData: true },
    codeNode('Classify, Validate & Dedupe', [1760, 300], ['time', 'text', 'reference', 'intake'], readGlue('classify')),
    ifNode('New Request?', [1980, 300], '={{ $json.route }}', { type: 'string', operation: 'notEquals' }, 'already_processed'),
    { name: 'Already Processed: No Action', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [2200, 900], parameters: {} },
    {
      name: 'Route by Category', type: 'n8n-nodes-base.switch', typeVersion: 3.2, position: [2200, 300],
      parameters: {
        rules: { values: ROUTES.slice(0, 9).map(([route]) => ({
          conditions: condition('={{ $json.route }}', isString, route), renameOutput: true, outputKey: route,
        })) },
        options: { fallbackOutput: 'extra', renameFallbackOutput: 'other' },
      },
    },
    ...ROUTES.map(([route, name], i) => FIXED_DECISIONS[route]
      ? setNode(name, [2460, branchY(i)], [
        ['status', FIXED_DECISIONS[route].status],
        ['decision_code', FIXED_DECISIONS[route].decision_code],
        ['staff_action', FIXED_DECISIONS[route].staff_action],
        ['decision_reason', DECISION_REASONS[route]],
      ], true)
      : codeNode(name, [2460, branchY(i)], rulesModules, readGlue('rules').replaceAll('__ROUTE__', route))),
    codeNode('Collect Inventory Changes', [2740, -300], ['reference', 'inventory'], readGlue('inventory')),
    { name: 'Update Room Inventory', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [2960, -300],
      parameters: {
        operation: 'update',
        ...sheetLocator(config, 'RoomInventory'),
        columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['inventory_key'], schema: sheetSchema(INVENTORY_COLUMNS) },
        options: { handlingExtraData: 'ignoreIt' },
      } },
    codeNode('Plan Staff Task & Email', [2740, 200], ['time', 'text', 'reference', 'email', 'plan'], readGlue('plan')),
    upsertLogNode('Log Request', [2960, 200], config),
    eachItemCode('Carry Plan Forward', [3180, 200], "return { json: $('Plan Staff Task & Email').item.json };"),
    ifNode('Needs Staff Task?', [3400, 200], '={{ $json.calendar_needed }}', isTrue),
    {
      name: 'Create Staff Task', type: 'n8n-nodes-base.googleCalendar', typeVersion: 1.3, position: [3620, 100],
      onError: 'continueErrorOutput',
      parameters: {
        calendar: { __rl: true, value: config.calendarId, mode: 'id' },
        start: '={{ $json.calendar_start }}',
        end: '={{ $json.calendar_end }}',
        additionalFields: { summary: '={{ $json.calendar_summary }}', description: '={{ $json.calendar_description }}' },
      },
    },
    eachItemCode('Calendar Created', [3840, 20],
      "return { json: Object.assign({}, $('Needs Staff Task?').item.json, { calendar_status: 'CREATED', calendar_event_id: $json.id || '' }) };"),
    eachItemCode('Calendar Failed', [3840, 180],
      "return { json: Object.assign({}, $('Needs Staff Task?').item.json, { calendar_status: 'FAILED', calendar_event_id: '' }) };"),
    ifNode('Send Guest Email?', [4060, 200], '={{ $json.email_needed }}', isTrue),
    {
      name: 'Send Guest Email', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [4280, 100],
      onError: 'continueErrorOutput',
      parameters: {
        sendTo: '={{ $json.email_to }}',
        subject: '={{ $json.email_subject }}',
        emailType: 'html',
        message: '={{ $json.email_html }}',
        options: { appendAttribution: false, senderName: '={{ $json.sender_name }}' },
      },
    },
    eachItemCode('Email Sent', [4500, 20],
      "var now = new Date().toISOString();\nreturn { json: Object.assign({}, $('Send Guest Email?').item.json, { email_status: 'SENT', email_sent_at: now, last_updated_at: now }) };"),
    eachItemCode('Email Failed', [4500, 180],
      "return { json: Object.assign({}, $('Send Guest Email?').item.json, { email_status: 'FAILED', email_sent_at: '', last_updated_at: new Date().toISOString() }) };"),
    upsertLogNode('Update Request Log', [4780, 200], config),
  ];

  const credentialFor = {
    'n8n-nodes-base.googleSheets': 'googleSheetsOAuth2Api',
    'n8n-nodes-base.googleCalendar': 'googleCalendarOAuth2Api',
    'n8n-nodes-base.gmail': 'gmailOAuth2',
  };
  for (const node of nodes) {
    node.id = node.id || stableId(node.name);
    const credType = credentialFor[node.type];
    if (credType) node.credentials = { [credType]: { ...config.credentials[credType] } };
  }

  const links = {};
  const link = (source, target, output = 0) => {
    const main = (links[source] ??= { main: [] }).main;
    while (main.length <= output) main.push([]);
    main[output].push({ node: target, type: 'main', index: 0 });
  };
  link(trigger.name, http.name);
  link(http.name, 'Split Out Submissions');
  link('Split Out Submissions', 'Normalize Fields');
  link('Normalize Fields', 'Read Request Catalog');
  link('Read Request Catalog', 'Read Hotel Policies');
  link('Read Hotel Policies', 'Read Room Inventory');
  link('Read Room Inventory', 'Read Request Log');
  link('Read Request Log', 'Classify, Validate & Dedupe');
  link('Classify, Validate & Dedupe', 'New Request?');
  link('New Request?', 'Route by Category', 0);
  link('New Request?', 'Already Processed: No Action', 1);
  ROUTES.forEach(([, name], i) => {
    link('Route by Category', name, i);
    link(name, 'Plan Staff Task & Email');
  });
  link('Rules: Early Check-In', 'Collect Inventory Changes');
  link('Rules: Room Upgrade', 'Collect Inventory Changes');
  link('Collect Inventory Changes', 'Update Room Inventory');
  link('Plan Staff Task & Email', 'Log Request');
  link('Log Request', 'Carry Plan Forward');
  link('Carry Plan Forward', 'Needs Staff Task?');
  link('Needs Staff Task?', 'Create Staff Task', 0);
  link('Needs Staff Task?', 'Send Guest Email?', 1);
  link('Create Staff Task', 'Calendar Created', 0);
  link('Create Staff Task', 'Calendar Failed', 1);
  link('Calendar Created', 'Send Guest Email?');
  link('Calendar Failed', 'Send Guest Email?');
  link('Send Guest Email?', 'Send Guest Email', 0);
  link('Send Guest Email?', 'Update Request Log', 1);
  link('Send Guest Email', 'Email Sent', 0);
  link('Send Guest Email', 'Email Failed', 1);
  link('Email Sent', 'Update Request Log');
  link('Email Failed', 'Update Request Log');

  const workflow = {
    name: 'StayFlow | Track C | Guest Request Automation',
    nodes,
    connections: links,
    settings: { executionOrder: 'v1', timezone: 'Asia/Manila', saveManualExecutions: true, availableInMCP: true },
    pinData: {},
    active: false,
  };
  if (config.workflowId) workflow.id = config.workflowId;
  return workflow;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.argv[2] || 'local';
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  const out = join(ROOT, 'dist', `stayflow-${env}.json`);
  writeFileSync(out, JSON.stringify(buildWorkflow(env), null, 2));
  console.log(`wrote ${out}`);
}
