import { Pool } from "pg";
import { validateSupabaseDatabaseUrl } from "./supabase-config.mjs";
import { readDatabaseCA, verifyRuntimeRole } from "./portable-postgres.mjs";

export function createSupabasePool(config, dependencies = {}) {
  return createVerifiedSupabasePool(config, dependencies, true);
}

// Only the separately invoked administrator migration CLI uses this factory.
// Runtime configuration cannot toggle the application's role validation.
export function createSupabaseMigrationPool(config, dependencies = {}) {
  return createVerifiedSupabasePool(config, dependencies, false);
}

function createVerifiedSupabasePool(config, dependencies, runtime) {
  const connectionString = validateSupabaseDatabaseUrl(config.connectionString, { runtime });
  const ca = readDatabaseCA(config.caCertificateFile);
  const PoolClass = dependencies.Pool ?? Pool;
  const pool = new PoolClass({
    connectionString,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 4,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 12000,
    idle_in_transaction_session_timeout: 10000,
    lock_timeout: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: runtime ? "wardflow_backend" : "wardflow_migrate",
  });
  pool.on("error", () => console.error("Ward Flow database connection unavailable"));
  return pool;
}

export async function verifySupabaseRuntimeRole(pool, config = {}) {
  return verifyRuntimeRole(
    pool,
    "wardflow_backend",
    config.pushEnabled,
    "Supabase database runtime verification unavailable",
    "Unsafe or unprepared Supabase database runtime",
  );
}
