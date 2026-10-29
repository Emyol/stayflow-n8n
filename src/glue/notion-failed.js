// n8n glue for "Notion Failed" (run once for each item). The guest email and
// calendar task already happened; only the Notion columns record the failure.
return { json: notionSyncOutcome($('Prepare Notion Payload').item.json, '', false, new Date()) };
