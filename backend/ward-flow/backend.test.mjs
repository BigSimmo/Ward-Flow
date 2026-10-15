import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { readConfig } from "./config.mjs";
import { createHandler, registerShutdown } from "./server.mjs";
import { VerifierUnavailableError } from "./auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";

const coordinator = "22222222-2222-4222-8222-222222222222";
const environment = {
  WARD_COORDINATOR_USER_IDS: coordinator,
  WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
  WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
  WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
};
const config = readConfig(environment);

test("configuration defaults to Supabase on the loopback host", () => {
  assert.equal(config.databaseProvider, "supabase");
  assert.equal(config.authProvider, "supabase");
  assert.equal(config.supabase.projectRef, APPROVED_SUPABASE_PROJECT);
  assert.deepEqual(config.coordinatorIds, [coordinator]);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.shared, false);
});

test("missing identity configuration fails closed", () => {
  for (const key of Object.keys(environment)) {
    const invalid = { ...environment };
    delete invalid[key];
    assert.throws(() => readConfig(invalid), /configuration/);
  }
});

test("example and nil coordinator UUIDs fail closed and casing is normalised", () => {
  for (const value of ["00000000-0000-4000-8000-000000000000", "00000000-0000-0000-0000-000000000000", "x"])
    assert.throws(
      () => readConfig({ ...environment, WARD_COORDINATOR_USER_IDS: value }),
      /Invalid coordinator configuration/,
    );
  const mixed = readConfig({ ...environment, WARD_COORDINATOR_USER_IDS: ` ${coordinator.toUpperCase()} ` });
  assert.deepEqual(mixed.coordinatorIds, [coordinator]);
});

test("configuration refuses wildcard or insecure origins and invalid ports", () => {
  assert.throws(() => readConfig({ ...environment, WARD_ALLOWED_ORIGIN: "*" }));
  assert.throws(() => readConfig({ ...environment, WARD_ALLOWED_ORIGIN: "http://example.com" }));
  assert.throws(() => readConfig({ ...environment, PORT: "70000" }), /port/);
  assert.equal(
    readConfig({ ...environment, WARD_ALLOWED_ORIGIN: "http://localhost:3000" }).origin,
    "http://localhost:3000",
  );
});

function setup({ authenticate, sharedStore, log = () => {} } = {}) {
  const calls = [];
  return {
    calls,
    handler: createHandler({
      config,
      sharedStore,
      authenticate:
        authenticate ??
        (async (token) => {
          calls.push("authenticate");
          if (token !== "Bearer accepted") throw new Error("secret diagnostic");
          return coordinator;
        }),
      log,
    }),
  };
}
const ready = (headers = {}) =>
  new Request("http://localhost/readyz", { headers: { authorization: "Bearer accepted", ...headers } });

test("liveness needs no sign-in and unknown paths are not found", async () => {
  const { handler, calls } = setup();
  const health = await handler(new Request("http://localhost/healthz"));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { service: "ward-flow-backend" });
  // The retired Azure Blob session vault route is gone.
  assert.equal((await handler(new Request(`http://localhost/v1/sessions/${coordinator}`))).status, 404);
  assert.equal(calls.length, 0);
});

test("readiness requires sign-in and never exposes diagnostics", async () => {
  const { handler } = setup();
  const response = await handler(ready({ authorization: "" }));
  assert.equal(response.status, 401);
  assert.doesNotMatch(await response.text(), /secret/);
  assert.equal((await handler(ready())).status, 200);
});

test("identity-provider outages return 503 while bad tokens stay 401", async () => {
  for (const [failure, status] of [
    [new VerifierUnavailableError("timed out"), 503],
    [new Error("expired"), 401],
  ]) {
    const { handler } = setup({
      authenticate: async () => {
        throw failure;
      },
    });
    const response = await handler(ready());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /timed out|expired/);
  }
});

test("cross-origin requests are denied before sign-in", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(ready({ origin: "https://attacker.example" }))).status, 403);
  assert.equal(calls.length, 0);
});

test("readiness rejects other methods after sign-in", async () => {
  const { handler } = setup();
  assert.equal(
    (
      await handler(
        new Request("http://localhost/readyz", { method: "PUT", headers: { authorization: "Bearer accepted" } }),
      )
    ).status,
    405,
  );
});

test("nonshared readiness reports no database", async () => {
  const { handler } = setup();
  const response = await handler(ready());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
});

test("shared readiness probes the database on every authenticated request", async () => {
  const probes = [];
  let healthy = true;
  const { handler } = setup({
    sharedStore: {
      ready: async () => {
        probes.push("database");
        if (!healthy) throw new Error("synthetic PostgreSQL diagnostic");
      },
    },
  });
  let response = await handler(ready());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { database: "ready" });
  healthy = false;
  response = await handler(ready());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Database unavailable" });
  healthy = true;
  response = await handler(ready());
  assert.equal(response.status, 200);
  assert.deepEqual(probes, ["database", "database", "database"]);
});

test("failure diagnostics correlate responses without request or exception contents", async () => {
  const events = [];
  const { handler } = setup({
    log: (event) => events.push(event),
    authenticate: async () => coordinator,
    sharedStore: {
      ready: async () => {
        throw new Error("private-token-and-demo-content");
      },
    },
  });
  const response = await handler(
    new Request("http://localhost/readyz?private-query", {
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
  const throwingLogger = setup({
    authenticate: async () => {
      throw new Error("private");
    },
    log: () => {
      throw new Error("logger failed");
    },
  });
  assert.equal((await throwingLogger.handler(ready())).status, 401);
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
