// @ts-check
import { pathToFileURL } from "node:url";
import { readSupabaseMigrationConfig } from "./migrate-supabase.mjs";
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
 * held behind one long delete. The backend's runtime role cannot delete receipts (the runtime-role
 * check refuses it), so this runs with the migration identity. Returns the number removed.
 */
export async function pruneReceipts(pool, { now = new Date(), days = RECEIPT_RETENTION_DAYS } = {}) {
  if (!Number.isInteger(days) || days < 1) throw new Error("Invalid receipt retention");
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  let removed = 0;
  for (;;) {
    const { rowCount } = await pool.query(
      "DELETE FROM ward_flow.commands WHERE ctid IN (SELECT ctid FROM ward_flow.commands WHERE committed_at < $1 LIMIT $2)",
      [cutoff, BATCH],
    );
    removed += rowCount ?? 0;
    if (!rowCount || rowCount < BATCH) return removed;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    pool = createSupabaseMigrationPool(readSupabaseMigrationConfig());
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
