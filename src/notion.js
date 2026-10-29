// Notion "Guest Request Board": a read-only staff mirror of the GuestRequests
// log. Google Sheets stays the source of truth; nothing here decides a request.
// Depends on time.js.

// property name -> Notion property type; scripts/notion-setup.mjs creates the
// board from this, so the payload and the board cannot drift apart
var NOTION_SCHEMA = {
  'Request': 'title',
  'Request ID': 'rich_text',
  'Booking ID': 'rich_text',
  'Request Type': 'select',
  'Status': 'select',
  'Arrival Date': 'date',
  'Staff Action': 'rich_text',
  'Decision Reason': 'rich_text',
  'Priority': 'select',
  'Calendar Event ID': 'rich_text',
  'Email Delivery': 'select',
  'Last Sync': 'date',
};

var NOTION_TEXT_LIMIT = 2000;
var NOTION_PAYLOAD_KEYS = ['notion_query', 'notion_create', 'notion_update'];

function notionString(value) {
  return String(value == null ? '' : value).trim();
}

function notionText(value) {
  var text = notionString(value);
  return text ? [{ type: 'text', text: { content: text.slice(0, NOTION_TEXT_LIMIT) } }] : [];
}

function notionSelect(value) {
  // Notion rejects commas in select option names
  var name = notionString(value).replace(/,/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
  return { select: name ? { name: name } : null };
}

function notionDate(value) {
  var text = notionString(value);
  var valid = isIsoDate(text.slice(0, 10)) && (text.length === 10 || !isNaN(Date.parse(text)));
  return { date: valid ? { start: text } : null };
}

function notionProperties(row, syncedAt) {
  // guest email and free-text request details stay out of Notion on purpose
  return {
    'Request': { title: notionText(notionString(row.request_id) + ' — ' + notionString(row.request_type)) },
    'Request ID': { rich_text: notionText(row.request_id) },
    'Booking ID': { rich_text: notionText(row.confirmation_number) },
    'Request Type': notionSelect(row.request_type),
    'Status': notionSelect(row.status),
    'Arrival Date': notionDate(row.check_in_date),
    'Staff Action': { rich_text: notionText(row.staff_action) },
    'Decision Reason': { rich_text: notionText(row.decision_reason) },
    'Priority': notionSelect(row.priority === 'HIGH' ? 'High' : 'Normal'),
    'Calendar Event ID': { rich_text: notionText(row.calendar_event_id) },
    'Email Delivery': notionSelect(row.email_status),
    'Last Sync': notionDate(syncedAt),
  };
}

function notionLookupQuery(requestId) {
  return { filter: { property: 'Request ID', rich_text: { equals: notionString(requestId) } }, page_size: 1 };
}

function notionPayload(row, databaseId, syncedAt) {
  var properties = notionProperties(row, syncedAt);
  return Object.assign({}, row, {
    notion_page_id: notionString(row.notion_page_id),
    notion_query: notionLookupQuery(row.request_id),
    notion_create: { parent: { database_id: databaseId }, properties: properties },
    notion_update: { properties: properties },
  });
}

function foundNotionPage(response) {
  var results = (response && response.results) || [];
  for (var i = 0; i < results.length; i++) {
    if (results[i] && results[i].id && !results[i].archived && !results[i].in_trash) return results[i].id;
  }
  return '';
}

// the full log row goes back to GuestRequests so an upsert can never blank a column
function notionSyncOutcome(payload, pageId, ok, now) {
  var row = Object.assign({}, payload);
  NOTION_PAYLOAD_KEYS.forEach(function (key) { delete row[key]; });
  row.notion_page_id = ok ? notionString(pageId) : notionString(payload.notion_page_id);
  row.notion_sync_status = ok ? 'SYNCED' : 'FAILED';
  row.notion_last_synced_at = ok ? now.toISOString() : notionString(payload.notion_last_synced_at);
  return row;
}

function rowsToResync(rows) {
  return rows.filter(function (row) {
    return notionString(row.request_id) && notionString(row.status) && notionString(row.notion_sync_status) !== 'SYNCED';
  });
}
