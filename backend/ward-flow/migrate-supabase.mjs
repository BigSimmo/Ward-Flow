// @ts-check
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { readSupabaseDatabaseConfig, validateSupabaseDatabaseUrl } from "./supabase-config.mjs";
import { createSupabaseMigrationPool } from "./supabase-postgres.mjs";
import { migrate } from "./migrate.mjs";
import { verifyPostgresNamespace } from "./postgres-preflight.mjs";

export function readSupabaseMigrationConfig(env = process.env) {
  const runtime = readSupabaseDatabaseConfig(env);
  let connectionString;
  try {
    connectionString = validateSupabaseDatabaseUrl(env.WARD_SUPABASE_MIGRATION_DATABASE_URL, {
      runtime: false,
    });
  } catch {
    throw new Error("Migration and runtime targets must match with separate identities");
  }
  const target = new URL(connectionString);
  const app = new URL(runtime.connectionString);
  if (
    target.hostname !== app.hostname ||
    (target.port || "5432") !== (app.port || "5432") ||
    target.pathname !== app.pathname ||
    decodeURIComponent(target.username) === decodeURIComponent(app.username)
  )
    throw new Error("Migration and runtime targets must match with separate identities");
  return {
    connectionString,
    ...(runtime.caCertificateFile ? { caCertificateFile: runtime.caCertificateFile } : {}),
  };
}

export async function migrateSupabasePostgres(pool) {
  await verifyPostgresNamespace(pool);
  const grants = await readFile(new URL("./infra/supabase-runtime-role.sql", import.meta.url), "utf8");
  // The grants commit in migrate()'s transaction, so a refused grant leaves the ledger unchanged and
  // the running backend never sees tables it cannot read.
  await migrate(pool, {
    afterMigrations: async (client) => {
      await client.query(grants);
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    pool = createSupabaseMigrationPool(readSupabaseMigrationConfig());
    await migrateSupabasePostgres(pool);
    console.log("Ward Flow Supabase schema and restricted grants applied; set the runtime password privately");
  } catch (error) {
    const safeReasons = new Set([
      "Unapproved Supabase project configuration",
      "Invalid shared database configuration",
      "Unapproved shared database target or runtime role",
      "Migration and runtime targets must match with separate identities",
      "Invalid database CA certificate configuration",
      "Unrecognised or unsafe Ward Flow database namespace",
      "Unsupported database migration version",
    ]);
    const reason = safeReasons.has(error?.message) ? `: ${error.message}` : "";
    console.error(
      `Supabase migration refused or unavailable; inspect the private administrator configuration${reason}`,
    );
    process.exitCode = 1;
  } finally {
    try {
      await pool?.end();
    } catch {
      console.error("Supabase migration connection cleanup unavailable");
      process.exitCode = 1;
    }
  }
}
