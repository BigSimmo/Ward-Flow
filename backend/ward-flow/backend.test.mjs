import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { APPROVED_STORAGE_ACCOUNTS, readConfig } from "./config.mjs";
import { createHandler, registerShutdown } from "./server.mjs";
import { createStore, validStoredSession } from "./database.mjs";
import { handleHttp } from "./function.mjs";
import { createAuthenticator } from "./auth.mjs";

// Kept byte-identical so the formatting pass does not re-add the pinned audience line.
// prettier-ignore
const environment = {
  AZURE_TENANT_ID: '11111111-1111-4111-8111-111111111111',
  WARD_API_AUDIENCE: '9b7b160d-9bc7-4712-b748-17ff3e70b706',
  WARD_ALLOWED_OBJECT_ID: '22222222-2222-4222-8222-222222222222',
  AzureWebJobsStorage__accountName: 'wflowdev7273a083aue',
};
const config = readConfig(environment);
const id = environment.AZURE_TENANT_ID;
const body = {
  expectedRevision: 0,
  classification: "synthetic",
  payload: { version: 5, state: { scenario: "standard" } },
};

test("configuration pins the existing storage account", () => {
  assert.equal(config.storage.account, "wflowdev7273a083aue");
  assert.equal(config.storage.container, "ward-flow-sessions");
  assert.equal(config.host, "127.0.0.1");
});
test("missing identity configuration fails closed", () => {
  for (const key of Object.keys(environment)) {
    const invalid = { ...environment };
    delete invalid[key];
    assert.throws(() => readConfig(invalid), /configuration/);
  }
});

test("example and nil identity UUIDs fail closed", () => {
  for (const [key, value] of [
    ["AZURE_TENANT_ID", "00000000-0000-4000-8000-000000000000"],
    ["WARD_ALLOWED_OBJECT_ID", "00000000-0000-4000-8000-000000000001"],
    ["AZURE_TENANT_ID", "00000000-0000-0000-0000-000000000000"],
  ])
    assert.throws(() => readConfig({ ...environment, [key]: value }), /Invalid identity configuration/);
});

test("configured UUID casing matches lower-case Entra token claims", async () => {
  const mixed = readConfig({
    ...environment,
    AZURE_TENANT_ID: environment.AZURE_TENANT_ID.toUpperCase(),
    WARD_ALLOWED_OBJECT_ID: environment.WARD_ALLOWED_OBJECT_ID.toUpperCase(),
  });
  assert.equal(mixed.tenant, environment.AZURE_TENANT_ID);
  assert.equal(mixed.allowedObjectId, environment.WARD_ALLOWED_OBJECT_ID);
  const authenticate = await createAuthenticator(mixed, {
    keys: {},
    jose: {
      jwtVerify: async (_token, _keys, options) => {
        assert.equal(options.issuer, `https://login.microsoftonline.com/${environment.AZURE_TENANT_ID}/v2.0`);
        return {
          payload: {
            tid: environment.AZURE_TENANT_ID,
            oid: environment.WARD_ALLOWED_OBJECT_ID,
            scp: "WardFlow.Access",
          },
        };
      },
    },
  });
  assert.equal(await authenticate("Bearer synthetic-token"), environment.WARD_ALLOWED_OBJECT_ID);
});
test("configuration refuses alternate storage accounts and wildcard origins", () => {
  assert.throws(() => readConfig({ ...environment, AzureWebJobsStorage__accountName: "other" }));
  assert.throws(() => readConfig({ ...environment, WARD_ALLOWED_ORIGIN: "*" }));
});

