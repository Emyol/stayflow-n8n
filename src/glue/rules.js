// n8n glue for "Rules: …" nodes (run once for all items). __ROUTE__ is
// replaced with the Switch output this node sits on.
var rows = function (nodeName) {
  return $(nodeName).all().map(function (item) { return item.json; });
};
var ctx = {
  policies: buildPolicies(rows('Read Hotel Policies')),
  inventory: buildInventory(rows('Read Room Inventory')),
  catalog: buildCatalog(rows('Read Request Catalog')),
  now: new Date(),
};
var items = $input.all().map(function (item) { return item.json; });
return decideBatch('__ROUTE__', items, ctx).map(function (json, i) {
  return { json: json, pairedItem: { item: i } };
});
