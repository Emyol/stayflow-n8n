// n8n glue for "Classify, Validate & Dedupe" (run once for all items).
var rows = function (nodeName) {
  return $(nodeName).all().map(function (item) { return item.json; });
};
var ref = {
  catalog: buildCatalog(rows('Read Request Catalog')),
  policies: buildPolicies(rows('Read Hotel Policies')),
  log: buildLogIndex(rows('Read Request Log')),
};
return classifyBatch(rows('Normalize Fields'), ref).map(function (json) { return { json: json }; });
