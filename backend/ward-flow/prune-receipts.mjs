// @ts-check
import { pathToFileURL } from "node:url";
import { readMigrationConfig } from "./migrate-postgres.mjs";
import { readSupabaseMigrationConfig } from "./migrate-supabase.mjs";
import { createPortableMigrationPool } from "./portable-postgres.mjs";
import { verifyPostgresNamespace } from "./postgres-preflight.mjs";
import { APPROVED_SUPABASE_PROJECT, validateSupabaseDatabaseUrl } from "./supabase-config.mjs";
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

/**
 * The same clean-up through the `wardflow_pruner` login (infra/supabase-prune-role.sql), which may
 * only call `ward_flow_ops.prune_receipts`: the function fixes the 7 days and removes at most 5,000
 * rows a call. For the scheduled workflow, so it never holds the migration identity.
 */
export async function pruneReceiptsAsPruner(pool) {
  let removed = 0;
  for (;;) {
    const { rows } = await pool.query("SELECT ward_flow_ops.prune_receipts($1) AS removed", [BATCH]);
    const step = Number(rows[0]?.removed ?? 0);
    removed += step;
    if (step < BATCH) return removed;
  }
}

/**
 * The pruner login's connection, from WARD_SUPABASE_PRUNE_DATABASE_URL: the approved project and the
 * `wardflow_pruner` login only (direct, or through the pooler as `wardflow_pruner.<project>`).
 */
export function readSupabasePrunerConfig(env = process.env) {
  const connectionString = validateSupabaseDatabaseUrl(env.WARD_SUPABASE_PRUNE_DATABASE_URL, { runtime: false });
  const user = decodeURIComponent(new URL(connectionString).username);
  if (user !== "wardflow_pruner" && user !== `wardflow_pruner.${APPROVED_SUPABASE_PROJECT}`)
    throw new Error("Receipt pruning needs the wardflow_pruner login");
  return {
    connectionString,
    ...(env.WARD_SUPABASE_CA_CERT_FILE?.trim() ? { caCertificateFile: env.WARD_SUPABASE_CA_CERT_FILE.trim() } : {}),
  };
}

/** The pool for the provider named on the command line: supabase, supabase-pruner or postgres. */
function prunePool(provider) {
  if (provider === "supabase") return createSupabaseMigrationPool(readSupabaseMigrationConfig());
  if (provider === "supabase-pruner") return createSupabaseMigrationPool(readSupabasePrunerConfig());
  if (provider === "postgres") return createPortableMigrationPool(readMigrationConfig());
  throw new Error("Name the provider: supabase, supabase-pruner or postgres");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    const provider = process.argv[2];
    pool = prunePool(provider);
    let removed;
    if (provider === "supabase-pruner") removed = await pruneReceiptsAsPruner(pool);
    else {
      await verifyPostgresNamespace(pool);
      removed = await pruneReceipts(pool);
    }
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
