import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { removePathSync } from "../retryable-fs.mjs";

/** How many per-run evidence folders `run-playwright.mjs` keeps, counting the current run. */
export const KEPT_EVIDENCE_RUNS = 5;

// The runner names each evidence folder `${runId}-${randomUUID()}`, where runId is
// PLAYWRIGHT_BUILD_ROOT_ID ([a-z0-9-]+) or `${pid}-${Date.now()}`. Only folders that end
// in a v4-style UUID after such a prefix are eligible; anything else under
// test-results/ is never touched.
export const EVIDENCE_RUN_DIR_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Remove older per-run evidence folders under `resultsParent`, keeping the newest
 * `keep` (current run included). The current run's folder is never removed, nor is
 * anything that is not a real directory matching EVIDENCE_RUN_DIR_PATTERN.
 * Pruning is housekeeping: a folder that cannot be removed (for example a file held
 * open on Windows) is reported through `warn` and skipped, never failing the run.
 * Returns the removed folder names.
 */
export function pruneEvidenceRuns({
  resultsParent,
  currentRunDir,
  keep = KEPT_EVIDENCE_RUNS,
  remove = removePathSync,
  warn = (message) => console.warn(message),
}) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error(`keep must be a positive integer, got ${keep}`);
  const current = path.basename(currentRunDir);
  let names;
  try {
    names = readdirSync(resultsParent);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const others = [];
  for (const name of names) {
    if (name === current || !EVIDENCE_RUN_DIR_PATTERN.test(name)) continue;
    let stats;
    try {
      stats = lstatSync(path.join(resultsParent, name));
    } catch {
      continue;
    }
    if (!stats.isDirectory()) continue;
    others.push({ name, mtimeMs: stats.mtimeMs });
  }
  others.sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
  const removed = [];
  for (const { name } of others.slice(keep - 1)) {
    try {
      remove(path.join(resultsParent, name), { recursive: true, force: true });
      removed.push(name);
    } catch (error) {
      warn(`Could not prune old Playwright evidence folder ${name}: ${error?.message ?? error}`);
    }
  }
  return removed;
}
