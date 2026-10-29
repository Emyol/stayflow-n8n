// n8n glue for "Classify, Validate & Dedupe" (run once for all items).
var rows = function (nodeName) {
  return $(nodeName).all().map(function (item) { return item.json; });
};
var ref = {
  catalog: buildCatalog(rows('Read Request Catalog')),
  policies: buildPolicies(rows('Read Hotel Policies')),
  inventory: buildInventory(rows('Read Room Inventory')),
  log: buildLogIndex(rows('Read Request Log')),
};
// an empty tab would otherwise route every request to review or end the run with no output
var empty = emptyReferenceTabs(ref);
if (empty.length) {
  throw new Error('StayFlow reference tab(s) empty: ' + empty.join(', ') + '. Restore them in the StayFlow sheet, then re-run.');
}
return classifyBatch(rows('Normalize Fields'), ref).map(function (json) { return { json: json }; });
