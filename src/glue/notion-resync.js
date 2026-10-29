// n8n glue for "Select Rows to Resync" (run once for all items).
var rows = $input.all().map(function (item) { return item.json; });
return rowsToResync(rows).map(function (json) {
  return { json: json, pairedItem: { item: rows.indexOf(json) } };
});
