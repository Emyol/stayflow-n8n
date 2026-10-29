// n8n glue for "Prepare Notion Payload" (run once for all items).
// __NOTION_DATABASE_ID__ is replaced by the build from config notion.databaseId.
var syncedAt = new Date().toISOString();
return $input.all().map(function (item, i) {
  return { json: notionPayload(item.json, __NOTION_DATABASE_ID__, syncedAt), pairedItem: { item: i } };
});
