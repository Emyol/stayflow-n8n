// Runs the same steps as the n8n workflow, in Node, for golden tests:
// normalize → classify → split off already processed → rules per route →
// plan actions → inventory writes from the early check-in, late check-out and upgrade branches.
import { loadModules } from '../../scripts/lib/modules.mjs';

const M = loadModules(['time', 'text', 'reference', 'intake', 'rules', 'email', 'plan', 'inventory']);

export function runPipeline({ submissions, sheets, now }) {
  const ctx = {
    policies: M.buildPolicies(sheets.policies),
    inventory: M.buildInventory(sheets.inventory),
    catalog: M.buildCatalog(sheets.catalog),
    now,
  };
  const classified = M.classifyBatch(submissions.map(M.normalizeSubmission), { ...ctx, log: M.buildLogIndex(sheets.log) });
  const alreadyProcessed = classified.filter(c => c.route === 'already_processed');
  const fresh = classified.filter(c => c.route !== 'already_processed');
  const routes = [...new Set(fresh.map(c => c.route))];
  const decidedByRoute = Object.fromEntries(routes.map(route =>
    [route, M.decideBatch(route, fresh.filter(c => c.route === route), ctx)]));
  const planned = Object.values(decidedByRoute).flat().map(item => M.planActions(item, ctx));
  const inventoryWrites = M.collectInventoryChanges(
    ['early_checkin', 'late_checkout', 'room_upgrade'].flatMap(route => decidedByRoute[route] || []), ctx.inventory);
  return { planned, alreadyProcessed, inventoryWrites };
}
