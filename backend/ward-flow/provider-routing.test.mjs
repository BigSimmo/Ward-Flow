import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { readConfig } from "./config.mjs";
import { createBackend } from "./providers.mjs";
import { createHandler } from "./server.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import { VerifierUnavailableError } from "./auth.mjs";
import { syntheticDatabaseUrl } from "./synthetic-database-url.test-support.mjs";

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
    WARD_COORDINATOR_OBJECT_IDS: randomUUID(),
    AZURE_TENANT_ID: randomUUID(),
    WARD_API_AUDIENCE: "9b7b160d-9bc7-4712-b748-17ff3e70b706",
    WARD_ALLOWED_OBJECT_ID: randomUUID(),
    AzureWebJobsStorage__accountName: "wflowdev7273a083aue",
    WARD_PG_RESOURCE_ID: `/subscriptions/${randomUUID()}/resourceGroups/rg-wardflow-dev-aue/providers/Microsoft.DBforPostgreSQL/flexibleServers/wardflow-dev-aue`,
    WARD_PG_HOST: "wardflow-dev-aue.postgres.database.azure.com",
    WARD_PG_DATABASE: "wardflow_dev",
    WARD_PG_USER: "wardflow_backend",
    WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
    WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
    WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
    WARD_SUPABASE_DATABASE_URL: databaseUrl,
    WARD_POSTGRES_DATABASE_URL: databaseUrl,
    WARD_ALLOWED_ORIGIN: "http://127.0.0.1:8799",
  };
}

for (const databaseProvider of ["azure", "supabase", "postgres"]) {
  for (const authProvider of ["entra", "supabase"]) {
    test(`${databaseProvider}/${authProvider} independently selects factories and preserves shared HTTP contracts offline`, async () => {
      const env = environment(databaseProvider, authProvider);
      const config = readConfig(env);
      assert.equal(config.databaseProvider, databaseProvider);
      assert.equal(config.authProvider, authProvider);
      assert.equal(config.push, null);
      assert.deepEqual(config.coordinatorIds, [
        authProvider === "supabase" ? env.WARD_COORDINATOR_USER_IDS : env.WARD_COORDINATOR_OBJECT_IDS,
      ]);
      const calls = [];
      const pool = { end: async () => calls.push("end") };
      const authenticate = async (header) => {
        if (header !== "Bearer synthetic-offline-token") throw new Error("denied");
        return config.coordinatorIds[0];
      };
      const sharedStore = {
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
          createAuthenticator: async () => {
            calls.push("preset-auth");
            return authenticate;
          },
          createPool: async (received) => {
            assert.equal(received, config.postgres);
            return pool;
          },
          verifyPool: async (received, settings) => {
            assert.equal(received, pool);
            assert.equal(settings.pushEnabled, false);
            calls.push("verify");
          },
          openStorage: async () => {
            calls.push("blob");
            return {};
          },
          createStore: () => ({ ready: async () => calls.push("storage-ready") }),
        };
      };
      const forbidden = async () => {
        throw new Error("unselected database provider was loaded");
      };
      const dependencies = {
        azure: databaseProvider === "azure" ? loader : forbidden,
        supabase: databaseProvider === "supabase" ? loader : forbidden,
        postgres: databaseProvider === "postgres" ? loader : forbidden,
        entraAuth: async () => {
          calls.push("entra-auth");
          return authenticate;
        },
        supabaseAuth: async () => {
          calls.push("supabase-auth");
          return authenticate;
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
      assert.equal(calls.includes("blob"), databaseProvider === "azure");
      const expectedAuth =
        (databaseProvider === "azure" && authProvider === "entra") ||
        (databaseProvider === "supabase" && authProvider === "supabase")
          ? "preset-auth"
          : `${authProvider}-auth`;
      assert.ok(calls.includes(expectedAuth));
      const handler = createHandler({ ...backend, log: () => {} });
      const request = (path, options = {}) =>
        new Request(`http://127.0.0.1:8799${path}`, {
          ...options,
          headers: { authorization: "Bearer synthetic-offline-token", origin: config.origin, ...options.headers },
        });
      assert.equal((await handler(request("/readyz", { headers: { authorization: "" } }))).status, 401);
      const ready = await handler(request("/readyz"));
      assert.deepEqual(
        await ready.json(),
        databaseProvider === "azure" ? { storage: "ready", database: "ready" } : { database: "ready" },
      );
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
      assert.deepEqual(calls.at(-1), [config.coordinatorIds[0], commandId.toLowerCase(), 1, body.event]);
      assert.equal(
        (await handler(request("/v1/workspace", { headers: { origin: "https://unapproved.invalid" } }))).status,
        403,
      );
      assert.equal(
        (await handler(request("/v1/sessions/" + randomUUID()))).status,
        databaseProvider === "azure" ? 503 : 404,
      );
    });
  }
}

test("omitted selectors default to Supabase, retain legacy Azure/Entra fallback, and refuse invalid or live configuration", () => {
  const supabaseDefault = environment("supabase", "supabase");
  delete supabaseDefault.WARD_DATABASE_PROVIDER;
  delete supabaseDefault.WARD_AUTH_PROVIDER;
  assert.equal(readConfig(supabaseDefault).databaseProvider, "supabase");
  assert.equal(readConfig(supabaseDefault).authProvider, "supabase");

  const env = environment("azure", "entra");
  delete env.WARD_DATABASE_PROVIDER;
  delete env.WARD_AUTH_PROVIDER;
  delete env.WARD_SUPABASE_PROJECT_REF;
  delete env.WARD_SUPABASE_URL;
  delete env.WARD_SUPABASE_DATABASE_URL;
  assert.equal(readConfig(env).databaseProvider, "azure");
  assert.equal(readConfig(env).authProvider, "entra");
  for (const patch of [
    { WARD_DATABASE_PROVIDER: "mysql" },
    { WARD_AUTH_PROVIDER: "none" },
    { WARD_DATA_MODE: "live" },
    { WARD_PG_HOST: "other.invalid" },
    { AzureWebJobsStorage__accountName: "otherstorage" },
  ])
    assert.throws(() => readConfig({ ...env, ...patch }));
  for (const provider of ["postgres", "supabase"])
    assert.throws(
      () => readConfig({ ...environment(provider, "supabase"), WARD_SHARED_ENABLED: "false" }),
      /requires the shared/,
    );
});

test("provider startup cleans up the created pool on verification or engine failure", async () => {
  for (const stage of ["verify", "engine", "workspace"]) {
    let closed = 0;
    const pool = {
      end: async () => {
        closed++;
      },
    };
    const config = readConfig(environment("postgres", "entra"));
    const fail = () => {
      throw new Error("synthetic startup failure");
    };
    await assert.rejects(
      createBackend(config, {
        postgres: async () => ({
          createPool: async () => pool,
          verifyPool: stage === "verify" ? fail : async () => {},
        }),
        entraAuth: async () => async () => config.coordinatorIds[0],
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
    const response = await createHandler({ config, store: null, sharedStore, authenticate, log: () => {} })(
      new Request("http://127.0.0.1/v1/workspace"),
    );
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /invented diagnostic/);
  }
  assert.equal(reads, 0);
});
