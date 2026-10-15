import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "./server.mjs";
import { storageFailure } from "./shared-http.mjs";
import { readConfig } from "./config.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import { syntheticDatabaseUrl } from "./synthetic-database-url.test-support.mjs";

const coordinator = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const commandId = "44444444-4444-4444-8444-444444444444";
const auditEvent = {
  sequence: 1,
  actor_id: coordinator,
  actor_role: "coordinator",
  data_mode: "prototype",
  action: "PULL_PATIENT",
  outcome: "accepted",
  prior_revision: 1,
  revision: 2,
  changes: {},
  committed_at: "2026-01-01T00:00:00.000Z",
};
const body = {
  classification: "synthetic",
  commandId,
  expectedRevision: 1,
  event: { type: "PULL_PATIENT", role: "coordinator" },
};
function setup(actor = coordinator, dataMode = "prototype", overrides = {}) {
  const calls = [];
  const logs = [];
  const sharedStore = {
    read: async (...args) => {
      calls.push(args);
      return { revision: 1, dataMode };
    },
    command: async (...args) => {
      calls.push(args);
      return { status: 409, body: { outcome: "stale" } };
    },
    audit: async (...args) => {
      calls.push(["audit", ...args]);
      return [auditEvent];
    },
    ...overrides,
  };
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: "https://ward-flow-production.up.railway.app" },
    store: {},
    sharedStore,
    authenticate: async (token) => {
      if (!token) throw new Error("Unauthorized");
      return actor;
    },
    log: (event) => logs.push(event),
  });
  return { calls, logs, handler };
}
const request = (path = "", data, token = "Bearer test") =>
  new Request(`http://localhost/v1/workspace${path}`, {
    method: data ? "POST" : "GET",
    headers: { authorization: token, "content-type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

test("a named coordinator can read the entire shared workspace", async () => {
  const { calls, handler } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.role, "coordinator");
  assert.deepEqual(value.data, { mode: "prototype", source: "synthetic", liveAvailable: false });
  assert.deepEqual(calls, [[coordinator]]);
});
test("another tenant account cannot self-assign coordinator in a command", async () => {
  const { calls, handler } = setup(other);
  assert.equal((await handler(request("/commands", body))).status, 403);
  assert.equal(calls.length, 0);
});
test("a named coordinator can read audit events without reading or commanding the workspace", async () => {
  const { calls, handler } = setup();
  const response = await handler(request("/audit"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { events: [auditEvent] });
  assert.deepEqual(calls, [["audit"]]);
});
test("another tenant account cannot read audit events or reach the store", async () => {
  const { calls, handler } = setup(other);
  const response = await handler(request("/audit"));
  assert.equal(response.status, 403);
  assert.deepEqual(calls, []);
});
test("the API does not expose a snapshot with mismatched database provenance", async () => {
  const { handler } = setup(coordinator, "live");
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).snapshot, undefined);
});
test("missing authentication and cross-origin calls never reach the database", async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(request("", undefined, ""))).status, 401);
  const crossOrigin = request("/commands", body);
  crossOrigin.headers.set("origin", "https://example.com");
  assert.equal((await handler(crossOrigin)).status, 403);
  assert.equal(calls.length, 0);
});
test("the server forwards the authenticated actor and conflict result", async () => {
  const { calls, handler } = setup();
  const response = await handler(request("/commands", { ...body, actorId: other }));
  assert.equal(response.status, 409);
  assert.equal(calls[0][0], coordinator);
  assert.equal(calls[0][1], commandId);
});
test("clinical labels and invalid command envelopes are rejected", async () => {
  const { calls, handler } = setup();
  for (const invalid of [
    { ...body, classification: "clinical" },
    { ...body, dataMode: "live" },
    { ...body, expectedRevision: 0 },
    { ...body, commandId: "bad" },
    { ...body, event: [] },
  ])
    assert.equal((await handler(request("/commands", invalid))).status, 400);
  assert.equal(calls.length, 0);
});
test("shared configuration reads only the approved Supabase target and refuses live data", () => {
  const env = {
    WARD_COORDINATOR_USER_IDS: coordinator,
    WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
    WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
    WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
    WARD_SHARED_ENABLED: "true",
    WARD_WORKSPACE_ID: commandId,
    WARD_SUPABASE_DATABASE_URL: syntheticDatabaseUrl({
      host: `db.${APPROVED_SUPABASE_PROJECT}.supabase.co`,
      database: "postgres",
    }),
  };
  assert.ok(readConfig(env).shared);
  assert.equal(readConfig(env).postgres.connectionString, env.WARD_SUPABASE_DATABASE_URL);
  assert.equal(readConfig(env).dataMode, "prototype");
  assert.throws(() => readConfig({ ...env, WARD_DATA_MODE: "live" }), /not commissioned/);
  assert.throws(() => readConfig({ ...env, WARD_DATA_MODE: "invalid" }), /not commissioned/);
  for (const host of ["db.otherproject.supabase.co", "127.0.0.1"])
    assert.throws(
      () => readConfig({ ...env, WARD_SUPABASE_DATABASE_URL: syntheticDatabaseUrl({ host, database: "postgres" }) }),
      /Unapproved/,
    );
  assert.throws(() => readConfig({ ...env, WARD_WORKSPACE_ID: "00000000-0000-4000-8000-000000000000" }), /workspace/);
});

