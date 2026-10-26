// n8n glue for "Plan Staff Task & Email" (run once for all items).
var rows = function (nodeName) {
  return $(nodeName).all().map(function (item) { return item.json; });
};
var ctx = {
  policies: buildPolicies(rows('Read Hotel Policies')),
  inventory: buildInventory(rows('Read Room Inventory')),
  catalog: buildCatalog(rows('Read Request Catalog')),
  now: new Date(),
};
return $input.all().map(function (item, i) {
  return { json: planActions(item.json, ctx), pairedItem: { item: i } };
});
