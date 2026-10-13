import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "./config.mjs";
import { createHandler } from "./server.mjs";

const project = "zakzoemeedfepxcstsou";
const coordinator = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const env = {
  WARD_DATABASE_PROVIDER: "supabase",
  WARD_AUTH_PROVIDER: "supabase",
  WARD_SHARED_ENABLED: "true",
  WARD_SUPABASE_PROJECT_REF: project,
  WARD_SUPABASE_URL: `https://${project}.supabase.co`,
  WARD_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  WARD_SUPABASE_DATABASE_URL: `postgresql://wardflow_backend.${project}:synthetic@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`, // precommit-scan: allow -- deliberately synthetic test credential
  WARD_COORDINATOR_USER_IDS: coordinator.toUpperCase(),
  WARD_WORKSPACE_ID: "44444444-4444-4444-8444-444444444444",
  WARD_ALLOWED_ORIGIN: "http://localhost:3100",
};

test("Supabase configuration is pinned, shared-only and requires no Azure configuration", () => {
  const config = readConfig(env);
  assert.equal(config.databaseProvider, "supabase");
  assert.equal(config.authProvider, "supabase");
  assert.deepEqual(config.coordinatorIds, [coordinator]);
  assert.equal(config.storage, null);
  assert.equal(config.push, null);
  assert.equal(config.postgres.connectionString, env.WARD_SUPABASE_DATABASE_URL);
});

test("Supabase rejects foreign targets, admin runtime credentials, mixed providers and uncommissioned data", () => {
  for (const override of [
    { WARD_SUPABASE_PROJECT_REF: "other" },
    { WARD_SUPABASE_URL: "https://other.supabase.co" },
    { WARD_SUPABASE_URL: `${env.WARD_SUPABASE_URL}/` },
    { WARD_SUPABASE_PUBLISHABLE_KEY: "sb_secret_synthetic" },
    { WARD_SUPABASE_DATABASE_URL: env.WARD_SUPABASE_DATABASE_URL.replace("wardflow_backend.", "postgres.") },
    { WARD_SUPABASE_DATABASE_URL: env.WARD_SUPABASE_DATABASE_URL.replace(project + ":synthetic", "foreign:synthetic") },
    { WARD_SUPABASE_DATABASE_URL: env.WARD_SUPABASE_DATABASE_URL + "?sslmode=disable" },
    { WARD_SUPABASE_DATABASE_URL: env.WARD_SUPABASE_DATABASE_URL.replace("pooler.supabase.com", "attacker.example") },
    { WARD_SUPABASE_DATABASE_URL: env.WARD_SUPABASE_DATABASE_URL.replace("aws-0-ap-southeast-2", "aws-0-us-east-1") },
    { WARD_SHARED_ENABLED: "false" },
    { WARD_AUTH_PROVIDER: "invalid" },
    { WARD_DATABASE_PROVIDER: "invalid" },
    { WARD_COORDINATOR_USER_IDS: "00000000-0000-0000-0000-000000000000" },
    { WARD_DATA_MODE: "live" },
    { WARD_ALLOWED_ORIGIN: "*" },
  ])
    assert.throws(() => readConfig({ ...env, ...override }));
});

test("database and identity selectors are independent, with Azure and Entra as defaults", () => {
  const entra = {
    AZURE_TENANT_ID: "11111111-1111-4111-8111-111111111111",
    WARD_API_AUDIENCE: "9b7b160d-9bc7-4712-b748-17ff3e70b706",
    WARD_ALLOWED_OBJECT_ID: coordinator,
  };
  const supabaseDatabaseEntra = readConfig({
    ...env,
    ...entra,
    WARD_AUTH_PROVIDER: "entra",
    WARD_SUPABASE_PUBLISHABLE_KEY: undefined,
  });
  assert.equal(supabaseDatabaseEntra.databaseProvider, "supabase");
  assert.equal(supabaseDatabaseEntra.authProvider, "entra");
  assert.equal(supabaseDatabaseEntra.storage, null);
  const azureDatabaseSupabase = readConfig({
    ...env,
    WARD_DATABASE_PROVIDER: "azure",
    WARD_SHARED_ENABLED: "false",
    AzureWebJobsStorage__accountName: "wflowdev7273a083aue",
  });
  assert.equal(azureDatabaseSupabase.databaseProvider, "azure");
  assert.equal(azureDatabaseSupabase.authProvider, "supabase");
  assert.equal(azureDatabaseSupabase.storage.account, "wflowdev7273a083aue");
  const defaults = readConfig({ ...entra, AzureWebJobsStorage__accountName: "wflowdev7273a083aue" });
  assert.equal(defaults.databaseProvider, "azure");
  assert.equal(defaults.authProvider, "entra");
});

