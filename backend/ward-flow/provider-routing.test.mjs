import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  AUTH_PROVIDERS,
  DATABASE_PROVIDERS,
  DEFAULT_AUTH_PROVIDER,
  DEFAULT_DATABASE_PROVIDER,
  readConfig,
} from "./config.mjs";
import { AUTH_ADAPTERS, DATABASE_ADAPTERS, createBackend } from "./providers.mjs";
import { createHandler } from "./server.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import { VerifierUnavailableError } from "./auth.mjs";
import { syntheticDatabaseUrl } from "./synthetic-database-url.test-support.mjs";
import { STATEWIDE_VIEW, bootstrapViewer } from "./viewer.test-support.mjs";

function environment(databaseProvider, authProvider) {
  const databaseUrl =
    databaseProvider === "supabase"
      ? syntheticDatabaseUrl({ host: `db.${APPROVED_SUPABASE_PROJECT}.supabase.co`, database: "postgres" })
      : syntheticDatabaseUrl();
  return {
    WARD_DATABASE_PROVIDER: databaseProvider,
    WARD_AUTH_PROVIDER: authProvider,
    WARD_SHARED_ENABLED: "true",
    WARD_DATA_MODE: "prototype",
    WARD_WORKSPACE_ID: randomUUID(),
    WARD_COORDINATOR_USER_IDS: randomUUID(),
    WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
    WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
    WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
    WARD_SUPABASE_DATABASE_URL: databaseUrl,
    WARD_POSTGRES_DATABASE_URL: databaseUrl,
    WARD_ALLOWED_ORIGIN: "http://127.0.0.1:8799",
  };
}

for (const databaseProvider of Object.keys(DATABASE_PROVIDERS)) {
  for (const authProvider of Object.keys(AUTH_PROVIDERS)) {
    test(`${databaseProvider}/${authProvider} independently selects factories and preserves shared HTTP contracts offline`, async () => {
      const env = environment(databaseProvider, authProvider);
      const config = readConfig(env);
      assert.equal(config.databaseProvider, databaseProvider);
      assert.equal(config.authProvider, authProvider);
      assert.equal(config.push, null);
      assert.deepEqual(config.coordinatorIds, [env.WARD_COORDINATOR_USER_IDS]);
      const calls = [];
      const pool = { end: async () => calls.push("end") };
      const authenticate = async (header) => {
        if (header !== "Bearer synthetic-offline-token") throw new Error("denied");
        return config.coordinatorIds[0];
      };
      const sharedStore = {
        viewer: bootstrapViewer,
        ready: async () => calls.push("database-ready"),
        read: async () => ({ revision: 1, payload: {}, dataMode: "prototype" }),
        audit: async () => [{ action: "synthetic" }],
        command: async (...args) => {
          calls.push(args);
          return { status: 409, body: { code: "stale", revision: 2 } };
        },
      };
      const loader = async () => {
        calls.push(databaseProvider);
        return {
          createPool: async (received) => {
            assert.equal(received, config.postgres);
            return pool;
          },
          verifyPool: async (received, settings) => {
            assert.equal(received, pool);
            assert.equal(settings.pushEnabled, false);
            calls.push("verify");
          },
        };
      };
      const forbidden = async () => {
        throw new Error("unselected database provider was loaded");
      };
      const dependencies = {
        database: Object.fromEntries(
          Object.keys(DATABASE_PROVIDERS).map((name) => [name, name === databaseProvider ? loader : forbidden]),
        ),
        auth: {
          [authProvider]: async () => async () => {
            calls.push(`${authProvider}-auth`);
            return authenticate;
          },
        },
        workspace: async () => ({
          createWorkspaceStore: (received, settings) => {
            assert.equal(received, pool);
            assert.equal(settings.workspaceId, config.workspaceId);
            assert.equal(settings.push, null);
            return sharedStore;
          },
        }),
        engine: async () => ({ fixture: "synthetic" }),
      };
      const backend = await createBackend(config, dependencies);
      assert.equal(backend.pool, pool);
      assert.equal(backend.sharedStore, sharedStore);
      assert.ok(calls.includes(`${authProvider}-auth`));
      const handler = createHandler({ ...backend, log: () => {} });
      const request = (path, options = {}) =>
        new Request(`http://127.0.0.1:8799${path}`, {
          ...options,
          headers: { authorization: "Bearer synthetic-offline-token", origin: config.origin, ...options.headers },
        });
      assert.equal((await handler(request("/readyz", { headers: { authorization: "" } }))).status, 401);
      const ready = await handler(request("/readyz"));
      assert.deepEqual(await ready.json(), { database: "ready" });
      const read = await handler(request("/v1/workspace"));
      assert.equal(read.status, 200);
      const envelope = await read.json();
      assert.deepEqual(envelope.data, { mode: "prototype", source: "synthetic", liveAvailable: false });
      assert.equal(envelope.role, "coordinator");
      assert.equal(envelope.actorId, config.coordinatorIds[0]);
      assert.deepEqual(await (await handler(request("/v1/workspace/audit"))).json(), {
        events: [{ action: "synthetic" }],
      });
      assert.deepEqual(await (await handler(request("/v1/workspace/push-key"))).json(), { enabled: false });
      const commandId = randomUUID().toUpperCase();
      const body = { classification: "synthetic", commandId, expectedRevision: 1, event: { type: "synthetic" } };
      const post = (value) =>
        request("/v1/workspace/commands", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(value),
        });
      assert.equal((await handler(post({ ...body, classification: "live" }))).status, 400);
      const response = await handler(post(body));
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { code: "stale", revision: 2 });
      assert.deepEqual(calls.at(-1), [
        config.coordinatorIds[0],
        commandId.toLowerCase(),
        1,
        body.event,
        { revisionOnly: false, view: { ...STATEWIDE_VIEW, actorId: config.coordinatorIds[0] } },
      ]);
      assert.equal(
        (await handler(request("/v1/workspace", { headers: { origin: "https://unapproved.invalid" } }))).status,
        403,
      );
      // The retired Azure Blob session vault route no longer exists.
      assert.equal((await handler(request("/v1/sessions/" + randomUUID()))).status, 404);
    });
  }
}

