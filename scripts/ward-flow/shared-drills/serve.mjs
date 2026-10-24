// @ts-check
// Drill-only backend: the real request handler, PostgreSQL store, engine and sign-in check, in its
// own process so the drill can crash and restart it. The only stand-in is Supabase's published
// public-key list: the drill hands its own public key in, so no request leaves this machine.
// Loopback database only. Started by run.mts; not a deployment entry point.
import { createRequire } from "node:module";

const backend = new URL("../../../backend/ward-flow/", import.meta.url);
const { Pool } = createRequire(new URL("package.json", backend))("pg");
const { createHandler, listen } = await import(new URL("server.mjs", backend).href);
const { createSupabaseAuthenticator } = await import(new URL("supabase-auth.mjs", backend).href);
const { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } = await import(new URL("supabase-config.mjs", backend).href);
const { createWorkspaceStore } = await import(new URL("postgres.mjs", backend).href);
const engine = await import(new URL("dist/engine.mjs", backend).href);

const env = process.env;
const databaseUrl = String(env.DRILL_DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname))
  throw new Error("Drills run against a loopback database only");

// The production pool settings (portable-postgres.mjs), less TLS on loopback.
const pool = new Pool({
  connectionString: databaseUrl,
  max: 4,
  connectionTimeoutMillis: 6000,
  idleTimeoutMillis: 30000,
  statement_timeout: 10000,
  query_timeout: 12000,
  idle_in_transaction_session_timeout: 10000,
  lock_timeout: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  application_name: "wardflow_drill",
});
const write = (/** @type {Record<string, unknown>} */ entry) => process.stdout.write(`${JSON.stringify(entry)}\n`);
pool.on("error", () => write({ event: "drill_pool_error" }));

const config = {
  coordinatorIds: String(env.DRILL_COORDINATORS).split(","),
  origin: null,
  host: "127.0.0.1",
  port: Number(env.DRILL_PORT),
  supabase: {
    projectRef: APPROVED_SUPABASE_PROJECT,
    url: APPROVED_SUPABASE_URL,
    publishableKey: "synthetic-offline-only",
  },
};
const jwk = JSON.parse(String(env.DRILL_JWK));
const authenticate = createSupabaseAuthenticator(config, { fetch: async () => Response.json({ keys: [jwk] }) });
const sharedStore = createWorkspaceStore(pool, { workspaceId: env.DRILL_WORKSPACE_ID, engine });
const server = listen(createHandler({ config, sharedStore, authenticate, log: write }), config);
server.on("listening", () => write({ event: "drill_listening" }));
process.on("SIGTERM", () => {
  server.close();
  server.closeAllConnections();
  void pool.end().finally(() => process.exit(0));
});
