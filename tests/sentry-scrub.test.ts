import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/core";
import { scrubSentryEvent } from "../src/lib/sentry-server";

describe("diagnostic metadata is not a content escape hatch", () => {
  it("drops synthetic private text from allowed keys, nested metadata and stack URLs", () => {
    const secret = "SYNTHETIC_PRIVATE_SENTINEL";
    const scrubbed = scrubSentryEvent({
      environment: secret,
      release: secret,
      sdk: { name: secret },
      tags: { incidentId: secret, method: secret, routeType: secret },
      contexts: { runtime: { name: "node", data: secret }, app: { note: secret } },
      exception: {
        values: [
          {
            type: secret,
            mechanism: { data: { note: secret } },
            stacktrace: {
              frames: [
                {
                  filename: `https://example.test/patients/${secret}?note=${secret}`,
                  module: secret,
                  function: secret,
                  vars: { note: secret },
                  lineno: 2,
                },
              ],
            },
          },
        ],
      },
    } as unknown as ErrorEvent);
    expect(JSON.stringify(scrubbed)).not.toContain(secret);
    expect(scrubbed.exception?.values?.[0]?.type).toBe("Error");
  });
  it("keeps the safe error class and location needed to investigate a build failure", () => {
    expect(
      scrubSentryEvent({
        type: undefined,
        tags: { incidentId: "11111111-1111-4111-8111-111111111111", method: "GET", routeType: "render" },
        exception: {
          values: [
            {
              type: "TypeError",
              stacktrace: {
                frames: [
                  {
                    filename: "https://example.test/_next/static/chunks/1234-abcd1234.js?private=discard",
                    lineno: 12,
                    colno: 9,
                  },
                ],
              },
            },
          ],
        },
      }).exception?.values?.[0],
    ).toMatchObject({
      type: "TypeError",
      stacktrace: { frames: [{ filename: "/_next/static/chunks/1234-abcd1234.js", lineno: 12, colno: 9 }] },
    });
  });
  it.each([
    "/_next/static/chunks/SYNTHETIC_PRIVATE_abcd1234.js",
    "/_next/static/SYNTHETIC_PRIVATE/chunks/abcd1234.js",
    "/_next/static/chunks/abcd1234-SYNTHETIC_PRIVATE.js",
  ])("rejects arbitrary text around an apparent build hash: %s", (path) => {
    const event = scrubSentryEvent({
      type: undefined,
      exception: { values: [{ stacktrace: { frames: [{ filename: path }] } }] },
    });
    expect(JSON.stringify(event)).not.toContain("SYNTHETIC_PRIVATE");
    expect(event.exception?.values?.[0].stacktrace?.frames?.[0].filename).toBe("[redacted]");
  });
});