test("Supabase verifies only through the pinned Auth service and ignores client roles", async () => {
  const { createSupabaseAuthenticator } = await import("./supabase-auth.mjs");
  let calls = 0;
  const authenticate = createSupabaseAuthenticator(readConfig(env), {
    fetch: async (url, options) => {
      calls++;
      assert.equal(url, `${env.WARD_SUPABASE_URL}/auth/v1/user`);
      assert.equal(options.headers.apikey, env.WARD_SUPABASE_PUBLISHABLE_KEY);
      assert.match(options.headers.Authorization, /^Bearer synthetic-(?:coordinator|other)$/);
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      // A client-controlled role never grants access; only the allowlisted user id does.
      const id = options.headers.Authorization.endsWith("coordinator") ? coordinator : other;
      return Response.json({ id, app_metadata: { role: "coordinator" } });
    },
  });
  assert.equal(await authenticate("Bearer synthetic-coordinator"), coordinator);
  await assert.rejects(authenticate("Bearer synthetic-other"), /Unauthorised/);
  await assert.rejects(authenticate("Bearer bad token"));
  assert.equal(calls, 2);
});

test("Supabase credential rejection differs from verification outages and has a bounded deadline", async () => {
  const { createSupabaseAuthenticator } = await import("./supabase-auth.mjs");
  const { VerifierUnavailableError } = await import("./auth.mjs");
  for (const status of [401, 403]) {
    const authenticate = createSupabaseAuthenticator(readConfig(env), {
      fetch: async () => new Response(null, { status }),
    });
    await assert.rejects(authenticate("Bearer synthetic"), (error) => !(error instanceof VerifierUnavailableError));
  }
  for (const fetch of [
    async () => new Response(null, { status: 503 }),
    async () => Response.json({ id: "invalid" }),
    async () => {
      throw new Error("private upstream message");
    },
    async () => {
      throw new Error("Unauthorised");
    },
    (_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
    async () => new Response(new ReadableStream({ start() {} })),
  ]) {
    const authenticate = createSupabaseAuthenticator(readConfig(env), { fetch, timeoutMs: 20 });
    await assert.rejects(authenticate("Bearer synthetic"), VerifierUnavailableError);
  }
});

test("Supabase shared routes retain UUID allowlisting, 401/503 distinction and unchanged response shapes", async () => {
  const { VerifierUnavailableError } = await import("./auth.mjs");
  for (const [actor, status] of [
    [coordinator, 200],
    [other, 403],
    [new Error("invalid"), 401],
    [new VerifierUnavailableError(), 503],
  ]) {
    let read = false;
    const handler = createHandler({
      config: readConfig(env),
      authenticate: async () => {
        if (actor instanceof Error) throw actor;
        return actor;
      },
      sharedStore: {
        read: async () => {
          read = true;
          return { revision: 1, dataMode: "prototype" };
        },
      },
    });
    const response = await handler(
      new Request("http://backend/v1/workspace", { headers: { Authorization: "Bearer synthetic" } }),
    );
    assert.equal(response.status, status);
    assert.equal(read, status === 200);
    const body = await response.json();
    assert.doesNotMatch(JSON.stringify(body), /Microsoft/);
    if (status === 200) assert.deepEqual(body.data, { mode: "prototype", source: "synthetic", liveAvailable: false });
  }
});

test("Supabase pool keeps verified TLS, bounded connections and runtime role checks", async () => {
  const { createSupabasePool } = await import("./supabase-postgres.mjs");
  let options;
  class FakePool {
    constructor(value) {
      options = value;
    }
    on() {}
  }
  createSupabasePool(readConfig(env).postgres, { Pool: FakePool });
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.equal(options.max, 4);
  assert.equal(options.connectionTimeoutMillis, 6000);
  assert.equal(options.statement_timeout, 10000);
  assert.equal(options.connectionString, env.WARD_SUPABASE_DATABASE_URL);
  assert.throws(() =>
    createSupabasePool(
      { connectionString: env.WARD_SUPABASE_DATABASE_URL.replace("wardflow_backend.", "postgres.") },
      { Pool: FakePool },
    ),
  );
});

test("Supabase pool adds only the configured CA and fails closed for unreadable or invalid certificates", async () => {
  const { createSupabasePool } = await import("./supabase-postgres.mjs");
  const { mkdtemp, writeFile, unlink, rmdir } = await import("node:fs/promises");
  const { rootCertificates } = await import("node:tls");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "wardflow-task3-ca-"));
  const file = join(directory, "ca.pem");
  let options;
  class FakePool {
    constructor(value) {
      options = value;
    }
    on() {}
  }
  try {
    await writeFile(file, rootCertificates[0]);
    const config = readConfig({ ...env, WARD_SUPABASE_CA_CERT_FILE: file });
    assert.equal(config.postgres.caCertificateFile, file);
    createSupabasePool(config.postgres, { Pool: FakePool });
    assert.equal(options.ssl.ca, rootCertificates[0]);
    assert.equal(options.ssl.rejectUnauthorized, true);
    await writeFile(file, "invalid certificate");
    assert.throws(() => createSupabasePool(config.postgres, { Pool: FakePool }));
    await unlink(file);
    assert.throws(() => createSupabasePool(config.postgres, { Pool: FakePool }));
  } finally {
    try {
      await unlink(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rmdir(directory);
  }
});

test("Supabase startup selects no Azure factory and readiness needs only the shared database", async () => {
  const { createBackend } = await import("./providers.mjs");
  const pool = { end: async () => {} };
  let poolOptions;
  const sharedStore = { ready: async () => {}, read: async () => ({ revision: 1, dataMode: "prototype" }) };
  const backend = await createBackend(readConfig(env), {
    azure: async () => {
      throw new Error("Azure must not initialise");
    },
    supabase: async () => ({
      createPool: (config) => {
        poolOptions = config;
        return pool;
      },
      createAuthenticator: () => async () => coordinator,
    }),
    workspace: async () => ({ createWorkspaceStore: () => sharedStore }),
    engine: async () => ({}),
  });
  assert.equal(backend.pool, pool);
  assert.equal(backend.store, null);
  assert.equal(poolOptions.connectionString, env.WARD_SUPABASE_DATABASE_URL);
  const handler = createHandler(backend);
  const response = await handler(
    new Request("http://backend/readyz", { headers: { Authorization: "Bearer synthetic" } }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { database: "ready" });
  assert.equal((await handler(new Request("http://backend/v1/sessions/" + coordinator))).status, 404);
});

test("backend startup failure releases the created pool", async () => {
  const { createBackend } = await import("./providers.mjs");
  let closed = false;
  await assert.rejects(
    createBackend(readConfig(env), {
      supabase: async () => ({
        createPool: () => ({
          end: async () => {
            closed = true;
          },
        }),
        createAuthenticator: () => async () => coordinator,
      }),
      workspace: async () => {
        throw new Error("engine unavailable");
      },
      engine: async () => ({}),
    }),
  );
  assert.equal(closed, true);
});

test("database selection never determines identity selection", async () => {
  const { createBackend } = await import("./providers.mjs");
  let azureStorage = 0;
  const azure = async () => ({
    openStorage: async () => {
      azureStorage++;
      return {};
    },
    createStore: () => ({}),
    createAuthenticator: () => {
      throw new Error("Wrong identity factory");
    },
  });
  const config = readConfig({
    ...env,
    WARD_DATABASE_PROVIDER: "azure",
    WARD_SHARED_ENABLED: "false",
    AzureWebJobsStorage__accountName: "wflowdev7273a083aue",
  });
  const backend = await createBackend(config, { azure, supabaseAuth: () => async () => coordinator });
  assert.equal(await backend.authenticate("Bearer synthetic"), coordinator);
  assert.equal(azureStorage, 1);
  const supabase = await createBackend(
    { ...readConfig(env), authProvider: "entra" },
    {
      azure: async () => {
        throw new Error("Azure database must not initialise");
      },
      supabase: async () => ({
        createPool: () => ({}),
        createAuthenticator: () => {
          throw new Error("Wrong identity factory");
        },
      }),
      entraAuth: () => async () => coordinator,
      workspace: async () => ({ createWorkspaceStore: () => ({}) }),
      engine: async () => ({}),
    },
  );
  assert.equal(await supabase.authenticate("Bearer synthetic"), coordinator);
  assert.equal(supabase.store, null);
});

test("startup verifies the actual runtime role and rejects administrator sessions", async () => {
  const { verifySupabaseRuntimeRole } = await import("./supabase-postgres.mjs");
  const prepared = {
    role: "wardflow_backend",
    safe_flags: true,
    no_memberships: true,
    no_ownership: true,
    schema_grants: true,
    required_grants: true,
    restricted_grants: true,
    push_grants: true,
    audit_append_only: true,
    browser_denied: true,
    guards_valid: true,
    versions: [1, 2, 3, 4],
  };
  const unsafe = { message: "Unsafe or unprepared Supabase database runtime" };
  await verifySupabaseRuntimeRole({ query: async () => ({ rows: [prepared] }) });
  for (const role of ["postgres", "supabase_admin", undefined]) {
    await assert.rejects(verifySupabaseRuntimeRole({ query: async () => ({ rows: [{ ...prepared, role }] }) }), unsafe);
  }
  // A correctly named role is still refused when any privilege check fails.
  for (const field of Object.keys(prepared).filter((key) => key !== "role" && key !== "versions")) {
    await assert.rejects(
      verifySupabaseRuntimeRole({ query: async () => ({ rows: [{ ...prepared, [field]: false }] }) }),
      unsafe,
    );
  }
  await assert.rejects(
    verifySupabaseRuntimeRole({ query: async () => ({ rows: [{ ...prepared, versions: [1, 2, 3] }] }) }),
    unsafe,
  );
  await assert.rejects(
    verifySupabaseRuntimeRole({
      query: async () => {
        throw new Error("synthetic outage");
      },
    }),
    { message: "Supabase database runtime verification unavailable" },
  );
});

test("private-schema SQL gives the runtime no audit mutation, DDL or browser role access", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("./infra/supabase-runtime-role.sql", import.meta.url), "utf8");
  assert.match(sql, /NOBYPASSRLS NOINHERIT/);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA ward_flow FROM PUBLIC, anon, authenticated, wardflow_backend/);
  assert.match(sql, /GRANT SELECT, INSERT ON ward_flow.commands, ward_flow.audit TO wardflow_backend/);
  assert.doesNotMatch(sql, /GRANT (?:ALL|CREATE|.*(?:DELETE|UPDATE).*audit)/);
  assert.doesNotMatch(sql, /GRANT .* TO (?:anon|authenticated|PUBLIC)/);
});

