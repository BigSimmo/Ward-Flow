// @ts-check
// Test-only helper for the compound drills (master audit list, 10 Nov 2026). Builds a disposable
// database on an isolated loopback PostgreSQL server, real backend HTTP servers on it, and offline
// signed sessions for synthetic coordinator accounts (an offline public JWKS, as in
// domain-undo-ordering.test.mjs). Never a hosted database. Synthetic data only.
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { once } from "node:events";
import { Pool } from "pg";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { LATEST_MIGRATION, MIGRATIONS, readMigration } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { createHandler, listen } from "./server.mjs";
import { createSupabaseAuthenticator } from "./supabase-auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";

export const drillDatabaseUrl = process.env.WARD_TEST_DATABASE_URL;
if (drillDatabaseUrl && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(drillDatabaseUrl).hostname))
  throw new Error("Compound drills require an isolated loopback PostgreSQL server");

/** Apply migrations 1..`upTo` in order, as migrate() would, so a drill can stop short of the latest. */
async function migrateTo(pool, upTo = LATEST_MIGRATION) {
  for (const migration of MIGRATIONS.filter((row) => row.version <= upTo))
    await pool.query(await readMigration(migration));
}

/**
 * @param {import("node:test").TestContext} t
 * @param {{ actors?: number, migrateTo?: number, at?: Date, poolMax?: number }} [options]
 */
export async function drillFixture(t, options = {}) {
  const engine = await import("./dist/engine.mjs");
  const admin = new Pool({ connectionString: drillDatabaseUrl, max: 1 });
  const databases = [];
  const pools = [];
  const servers = [];
  const at = options.at ?? new Date();
  t.after(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(() => resolve(undefined)))));
    await Promise.all(pools.map((pool) => pool.end().catch(() => {})));
    for (const database of databases) await dropTestDatabase(admin, database);
    await admin.end();
  });
  async function createDatabase(template) {
    const name = `wardflow_drill_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE ${name}${template ? ` TEMPLATE ${template}` : ""}`);
    databases.push(name);
    const target = new URL(/** @type {string} */ (drillDatabaseUrl));
    target.pathname = `/${name}`;
    return { name, url: target.href };
  }
  const primary = await createDatabase();
  const pool = (url = primary.url, max = options.poolMax ?? 4) => {
    const made = new Pool({ connectionString: url, max, connectionTimeoutMillis: 6_000 });
    pools.push(made);
    return made;
  };
  const schema = new Pool({ connectionString: primary.url, max: 1 });
  try {
    await migrateTo(schema, options.migrateTo);
  } finally {
    await schema.end();
  }

  const actors = Array.from({ length: options.actors ?? 2 }, () => randomUUID());
  const config = {
    coordinatorIds: actors,
    origin: null,
    host: "127.0.0.1",
    port: 0,
    supabase: {
      projectRef: APPROVED_SUPABASE_PROJECT,
      url: APPROVED_SUPABASE_URL,
      publishableKey: "synthetic-offline-only",
    },
  };
  const key = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const issued = Math.floor(at.getTime() / 1000);
  const tokens = new Map(
    actors.map((actor) => {
      const signed = `${part({ alg: "ES256", kid: "local-drill", typ: "JWT" })}.${part({
        sub: actor,
        iss: `${APPROVED_SUPABASE_URL}/auth/v1`,
        aud: "authenticated",
        role: "authenticated",
        iat: issued,
        exp: issued + 8 * 3600,
        session_id: randomUUID(),
        amr: [{ method: "password", timestamp: issued }],
      })}`;
      const signature = sign("sha256", Buffer.from(signed), { key: key.privateKey, dsaEncoding: "ieee-p1363" });
      return [actor, `Bearer ${signed}.${signature.toString("base64url")}`];
    }),
  );
  const authenticate = createSupabaseAuthenticator(config, {
    now: () => at.getTime(),
    fetch: async () =>
      Response.json({
        keys: [{ ...key.publicKey.export({ format: "jwk" }), kid: "local-drill", alg: "ES256", use: "sig" }],
      }),
  });
  const workspaceId = randomUUID();

  /** One backend process on a database: its own pool, store and HTTP listener. */
  async function startBackend(url = primary.url, extra = {}) {
    const backendPool = pool(url);
    const sharedStore = createWorkspaceStore(backendPool, { workspaceId, engine, clock: () => new Date(at), ...extra });
    const server = listen(createHandler({ config, sharedStore, authenticate, log: () => {} }), config);
    servers.push(server);
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    return {
      base: `http://127.0.0.1:${address.port}`,
      port: address.port,
      pool: backendPool,
      store: sharedStore,
      server,
    };
  }

  /** Stop a backend process and wait until its database has no connections left (needed to copy it). */
  async function stopBackend(backend, database = primary.name) {
    await new Promise((resolve) => backend.server.close(() => resolve(undefined)));
    await backend.pool.end();
    pools.splice(pools.indexOf(backend.pool), 1);
    for (let attempt = 0; attempt < 100; attempt++) {
      const { rows } = await admin.query("SELECT count(*)::integer AS n FROM pg_stat_activity WHERE datname = $1", [
        database,
      ]);
      if (rows[0].n === 0) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("The stopped backend's connections did not close");
  }

  /**
   * A backup at this moment: a byte copy of the whole database, taken with no backend connected.
   * Pointing a backend at it later is the "restore to a new project and repoint" path of
   * docs/ward-flow/OPERATIONS-RUNBOOK.md, minus the hosted steps.
   */
  async function backup(database = primary.name) {
    return createDatabase(database);
  }

  /** A request as one synthetic account, to `base` (a backend, or a fault proxy in front of one). */
  async function request(base, actor, body, { timeoutMs = 15_000 } = {}) {
    const response = await fetch(`${base}/v1/workspace${body ? "/commands" : ""}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { authorization: /** @type {string} */ (tokens.get(actor)), "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return { status: response.status, body: parsed };
  }

  const command = (event, expectedRevision, commandId = randomUUID()) => ({
    classification: "synthetic",
    commandId,
    expectedRevision,
    event: { role: "coordinator", now: 0, ...event },
  });

  /** Receipt rows kept for this workspace, by command identity. */
  async function receipts(url = primary.url) {
    const reader = new Pool({ connectionString: url, max: 1 });
    const { rows } = await reader
      .query(
        "SELECT command_id::text AS id, status FROM ward_flow.commands WHERE workspace_id=$1 ORDER BY command_id",
        [workspaceId],
      )
      .finally(() => reader.end());
    return rows;
  }

  return {
    engine,
    at,
    actors,
    workspaceId,
    primary,
    createDatabase,
    pool,
    startBackend,
    stopBackend,
    backup,
    request,
    command,
    receipts,
  };
}
