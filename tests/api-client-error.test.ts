import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reports = vi.hoisted(() => ({ start: vi.fn(), capture: vi.fn(), failure: vi.fn() }));
vi.mock("../src/lib/sentry-server", () => ({
  startServerSentry: reports.start,
  captureBrowserFailure: reports.capture,
  captureServerFailure: reports.failure,
}));
import { POST } from "../src/app/api/client-error/route";

const origin = "https://synthetic.invalid";
const valid = {
  type: "TypeError",
  frames: [{ filename: "/_next/static/chunks/1234-abcd1234.js", lineno: 12, colno: 3 }],
};
function request(body: unknown = valid, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/client-error`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("WARD_CLIENT_ERROR_REPORTING", "true");
  vi.stubEnv("SENTRY_DSN", "https://synthetic@collector.invalid/1");
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("private browser diagnostic relay", () => {
  it.each(["false", ""])("stays off without its private switch (%s)", async (value) => {
    vi.stubEnv("WARD_CLIENT_ERROR_REPORTING", value);
    expect((await POST(request())).status).toBe(404);
    expect(reports.start).not.toHaveBeenCalled();
    expect(reports.capture).not.toHaveBeenCalled();
  });
  it("stays off without a collector", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    expect((await POST(request())).status).toBe(404);
    expect(reports.start).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([
    { origin: "https://other.invalid" },
    { origin: "" },
    { "sec-fetch-site": "cross-site" },
  ])("refuses an untrusted origin: %j", async (headers) => {
    expect((await POST(request(valid, headers))).status).toBe(403);
    expect(reports.capture).not.toHaveBeenCalled();
  });
  it.each(["text/plain", "application/json-extra"])("refuses a non-JSON media type: %s", async (type) => {
    expect((await POST(request(valid, { "content-type": type }))).status).toBe(415);
  });
  it.each([
    { ...valid, message: "SYNTHETIC_PRIVATE_SENTINEL" },
    { ...valid, type: "SYNTHETIC_PRIVATE_SENTINEL" },
    { ...valid, frames: [{ ...valid.frames[0], filename: "/_next/static/chunks/SYNTHETIC_PRIVATE_abcd1234.js" }] },
    {
      ...valid,
      frames: [{ ...valid.frames[0], filename: `${valid.frames[0].filename}?note=SYNTHETIC_PRIVATE_SENTINEL` }],
    },
    { ...valid, frames: [{ ...valid.frames[0], function: "SYNTHETIC_PRIVATE_SENTINEL" }] },
    { ...valid, frames: [{ ...valid.frames[0], lineno: -1 }] },
    { ...valid, frames: Array.from({ length: 21 }, () => valid.frames[0]) },
    "malformed JSON",
  ])("refuses private, malformed or unbounded fields: %#", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(reports.capture).not.toHaveBeenCalled();
  });
  it("bounds the actual stream even when Content-Length claims a smaller size", async () => {
    const response = await POST(request("x".repeat(16_385), { "content-length": "1" }));
    expect(response.status).toBe(413);
    expect(reports.capture).not.toHaveBeenCalled();
  });
  it("accepts only scrubbed build coordinates, without claiming delivery", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/i);
    expect(await response.text()).toBe("");
    expect(reports.start).toHaveBeenCalledOnce();
    expect(reports.capture).toHaveBeenCalledExactlyOnceWith(valid);
  });
});
