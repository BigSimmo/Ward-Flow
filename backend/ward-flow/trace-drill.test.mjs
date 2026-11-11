// @ts-check
// M74 (master audit list, 10 Nov 2026): "what happened at 03:12?" The offline half of the trace drill.
// A request's ID is in its reply header and its log line (shared-http.test.mjs). This pins what the
// Sentry event carries: the same request ID, the desk role, the route and the screen, and that a
// handled 500 is sent as well as an unhandled failure (fixed 10 Nov 2026). Browser error reporting
// (TE-04) is owned by another thread and is not covered here. No network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { failureEvent } from "./error-report.mjs";
import { createSharedHandler } from "./shared-http.mjs";
import { bootstrapViewer } from "./viewer.test-support.mjs";

const coordinator = "22222222-2222-4222-8222-222222222222";
const commandId = "44444444-4444-4444-8444-444444444444";

test("M74: a Sentry event carries the release, environment, request ID, role and screen, and no name", () => {
  const event = failureEvent(
    {
      event: "ward_backend_server_error",
      errorName: "TypeError",
      requestId: "3f6c1f0e-1111-4111-8111-111111111111",
      role: "coordinator",
      screen: "tv",
      route: "workspace_commands",
      patient: "SYNTHETIC-NAME",
    },
    { environment: "local-drill", release: "live-2026-11-10", now: Date.UTC(2026, 10, 9, 19, 12) },
  );
  assert.equal(event.release, "live-2026-11-10");
  assert.equal(event.environment, "local-drill");
  assert.equal(event.message.formatted, "ward_backend_server_error");
  assert.deepEqual(event.tags, {
    service: "ward-flow-backend",
    errorName: "TypeError",
    requestId: "3f6c1f0e-1111-4111-8111-111111111111",
    role: "coordinator",
    screen: "tv",
    route: "workspace_commands",
  });
  // The request ID is not part of the grouping, so one fault stays one Sentry issue.
  assert.deepEqual(event.fingerprint, ["ward_backend_server_error", "TypeError", ""]);
  assert.ok(!JSON.stringify(event).includes("SYNTHETIC-NAME"));
});

test("M74: role, screen and request ID outside their closed shapes are dropped", () => {
  const event = failureEvent({
    event: "ward_backend_server_error",
    requestId: "SYNTHETIC-NAME 1234567",
    role: "Synthetic Patient",
    screen: "ward 4 bed 2",
    route: "Bed 4 Synthetic",
  });
  assert.deepEqual(event.tags, { service: "ward-flow-backend" });
});

function handlerWith(command, report) {
  return createSharedHandler({
    config: { coordinatorIds: [coordinator], origin: null },
    store: { viewer: bootstrapViewer, command, read: async () => ({ revision: 1, dataMode: "prototype" }) },
    authenticate: async () => coordinator,
    readBody: (request) => request.json(),
    verifierUnavailable: class extends Error {},
    log: () => {},
    report,
  });
}
const commandRequest = (headers = {}) =>
  new Request("http://localhost/v1/workspace/commands", {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json", ...headers },
    body: JSON.stringify({
      classification: "synthetic",
      commandId,
      expectedRevision: 1,
      event: { type: "PULL_PATIENT", role: "coordinator" },
    }),
  });

test("M74: a handled 500 is sent to Sentry with the reply's request ID, the role and the screen", async () => {
  const reports = [];
  const handler = handlerWith(
    async () => {
      throw new TypeError("Cannot read properties of SYNTHETIC-NAME");
    },
    (event) => reports.push(event),
  );
  const response = await handler(commandRequest({ "x-ward-screen": "tv" }));
  assert.equal(response.status, 500);
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0], {
    event: "ward_backend_server_error",
    requestId: response.headers.get("x-request-id"),
    route: "workspace_commands",
    role: "coordinator",
    screen: "tv",
    errorName: "TypeError",
  });
  assert.ok(!JSON.stringify(reports).includes("SYNTHETIC-NAME"));
});

test("M74 / A7-05: a storage outage (503) is reported as unavailable, not as a server error, and a refusal is not reported", async () => {
  const reports = [];
  const outage = handlerWith(
    async () => {
      throw Object.assign(new Error("x"), { code: "ECONNREFUSED" });
    },
    (event) => reports.push(event),
  );
  assert.equal((await outage(commandRequest())).status, 503);
  const stale = handlerWith(
    async () => ({ status: 409, body: { outcome: "stale" } }),
    (event) => reports.push(event),
  );
  assert.equal((await stale(commandRequest())).status, 409);
  assert.deepEqual(
    reports.map((report) => report.event),
    ["ward_backend_service_unavailable"],
  );
});
