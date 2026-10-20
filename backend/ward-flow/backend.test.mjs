// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { readConfig } from "./config.mjs";
import {
  GZIP_MIN_BYTES,
  HEADERS_TIMEOUT_MS,
  MAX_CONNECTIONS,
  createHandler,
  databaseHealth,
  listen,
  registerShutdown,
} from "./server.mjs";
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

/** @typedef {EventEmitter & { close?: any }} FakeServer */
/** @typedef {EventEmitter & { exitCode?: number | string | null }} FakeSignals */

/** @param {{ authenticate?: (token: string) => Promise<string>, sharedStore?: any, log?: (event: any) => void }} [options] */
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
  assert.deepEqual(await health.json(), { service: "ward-flow-backend", database: "not_configured" });
  // The retired Azure Blob session vault route is gone.
  assert.equal((await handler(new Request(`http://localhost/v1/sessions/${coordinator}`))).status, 404);
  assert.equal(calls.length, 0);
});

test("liveness reports the database without sign-in or detail, and stays 200 when it is down", async () => {
  let up = true;
  let queries = 0;
  const sharedStore = {
    async ready() {
      queries += 1;
      if (!up) throw new Error("secret connection string");
    },
  };
  const { handler, calls } = setup({ sharedStore });
  const health = await handler(new Request("http://localhost/healthz"));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { service: "ward-flow-backend", database: "ok" });
  up = false;
  const down = databaseHealth(sharedStore);
  assert.equal(await down(), "unavailable");
  const response = await setup({ sharedStore }).handler(new Request("http://localhost/healthz"));
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /secret|connection/);
  assert.equal(calls.length, 0);
  assert.equal(queries, 3);
});

test("the database health answer asks at most once per 30 seconds and once at a time", async () => {
  let clock = 0;
  let queries = 0;
  /** @type {(() => void) | undefined} */
  let finish;
  const store = {
    ready() {
      queries += 1;
      return new Promise((resolve) => {
        finish = () => resolve(undefined);
      });
    },
  };
  const health = databaseHealth(store, { now: () => clock });
  const first = health();
  const second = health();
  await new Promise((resolve) => setImmediate(resolve));
  finish?.();
  assert.deepEqual(await Promise.all([first, second]), ["ok", "ok"]);
  assert.equal(queries, 1);
  clock = 29_999;
  assert.equal(await health(), "ok");
  assert.equal(queries, 1);
  clock = 30_000;
  const third = health();
  await new Promise((resolve) => setImmediate(resolve));
  finish?.();
  assert.equal(await third, "ok");
  assert.equal(queries, 2);
});

test("a database check that hangs answers unavailable", async () => {
  const health = databaseHealth({ ready: () => new Promise(() => {}) }, { timeoutMs: 10 });
  assert.equal(await health(), "unavailable");
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
    const signals = /** @type {FakeSignals} */ (new EventEmitter());
    const server = /** @type {FakeServer} */ (new EventEmitter());
    const order = [];
    /** @type {(error?: Error) => void} */
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
  const signals = /** @type {FakeSignals} */ (new EventEmitter());
  const server = /** @type {FakeServer} */ (new EventEmitter());
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
  const signals = /** @type {FakeSignals} */ (new EventEmitter());
  const server = /** @type {FakeServer} */ (new EventEmitter());
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
  const signals = /** @type {FakeSignals} */ (new EventEmitter());
  const server = /** @type {FakeServer} */ (new EventEmitter());
  server.close = t.mock.fn((callback) => callback(new Error("synthetic listener close diagnostic")));
  const pool = { end: t.mock.fn(async () => {}) };
  const close = registerShutdown(server, pool, signals);
  await close();
  assert.equal(signals.exitCode, 1);
  assert.equal(pool.end.mock.callCount(), 1);
  assert.deepEqual(messages, [["Backend shutdown unavailable"]]);
});

test("nonshared shutdown closes the listener without a pool", async (t) => {
  const signals = /** @type {FakeSignals} */ (new EventEmitter());
  const server = /** @type {FakeServer} */ (new EventEmitter());
  server.close = t.mock.fn((callback) => callback());
  const close = registerShutdown(server, undefined, signals);
  signals.emit("SIGTERM");
  await close();
  assert.equal(server.close.mock.callCount(), 1);
  assert.equal(signals.exitCode, undefined);
});

