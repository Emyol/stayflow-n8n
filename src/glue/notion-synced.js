// n8n glue for "Notion Synced" (run once for each item). $json is the Notion page.
return { json: notionSyncOutcome($('Prepare Notion Payload').item.json, $json.id, true, new Date()) };