const localDatabase = process.env.WARD_TEST_DATABASE_URL;
if (localDatabase && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(localDatabase).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

test(
  "local PostgreSQL: runtime role can transact but cannot migrate, change audit or expose browser tables",
  { skip: !localDatabase },
  async () => {
    const { Pool } = await import("pg");
    const { readFile } = await import("node:fs/promises");
    const { randomUUID } = await import("node:crypto");
    const { migrate } = await import("./migrate.mjs");
    const { createWorkspaceStore } = await import("./postgres.mjs");
    const { verifySupabaseRuntimeRole } = await import("./supabase-postgres.mjs");
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: localDatabase, max: 1 });
    let runtime;
    try {
      await migrate(admin);
      await admin.query(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$",
      );
      await admin.query(await readFile(new URL("./infra/supabase-runtime-role.sql", import.meta.url), "utf8"));
      // Disposable local fixture only; never used in a production configuration.
      await admin.query("ALTER ROLE wardflow_backend PASSWORD 'synthetic-local-task3'");
      const url = new URL(localDatabase);
      url.username = "wardflow_backend";
      url.password = "synthetic-local-task3";
      runtime = new Pool({ connectionString: url.href, max: 1 });
      await verifySupabaseRuntimeRole(runtime);
      const store = createWorkspaceStore(runtime, { workspaceId: randomUUID(), engine });
      await store.ready();
      const initial = await store.read(coordinator);
      assert.equal(initial.revision, 1);
      const event = { type: "RESET_SCENARIO", role: "demo" };
      assert.equal(engine.validCommand(event), true, "fixture must be a recognised command");
      const committed = await store.command(coordinator, randomUUID(), initial.revision, event);
      assert.equal(committed.status, 200);
      assert.equal((await store.audit()).length, 2);
      for (const sql of [
        "CREATE TABLE ward_flow.runtime_ddl(id integer)",
        "INSERT INTO ward_flow.migrations(version) VALUES(99)",
        "DELETE FROM ward_flow.audit",
        "UPDATE ward_flow.audit SET action='tampered'",
        "TRUNCATE ward_flow.audit",
      ])
        await assert.rejects(runtime.query(sql), (error) => error.code === "42501");
      const { rows } = await admin.query(
        "SELECT has_schema_privilege('anon','ward_flow','USAGE') AS anon, has_schema_privilege('authenticated','ward_flow','USAGE') AS authenticated",
      );
      assert.deepEqual(rows[0], { anon: false, authenticated: false });
    } finally {
      await runtime?.end();
      await admin.end();
    }
  },
);
