import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { validatePostgresConnectionString, readPortablePostgresConfig } from "./postgres-config.mjs";
import {
  createPortablePostgresPool,
  createPortableMigrationPool,
  verifyPortableRuntimeRole,
  verifyRuntimeRole,
  RUNTIME_SUMMARY,
} from "./portable-postgres.mjs";
import { readMigrationConfig, migratePortablePostgres } from "./migrate-postgres.mjs";
import { createSupabasePool, verifySupabaseRuntimeRole } from "./supabase-postgres.mjs";
import {
  APPROVED_SUPABASE_PROJECT,
  APPROVED_SUPABASE_POOLER,
  APPROVED_SUPABASE_URL,
  validateSupabaseDatabaseUrl,
  readSupabaseIdentityConfig,
} from "./supabase-config.mjs";
import { createSupabaseAuthenticator } from "./supabase-auth.mjs";
import { VerifierUnavailableError } from "./auth.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

// Generated offline-only values. No fixture is a copied credential or opens a socket.
function databaseUrl(role = "wardflow_backend", host = "127.0.0.1", database = "synthetic") {
  const url = new URL(`postgresql://${host}:5432/${database}`);
  url.username = role;
  url.password = `offline-${randomUUID()}`;
  return url.href;
}
class RecordingPool {
  constructor(options) {
    this.options = options;
  }
  on(event, listener) {
    this.event = event;
    this.listener = listener;
  }
}

test("portable URL validation rejects SSL overrides, ambiguous targets and runtime administrators", () => {
  const valid = databaseUrl();
  assert.equal(validatePostgresConnectionString(valid), valid);
  for (const invalid of [
    undefined,
    "not a URL",
    valid + "?sslmode=disable",
    valid + "#fragment",
    valid + "?",
    valid + "#",
    valid + "\n",
    databaseUrl("postgres"),
    databaseUrl("administrator"),
    databaseUrl("wardflow_backend", "127.0.0.1", "two%2Fdatabases"),
  ])
    assert.throws(() => validatePostgresConnectionString(invalid), {
      message: "Invalid portable PostgreSQL configuration",
    });
  const administrator = databaseUrl("postgres");
  assert.equal(validatePostgresConnectionString(administrator, { runtime: false }), administrator);
  assert.throws(() => validatePostgresConnectionString(valid.replace(/offline-[^@]+/, "")), /Invalid portable/);
});

test("both pool presets enforce verified TLS and bounded resources without network access", () => {
  const portable = createPortablePostgresPool({ connectionString: databaseUrl() }, { Pool: RecordingPool });
  const supabase = createSupabasePool(
    { connectionString: databaseUrl("wardflow_backend", `db.${APPROVED_SUPABASE_PROJECT}.supabase.co`, "postgres") },
    { Pool: RecordingPool },
  );
  for (const pool of [portable, supabase]) {
    assert.deepEqual(pool.options.ssl, { rejectUnauthorized: true });
    assert.equal(pool.options.max, 4);
    assert.equal(pool.options.connectionTimeoutMillis, 6000);
    assert.equal(pool.options.statement_timeout, 10000);
    assert.equal(pool.options.query_timeout, 12000);
    assert.equal(pool.event, "error");
  }
});

test("the migration factory cannot be selected through runtime URL configuration", () => {
  const connectionString = databaseUrl("postgres");
  assert.throws(
    () => createPortablePostgresPool({ connectionString, runtime: false }, { Pool: RecordingPool }),
    /Invalid portable/,
  );
  assert.equal(
    createPortableMigrationPool({ connectionString }, { Pool: RecordingPool }).options.connectionString,
    connectionString,
  );
});

test("missing or malformed CA files are refused before creating a pool", () => {
  for (const factory of [createPortablePostgresPool, createSupabasePool]) {
    const connectionString =
      factory === createSupabasePool
        ? databaseUrl("wardflow_backend", `db.${APPROVED_SUPABASE_PROJECT}.supabase.co`, "postgres")
        : databaseUrl();
    assert.throws(
      () =>
        factory(
          { connectionString, caCertificateFile: new URL("./nonexistent-synthetic-ca.pem", import.meta.url) },
          { Pool: RecordingPool },
        ),
      { message: "Invalid database CA certificate configuration" },
    );
  }
});

test("administrator setup requires the same target and separate fixed runtime identity", () => {
  const runtime = databaseUrl();
  const admin = databaseUrl("postgres");
  const env = { WARD_POSTGRES_DATABASE_URL: runtime, WARD_POSTGRES_MIGRATION_DATABASE_URL: admin };
  assert.equal(readMigrationConfig(env).connectionString, admin);
  assert.deepEqual(readPortablePostgresConfig({ WARD_POSTGRES_DATABASE_URL: runtime }), { connectionString: runtime });
  for (const changed of [
    databaseUrl("postgres", "localhost"),
    databaseUrl("postgres", "127.0.0.1", "other"),
    databaseUrl(),
    admin.replace(":5432", ":6543"),
  ])
    assert.throws(
      () => readMigrationConfig({ ...env, WARD_POSTGRES_MIGRATION_DATABASE_URL: changed }),
      /separate identities/,
    );
  assert.throws(
    () => readMigrationConfig({ ...env, WARD_POSTGRES_DATABASE_URL: databaseUrl("other_runtime") }),
    /separate identities/,
  );
});