test("omitted selectors default to Supabase, and retired, unknown or live configuration is refused", () => {
  assert.equal(DEFAULT_DATABASE_PROVIDER, "supabase");
  assert.equal(DEFAULT_AUTH_PROVIDER, "supabase");
  assert.deepEqual(Object.keys(DATABASE_PROVIDERS), Object.keys(DATABASE_ADAPTERS));
  assert.deepEqual(Object.keys(AUTH_PROVIDERS), Object.keys(AUTH_ADAPTERS));
  const env = environment("supabase", "supabase");
  delete env.WARD_DATABASE_PROVIDER;
  delete env.WARD_AUTH_PROVIDER;
  assert.equal(readConfig(env).databaseProvider, "supabase");
  assert.equal(readConfig(env).authProvider, "supabase");
  for (const patch of [
    { WARD_DATABASE_PROVIDER: "azure" },
    { WARD_AUTH_PROVIDER: "entra" },
    { WARD_DATABASE_PROVIDER: "mysql" },
    { WARD_AUTH_PROVIDER: "none" },
    { WARD_DATA_MODE: "live" },
  ])
    assert.throws(() => readConfig({ ...env, ...patch }), /configuration|commissioned/);
  // With the shared workspace off, the database selector is accepted but no PostgreSQL target is read.
  for (const provider of Object.keys(DATABASE_PROVIDERS)) {
    const config = readConfig({ ...environment(provider, "supabase"), WARD_SHARED_ENABLED: "false" });
    assert.equal(config.shared, false);
    assert.equal(config.postgres, null);
  }
});

test("provider startup cleans up the created pool on verification or engine failure", async () => {
  for (const stage of ["verify", "engine", "workspace"]) {
    let closed = 0;
    const pool = {
      end: async () => {
        closed++;
      },
    };
    const config = readConfig(environment("postgres", "supabase"));
    const fail = () => {
      throw new Error("synthetic startup failure");
    };
    await assert.rejects(
      createBackend(config, {
        database: {
          postgres: async () => ({
            createPool: async () => pool,
            verifyPool: stage === "verify" ? fail : async () => {},
          }),
        },
        auth: { supabase: async () => async () => async () => config.coordinatorIds[0] },
        engine: stage === "engine" ? fail : async () => ({}),
        workspace: async () => ({ createWorkspaceStore: stage === "workspace" ? fail : () => ({}) }),
      }),
      /synthetic startup failure/,
    );
    assert.equal(closed, 1);
  }
});

test("shared HTTP authorisation and verifier outages never reach the store", async () => {
  const config = readConfig(environment("postgres", "supabase"));
  let reads = 0;
  const sharedStore = {
    viewer: bootstrapViewer,
    read: async () => {
      reads++;
    },
  };
  for (const [authenticate, expected] of [
    [async () => randomUUID(), 403],
    [
      async () => {
        throw new Error("denied");
      },
      401,
    ],
    [
      async () => {
        throw new VerifierUnavailableError("invented diagnostic");
      },
      503,
    ],
  ]) {
    const response = await createHandler({ config, sharedStore, authenticate, log: () => {} })(
      new Request("http://127.0.0.1/v1/workspace"),
    );
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /invented diagnostic/);
  }
  assert.equal(reads, 0);
});

test("the sign-in check asks the shared workspace whether an account holds a role", async () => {
  const config = readConfig(environment("postgres", "supabase"));
  const nurse = randomUUID();
  let knownSubject;
  await createBackend(config, {
    database: {
      postgres: async () => ({ createPool: async () => ({ end: async () => {} }), verifyPool: async () => {} }),
    },
    auth: {
      supabase: async () => async (_config, dependencies) => {
        knownSubject = dependencies.knownSubject;
        return async () => config.coordinatorIds[0];
      },
    },
    engine: async () => ({}),
    workspace: async () => ({ createWorkspaceStore: () => ({ hasRole: async (subject) => subject === nurse }) }),
  });
  assert.equal(await knownSubject(nurse), true);
  assert.equal(await knownSubject(randomUUID()), false);
});
