import assert from "node:assert/strict";
import test from "node:test";
import { createErrorReporter, failureEvent, REPORT_INTERVAL_MS, sentryTarget } from "./error-report.mjs";

const DSN = "https://publickey@o123.ingest.de.sentry.io/4567";

test("reporting stays off without a usable DSN or under tests", () => {
  assert.equal(createErrorReporter({}), null);
  assert.equal(createErrorReporter({ SENTRY_DSN: "  " }), null);
  assert.equal(createErrorReporter({ SENTRY_DSN: DSN, NODE_ENV: "test" }), null);
  assert.equal(createErrorReporter({ SENTRY_DSN: "not a dsn" }), null);
  assert.equal(createErrorReporter({ SENTRY_DSN: "http://publickey@example.test/1" }), null);
  assert.equal(createErrorReporter({ SENTRY_DSN: "https://example.test/1" }), null);
});

test("a DSN maps to its envelope address without putting the key in the URL", () => {
  assert.deepEqual(sentryTarget(DSN), {
    endpoint: "https://o123.ingest.de.sentry.io/api/4567/envelope/",
    auth: "Sentry sentry_version=7, sentry_key=publickey, sentry_client=ward-flow-backend/0.1.0",
  });
  assert.equal(sentryTarget("https://k@self.example/sentry/9").endpoint, "https://self.example/sentry/api/9/envelope/");
});

test("a report holds only the fixed event name, allow-listed error fields and labels", () => {
  const event = failureEvent(
    {
      event: "ward_backend_unhandled_failure",
      errorName: "TypeError",
      errorCode: "23505",
      message: "Synthetic Patient UMRN 1234567",
      stack: "at /srv/records.mjs",
      request: { body: "typed text" },
    },
    { environment: "production", release: "abc123", now: 1_000_000 },
  );
  assert.equal(event.message.formatted, "ward_backend_unhandled_failure");
  assert.deepEqual(event.tags, { service: "ward-flow-backend", errorName: "TypeError", errorCode: "23505" });
  assert.equal(event.release, "abc123");
  assert.doesNotMatch(JSON.stringify(event), /Synthetic|UMRN|typed text|records\.mjs/);
});

test("unknown event names and unsafe error fields are not passed through", () => {
  const event = failureEvent({ event: "Patient Jane", errorName: "Bad name with spaces", errorCode: { x: 1 } }, {});
  assert.equal(event.message.formatted, "ward_backend_failure");
  assert.deepEqual(event.tags, { service: "ward-flow-backend" });
});

test("each failure kind is sent at most once per interval and send errors are swallowed", async () => {
  const sent = [];
  let clock = 0;
  const report = createErrorReporter(
    { SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: "shared-pilot" },
    {
      now: () => clock,
      send: async (url, init) => {
        sent.push({ url, init });
        throw new Error("network down");
      },
    },
  );
  report({ event: "ward_backend_unhandled_failure", errorName: "Error" });
  report({ event: "ward_backend_unhandled_failure", errorName: "Error" });
  report({ event: "ward_backend_push_sweep_failure", errorName: "Error" });
  clock = REPORT_INTERVAL_MS;
  report({ event: "ward_backend_unhandled_failure", errorName: "Error" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 3);
  const [first] = sent;
  assert.equal(first.url, "https://o123.ingest.de.sentry.io/api/4567/envelope/");
  assert.equal(first.init.headers["content-type"], "application/x-sentry-envelope");
  const [, itemHeader, payload] = first.init.body.split("\n");
  assert.deepEqual(JSON.parse(itemHeader), { type: "event" });
  assert.equal(JSON.parse(payload).environment, "shared-pilot");
});
