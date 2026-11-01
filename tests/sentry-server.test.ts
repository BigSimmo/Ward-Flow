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

  it("keeps a bounded list of kinds without letting a full list reopen a throttled kind", () => {
    resetServerReportThrottle();
    for (let i = 0; i < 500; i += 1) expect(allowServerReport(`kind-${i}`, 1_000)).toBe(true);
    // Full, and every kind is still inside its interval: a new kind waits, and old kinds stay throttled.
    expect(allowServerReport("kind-500", 2_000)).toBe(false);
    expect(allowServerReport("kind-0", 2_000)).toBe(false);
    // Once the oldest kind's interval has run out, it makes room for a new one.
    expect(allowServerReport("kind-500", 1_000 + SERVER_REPORT_INTERVAL_MS)).toBe(true);
  });
});

describe("server Sentry transport deadline", () => {
  it("bounds monitoring requests so a stalled collector cannot retain transport slots", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const sentry = await import("@/lib/sentry-server");
    sentry.startServerSentry({ NODE_ENV: "production", SENTRY_DSN: DSN, SENTRY_ENABLE_LOGS: "false" });
    const { getClient } = await import("@sentry/core");
    try {
      sentry.captureServerFailure(new RangeError("synthetic timeout fixture"), { routeType: "render" });
      await getClient()?.flush(2000);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
      expect(timeout).toHaveBeenCalledWith(5000);
    } finally {
      await getClient()?.close(0);
    }
  });
});

describe("server Sentry collector recovery", () => {
  it("drains an aborted collector request and accepts a later report", async () => {
    const controller = new AbortController();
    const recovered = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(controller.signal).mockReturnValue(recovered.signal);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
          }),
      )
      .mockResolvedValue(new Response(null, { status: 200 }));
    const sentry = await import("@/lib/sentry-server");
    sentry.startServerSentry({ NODE_ENV: "production", SENTRY_DSN: DSN, SENTRY_ENABLE_LOGS: "false" });
    const { getClient } = await import("@sentry/core");
    try {
      sentry.captureServerFailure(new RangeError("synthetic stalled collector"), { routeType: "route" });
      let drained = false;
      const flushing = getClient()!
        .flush(2000)
        .then((value) => {
          drained = true;
          return value;
        });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      expect(drained).toBe(false);
      expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
      controller.abort();
      expect(await flushing).toBe(true);
      sentry.captureServerFailure(new TypeError("synthetic recovered collector"), { routeType: "route" });
      expect(await getClient()!.flush(2000)).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1]?.signal).toBe(recovered.signal);
      expect(recovered.signal.aborted).toBe(false);
    } finally {
      controller.abort();
      await getClient()?.close(0);
    }
  });
});
