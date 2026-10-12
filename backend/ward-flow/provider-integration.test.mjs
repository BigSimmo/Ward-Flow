import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readConfig } from "./config.mjs";
import { createBackend } from "./providers.mjs";
import { createHandler } from "./server.mjs";
import { readMigrationConfig, migratePortablePostgres } from "./migrate-postgres.mjs";
import {
  createPortableMigrationPool,
  createPortablePostgresPool,
  verifyPortableRuntimeRole,
} from "./portable-postgres.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { verifyPostgresNamespace } from "./postgres-preflight.mjs";

const actor = "22222222-2222-4222-8222-222222222222";
const env = {
  WARD_DATABASE_PROVIDER: "postgres",
  WARD_AUTH_PROVIDER: "supabase",
  WARD_SHARED_ENABLED: "true",
  WARD_POSTGRES_DATABASE_URL: "postgresql://wardflow_backend:synthetic@db.example.test:5432/wardflow", // precommit-scan: allow -- synthetic fixture
  WARD_SUPABASE_PROJECT_REF: "zakzoemeedfepxcstsou",
  WARD_SUPABASE_URL: "https://zakzoemeedfepxcstsou.supabase.co",
  WARD_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  WARD_COORDINATOR_USER_IDS: actor,
  WARD_WORKSPACE_ID: "44444444-4444-4444-8444-444444444444",
  WARD_ALLOWED_ORIGIN: "http://localhost:4387",
};

test("portable database configuration needs no Azure storage or database configuration", () => {
  const config = readConfig(env);
  assert.equal(config.databaseProvider, "postgres");
  assert.equal(config.storage, null);
  assert.equal(config.postgres.connectionString, env.WARD_POSTGRES_DATABASE_URL);
  assert.throws(() => readConfig({ ...env, WARD_SHARED_ENABLED: "false" }), /shared workspace/);
});

test("portable startup selects database and identity independently and cleans up refusal", async () => {
  const config = readConfig(env);
  let closed = 0;
  const pool = {
    end: async () => {
      closed++;
    },
  };
  const dependencies = {
    azure: async () => {
      throw new Error("Azure must stay unused");
    },
    supabase: async () => {
      throw new Error("Supabase database must stay unused");
    },
    postgres: async () => ({
      createPool: () => pool,
      verifyPool: async (received, db) => {
        assert.equal(received, pool);
        assert.equal(db.pushEnabled, false);
      },
    }),
    supabaseAuth: () => async () => actor,
    workspace: async () => ({ createWorkspaceStore: () => ({}) }),
    engine: async () => ({}),
  };
  const backend = await createBackend(config, dependencies);
  assert.equal(await backend.authenticate("Bearer synthetic"), actor);
  assert.equal(backend.store, null);
  await assert.rejects(
    createBackend(config, {
      ...dependencies,
      postgres: async () => ({
        createPool: () => pool,
        verifyPool: () => {
          throw new Error("unsafe runtime");
        },
      }),
    }),
    /unsafe runtime/,
  );
  assert.equal(closed, 1);
});

test("administrator setup refuses missing, reused or mismatched connection targets", () => {
  const admin = "postgresql://postgres:synthetic@db.example.test:5432/wardflow"; // precommit-scan: allow -- synthetic fixture
  assert.equal(readMigrationConfig({ ...env, WARD_POSTGRES_MIGRATION_DATABASE_URL: admin }).connectionString, admin);
  for (const value of [
    undefined,
    env.WARD_POSTGRES_DATABASE_URL,
    env.WARD_POSTGRES_DATABASE_URL.replace("wardflow_backend:", "%77ardflow_backend:"),
    admin.replace("db.example.test", "other.example.test"),
    admin.replace("/wardflow", "/other"),
  ]) {
    assert.throws(() => readMigrationConfig({ ...env, WARD_POSTGRES_MIGRATION_DATABASE_URL: value }));
  }
});

test("shared readiness refuses schema 3 and requires the current migration", async () => {
  let version;
  const store = createWorkspaceStore(
    {
      query: async (_sql, params) => {
        version = params[0];
        return { rows: [] };
      },
    },
    { workspaceId: env.WARD_WORKSPACE_ID, engine: {} },
  );
  await assert.rejects(store.ready(), /schema unavailable/);
  assert.equal(version, 4);
});

const adminUrl = process.env.WARD_TEST_PORTABLE_DATABASE_URL;
if (adminUrl && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(adminUrl).hostname))
  throw new Error("Portable database proof requires disposable loopback PostgreSQL");
