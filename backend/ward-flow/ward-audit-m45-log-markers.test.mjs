// @ts-check
// Audit M45 (GNG row C7): a synthetic name and note marker sent through the backend's request
// log and error report never leaves the server. One marker test per backend path. The Next.js
// server paths (logger, server Sentry, onRequestError) are covered in
// tests/ward-audit-m45-log-markers.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "./server.mjs";
import { createErrorReporter, failureEvent } from "./error-report.mjs";
import { bootstrapViewer } from "./viewer.test-support.mjs";

// Synthetic markers only: an invented name, a note phrase and a UMRN-shaped number.
const NAME = "Zephyrine Quandtwhistle";
const NOTE = "M45-NOTE-MARKER said she feels unsafe at home";
const UMRN = "9900123";
const MARKERS = [NAME, NOTE, UMRN, "Quandtwhistle", "M45-NOTE-MARKER"];

const coordinator = "22222222-2222-4222-8222-222222222222";

function assertNoMarker(value, where) {
  const text = JSON.stringify(value);
  for (const marker of MARKERS) assert.equal(text.includes(marker), false, `${where} carried "${marker}"`);
}

function markerError() {
  return Object.assign(new Error(`insert failed for ${NAME} (${UMRN}): ${NOTE}`), { code: "23514" });
}

function setup(overrides = {}) {
  const logs = [];
  const sharedStore = {
    viewer: bootstrapViewer,
    read: async () => {
      throw markerError();
    },
    command: async () => {
      throw markerError();
    },
    stepUpMinutes: 10,
    sessionLimitMinutes: 720,
    ...overrides,
  };
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: "https://ward-flow-production.up.railway.app" },
    sharedStore,
    /** @param {string} token @param {{ session?: { signedInAt?: number, startedAt?: number } }} [context] */
    authenticate: async (token, { session } = {}) => {
      if (!token) throw new Error("Unauthorized");
      if (session) session.signedInAt = session.startedAt = Date.now();
      return coordinator;
    },
    log: (event) => logs.push(event),
  });
  return { logs, handler };
}

const markerQuery = `?name=${encodeURIComponent(NAME)}&note=${encodeURIComponent(NOTE)}`;

test("M45 backend request log: a failing command carrying a name and note logs neither", async () => {
  const { logs, handler } = setup();
  const response = await handler(
    new Request(`http://localhost/v1/workspace/commands${markerQuery}`, {
      method: "POST",
      headers: { authorization: "Bearer test", "content-type": "application/json" },
      body: JSON.stringify({
        classification: "synthetic",
        commandId: "44444444-4444-4444-8444-444444444444",
        expectedRevision: 1,
        event: { type: "ADD_NOTE", role: "coordinator", patientName: NAME, note: NOTE, umrn: UMRN },
      }),
    }),
  );
  // 500 means the store's marker-laden error reached the failure log path (not an earlier refusal).
  assert.equal(response.status, 500, "the command must fail inside the store so the failure path is exercised");
  assert.ok(logs.length > 0, "the request must be logged");
  assertNoMarker(logs, "backend request log");
  // The reply itself is not a log, but it must not echo the database message either.
  assertNoMarker(await response.text(), "backend failure reply");
});

test("M45 backend request log: a failing read with a name in the address logs neither", async () => {
  const { logs, handler } = setup();
  const response = await handler(
    new Request(`http://localhost/v1/workspace${markerQuery}`, { headers: { authorization: "Bearer test" } }),
  );
  assert.equal(response.status, 500);
  assert.ok(logs.length > 0);
  assertNoMarker(logs, "backend read log");
});

test("M45 backend request log: an unknown route with a name in the path logs neither", async () => {
  const { logs, handler } = setup();
  await handler(
    new Request(`http://localhost/v1/workspace/${encodeURIComponent(NAME)}${markerQuery}`, {
      headers: { authorization: "Bearer test" },
    }),
  );
  assert.ok(logs.length > 0);
  assertNoMarker(logs, "backend unknown-route log");
});

test("M45 backend error report: a failure event carrying a name and note sends neither to Sentry", async () => {
  const sent = [];
  const reporter = createErrorReporter(
    { SENTRY_DSN: "https://publickey@o0.ingest.invalid/1", NODE_ENV: "production" },
    {
      send: async (url, init) => {
        sent.push({ url, init });
        return new Response(null, { status: 200 });
      },
      now: () => 1_000_000,
    },
  );
  assert.ok(reporter);
  const error = markerError();
  reporter({
    event: "ward_backend_unhandled_failure",
    errorName: "TypeError",
    errorCode: "23514",
    message: error.message,
    stack: error.stack,
    note: NOTE,
    patient: { name: NAME, umrn: UMRN },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(sent.length, 1, "the report must be sent so the path is exercised");
  assertNoMarker(sent[0].init.body, "backend Sentry envelope");
  assertNoMarker(failureEvent({ event: NAME, errorName: NAME, errorCode: NOTE }, {}), "backend failure event");
});