test("the listener allows many connections but drops slow headers after 5 seconds", async () => {
  const server = listen(async () => new Response(null, { status: 204 }), { port: 0, host: "127.0.0.1" });
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    assert.equal(server.maxConnections, MAX_CONNECTIONS);
    assert.ok(MAX_CONNECTIONS >= 128);
    assert.equal(server.headersTimeout, HEADERS_TIMEOUT_MS);
    assert.ok(HEADERS_TIMEOUT_MS <= 5_000 && server.requestTimeout > HEADERS_TIMEOUT_MS);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the listener gzips JSON replies of 1 KB or more when the browser accepts it (audit F-04)", async () => {
  const { gunzipSync } = await import("node:zlib");
  const { request } = await import("node:http");
  const big = { rows: "x".repeat(GZIP_MIN_BYTES * 4) };
  const server = listen(
    async (incoming) =>
      Response.json(new URL(incoming.url).pathname === "/small" ? { ok: true } : big, {
        headers: { "cache-control": "no-store", vary: "Origin" },
      }),
    { port: 0, host: "127.0.0.1" },
  );
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
    const fetchRaw = (path, encoding) =>
      new Promise((resolve, reject) => {
        const outgoing = request({
          port,
          host: "127.0.0.1",
          path,
          headers: encoding ? { "accept-encoding": encoding } : {},
        });
        outgoing.on("response", (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => resolve({ headers: response.headers, body: Buffer.concat(chunks) }));
        });
        outgoing.on("error", reject);
        outgoing.end();
      });
    const zipped = await fetchRaw("/big", "gzip, deflate, br");
    assert.equal(zipped.headers["content-encoding"], "gzip");
    assert.equal(zipped.headers.vary, "Origin, Accept-Encoding");
    assert.equal(Number(zipped.headers["content-length"]), zipped.body.length);
    assert.deepEqual(JSON.parse(gunzipSync(zipped.body).toString()), big);
    const plain = await fetchRaw("/big");
    assert.equal(plain.headers["content-encoding"], undefined);
    assert.deepEqual(JSON.parse(plain.body.toString()), big);
    const refused = await fetchRaw("/big", "gzip;q=0, deflate");
    assert.equal(refused.headers["content-encoding"], undefined);
    assert.deepEqual(JSON.parse(refused.body.toString()), big);
    const small = await fetchRaw("/small", "gzip");
    assert.equal(small.headers["content-encoding"], undefined);
    assert.deepEqual(JSON.parse(small.body.toString()), { ok: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("every file the engine bundle is built from is under the backend's redeploy watch paths", async () => {
  // Audit F-07: a change to the synthetic-data guard alone once left the hosted backend unrebuilt.
  const { build } = await import("esbuild");
  const { fileURLToPath } = await import("node:url");
  const { relative } = await import("node:path");
  const { BACKEND_WATCH_PATHS, watched } = await import("./watch-paths.mjs");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const here = fileURLToPath(new URL("./", import.meta.url));
  const { metafile } = await build({
    entryPoints: [fileURLToPath(new URL("./engine.ts", import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    tsconfig: fileURLToPath(new URL("../../tsconfig.json", import.meta.url)),
    write: false,
    metafile: true,
    outfile: fileURLToPath(new URL("./dist/watch-check.mjs", import.meta.url)),
  });
  const inputs = Object.keys(metafile.inputs).map((input) => relative(root, `${here}${input}`).replaceAll("\\", "/"));
  assert.ok(inputs.includes("src/lib/synthetic-data-guard.ts"), "the check must see the engine's real inputs");
  const unwatched = inputs.filter((path) => !path.startsWith("node_modules/") && !watched(path));
  assert.deepEqual(unwatched, [], "add these to BACKEND_WATCH_PATHS, docs/hosting.md and the Railway service");
  assert.ok(watched("package-lock.json"), "root packages are rebuilt through the root lockfile");
  assert.equal(watched("src/app/page.tsx", BACKEND_WATCH_PATHS), false);
});
