import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "./server.mjs";
import { readConfig } from "./config.mjs";

const coordinator = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const commandId = "44444444-4444-4444-8444-444444444444";
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
    audit: async () => [],
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
test("shared configuration refuses a host that differs from its Ward Flow resource", () => {
  const env = {
    AZURE_TENANT_ID: other,
    WARD_ALLOWED_OBJECT_ID: coordinator,
    WARD_API_AUDIENCE: "9b7b160d-9bc7-4712-b748-17ff3e70b706",
    AzureWebJobsStorage__accountName: "wflowdev7273a083aue",
    WARD_SHARED_ENABLED: "true",
    WARD_WORKSPACE_ID: commandId,
    WARD_PG_RESOURCE_ID: `/subscriptions/${other}/resourceGroups/rg-wardflow-dev-aue/providers/Microsoft.DBforPostgreSQL/flexibleServers/wardflow-test`,
    WARD_PG_HOST: "wardflow-test.postgres.database.azure.com",
    WARD_PG_DATABASE: "wardflow",
    WARD_PG_USER: "wardflow_backend",
  };
  assert.ok(readConfig(env).shared);
  assert.equal(readConfig(env).dataMode, "prototype");
  assert.throws(() => readConfig({ ...env, WARD_DATA_MODE: "live" }), /not commissioned/);
  assert.throws(() => readConfig({ ...env, WARD_DATA_MODE: "invalid" }), /not commissioned/);
  assert.throws(() => readConfig({ ...env, WARD_PG_HOST: "different.postgres.database.azure.com" }), /Unapproved/);
  const existing = {
    ...env,
    WARD_PG_RESOURCE_ID: env.WARD_PG_RESOURCE_ID.replace("wardflow-test", "wardflow-dev-aue"),
    WARD_PG_HOST: "wardflow-dev-aue.postgres.database.azure.com",
    WARD_PG_DATABASE: "wardflow_dev",
  };
  assert.equal(readConfig(existing).postgres.database, "wardflow_dev");
  assert.throws(() => readConfig({ ...existing, WARD_PG_DATABASE: "wardflow" }), /Unapproved/);
  assert.throws(() => readConfig({ ...env, WARD_PG_DATABASE: "wardflow_dev" }), /Unapproved/);
});
