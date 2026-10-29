// n8n glue for "Validate Report Range" (run once for all items).
// The webhook hands over { headers, query, body }; the manual trigger hands over
// an empty item, which reports the last 31 days by email.
var input = $input.first().json;
var fromWebhook = Boolean(input.headers);
var range = validateReportRange(fromWebhook ? Object.assign({}, input.query, input.body) : {}, new Date());
return [{ json: Object.assign(range, {
  delivery: fromWebhook ? 'download' : 'email',
  file_name: range.ok ? reportFileName(range.generated_on) : '',
}) }];