const roleFields = [
  "safe_flags",
  "no_memberships",
  "no_ownership",
  "schema_grants",
  "required_grants",
  "restricted_grants",
  "push_grants",
  "audit_append_only",
  "browser_denied",
  "guards_valid",
];
function safeSummary() {
  return {
    role: "wardflow_backend",
    versions: [1, 2, 3, 4],
    ...Object.fromEntries(roleFields.map((field) => [field, true])),
  };
}
function summaryPool(row = safeSummary()) {
  return {
    query: async (sql, args) => {
      assert.equal(sql, RUNTIME_SUMMARY);
      assert.deepEqual(args, [false]);
      return { rows: [row] };
    },
  };
}

test("runtime role verification requires every safeguard and the complete migration 4 ledger", async () => {
  const config = { connectionString: databaseUrl(), pushEnabled: false };
  await verifyPortableRuntimeRole(summaryPool(), config);
  await verifySupabaseRuntimeRole(summaryPool(), { pushEnabled: false });
  for (const field of roleFields) {
    for (const value of [false, null, undefined, "true"]) {
      const row = { ...safeSummary(), [field]: value };
      await assert.rejects(verifyPortableRuntimeRole(summaryPool(row), config), /Unsafe or unprepared/);
    }
  }
  for (const versions of [[], [1, 2, 3], [1, 2, 4], [1, 2, 3, "4"], [1, 2, 3, 4, 5]])
    await assert.rejects(
      verifySupabaseRuntimeRole(summaryPool({ ...safeSummary(), versions })),
      /Unsafe or unprepared/,
    );
  await assert.rejects(
    verifyPortableRuntimeRole(summaryPool({ ...safeSummary(), role: "postgres" }), config),
    /Unsafe or unprepared/,
  );
});

test("catalogue outages redact upstream diagnostics and reject missing summary rows", async () => {
  await assert.rejects(
    verifyRuntimeRole(
      {
        query: async () => {
          throw new Error("invented private diagnostic");
        },
      },
      "wardflow_backend",
      false,
      "unavailable",
      "unsafe",
    ),
    { message: "unavailable" },
  );
  for (const rows of [[], [safeSummary(), safeSummary()]])
    await assert.rejects(
      verifyRuntimeRole({ query: async () => ({ rows }) }, "wardflow_backend", false, "unavailable", "unsafe"),
      { message: "unavailable" },
    );
});

test("enabled push requires its grants while optional push remains off by configuration", async () => {
  let received;
  const pool = {
    query: async (_sql, args) => {
      received = args;
      return { rows: [safeSummary()] };
    },
  };
  await verifySupabaseRuntimeRole(pool, { pushEnabled: true });
  assert.deepEqual(received, [true]);
  await assert.rejects(
    verifySupabaseRuntimeRole(
      { query: async () => ({ rows: [{ ...safeSummary(), push_grants: false }] }) },
      { pushEnabled: true },
    ),
    /Unsafe or unprepared/,
  );
});

test("shared readiness refuses a missing migration 4 without applying SQL", async () => {
  const calls = [];
  let prepared = false;
  const pool = {
    query: async (sql, args) => {
      calls.push([sql, args]);
      return { rows: prepared ? [{ version: 4 }] : [] };
    },
  };
  const store = createWorkspaceStore(pool, { workspaceId: randomUUID(), engine: {} });
  await assert.rejects(store.ready(), /Shared schema unavailable/);
  prepared = true;
  await store.ready();
  assert.deepEqual(
    calls,
    Array.from({ length: 2 }, () => ["SELECT version FROM ward_flow.migrations WHERE version=$1", [4]]),
  );
});

test("migration namespace refusal performs no mutation or administrator checkout", async () => {
  let connects = 0;
  const pool = {
    query: async () => ({ rows: [{ owner: "foreign_owner", objects: [] }] }),
    connect: async () => {
      connects++;
      throw new Error("must not connect");
    },
  };
  await assert.rejects(migratePortablePostgres(pool), /Unrecognised or unsafe/);
  assert.equal(connects, 0);
});

test("administrator grant failure rolls back its transaction and releases the client for recovery", async () => {
  const queries = [];
  let releases = 0;
  let connects = 0;
  const client = {
    query: async (sql) => {
      queries.push(sql);
      if (sql.includes("to_regclass")) return { rows: [{ relation: "ward_flow.migrations" }] };
      if (sql.includes("SELECT max(version)")) return { rows: [{ version: 4 }] };
      if (sql.includes("Runtime role flags are unsafe")) throw new Error("synthetic grant refusal");
      return { rows: [] };
    },
    release: () => {
      releases++;
    },
  };
  const pool = {
    query: async () => ({ rows: [{ owner: null }] }),
    connect: async () => {
      connects++;
      return client;
    },
  };
  await assert.rejects(migratePortablePostgres(pool), /synthetic grant refusal/);
  assert.equal(connects, 2);
  assert.equal(releases, 2);
  assert.ok(queries.includes("COMMIT"));
  assert.equal(queries.at(-1), "ROLLBACK");
});

