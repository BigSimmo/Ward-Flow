// @ts-check
// M74 (master audit list, 10 Nov 2026): "what happened at 03:12?" The offline half of the trace drill.
// A request's ID is in its reply header and its log line (shared-http.test.mjs). This pins what the
// Sentry event carries today, and records the gaps as todos for Josh. Browser error reporting
// (TE-04) is owned by another thread and is not covered here. No network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { failureEvent } from "./error-report.mjs";

test("M74: a Sentry event carries the release and environment, and no request ID, role, screen or name", () => {
  const event = failureEvent(
    {
      event: "ward_backend_unhandled_failure",
      errorName: "TypeError",
      requestId: "3f6c1f0e-1111-4111-8111-111111111111",
      role: "coordinator",
      screen: "home",
      patient: "SYNTHETIC-NAME",
    },
    { environment: "local-drill", release: "live-2026-11-10", now: Date.UTC(2026, 10, 9, 19, 12) },
  );
  assert.equal(event.release, "live-2026-11-10");
  assert.equal(event.environment, "local-drill");
  assert.equal(event.message.formatted, "ward_backend_unhandled_failure");
  assert.deepEqual(event.tags, { service: "ward-flow-backend", errorName: "TypeError" });
  assert.ok(!JSON.stringify(event).includes("SYNTHETIC-NAME"));
  // Today the request ID does not reach Sentry, so a Sentry event cannot be matched to its log line.
  assert.ok(!JSON.stringify(event).includes("3f6c1f0e"));
});

test.todo("M74 GAP (Josh): carry the request ID as a Sentry tag so one ID links the tap, the log line and the event");
test.todo("M74 GAP (Josh): allow role and screen as Sentry tags (closed vocabularies only, never names)");
test.todo(
  "M74 GAP: a handled 500 (server_error in shared-http.mjs) is logged but never sent to Sentry; only unhandled failures are",
);
