// Creates the private "Guest Request Board" database in Notion from
// NOTION_SCHEMA in src/notion.js, so the board matches what n8n writes.
// Usage: NOTION_TOKEN=<integration secret> node scripts/notion-setup.mjs <parent-page-id>
// Prints the new database id: put it in config/<env>.json → notion.databaseId.
import { loadModules } from './lib/modules.mjs';

const { NOTION_SCHEMA } = loadModules(['time', 'notion']);

// select options seeded with colours; Notion adds any other value on first write
const OPTIONS = {
  'Status': [['CONFIRMED', 'green'], ['ALTERNATIVE_OFFERED', 'yellow'], ['MANUAL_REVIEW', 'orange'], ['INVALID', 'red'], ['DUPLICATE', 'gray']],
  'Priority': [['High', 'red'], ['Normal', 'default']],
  'Email Delivery': [['SENT', 'green'], ['PENDING', 'yellow'], ['FAILED', 'red'], ['SKIPPED', 'gray']],
};

export function databaseBody(parentPageId) {
  const properties = {};
  for (const [name, type] of Object.entries(NOTION_SCHEMA)) {
    properties[name] = type === 'select'
      ? { select: { options: (OPTIONS[name] || []).map(([option, color]) => ({ name: option, color })) } }
      : { [type]: {} };
  }
  return {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Guest Request Board' } }],
    properties,
  };
}

async function main() {
  const [parent] = process.argv.slice(2);
  const token = process.env.NOTION_TOKEN;
  if (!parent || !token) {
    console.error('Usage: NOTION_TOKEN=<integration secret> node scripts/notion-setup.mjs <parent-page-id>');
    process.exit(1);
  }
  const base = (process.env.NOTION_API_BASE || 'https://api.notion.com').replace(/\/$/, '');
  const res = await fetch(`${base}/v1/databases`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(databaseBody(parent.replace(/-/g, '').slice(-32))),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`Notion said ${res.status}: ${body.message || JSON.stringify(body)}`);
    console.error('Check the page is shared with the integration (page ⋯ menu → Connections).');
    process.exit(1);
  }
  console.log(`Created "Guest Request Board": ${body.url || ''}`);
  console.log(`notion.databaseId = ${body.id}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