function setup(overrides = {}) {
  const calls = [];
  const store = {
    read: async (...args) => {
      calls.push(["read", ...args]);
      return null;
    },
    save: async (...args) => {
      calls.push(["save", ...args]);
      return 1;
    },
    ready: async () => {},
    ...overrides,
  };
  return {
    calls,
    handler: createHandler({
      config,
      store,
      authenticate: async (token) => {
        if (token !== "Bearer accepted") throw new Error("secret diagnostic");
        return environment.WARD_ALLOWED_OBJECT_ID;
      },
      log: () => {},
    }),
  };
}
function request(method = "GET", data, headers = {}) {
  return new Request(`http://localhost/v1/sessions/${id}`, {
    method,
    headers: { authorization: "Bearer accepted", "content-type": "application/json", ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
test("unauthenticated calls never reach storage or expose diagnostics", async () => {
  const { handler, calls } = setup();
  const response = await handler(request("GET", undefined, { authorization: "" }));
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
  assert.doesNotMatch(await response.text(), /secret/);
});
test("approved caller can save a bounded synthetic snapshot", async () => {
  const { handler, calls } = setup();
  const response = await handler(request("PUT", body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { revision: 1 });
  assert.equal(calls[0][1], environment.WARD_ALLOWED_OBJECT_ID);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("missing sessions are reported without inventing a successful restore", async () => {
  const { handler } = setup();
  assert.equal((await handler(request())).status, 404);
});
test("concurrent save conflicts return 409 instead of overwriting", async () => {
  const { handler } = setup({ save: async () => null });
  assert.equal((await handler(request("PUT", body))).status, 409);
});
test("real-data labels, malformed revisions and oversized bodies are rejected", async () => {
  const { handler, calls } = setup();
  for (const invalid of [
    { ...body, classification: "clinical" },
    { ...body, expectedRevision: -1 },
    { ...body, expectedRevision: 0.5 },
    { ...body, payload: null },
  ])
    assert.equal((await handler(request("PUT", invalid))).status, 400);
  assert.equal((await handler(request("PUT", { ...body, payload: { text: "x".repeat(1_048_577) } }))).status, 413);
  assert.equal(calls.length, 0);
});
test("cross-origin requests are denied before storage access", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request("PUT", body, { origin: "https://attacker.example" }))).status, 403);
  assert.equal(calls.length, 0);
});
test("storage failures return unavailable without credentials or payloads", async () => {
  const { handler } = setup({
    read: async () => {
      throw new Error("password=secret");
    },
  });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /password|secret/);
});
test("store scopes blobs by owner and uses conditional writes", async () => {
  const calls = [];
  let record;
  let etag = '"first"';
  const store = createStore({
    ...config.storage,
    request: async (method, url, value, headers = {}) => {
      calls.push({ method, url, headers });
      if (url.endsWith("?restype=container")) return new Response(null, { status: 201 });
      if (method === "GET")
        return record
          ? new Response(JSON.stringify(record), { status: 200, headers: { etag } })
          : new Response(null, { status: 404, headers: { "x-ms-error-code": "BlobNotFound" } });
      if (record && headers["if-match"] !== etag) return new Response(null, { status: 412 });
      if (!record && headers["if-none-match"] !== "*") return new Response(null, { status: 412 });
      record = JSON.parse(value);
      etag = '"second"';
      return new Response(null, { status: 201 });
    },
  });
  const owner = environment.WARD_ALLOWED_OBJECT_ID;
  assert.equal(await store.save(owner, id, 0, body.payload), 1);
  assert.equal((await store.read(owner, id)).revision, 1);
  assert.equal(await store.save(owner, id, 1, body.payload), 2);
  assert.equal(await store.save(owner, id, 1, body.payload), null);
  assert.ok(
    calls.filter((call) => call.url.endsWith(".json")).every((call) => call.url.includes(`/${owner}/${id}.json`)),
  );
  assert.equal(calls.find((call) => call.headers["if-none-match"])?.headers["if-none-match"], "*");
  assert.equal(calls.find((call) => call.headers["if-match"])?.headers["if-match"], '"second"');
});

test("only BlobNotFound is a missing session; a lost container is unavailable", async () => {
  let errorCode = "BlobNotFound";
  const store = createStore({
    ...config.storage,
    request: async (_method, url) =>
      url.endsWith("?restype=container")
        ? new Response(null, { status: 201 })
        : new Response(null, { status: 404, headers: { "x-ms-error-code": errorCode } }),
  });
  assert.equal(await store.read(environment.WARD_ALLOWED_OBJECT_ID, id), null);
  errorCode = "ContainerNotFound";
  await assert.rejects(store.read(environment.WARD_ALLOWED_OBJECT_ID, id), /Session read unavailable/);
  const handler = createHandler({
    config,
    store,
    authenticate: async () => environment.WARD_ALLOWED_OBJECT_ID,
  });
  assert.equal((await handler(request())).status, 503);
});

test("malformed stored revision cannot be overwritten", async () => {
  let putCount = 0;
  for (const record of [{ payload: {} }, { revision: null, payload: {} }]) {
    const store = createStore({
      ...config.storage,
      request: async (method, url) => {
        if (url.endsWith("?restype=container")) return new Response(null, { status: 201 });
        if (method === "GET")
          return new Response(JSON.stringify(record), { status: 200, headers: { etag: '"existing"' } });
        putCount += 1;
        return new Response(null, { status: 201 });
      },
    });
    await assert.rejects(
      store.save(environment.WARD_ALLOWED_OBJECT_ID, id, 0, body.payload),
      /Invalid stored session envelope/,
    );
  }
  assert.equal(putCount, 0);
});

test("readiness rejects a container that is being deleted", async () => {
  const store = createStore({
    ...config.storage,
    request: async () => new Response(null, { status: 409, headers: { "x-ms-error-code": "ContainerBeingDeleted" } }),
  });
  await assert.rejects(store.ready(), /container unavailable/);
});

test("a competing blob write rejects the stale revision", async () => {
  const store = createStore({
    ...config.storage,
    request: async (method, url) => {
      if (url.endsWith("?restype=container")) return new Response(null, { status: 201 });
      if (method === "GET")
        return new Response(JSON.stringify({ revision: 1, payload: {}, updated_at: "2026-10-08T12:00:00.000Z" }), {
          status: 200,
          headers: { etag: '"original"' },
        });
      return new Response(null, { status: 412 });
    },
  });
  assert.equal(await store.save(environment.WARD_ALLOWED_OBJECT_ID, id, 1, body.payload), null);
});

test("Azure Functions adapter preserves the API response", async () => {
  const { handler } = setup();
  const incoming = request();
  const response = await handleHttp(incoming, { invocationId: "azure-test" }, async () => handler);
  assert.equal(response.status, 404);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.body.toString(), /Session not found/);
});

test("identity-provider outages return 503 while bad tokens stay 401", async () => {
  const outage = Object.assign(new Error("timed out"), { code: "ERR_JWKS_TIMEOUT" });
  const expired = Object.assign(new Error("expired"), { code: "ERR_JWT_EXPIRED" });
  for (const [failure, status] of [
    [outage, 503],
    [new TypeError("fetch failed"), 503],
    [expired, 401],
  ]) {
    const authenticate = await createAuthenticator(config, {
      keys: {},
      jose: {
        jwtVerify: async () => {
          throw failure;
        },
      },
    });
    const { calls } = setup();
    const handler = createHandler({ config, store: { read: async () => calls.push("read") }, authenticate });
    const response = await handler(request());
    assert.equal(response.status, status);
    assert.equal(calls.length, 0);
    assert.doesNotMatch(await response.text(), /timed out|fetch failed|expired"/);
  }
});

test("session ids are canonicalised so one session maps to one blob", async () => {
  const { handler, calls } = setup();
  const mixedCase = "ABCDEF01-aBcD-4EF0-8abc-DEF012345678";
  await handler(
    new Request(`http://localhost/v1/sessions/${mixedCase}`, { headers: { authorization: "Bearer accepted" } }),
  );
  assert.equal(calls[0][2], mixedCase.toLowerCase());
});

test("readiness contacts storage on every probe", async () => {
  let healthy = true;
  const store = createStore({
    ...config.storage,
    request: async () => new Response(null, { status: healthy ? 201 : 403 }),
  });
  await store.ready();
  healthy = false;
  await assert.rejects(store.ready(), /container unavailable/);
});

test("nonshared readiness reports storage readiness", async () => {
  const { handler } = setup();
  const response = await handler(
    new Request("http://localhost/readyz", { headers: { authorization: "Bearer accepted" } }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { storage: "ready" });
});

test("shared readiness probes both active stores on every authenticated request", async () => {
  const testAccount = {
    authorization: "Bearer synthetic-readiness-coordinator",
    objectId: environment.WARD_ALLOWED_OBJECT_ID,
  };
  const probes = [];
  let storageHealthy = true;
  let databaseHealthy = true;
  const handler = createHandler({
    config,
    authenticate: async (authorization) => {
      assert.equal(authorization, testAccount.authorization);
      return testAccount.objectId;
    },
    store: {
      ready: async () => {
        probes.push("storage");
        if (!storageHealthy) throw new Error("synthetic Blob diagnostic");
      },
    },
    sharedStore: {
      ready: async () => {
        probes.push("database");
        if (!databaseHealthy) throw new Error("synthetic PostgreSQL diagnostic");
      },
    },
  });
  const probe = () =>
    handler(new Request("http://localhost/readyz", { headers: { authorization: testAccount.authorization } }));
  let response = await probe();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { storage: "ready", database: "ready" });
  assert.deepEqual(probes, ["storage", "database"]);

  storageHealthy = false;
  response = await probe();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Storage unavailable; changes were not confirmed" });
  assert.deepEqual(probes, ["storage", "database", "storage"]);

  storageHealthy = true;
  databaseHealthy = false;
  response = await probe();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Storage unavailable; changes were not confirmed" });
  assert.deepEqual(probes, ["storage", "database", "storage", "storage", "database"]);

  databaseHealthy = true;
  response = await probe();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { storage: "ready", database: "ready" });
  assert.deepEqual(probes, ["storage", "database", "storage", "storage", "database", "storage", "database"]);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  test(`${signal} stops the listener before ending the pool exactly once`, async (t) => {
    const signals = new EventEmitter();
    const server = new EventEmitter();
    const order = [];
    let finishClose;
    server.close = t.mock.fn((callback) => {
      order.push("server");
      finishClose = callback;
    });
    const pool = { end: t.mock.fn(async () => order.push("pool")) };
    const close = registerShutdown(server, pool, signals);
    signals.emit(signal);
    const shutdown = close();
    signals.emit(signal === "SIGINT" ? "SIGTERM" : "SIGINT");
    assert.equal(close(), shutdown);
    assert.deepEqual(order, ["server"]);
    assert.equal(pool.end.mock.callCount(), 0);
    finishClose();
    await shutdown;
    assert.deepEqual(order, ["server", "pool"]);
    assert.equal(server.close.mock.callCount(), 1);
    assert.equal(pool.end.mock.callCount(), 1);
    assert.equal(signals.exitCode, undefined);
  });
}

test("listener startup errors still end the pool when the server is not running", async (t) => {
  const messages = [];
  t.mock.method(console, "error", (...args) => messages.push(args));
  const signals = new EventEmitter();
  const server = new EventEmitter();
  server.close = t.mock.fn((callback) =>
    callback(Object.assign(new Error("synthetic close diagnostic"), { code: "ERR_SERVER_NOT_RUNNING" })),
  );
  const pool = { end: t.mock.fn(async () => {}) };
  const close = registerShutdown(server, pool, signals);
  server.emit("error", new Error("synthetic listener diagnostic"));
  signals.emit("SIGTERM");
  await close();
  assert.equal(signals.exitCode, 1);
  assert.equal(server.close.mock.callCount(), 1);
  assert.equal(pool.end.mock.callCount(), 1);
  assert.deepEqual(messages, [["Backend listener unavailable"]]);
});

test("pool shutdown rejection is caught and logged without raw diagnostics", async (t) => {
  const messages = [];
  t.mock.method(console, "error", (...args) => messages.push(args));
  const signals = new EventEmitter();
  const server = new EventEmitter();
  server.close = t.mock.fn((callback) => callback());
  const pool = {
    end: t.mock.fn(async () => {
      throw new Error("synthetic private pool diagnostic");
    }),
  };
  const close = registerShutdown(server, pool, signals);
  signals.emit("SIGINT");
  await assert.doesNotReject(close());
  await close();
  assert.equal(signals.exitCode, 1);
  assert.equal(pool.end.mock.callCount(), 1);
  assert.deepEqual(messages, [["Backend shutdown unavailable"]]);
});

test("listener close errors still end the pool and produce sanitized shutdown failure", async (t) => {
  const messages = [];
  t.mock.method(console, "error", (...args) => messages.push(args));
  const signals = new EventEmitter();
  const server = new EventEmitter();
  server.close = t.mock.fn((callback) => callback(new Error("synthetic listener close diagnostic")));
  const pool = { end: t.mock.fn(async () => {}) };
  const close = registerShutdown(server, pool, signals);
  await close();
  assert.equal(signals.exitCode, 1);
  assert.equal(pool.end.mock.callCount(), 1);
  assert.deepEqual(messages, [["Backend shutdown unavailable"]]);
});

test("nonshared shutdown closes the listener without a pool", async (t) => {
  const signals = new EventEmitter();
  const server = new EventEmitter();
  server.close = t.mock.fn((callback) => callback());
  const close = registerShutdown(server, undefined, signals);
  signals.emit("SIGTERM");
  await close();
  assert.equal(server.close.mock.callCount(), 1);
  assert.equal(signals.exitCode, undefined);
});

test("storage account must be on the fixed Ward Flow allowlist, not merely agree between the two variables", () => {
  assert.deepEqual([...APPROVED_STORAGE_ACCOUNTS], ["wflowdev7273a083aue"]);
  const approved = readConfig({
    ...environment,
    AZURE_STORAGE_ACCOUNT: "wflowdev7273a083aue",
    AzureWebJobsStorage__accountName: "wflowdev7273a083aue",
  });
  assert.equal(approved.storage.account, "wflowdev7273a083aue");
  assert.throws(
    () =>
      readConfig({
        ...environment,
        AZURE_STORAGE_ACCOUNT: "customstorageacct",
        AzureWebJobsStorage__accountName: "customstorageacct",
      }),
    /Unapproved storage account/,
  );
  assert.throws(
    () =>
      readConfig({
        ...environment,
        AZURE_STORAGE_ACCOUNT: "wflowdev7273a083aue",
        AzureWebJobsStorage__accountName: "other",
      }),
    /Unapproved storage account/,
  );
});

test("unapproved storage account is refused even if both env variables agree", () => {
  assert.throws(
    () =>
      readConfig({
        ...environment,
        AZURE_STORAGE_ACCOUNT: "unapprovedstorageacct",
        AzureWebJobsStorage__accountName: "unapprovedstorageacct",
      }),
    /Unapproved storage account/,
  );
});

test("tenant users are accepted when WARD_ALLOW_TENANT_USERS is enabled", async () => {
  const tenantConfig = readConfig({
    ...environment,
    WARD_ALLOW_TENANT_USERS: "true",
  });
  assert.equal(tenantConfig.allowTenantUsers, true);
  const otherUserOid = "33333333-3333-4333-8333-333333333333";
  const authenticate = await createAuthenticator(tenantConfig, {
    keys: {},
    jose: {
      jwtVerify: async () => ({
        payload: {
          tid: environment.AZURE_TENANT_ID,
          oid: otherUserOid,
          scp: "WardFlow.Access",
        },
      }),
    },
  });
  assert.equal(await authenticate("Bearer accepted"), otherUserOid);
});

test("comma-separated coordinators and the legacy account are accepted without enabling tenant users", async () => {
  const coordinatorOids = ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
  const unlistedOid = "55555555-5555-4555-8555-555555555555";
  const coordinatorConfig = readConfig({
    ...environment,
    WARD_ALLOW_TENANT_USERS: "false",
    WARD_COORDINATOR_OBJECT_IDS: coordinatorOids.join(","),
  });
  assert.equal(coordinatorConfig.allowTenantUsers, false);
  assert.deepEqual(coordinatorConfig.coordinatorIds, coordinatorOids);
  for (const oid of coordinatorOids) {
    assert.notEqual(oid, coordinatorConfig.allowedObjectId);
  }
  const claims = {
    tid: environment.AZURE_TENANT_ID,
    oid: coordinatorOids[0],
    scp: "WardFlow.Access",
  };
  let payload = claims;
  const authenticate = await createAuthenticator(coordinatorConfig, {
    keys: {},
    jose: { jwtVerify: async () => ({ payload }) },
  });
  const authorization = request().headers.get("authorization");
  for (const oid of [...coordinatorOids, environment.WARD_ALLOWED_OBJECT_ID]) {
    payload = { ...claims, oid };
    assert.equal(await authenticate(authorization), oid);
  }
  for (const invalid of [
    { ...claims, oid: unlistedOid },
    { ...claims, scp: "" },
    { ...claims, tid: unlistedOid },
  ]) {
    payload = invalid;
    await assert.rejects(authenticate(authorization), /Unauthorised/);
  }
});

test("stored snapshots require a complete valid envelope and preserve corrupt data", async () => {
  const valid = { revision: 1, payload: {}, updated_at: "2026-10-08T12:00:00.000Z" };
  assert.equal(validStoredSession(valid), true);
  assert.equal(validStoredSession({ ...valid, updated_at: "2026-10-08T12:00:00Z" }), true);
  const invalid = [
    null,
    [],
    { revision: 1 },
    { ...valid, payload: [] },
    { ...valid, payload: null },
    { ...valid, updated_at: "tomorrow" },
    { ...valid, updated_at: "2026-02-31T12:00:00.000Z" },
    { ...valid, revision: 1.5 },
    { ...valid, revision: 2_147_483_647 },
    { ...valid, lastMutation: { requestId: id, expectedRevision: 0, digest: "0".repeat(64) } },
  ];
  for (const record of invalid) {
    assert.equal(validStoredSession(record), false);
    let writes = 0;
    const store = createStore({
      ...config.storage,
      request: async (method, url) => {
        if (url.endsWith("?restype=container")) return new Response(null, { status: 201 });
        if (method === "PUT") writes++;
        return new Response(JSON.stringify(record), { headers: { etag: '"saved"' } });
      },
    });
    await assert.rejects(store.read(environment.WARD_ALLOWED_OBJECT_ID, id), /envelope/);
    await assert.rejects(store.save(environment.WARD_ALLOWED_OBJECT_ID, id, 0, {}), /envelope/);
    await assert.rejects(store.delete(environment.WARD_ALLOWED_OBJECT_ID, id, 1), /envelope/);
    assert.equal(writes, 0);
  }
});

/** In-memory Blob CAS fixture: only the production store builds paths and conditional headers. */
function memoryBlobStore() {
  const blobs = new Map();
  let sequence = 0;
  let writes = 0;
  const store = createStore({
    ...config.storage,
    request: async (method, url, value, headers = {}) => {
      if (url.endsWith("?restype=container")) return new Response(null, { status: 201 });
      const current = blobs.get(url);
      if (method === "GET")
        return current
          ? new Response(current.value, { headers: { etag: current.etag } })
          : new Response(null, { status: 404, headers: { "x-ms-error-code": "BlobNotFound" } });
      if (current ? headers["if-match"] !== current.etag : headers["if-none-match"] !== "*")
        return new Response(null, { status: 412 });
      writes++;
      blobs.set(url, { value, etag: `"${++sequence}"` });
      return new Response(null, { status: 201 });
    },
  });
  return { store, blobs, writes: () => writes };
}

test("same request receipt retries recover success without another write", async () => {
  const { store, writes } = memoryBlobStore();
  const owner = environment.WARD_ALLOWED_OBJECT_ID;
  const requestId = "ABCDEF01-aBcD-4EF0-8abc-DEF012345678";
  assert.equal(await store.save(owner, id, 0, body.payload, requestId), 1);
  assert.equal(await store.save(owner, id, 0, body.payload, requestId), 1);
  assert.equal(writes(), 1);
  assert.equal(await store.save(owner, id, 0, { changed: true }, requestId), null);
  assert.equal(await store.save(owner, id, 1, body.payload, requestId), null);
  assert.equal(writes(), 1);
  assert.equal(await store.save(owner, id, 1, { next: true }), 2);
  assert.equal(await store.save(owner, id, 0, body.payload, requestId), null);
});

test("simultaneous identical receipt requests return one committed revision", async () => {
  const { store, writes } = memoryBlobStore();
  const results = await Promise.all([
    store.save(environment.WARD_ALLOWED_OBJECT_ID, id, 0, body.payload, id),
    store.save(environment.WARD_ALLOWED_OBJECT_ID, id, 0, body.payload, id),
  ]);
  assert.deepEqual(results, [1, 1]);
  assert.equal(writes(), 1);
});

test("simultaneous different snapshots do not lose the winning update", async () => {
  const { store, writes } = memoryBlobStore();
  const results = await Promise.all([
    store.save(environment.WARD_ALLOWED_OBJECT_ID, id, 0, { first: true }, id),
    store.save(environment.WARD_ALLOWED_OBJECT_ID, id, 0, { second: true }, environment.WARD_ALLOWED_OBJECT_ID),
  ]);
  assert.equal(results.filter((value) => value === 1).length, 1);
  assert.equal(results.filter((value) => value === null).length, 1);
  assert.equal(writes(), 1);
});

test("owner deletion clears content, is repeatable and retires the session ID", async () => {
  const { store, blobs, writes } = memoryBlobStore();
  const owner = environment.WARD_ALLOWED_OBJECT_ID;
  await store.save(owner, id, 0, { note: "invented-private-demo-content" }, id);
  assert.equal(await store.delete(environment.AZURE_TENANT_ID, id, 1), "not_found");
  assert.equal(await store.delete(owner, id, 2), "conflict");
  assert.equal(await store.delete(owner, id, 1), "deleted");
  assert.equal(await store.read(owner, id), null);
  assert.equal(await store.delete(owner, id, 1), "deleted");
  assert.equal(await store.save(owner, id, 0, body.payload), null);
  assert.equal(await store.save(owner, id, 1, body.payload), null);
  assert.equal(await store.save(owner, id, 0, { note: "invented-private-demo-content" }, id), null);
  assert.equal(writes(), 2);
  const stored = JSON.parse([...blobs.values()][0].value);
  assert.deepEqual(Object.keys(stored).sort(), ["deleted", "revision", "updated_at"]);
  assert.equal(validStoredSession(stored), true);
});

test("conditional deletion rejects a competing update", async () => {
  const store = createStore({
    ...config.storage,
    request: async (method, url) => {
      if (url.endsWith("?restype=container")) return new Response(null, { status: 201 });
      if (method === "GET")
        return new Response(JSON.stringify({ revision: 1, payload: {}, updated_at: "2026-10-08T12:00:00Z" }), {
          headers: { etag: '"old"' },
        });
      return new Response(null, { status: 412 });
    },
  });
  assert.equal(await store.delete(environment.WARD_ALLOWED_OBJECT_ID, id, 1), "conflict");
});

test("HTTP delete is authenticated, owner-scoped and revision-guarded", async () => {
  const calls = [];
  const { handler } = setup({
    delete: async (...args) => {
      calls.push(args);
      return "deleted";
    },
  });
  assert.equal((await handler(request("DELETE", { expectedRevision: 1 }, { authorization: "" }))).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await handler(request("DELETE", { expectedRevision: 0 }))).status, 400);
  assert.equal((await handler(request("DELETE", { expectedRevision: 1 }))).status, 204);
  assert.deepEqual(calls, [[environment.WARD_ALLOWED_OBJECT_ID, id, 1]]);
  for (const [outcome, status] of [
    ["conflict", 409],
    ["not_found", 404],
  ]) {
    const { handler: other } = setup({ delete: async () => outcome });
    assert.equal((await other(request("DELETE", { expectedRevision: 1 }))).status, status);
  }
});

test("request receipts are optional UUIDs and are passed canonically", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request("PUT", { ...body, requestId: "not-a-uuid" }))).status, 400);
  assert.equal(calls.length, 0);
  const mixedCase = "ABCDEF01-aBcD-4EF0-8abc-DEF012345678";
  assert.equal((await handler(request("PUT", { ...body, requestId: mixedCase }))).status, 200);
  assert.equal(calls[0][5], mixedCase.toLowerCase());
});

