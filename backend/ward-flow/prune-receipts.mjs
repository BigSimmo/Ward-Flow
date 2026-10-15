// @ts-check
import { pathToFileURL } from "node:url";
import { readMigrationConfig } from "./migrate-postgres.mjs";
import { readSupabaseMigrationConfig } from "./migrate-supabase.mjs";
import { createPortableMigrationPool } from "./portable-postgres.mjs";
import { verifyPostgresNamespace } from "./postgres-preflight.mjs";
import { createSupabaseMigrationPool } from "./supabase-postgres.mjs";

/**
 * Command receipts make a retried command ID safe to resend. A browser retries within minutes, so
 * receipts older than this are only history; the append-only audit table keeps the record.
 */
export const RECEIPT_RETENTION_DAYS = 7;
const BATCH = 5_000;

/**
 * Deletes command receipts older than the retention window, in small batches so a save is never
 * held behind one long delete. The cutoff uses the database clock, which stamped the receipts, and
 * each workspace is pruned on its own so the (workspace, commit time) index serves the search. The
 * backend's runtime role cannot delete receipts (the runtime-role check refuses it), so this runs
 * with the migration identity. Returns the number removed.
 */
export async function pruneReceipts(pool, { days = RECEIPT_RETENTION_DAYS } = {}) {
  if (!Number.isInteger(days) || days < 1) throw new Error("Invalid receipt retention");
  const { rows: workspaces } = await pool.query("SELECT id FROM ward_flow.workspaces");
  let removed = 0;
  for (const { id } of workspaces) {
    for (;;) {
      const { rowCount } = await pool.query(
        "DELETE FROM ward_flow.commands WHERE ctid IN (SELECT ctid FROM ward_flow.commands WHERE workspace_id=$1 AND committed_at < now() - make_interval(days => $2) LIMIT $3)",
        [id, days, BATCH],
      );
      removed += rowCount ?? 0;
      if (!rowCount || rowCount < BATCH) break;
    }
  }
  return removed;
}

/** The migration pool for the provider named on the command line: supabase or postgres. */
function migrationPool(provider) {
  if (provider === "supabase") return createSupabaseMigrationPool(readSupabaseMigrationConfig());
  if (provider === "postgres") return createPortableMigrationPool(readMigrationConfig());
  throw new Error("Name the provider: supabase or postgres");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    pool = migrationPool(process.argv[2]);
    await verifyPostgresNamespace(pool);
    const removed = await pruneReceipts(pool);
    console.log(`Ward Flow command receipts older than ${RECEIPT_RETENTION_DAYS} days removed: ${removed}`);
  } catch {
    console.error("Receipt pruning refused or unavailable; inspect the private administrator configuration");
    process.exitCode = 1;
  } finally {
    try {
      await pool?.end();
    } catch {
      console.error("Receipt pruning connection cleanup unavailable");
      process.exitCode = 1;
    }
  }
}
