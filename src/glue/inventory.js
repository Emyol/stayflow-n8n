// n8n glue for "Collect Inventory Changes" (run once for all items).
// n8n runs this node once per incoming branch, and each run writes absolute
// values, so it reads every rules branch that has run so far instead of
// $input. The last run then carries the full total and nothing is lost.
var inventory = buildInventory($('Read Room Inventory').all().map(function (item) { return item.json; }));
var items = [];
['Rules: Early Check-In', 'Rules: Late Check-Out', 'Rules: Room Upgrade'].forEach(function (name) {
  try {
    $(name).all().forEach(function (item) { items.push(item.json); });
  } catch (error) {
    // a branch with no requests this run never executes; any other failure stops the run
    if ($(name).isExecuted !== false) throw error;
  }
});
return collectInventoryChanges(items, inventory).map(function (json) { return { json: json }; });
