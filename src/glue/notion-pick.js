// n8n glue for "Pick Notion Page" (run once for each item).
// Only a page the query found is updated: a stored id that no longer matches
// a live card is stale, so the request gets a new card instead.
return { json: Object.assign({}, $('Prepare Notion Payload').item.json, { notion_page_id: foundNotionPage($json) }) };
