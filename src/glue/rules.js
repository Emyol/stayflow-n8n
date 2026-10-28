// n8n glue for "Rules: …" nodes (run once for all items). __ROUTE__ is
// replaced with the Switch output this node sits on.
var rows = function (nodeName) {
  return $(nodeName).all().map(function (item) { return item.json; });
};
// the two hold-taking branches read the holds the other took earlier in this run; a branch
// with no requests never executes, any other read failure stops the run
var HOLD_BRANCHES = { late_checkout: 'Rules: Late Check-Out', room_upgrade: 'Rules: Room Upgrade' };
var earlier = [];
Object.keys(HOLD_BRANCHES).forEach(function (route) {
  if (!HOLD_BRANCHES['__ROUTE__'] || route === '__ROUTE__') return;
  var name = HOLD_BRANCHES[route];
  try {
    earlier = earlier.concat(rows(name));
  } catch (error) {
    if ($(name).isExecuted !== false) throw error;
  }
});
var ctx = {
  policies: buildPolicies(rows('Read Hotel Policies')),
  inventory: buildInventory(rows('Read Room Inventory')),
  catalog: buildCatalog(rows('Read Request Catalog')),
  priorHolds: heldRooms(earlier),
  now: new Date(),
};
var items = $input.all().map(function (item) { return item.json; });
return decideBatch('__ROUTE__', items, ctx).map(function (json, i) {
  return { json: json, pairedItem: { item: i } };
});
