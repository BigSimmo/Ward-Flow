import { Pool } from "pg";
import { validateSupabaseDatabaseUrl } from "./supabase-config.mjs";
import { readDatabaseCA, verifyRuntimeRole } from "./portable-postgres.mjs";

export function createSupabasePool(config, dependencies = {}) {
  const PoolClass = dependencies.Pool ?? Pool;
  const ca = readDatabaseCA(config.caCertificateFile);
  const pool = new PoolClass({
    connectionString: validateSupabaseDatabaseUrl(config.connectionString),
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 4,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 12000,
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
