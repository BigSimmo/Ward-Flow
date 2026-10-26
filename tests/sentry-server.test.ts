import { afterEach, describe, expect, it, vi } from "vitest";
import type { ErrorEvent } from "@sentry/core";
import {
  allowServerReport,
  resetServerReportThrottle,
  scrubSentryEvent,
  SERVER_REPORT_INTERVAL_MS,
  serverSentrySettings,
} from "@/lib/sentry-server";

const SECRET = "SYNTHETIC_PRIVATE_SENTINEL";
const DSN = "https://publickey@o0.ingest.invalid/1";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("server Sentry settings", () => {
  it("stays off without a DSN, with a blank DSN and under tests", () => {
    expect(serverSentrySettings({ NODE_ENV: "production" })).toBeNull();
    expect(serverSentrySettings({ NODE_ENV: "production", SENTRY_DSN: "  " })).toBeNull();
    expect(serverSentrySettings({ NODE_ENV: "test", SENTRY_DSN: DSN })).toBeNull();
  });

  it("reads the environment, release and logs switch", () => {
    expect(
      serverSentrySettings({
        NODE_ENV: "production",
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "demo",
        RAILWAY_GIT_COMMIT_SHA: "abc123",
        SENTRY_ENABLE_LOGS: "false",
      }),
    ).toEqual({ dsn: DSN, environment: "demo", release: "abc123", enableLogs: false });
    expect(serverSentrySettings({ NODE_ENV: "production", SENTRY_DSN: DSN })?.enableLogs).toBe(true);
  });
});

describe("server Sentry scrubbing", () => {
  it("keeps error types, frames and allowed tags only", () => {
    const event = {
      type: undefined,
      event_id: "e1",
      message: SECRET,
      request: { url: `/people/${SECRET}`, headers: { authorization: SECRET } },
      user: { id: SECRET },
      breadcrumbs: [{ message: SECRET }],
      extra: { note: SECRET },
      tags: { routeType: "render", path: SECRET },
      contexts: { runtime: { name: "node" }, response: { body: SECRET } },
      exception: {
        values: [
          {
            type: "TypeError",
            value: SECRET,
            stacktrace: { frames: [{ filename: "app.js", lineno: 3, context_line: SECRET, vars: { a: SECRET } }] },
          },
        ],
      },
    } as unknown as ErrorEvent;
    const scrubbed = scrubSentryEvent(event);
    expect(JSON.stringify(scrubbed)).not.toContain(SECRET);
    expect(scrubbed.tags).toEqual({ routeType: "render" });
    expect(scrubbed.contexts).toEqual({ runtime: { name: "node" } });
    expect(scrubbed.exception?.values?.[0]).toMatchObject({
      type: "TypeError",
      value: "[redacted]",
      stacktrace: { frames: [{ filename: "app.js", lineno: 3 }] },
    });
  });

  it("sends a scrubbed envelope for a captured server failure", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const sentry = await import("@/lib/sentry-server");
    expect(sentry.startServerSentry({ NODE_ENV: "production", SENTRY_DSN: DSN, SENTRY_ENABLE_LOGS: "false" })).toBe(
      true,
    );
    const cause = new Error(`cause ${SECRET}`);
    sentry.captureServerFailure(new TypeError(`failed for ${SECRET}`, { cause }), {
      incidentId: "11111111-1111-4111-8111-111111111111",
      routeType: "render",
    });
    const { getClient } = await import("@sentry/core");
    await getClient()?.flush(2000);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("o0.ingest.invalid");
    const body = typeof init?.body === "string" ? init.body : new TextDecoder().decode(init?.body as Uint8Array);
    expect(body).not.toContain(SECRET);
    expect(body).toContain("TypeError");
    expect(body).toContain("11111111-1111-4111-8111-111111111111");
    await getClient()?.close(0);
  });
});

describe("server Sentry rate limit (PS-13, H-0961)", () => {
  it("sends one report per kind every five minutes", () => {
    resetServerReportThrottle();
    expect(allowServerReport("failure:TypeError", 1_000)).toBe(true);
    expect(allowServerReport("failure:TypeError", 2_000)).toBe(false);
    expect(allowServerReport("failure:RangeError", 2_000)).toBe(true);
    expect(allowServerReport("failure:TypeError", 1_000 + SERVER_REPORT_INTERVAL_MS)).toBe(true);
  });

  it("keeps a bounded list of kinds", () => {
    resetServerReportThrottle();
    for (let i = 0; i < 600; i += 1) allowServerReport(`kind-${i}`, 1_000);
    expect(allowServerReport("kind-0", 2_000)).toBe(true);
    expect(allowServerReport("kind-599", 2_000)).toBe(false);
  });
});