test("failure diagnostics correlate responses without request or exception contents", async () => {
  const events = [];
  const handler = createHandler({
    config,
    log: (event) => events.push(event),
    authenticate: async () => environment.WARD_ALLOWED_OBJECT_ID,
    store: {
      read: async () => {
        throw new Error("private-token-and-demo-content");
      },
    },
  });
  const response = await handler(
    new Request(`http://localhost/v1/sessions/${id}?private-query`, {
      headers: { authorization: "Bearer private-token-and-demo-content" },
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(events.length, 1);
  assert.equal(events[0].requestId, response.headers.get("x-request-id"));
  assert.equal(events[0].outcome, "storage_unavailable");
  assert.deepEqual(Object.keys(events[0]).sort(), [
    "durationMs",
    "event",
    "method",
    "outcome",
    "requestId",
    "route",
    "status",
  ]);
  assert.doesNotMatch(JSON.stringify(events), /private-token|private-query|demo-content/);
  const throwingLogger = createHandler({
    config,
    store: {},
    authenticate: async () => {
      throw new Error("private");
    },
    log: () => {
      throw new Error("logger failed");
    },
  });
  assert.equal((await throwingLogger(request())).status, 401);
});

test("adapter configuration failures have a sanitized response-correlated diagnostic", async () => {
  const events = [];
  const response = await handleHttp(
    request(),
    {},
    async () => {
      throw new Error("private configuration detail");
    },
    (event) => events.push(event),
  );
  assert.equal(response.status, 503);
  assert.equal(events[0].requestId, response.headers["x-request-id"]);
  assert.doesNotMatch(JSON.stringify(events), /private configuration/);
});