test(
  "portable PostgreSQL: verified TLS, restricted role, shared API and startup refusal",
  { skip: !adminUrl },
  async (t) => {
    const caCertificateFile = process.env.WARD_TEST_PORTABLE_CA_CERT_FILE;
    assert.ok(caCertificateFile, "A verified local CA is required");
    const admin = createPortableMigrationPool({ connectionString: adminUrl, caCertificateFile });
    let backend;
    try {
      // This database belongs exclusively to the disposable fixture; no schema is dropped.
      await admin.query(
        "CREATE ROLE wardflow_backend LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'synthetic-portable-local'",
      ); // precommit-scan: allow -- disposable fixture only
      await admin.query("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN");
      await t.test("namespace preflight accepts actual supported schemas before upgrading", async () => {
        await verifyPostgresNamespace(admin);
        for (const file of ["001-shared-workspace.sql", "002-workspace-data-mode.sql", "003-push-subscriptions.sql"]) {
          await admin.query(await readFile(new URL("./migrations/" + file, import.meta.url), "utf8"));
          await verifyPostgresNamespace(admin);
        }
      });
      await migratePortablePostgres(admin);
      await migratePortablePostgres(admin);
      const url = new URL(adminUrl);
      url.username = "wardflow_backend";
      url.password = "synthetic-portable-local";
      const config = readConfig({
        ...env,
        WARD_POSTGRES_DATABASE_URL: url.href,
        WARD_POSTGRES_CA_CERT_FILE: caCertificateFile,
        WARD_WORKSPACE_ID: randomUUID(),
      });
      backend = await createBackend(config, {
        supabaseAuth: () => async (header) => {
          if (header !== "Bearer synthetic") throw new Error("invalid token");
          return actor;
        },
        azure: async () => {
          throw new Error("unexpected Azure initialisation");
        },
        supabase: async () => {
          throw new Error("unexpected Supabase database initialisation");
        },
      });
      const handler = createHandler(backend);
      const request = (path, body) =>
        new Request("http://localhost" + path, {
          method: body ? "POST" : "GET",
          headers: { authorization: "Bearer synthetic", ...(body ? { "content-type": "application/json" } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      await t.test("TLS and authenticated readiness use the restricted runtime", async () => {
        const { rows } = await backend.pool.query(
          "SELECT current_user AS role,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls",
        );
        assert.deepEqual(rows, [{ role: "wardflow_backend", tls: true }]);
        assert.equal((await handler(request("/readyz"))).status, 200);
        assert.equal((await handler(new Request("http://localhost/v1/workspace"))).status, 401);
      });
      await t.test("save, reload, idempotent retry and revision conflict preserve API contracts", async () => {
        const initial = await (await handler(request("/v1/workspace"))).json();
        const movement = initial.snapshot.payload.state.movements.find((row) => row.id === "WF-012");
        const command = {
          classification: "synthetic",
          commandId: randomUUID(),
          expectedRevision: initial.snapshot.revision,
          event: {
            type: "CHANGE_URGENCY",
            role: "coordinator",
            now: 0,
            movementId: movement.id,
            urgency: movement.urgency === 1 ? 2 : 1,
            reason: "reassessed",
          },
        };
        const saved = await handler(request("/v1/workspace/commands", command));
        assert.equal(saved.status, 200);
        const result = await saved.json();
        assert.equal(result.snapshot.revision, initial.snapshot.revision + 1);
        const retry = await handler(request("/v1/workspace/commands", command));
        assert.equal(retry.status, 200);
        assert.equal((await retry.json()).replayed, true);
        assert.equal(
          (await handler(request("/v1/workspace/commands", { ...command, commandId: randomUUID() }))).status,
          409,
        );
        assert.equal((await backend.sharedStore.read(actor)).revision, result.snapshot.revision);
        assert.equal(
          (await backend.sharedStore.audit()).filter(
            (row) => row.action === "CHANGE_URGENCY" && row.outcome === "accepted",
          ).length,
          1,
        );
      });
      await t.test("audit mutation, reclassification and overprivileged startup are refused", async () => {
        await assert.rejects(
          backend.pool.query("UPDATE ward_flow.audit SET action=action"),
          (error) => error.code === "42501",
        );
        await assert.rejects(
          backend.pool.query("UPDATE ward_flow.workspaces SET data_mode='live'"),
          /data mode cannot be changed/,
        );
        await admin.query("GRANT UPDATE ON ward_flow.audit TO wardflow_backend");
        try {
          await assert.rejects(verifyPortableRuntimeRole(backend.pool, config.postgres), /Unsafe/);
        } finally {
          await admin.query("REVOKE UPDATE ON ward_flow.audit FROM wardflow_backend");
        }
        await verifyPortableRuntimeRole(backend.pool, config.postgres);
        await admin.query("GRANT UPDATE(result) ON ward_flow.commands TO wardflow_backend");
        try {
          await assert.rejects(verifyPortableRuntimeRole(backend.pool, config.postgres), /Unsafe/);
        } finally {
          await migratePortablePostgres(admin);
        }
        await verifyPortableRuntimeRole(backend.pool, config.postgres);
        await admin.query("ALTER FUNCTION ward_flow.protect_workspace_mode() OWNER TO wardflow_backend");
        try {
          await assert.rejects(verifyPortableRuntimeRole(backend.pool, config.postgres), /Unsafe/);
        } finally {
          await admin.query("ALTER FUNCTION ward_flow.protect_workspace_mode() OWNER TO postgres");
        }
        await admin.query("ALTER DATABASE wardflow_test OWNER TO wardflow_backend");
        try {
          await assert.rejects(verifyPortableRuntimeRole(backend.pool, config.postgres), /Unsafe/);
        } finally {
          await admin.query("ALTER DATABASE wardflow_test OWNER TO postgres");
        }
        await verifyPortableRuntimeRole(backend.pool, config.postgres);
      });
      await t.test("administrator preflight preserves an unknown object and its grants", async () => {
        await admin.query(
          "CREATE TABLE ward_flow.unrelated_sentinel(id integer); GRANT SELECT ON ward_flow.unrelated_sentinel TO anon",
        );
        await assert.rejects(migratePortablePostgres(admin), /namespace|schema|objects/i);
        const { rows } = await admin.query(
          "SELECT has_table_privilege('anon','ward_flow.unrelated_sentinel','SELECT') AS preserved",
        );
        assert.equal(rows[0].preserved, true);
      });
      await t.test("missing trusted CA refuses the local self-signed server", async () => {
        const pool = createPortablePostgresPool({ connectionString: url.href });
        try {
          await assert.rejects(pool.query("SELECT 1"));
        } finally {
          await pool.end();
        }
      });
    } finally {
      await backend?.pool?.end();
      await admin.end();
    }
  },
);