test("every shared request is logged with its request ID and closed fields only", async () => {
  const { logs, handler } = setup();
  const response = await handler(request("/commands", body));
  assert.equal(response.status, 409);
  const requestId = response.headers.get("x-request-id");
  assert.match(requestId, /^[0-9a-f-]{36}$/);
  assert.equal(logs.length, 1);
  const { durationMs, ...entry } = logs[0];
  assert.ok(Number.isInteger(durationMs));
  assert.deepEqual(entry, {
    event: "ward_backend_request",
    requestId,
    route: "workspace_commands",
    method: "POST",
    status: 409,
    outcome: "refused",
  });
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(coordinator));
});
test("a database outage is a 503 and a code fault is a 500, and both are logged", async () => {
  const outage = Object.assign(new Error('relation "x" does not exist: secret value'), { code: "57P01" });
  const fault = new TypeError("Cannot read properties of undefined (reading 'state')");
  for (const [error, status, outcome, fields] of [
    [outage, 503, "storage_unavailable", { errorName: "Error", errorCode: "57P01" }],
    [new Error("Connection terminated unexpectedly"), 503, "storage_unavailable", { errorName: "Error" }],
    [
      Object.assign(new Error("canceling statement due to lock timeout"), { code: "55P03" }),
      503,
      "storage_unavailable",
      { errorName: "Error", errorCode: "55P03" },
    ],
    [new Error("Query read timeout"), 503, "storage_unavailable", { errorName: "Error" }],
    [fault, 500, "server_error", { errorName: "TypeError" }],
    [
      Object.assign(new Error('column "secret value" does not exist'), { code: "42703" }),
      500,
      "server_error",
      { errorName: "Error", errorCode: "42703" },
    ],
  ]) {
    const { logs, handler } = setup(coordinator, "prototype", {
      command: async () => {
        throw error;
      },
    });
    const response = await handler(request("/commands", body));
    assert.equal(response.status, status);
    const { durationMs, requestId, ...entry } = logs[0];
    assert.ok(Number.isInteger(durationMs));
    assert.equal(requestId, response.headers.get("x-request-id"));
    assert.deepEqual(entry, {
      event: "ward_backend_request",
      route: "workspace_commands",
      method: "POST",
      status,
      outcome,
      ...fields,
    });
  }
});
test("storage failures are told apart from code faults", () => {
  assert.equal(storageFailure(Object.assign(new Error("x"), { code: "ECONNREFUSED" })), true);
  for (const code of ["08006", "53300", "57P01", "58030", "40001", "40P01"])
    assert.equal(storageFailure(Object.assign(new Error("x"), { code })), true, code);
  for (const code of ["23514", "42703", "P0001", "ENGINE"])
    assert.equal(storageFailure(Object.assign(new Error("x"), { code })), false, code);
  assert.equal(storageFailure(new Error("timeout exceeded when trying to connect")), true);
  assert.equal(storageFailure(new RangeError("Invalid time value")), false);
  assert.equal(storageFailure(Object.assign(new Error("x"), { code: "ERR_INVALID_ARG_TYPE" })), false);
});
test("shared routes are logged with a request ID even when the shared workspace is off", async () => {
  const logs = [];
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: null },
    sharedStore: null,
    authenticate: async () => coordinator,
    log: (event) => logs.push(event),
  });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].requestId, response.headers.get("x-request-id"));
  assert.equal(logs[0].route, "workspace");
  assert.equal(logs[0].outcome, "not_configured");
});

// Match the pg client's configured deadline vocabulary narrowly: arbitrary timeout text can
// still be an application fault and must not hide behind a retryable database response.
test("only the configured pg query timeout and lock SQLSTATE are storage failures", () => {
  assert.equal(storageFailure(new Error("Query read timeout")), true);
  assert.equal(storageFailure({ code: "55P03" }), true);
  for (const message of ["Query read timeout: invalid application state", "application timeout", "query read timeout"])
    assert.equal(storageFailure(new Error(message)), false, message);
  for (const code of ["55000", "55P02", "55P04"]) assert.equal(storageFailure({ code }), false, code);
});

test("arbitrary exception fields cannot enter HTTP diagnostics or the response", async () => {
  const { logs, handler } = setup(coordinator, "prototype", {
    command: async () => {
      throw { name: "synthetic-private-name", code: "SECRT", message: "synthetic-private-marker" };
    },
  });
  const response = await handler(request("/commands", body));
  assert.equal(response.status, 500);
  const value = await response.json();
  assert.equal(logs[0].errorName, "Error");
  assert.equal(logs[0].errorCode, undefined);
  assert.equal(logs[0].requestId, response.headers.get("x-request-id"));
  assert.equal(logs[0].requestId, value.requestId);
  assert.equal(logs[0].outcome, "server_error");
  assert.doesNotMatch(JSON.stringify({ logs, value }), /synthetic-private|SECRT/);
});
