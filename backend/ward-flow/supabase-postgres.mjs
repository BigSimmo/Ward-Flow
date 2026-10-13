import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { validateSupabaseDatabaseUrl } from "./supabase-config.mjs";
import { verifyRuntimeRole } from "./portable-postgres.mjs";

export function createSupabasePool(config, dependencies = {}) {
  const PoolClass = dependencies.Pool ?? Pool;
  let ca;
  if (config.caCertificateFile) {
    ca = readFileSync(config.caCertificateFile, "utf8");
    if (!new X509Certificate(ca).ca) throw new Error("Database CA certificate required");
  }
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
