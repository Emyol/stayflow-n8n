// n8n glue for "Collect Inventory Changes" (run once for all items).
var inventory = buildInventory($('Read Room Inventory').all().map(function (item) { return item.json; }));
var items = $input.all().map(function (item) { return item.json; });
return collectInventoryChanges(items, inventory).map(function (json) { return { json: json }; });
