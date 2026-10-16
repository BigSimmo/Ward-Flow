import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "./server.mjs";
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
function setup(actor = coordinator, dataMode = "prototype") {
  const calls = [];
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
  };
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: "https://ward-flow-production.up.railway.app" },
    store: {},
    sharedStore,
    authenticate: async (token) => {
      if (!token) throw new Error("Unauthorized");
      return actor;
    },
  });
  return { calls, handler };
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

test("command events containing real Australian identifiers are rejected", async () => {
  const { calls, handler } = setup();
  for (const badEvent of [
    { type: "PULL_PATIENT", role: "coordinator", notes: "Medicare: 2123 45678 1" },
    { type: "PULL_PATIENT", role: "coordinator", umrn: "12345678" },
    { type: "PULL_PATIENT", role: "coordinator", contact: "0412 345 678" },
  ]) {
    const response = await handler(request("/commands", { ...body, event: badEvent }));
    assert.equal(response.status, 400);
  }
  assert.equal(calls.length, 0);
});

test("engine.applyCommand rejects events containing real Australian identifiers", async () => {
  const { seedWorld, applyCommand } = await import("./dist/engine.mjs");
  const world = seedWorld(new Date());
  for (const badEvent of [
    { type: "ADVANCE_CLOCK", role: "coordinator", notes: "Medicare: 2123 45678 1" },
    { type: "ADVANCE_CLOCK", role: "coordinator", umrn: "12345678" },
    { type: "ADVANCE_CLOCK", role: "coordinator", contact: "0412 345 678" },
  ]) {
    assert.throws(() => applyCommand(world, badEvent, new Date()), /invalid-command/);
  }
});
