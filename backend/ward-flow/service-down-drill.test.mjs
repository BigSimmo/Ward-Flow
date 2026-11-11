// @ts-check
// M68 (master audit list, 10 Nov 2026): service-down drills, local fault injection. Error reporting
// (Sentry) that hangs, throws at once or rejects must never delay or fail the request that failed.
// The other services' local drills are listed in docs/ward-flow/OPERATIONS-DRILLS.md. No network:
// the DSN is synthetic and `send` is injected.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createErrorReporter } from "./error-report.mjs";

const DSN = "https://synthetickey@o1.ingest.synthetic.invalid/1";
const event = { event: "ward_backend_unhandled_failure", errorName: "Error" };

for (const [name, send] of [
  ["never answers", () => new Promise(() => {})],
  [
    "throws before it starts",
    () => {
      throw new Error("synthetic DNS failure");
    },
  ],
  ["rejects", async () => Promise.reject(new Error("synthetic 503"))],
]) {
  test(`M68: a Sentry endpoint that ${name} never blocks or fails the caller`, async () => {
    let calls = 0;
    const report = createErrorReporter(
      { SENTRY_DSN: DSN, NODE_ENV: "production" },
      {
        send: (...args) => {
          calls += 1;
          return /** @type {any} */ (send)(...args);
        },
      },
    );
    assert.ok(report);
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const started = performance.now();
      assert.equal(report(event), undefined);
      // The caller gets control back before the send even starts.
      assert.equal(calls, 0);
      assert.ok(performance.now() - started < 50);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(calls, 1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.deepEqual(unhandled, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
}
