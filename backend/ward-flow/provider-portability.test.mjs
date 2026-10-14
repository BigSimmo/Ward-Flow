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
  FOREIGN_READ_SCHEMA_ALLOWLIST,
  FOREIGN_READ_RELATION_ALLOWLIST,
  CRON_POLICY_STRIP_PATTERN,
  CRON_POLICY_CAST_PATTERN,
  CRON_OWNER_FILTER_FORMS,
} from "./portable-postgres.mjs";
import { readMigrationConfig, migratePortablePostgres } from "./migrate-postgres.mjs";
import { readSupabaseMigrationConfig, migrateSupabasePostgres } from "./migrate-supabase.mjs";
import { createSupabasePool, createSupabaseMigrationPool, verifySupabaseRuntimeRole } from "./supabase-postgres.mjs";
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
import { syntheticDatabaseUrl } from "./synthetic-database-url.test-support.mjs";

// Generated offline-only values. No fixture is a copied credential or opens a socket.
function databaseUrl(role = "wardflow_backend", host = "127.0.0.1", database = "synthetic") {
  return syntheticDatabaseUrl({ role, host, database });
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
    assert.equal(pool.options.idle_in_transaction_session_timeout, 10000);
    assert.equal(pool.options.lock_timeout, 5000);
    assert.equal(pool.options.keepAlive, true);
    assert.equal(pool.options.keepAliveInitialDelayMillis, 10000);
    assert.equal(pool.options.application_name, "wardflow_backend");
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
  const supabaseAdmin = databaseUrl("postgres", `db.${APPROVED_SUPABASE_PROJECT}.supabase.co`, "postgres");
  assert.throws(
    () => createSupabasePool({ connectionString: supabaseAdmin, runtime: false }, { Pool: RecordingPool }),
    /Unapproved shared database target/,
  );
  assert.equal(
    createSupabaseMigrationPool({ connectionString: supabaseAdmin }, { Pool: RecordingPool }).options.connectionString,
    supabaseAdmin,
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
  "foreign_reads_denied",
  "required_grants",
  "restricted_grants",
  "push_grants",
  "audit_append_only",
  "browser_denied",
  "guards_valid",
  "sequence_restricted",
];
function safeSummary() {
  return {
    role: "wardflow_backend",
    versions: [1, 2, 3, 4, 5],
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

test("runtime role verification requires every safeguard and the complete migration 5 ledger", async () => {
  const config = { connectionString: databaseUrl(), pushEnabled: false };
  await verifyPortableRuntimeRole(summaryPool(), config);
  await verifySupabaseRuntimeRole(summaryPool(), { pushEnabled: false });
  for (const field of roleFields) {
    for (const value of [false, null, undefined, "true"]) {
      const row = { ...safeSummary(), [field]: value };
      await assert.rejects(verifyPortableRuntimeRole(summaryPool(row), config), /Unsafe or unprepared/);
    }
  }
  for (const versions of [[], [1, 2, 3, 4], [1, 2, 3, 5], [1, 2, 3, 4, "5"], [1, 2, 3, 4, 5, 6]])
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

test("shared readiness refuses a missing migration 5 without applying SQL", async () => {
  const calls = [];
  let prepared = false;
  const pool = {
    query: async (sql, args) => {
      calls.push([sql, args]);
      return { rows: prepared ? [{ version: 5 }] : [] };
    },
  };
  const store = createWorkspaceStore(pool, { workspaceId: randomUUID(), engine: {} });
  await assert.rejects(store.ready(), /Shared schema unavailable/);
  prepared = true;
  await store.ready();
  assert.deepEqual(
    calls,
    Array.from({ length: 2 }, () => ["SELECT version FROM ward_flow.migrations WHERE version=$1", [5]]),
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
      if (sql.includes("SELECT max(version)")) return { rows: [{ version: 5 }] };
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

test("runtime summary refuses UPDATE on the audit and push ID sequences", () => {
  assert.match(
    RUNTIME_SUMMARY,
    /NOT pg_catalog\.has_sequence_privilege\(r\.oid, 'ward_flow\.audit_sequence_seq', 'UPDATE'\)/,
  );
  assert.match(
    RUNTIME_SUMMARY,
    /NOT \$1::boolean OR NOT pg_catalog\.has_sequence_privilege\(r\.oid, 'ward_flow\.push_subscriptions_id_seq', 'UPDATE'\)/,
  );
  assert.match(RUNTIME_SUMMARY, /AS sequence_restricted/);
});

test("Azure startup refuses a database without the complete migration 5 ledger", async () => {
  const { verifyAzureMigrations } = await import("./postgres.mjs");
  const pool = (versions) => ({ query: async () => ({ rows: [{ versions }] }) });
  await verifyAzureMigrations(pool([1, 2, 3, 4, 5]));
  for (const versions of [null, [], [1, 2], [1, 2, 3, 4], [1, 2, 3, 5], [1, 2, 3, 4, "5"], [1, 2, 3, 4, 5, 6]])
    await assert.rejects(verifyAzureMigrations(pool(versions)), /Unsafe or unprepared Azure/);
  await assert.rejects(
    verifyAzureMigrations({ query: async () => Promise.reject(new Error("offline")) }),
    /verification unavailable/,
  );
});

test("pg_cron policy normalisation accepts the stock owner filter in any deparse format and refuses anything wider", () => {
  // Mirrors the SQL: strip whitespace and parentheses, then name/text casts; quotes and case kept.
  const normalise = (expr) =>
    (expr ?? "")
      .replace(new RegExp(CRON_POLICY_STRIP_PATTERN, "g"), "")
      .replace(new RegExp(CRON_POLICY_CAST_PATTERN, "g"), "");
  const accepted = (expr) => CRON_OWNER_FILTER_FORMS.includes(normalise(expr));
  for (const stock of [
    "(username = CURRENT_USER)", // PostgreSQL 16-18 (verified on 18 with PGlite)
    "username = CURRENT_USER",
    "(username = (CURRENT_USER)::text)",
    "(CURRENT_USER = username)",
    "(username = (CURRENT_USER)::character varying)",
  ]) {
    assert.equal(accepted(stock), true, stock);
  }
  for (const wider of [
    "((username = CURRENT_USER) OR true)",
    "(other = CURRENT_USER)",
    "(username = SESSION_USER)",
    '("user name" = CURRENT_USER)', // a different, quoted column
    '(username = "current_user"())', // a user-defined function, not the keyword
    '(username = public."current_user"())',
    "(Username = current_user)",
    "(username <> CURRENT_USER)",
    "true",
    "",
    null,
  ]) {
    assert.equal(accepted(wider), false, String(wider));
  }
});

test("runtime summary refuses read grants outside ward_flow except stock Supabase system schemas and relations", () => {
  // PUBLIC read grants on a stock Supabase PostgreSQL 17 project (pg_class ACLs): system schemas whole,
  // plus four named extension relations. Anything else, including new relations in extensions or cron, refuses.
  assert.deepEqual([...FOREIGN_READ_SCHEMA_ALLOWLIST], ["pg_catalog", "information_schema"]);
  assert.deepEqual(
    FOREIGN_READ_RELATION_ALLOWLIST.map((pair) => [...pair]),
    [
      ["extensions", "pg_stat_statements"],
      ["extensions", "pg_stat_statements_info"],
      ["cron", "job"],
      ["cron", "job_run_details"],
    ],
  );
  assert.ok(FOREIGN_READ_RELATION_ALLOWLIST.every((pair) => Object.isFrozen(pair)));
  for (const schema of ["public", "auth", "storage", "vault", "extensions", "cron"])
    assert.ok(!FOREIGN_READ_SCHEMA_ALLOWLIST.includes(schema), schema);
  assert.ok(Object.isFrozen(FOREIGN_READ_SCHEMA_ALLOWLIST) && Object.isFrozen(FOREIGN_READ_RELATION_ALLOWLIST));
  const clause = RUNTIME_SUMMARY.slice(
    RUNTIME_SUMMARY.indexOf("-- No read grant"),
    RUNTIME_SUMMARY.indexOf("AS foreign_reads_denied"),
  );
  assert.match(
    clause,
    /n\.nspname <> 'ward_flow' AND n\.nspname <> ALL \(ARRAY\['pg_catalog', 'information_schema'\]::text\[\]\)/,
  );
  assert.match(
    clause,
    /AND NOT \(c\.relkind IN \('r', 'v'\)\s+AND \(n\.nspname::text, c\.relname::text\) IN \(\('extensions', 'pg_stat_statements'\), \('extensions', 'pg_stat_statements_info'\), \('cron', 'job'\), \('cron', 'job_run_details'\)\)/,
  );
  // Schema and relation are compared separately: a quoted schema "extensions.pg_stat" with a table
  // "statements" must not match extensions.pg_stat_statements through string concatenation.
  assert.doesNotMatch(clause, /\|\|/);
  // The cron exception only holds while row-level security is on for those tables.
  // ...and only while every permissive SELECT policy is pg_cron's stock owner filter.
  assert.match(clause, /AND \(n\.nspname <> 'cron' OR \(c\.relrowsecurity AND NOT EXISTS/);
  assert.match(clause, /p\.polpermissive AND p\.polcmd IN \('\*', 'r'\)/);
  // Compared through a normalised form, never pg_get_expr's exact text, which varies by major.
  assert.doesNotMatch(clause, /IS DISTINCT FROM '\(username = CURRENT_USER\)'/);
  assert.ok(clause.includes(`'${CRON_POLICY_STRIP_PATTERN}', '', 'g'), '${CRON_POLICY_CAST_PATTERN}', '', 'g')`));
  assert.match(
    clause,
    /COALESCE\(pg_catalog\.pg_get_expr\(p\.polqual, p\.polrelid\), ''\),[\s\S]*<> ALL \(ARRAY\['username=CURRENT_USER', 'CURRENT_USER=username'\]::text\[\]\)\)\)\)\)/,
  );
  assert.match(clause, /has_table_privilege\(r\.oid, c\.oid, 'SELECT'\)/);
  assert.match(clause, /has_any_column_privilege\(r\.oid, c\.oid, 'SELECT'\)/);
  assert.match(clause, /c\.relkind IN \('r', 'p', 'v', 'm', 'f'\)/);
  assert.match(clause, /has_sequence_privilege\(r\.oid, c\.oid, 'SELECT,USAGE'\)/);
});

test("Supabase migration config requires matching approved target and distinct admin/runtime roles", () => {
  const directHost = `db.${APPROVED_SUPABASE_PROJECT}.supabase.co`;
  const directAdmin = databaseUrl("postgres", directHost, "postgres");
  const directConfig = readSupabaseMigrationConfig({
    WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
    WARD_SUPABASE_MIGRATION_DATABASE_URL: directAdmin,
    WARD_SUPABASE_DATABASE_URL: databaseUrl("wardflow_backend", directHost, "postgres"),
  });
  assert.equal(directConfig.connectionString, directAdmin);

  const poolerAdmin = databaseUrl(`postgres.${APPROVED_SUPABASE_PROJECT}`, APPROVED_SUPABASE_POOLER, "postgres");
  const poolerConfig = readSupabaseMigrationConfig({
    WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
    WARD_SUPABASE_MIGRATION_DATABASE_URL: poolerAdmin,
    WARD_SUPABASE_DATABASE_URL: databaseUrl(
      `wardflow_backend.${APPROVED_SUPABASE_PROJECT}`,
      APPROVED_SUPABASE_POOLER,
      "postgres",
    ),
  });
  assert.equal(poolerConfig.connectionString, poolerAdmin);

  // Reject identical runtime/admin role or mismatched host targets
  assert.throws(
    () =>
      readSupabaseMigrationConfig({
        WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
        WARD_SUPABASE_MIGRATION_DATABASE_URL: databaseUrl("wardflow_backend", directHost, "postgres"),
        WARD_SUPABASE_DATABASE_URL: databaseUrl("wardflow_backend", directHost, "postgres"),
      }),
    /Migration and runtime targets must match with separate identities/,
  );
  assert.throws(
    () =>
      readSupabaseMigrationConfig({
        WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
        WARD_SUPABASE_MIGRATION_DATABASE_URL: databaseUrl("postgres", directHost, "postgres"),
        WARD_SUPABASE_DATABASE_URL: databaseUrl(
          `wardflow_backend.${APPROVED_SUPABASE_PROJECT}`,
          APPROVED_SUPABASE_POOLER,
          "postgres",
        ),
      }),
    /Migration and runtime targets must match with separate identities/,
  );
});

test("migrateSupabasePostgres applies migrations, runs supabase-runtime-role.sql and rolls back on failure", async () => {
  const executed = [];
  let releases = 0;
  const client = {
    query: async (sql) => {
      executed.push(sql);
      if (sql.includes("to_regclass")) return { rows: [{ relation: "ward_flow.migrations" }] };
      if (sql.includes("SELECT max(version)")) return { rows: [{ version: 5 }] };
      return { rows: [] };
    },
    release: () => {
      releases++;
    },
  };
  const pool = {
    query: async () => ({ rows: [{ owner: null }] }),
    connect: async () => client,
  };
  await migrateSupabasePostgres(pool);
  assert.equal(releases, 2);
  assert.ok(executed.some((sql) => sql.includes("REVOKE CREATE ON SCHEMA public FROM PUBLIC, wardflow_backend")));
  assert.ok(executed.some((sql) => sql.includes("ALTER ROLE wardflow_backend SET statement_timeout = '10s'")));
});

test("workspace store lock() reads existing row with FOR UPDATE before seeding and evicts broken rollback sockets", async () => {
  const queries = [];
  let seedCalls = 0;
  const existingSnapshot = { state: { worldGeneration: 1 } };
  const fastClient = {
    query: async (sql) => {
      queries.push(sql.trim());
      if (sql.includes("FROM ward_flow.workspaces WHERE id=$1")) {
        return {
          rows: [
            {
              data_mode: "prototype",
              revision: 7,
              payload: existingSnapshot,
            },
          ],
        };
      }
      if (sql.includes("FROM ward_flow.audit")) return { rows: [] };
      return { rows: [] };
    },
    release: () => {},
  };
  const fastPool = {
    connect: async () => fastClient,
    query: async () => ({ rows: [] }),
  };
  const store = createWorkspaceStore(fastPool, {
    workspaceId: randomUUID(),
    engine: {
      seedWorld: () => {
        seedCalls++;
        return existingSnapshot;
      },
      validWorld: () => true,
      worldNow: (_p, at) => at,
    },
  });
  const doc = await store.read("coordinator-1", "2026-10-14T10:00:00.000Z");
  assert.equal(doc.revision, 7);
  assert.equal(seedCalls, 0);
  assert.equal(
    queries.some((sql) => sql.includes("INSERT INTO ward_flow.workspaces")),
    false,
  );

  // Verify broken socket eviction when both main query and ROLLBACK fail
  let releasedWith;
  const rollbackErr = new Error("socket terminated during rollback");
  const brokenClient = {
    query: async (sql) => {
      if (sql === "BEGIN") return { rows: [] };
      if (sql === "ROLLBACK") throw rollbackErr;
      throw new Error("primary query failure");
    },
    release: (err) => {
      releasedWith = err;
    },
  };
  const brokenStore = createWorkspaceStore(
    { connect: async () => brokenClient, query: async () => ({ rows: [] }) },
    { workspaceId: randomUUID(), engine: {} },
  );
  await assert.rejects(brokenStore.read("coordinator-1", "2026-10-14T10:00:00.000Z"), /primary query failure/);
  assert.equal(releasedWith, rollbackErr);

  // Verify unsubscribe() immediately prunes push_deliveries for the revoked subscription ID
  const unsubQueries = [];
  const unsubClient = {
    query: async (sql, args) => {
      unsubQueries.push([sql, args]);
      if (sql.includes("UPDATE ward_flow.push_subscriptions SET revoked_at")) {
        return { rowCount: 1, rows: [{ id: 42 }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => {},
  };
  const unsubStore = createWorkspaceStore(
    { connect: async () => unsubClient, query: async () => ({ rows: [] }) },
    { workspaceId: randomUUID(), engine: {}, push: { coordinatorIds: [] } },
  );
  assert.equal(await unsubStore.unsubscribe("coordinator-1", "https://fcm.googleapis.com/fcm/send/e1"), "unsubscribed");
  assert.deepEqual(
    unsubQueries.map(([sql]) => sql.split(" ")[0]),
    ["BEGIN", "UPDATE", "DELETE", "COMMIT"],
  );
  assert.deepEqual(unsubQueries[2], ["DELETE FROM ward_flow.push_deliveries WHERE subscription_id=$1", [42]]);
});