test("Supabase target validation preserves exact project, session pooler and restricted login", () => {
  for (const [role, host] of [
    ["wardflow_backend", `db.${APPROVED_SUPABASE_PROJECT}.supabase.co`],
    [`wardflow_backend.${APPROVED_SUPABASE_PROJECT}`, APPROVED_SUPABASE_POOLER],
  ]) {
    const value = databaseUrl(role, host, "postgres");
    assert.equal(validateSupabaseDatabaseUrl(value), value);
    for (const invalid of [
      value + "?sslmode=disable",
      value.replace(":5432", ":6543"),
      value.replace("/postgres", "/other"),
    ])
      assert.throws(() => validateSupabaseDatabaseUrl(invalid));
  }
  for (const invalid of [
    databaseUrl("postgres", APPROVED_SUPABASE_POOLER, "postgres"),
    databaseUrl("wardflow_backend", "example.invalid", "postgres"),
  ])
    assert.throws(() => validateSupabaseDatabaseUrl(invalid), /Unapproved/);
});

test("identity configuration rejects other projects and privileged key families", () => {
  const env = {
    WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
    WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
    WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
  };
  for (const patch of [
    { WARD_SUPABASE_PROJECT_REF: "other_project" },
    { WARD_SUPABASE_URL: "https://other.invalid" },
    { WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "secret", "synthetic_offline_fixture"].join("_") },
    { WARD_SUPABASE_PUBLISHABLE_KEY: "synthetic-jwt-service-role-is-not-a-publishable-key" },
  ])
    assert.throws(() => readSupabaseIdentityConfig({ ...env, ...patch }));
  assert.throws(
    () =>
      createSupabaseAuthenticator({
        ...identityConfig(),
        supabase: { projectRef: "other_project", url: "https://other.invalid" },
      }),
    /Unapproved/,
  );
});

function identityConfig() {
  const coordinator = randomUUID();
  const supabase = readSupabaseIdentityConfig({
    WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
    WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
    WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
  });
  return { coordinatorIds: [coordinator], supabase };
}

test("Supabase verifier confirms the allowlisted server-returned UUID with a private request", async () => {
  const config = identityConfig();
  const verify = createSupabaseAuthenticator(config, {
    fetch: async (url, options) => {
      assert.equal(url, `${APPROVED_SUPABASE_URL}/auth/v1/user`);
      assert.equal(options.redirect, "error");
      assert.equal(options.method, "GET");
      assert.equal(options.headers.apikey, config.supabase.publishableKey);
      return Response.json({ id: config.coordinatorIds[0].toUpperCase(), role: "untrusted-browser-role" });
    },
  });
  assert.equal(await verify("Bearer synthetic-offline-token"), config.coordinatorIds[0]);
});

test("Supabase verifier separates denied credentials from outages and malformed responses", async () => {
  const config = identityConfig();
  for (const response of [
    new Response(null, { status: 401 }),
    new Response(null, { status: 403 }),
    Response.json({ id: randomUUID() }),
  ]) {
    const verify = createSupabaseAuthenticator(config, { fetch: async () => response });
    await assert.rejects(
      verify("Bearer synthetic-offline-token"),
      (error) => !(error instanceof VerifierUnavailableError) && error.message === "Unauthorised",
    );
  }
  for (const fetch of [
    async () => new Response(null, { status: 503 }),
    async () => Response.json({ id: "invalid" }),
    async () => {
      throw new Error("invented diagnostic");
    },
    async () => ({
      ok: true,
      json: async () => {
        throw new Error("invalid body");
      },
    }),
  ])
    await assert.rejects(createSupabaseAuthenticator(config, { fetch })("Bearer synthetic-offline-token"), {
      message: "Token verifier unavailable",
    });
});

test("Supabase verifier rejects malformed input before fetch and bounds headers plus body reads", async () => {
  const config = identityConfig();
  let calls = 0;
  const verify = createSupabaseAuthenticator(config, {
    fetch: async () => {
      calls++;
      return Response.json({ id: config.coordinatorIds[0] });
    },
  });
  for (const header of [null, "Basic synthetic", "Bearer two tokens", "Bearer " + "x".repeat(16385)])
    await assert.rejects(verify(header), /Unauthorised/);
  assert.equal(calls, 0);
  for (const fetch of [() => new Promise(() => {}), async () => ({ ok: true, json: () => new Promise(() => {}) })])
    await assert.rejects(
      createSupabaseAuthenticator(config, { fetch, timeoutMs: 10 })("Bearer synthetic-offline-token"),
      VerifierUnavailableError,
    );
  for (const timeoutMs of [0, 5001, 1.5])
    assert.throws(() => createSupabaseAuthenticator(config, { timeoutMs }), /deadline/);
});
