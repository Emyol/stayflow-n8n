// n8n glue for "Prepare Report Rows" (run once for all items).
var range = $('Validate Report Range').first().json;
var rows = $input.all().map(function (item) { return item.json; });
return prepareReportRows(rows, range).map(function (json) { return { json: json }; });
