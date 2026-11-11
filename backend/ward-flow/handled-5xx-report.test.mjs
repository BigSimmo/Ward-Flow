// @ts-check
// Audit A7-05 (11 November 2026): handled 500, 503 and 413 from the shared API reach error
// reporting, with closed fields only. Never a request body or patient data. Synthetic data only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { failureEvent } from "./error-report.mjs";
import { createSharedHandler, handledFailureEvent } from "./shared-http.mjs";
import { bootstrapViewer } from "./viewer.test-support.mjs";

const coordinator = "22222222-2222-4222-8222-222222222222";
const body = {
  classification: "synthetic",
  commandId: "44444444-4444-4444-8444-444444444444",
  expectedRevision: 1,
  event: { type: "PULL_PATIENT", role: "coordinator" },
};

/**
 * @param {{
 *   command?: (actorId: string, commandId: string, expectedRevision: number, event: object, options: object) => Promise<unknown>,
 *   readBody?: (request: Request) => Promise<unknown>,
 *   report?: (event: object) => void,
 * }} [overrides]
 */
function setup(overrides = {}) {
  const reports = /** @type {object[]} */ ([]);
  const handler = createSharedHandler({
    config: { coordinatorIds: [coordinator], origin: "https://ward-flow-production.up.railway.app" },
    store: {
      viewer: bootstrapViewer,
      read: async () => ({ revision: 1, dataMode: "prototype" }),
      command:
        overrides.command ??
        (async () => ({
          status: 409,
          body: { outcome: "stale" },
        })),
      stepUpMinutes: 10,
      sessionLimitMinutes: 720,
    },
    authenticate: async (
      _token,
      /** @type {{ session?: { signedInAt?: number, startedAt?: number } }} */ { session } = {},
    ) => {
      if (session) session.signedInAt = session.startedAt = Date.now();
      return coordinator;
    },
    readBody: overrides.readBody ?? ((request) => request.json()),
    verifierUnavailable: Error,
    log: () => {},
    report: (event) => {
      reports.push(event);
      overrides.report?.(event);
    },
  });
  return { handler, reports };
}

const command = (extra = {}) =>
  new Request("http://localhost/v1/workspace/commands", {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json", ...extra.headers },
    body: JSON.stringify(extra.body ?? body),
  });

test("handledFailureEvent names only handled 500, 503 and 413 failures", () => {
  assert.equal(handledFailureEvent(500, "server_error"), "ward_backend_server_error");
  assert.equal(handledFailureEvent(503, "storage_unavailable"), "ward_backend_service_unavailable");
  assert.equal(handledFailureEvent(503, "verifier_unavailable"), "ward_backend_service_unavailable");
  assert.equal(handledFailureEvent(503, "report_unavailable"), "ward_backend_service_unavailable");
  assert.equal(handledFailureEvent(413, "workspace_full"), "ward_backend_payload_too_large");
  assert.equal(handledFailureEvent(413, "request_too_large"), "ward_backend_payload_too_large");
  assert.equal(handledFailureEvent(503, "not_configured"), null);
  assert.equal(handledFailureEvent(409, "refused"), null);
  assert.equal(handledFailureEvent(200, "completed"), null);
});

test("a handled 500, 503 and 413 from a command are each reported once, with closed fields only", async () => {
  const tooLarge = new Error("Workspace too large for Synthetic Patient UMRN 1234567");
  tooLarge.name = "WorkspaceTooLargeError";
  /** @type {Array<[Error, number, string, string]>} */
  const cases = [
    [
      new TypeError("Cannot read properties of undefined (reading 'state')"),
      500,
      "ward_backend_server_error",
      "TypeError",
    ],
    [
      Object.assign(new Error('relation "x" does not exist: secret value'), { code: "57P01" }),
      503,
      "ward_backend_service_unavailable",
      "Error",
    ],
    [tooLarge, 413, "ward_backend_payload_too_large", "WorkspaceTooLargeError"],
  ];
  for (const [error, status, event, errorName] of cases) {
    const { handler, reports } = setup({
      command: async () => {
        throw error;
      },
    });
    const response = await handler(command());
    assert.equal(response.status, status, event);
    assert.equal(reports.length, 1, event);
    assert.equal(reports[0].event, event);
    assert.equal(reports[0].route, "workspace_commands");
    if (status === 500 || status === 503) assert.equal(reports[0].errorName, errorName);
    assert.equal(reports[0].requestId, response.headers.get("x-request-id"));
    assert.equal("request" in reports[0], false);
    assert.equal("message" in reports[0], false);
    assert.equal("body" in reports[0], false);
    const sent = JSON.stringify(reports[0]);
    assert.doesNotMatch(sent, /UMRN|1234567|secret value|reading 'state'|PULL_PATIENT|classification/);
    const envelope = failureEvent(reports[0], { environment: "production" });
    assert.equal(envelope.message.formatted, event);
    assert.doesNotMatch(JSON.stringify(envelope), /UMRN|1234567|secret value|typed text|PULL_PATIENT/);
  }
});

test("an oversized command body is reported as a closed 413, never with the body", async () => {
  const { handler, reports } = setup({
    readBody: async () => {
      throw new Error("too_large");
    },
  });
  const response = await handler(command());
  assert.equal(response.status, 413);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].event, "ward_backend_payload_too_large");
  assert.doesNotMatch(JSON.stringify(reports[0]), /PULL_PATIENT|classification|Synthetic Patient/);
});

test("a refused command is not reported", async () => {
  const { handler, reports } = setup();
  const response = await handler(command());
  assert.equal(response.status, 409);
  assert.equal(reports.length, 0);
});
