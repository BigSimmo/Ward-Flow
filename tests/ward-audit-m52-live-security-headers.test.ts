// Audit M52: the live security-header check (scripts/check-live-security-headers.mjs) must match
// what the code builds, and must fail when the live answer drifts. Code side only: running it
// against the live site after a release is the post-release step (M67) and needs Josh's yes.
import { describe, expect, it, vi } from "vitest";

import { buildContentSecurityPolicy, buildSecurityHeaders } from "@/lib/security-headers";
import {
  EXPECTED_HEADERS,
  checkLiveSecurityHeaders,
  compareSecurityHeaders,
} from "../scripts/check-live-security-headers.mjs";

const PROD = { isDevelopment: false, isLocalHttpRuntime: false };

function productionHeaders(): Headers {
  const headers = new Headers();
  for (const { key, value } of buildSecurityHeaders(PROD)) headers.set(key, value);
  headers.set("Content-Security-Policy", buildContentSecurityPolicy({ ...PROD, nonce: "bm9uY2UtZm9yLXRlc3Q=" }));
  return headers;
}

describe("M52 live header check matches the code", () => {
  it("expects exactly the headers the code builds for production", () => {
    const built = Object.fromEntries(buildSecurityHeaders(PROD).map(({ key, value }) => [key.toLowerCase(), value]));
    expect(EXPECTED_HEADERS).toEqual(built);
  });

  it("passes the code's own production headers and policy", () => {
    const result = compareSecurityHeaders(productionHeaders());
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each([
    ["a missing framing header", (h: Headers) => h.delete("X-Frame-Options")],
    ["a weakened HSTS", (h: Headers) => h.set("Strict-Transport-Security", "max-age=60")],
    ["no content security policy", (h: Headers) => h.delete("Content-Security-Policy")],
    [
      "inline scripts allowed",
      (h: Headers) =>
        h.set("Content-Security-Policy", buildContentSecurityPolicy({ ...PROD, isDevelopment: true, nonce: "x" })),
    ],
    [
      "framing allowed",
      (h: Headers) =>
        h.set(
          "Content-Security-Policy",
          h.get("Content-Security-Policy")!.replace("frame-ancestors 'none'", "frame-ancestors *"),
        ),
    ],
    [
      "no https upgrade",
      (h: Headers) =>
        h.set("Content-Security-Policy", buildContentSecurityPolicy({ ...PROD, isLocalHttpRuntime: true, nonce: "x" })),
    ],
    ["a cookie without Secure", (h: Headers) => h.append("Set-Cookie", "wf_pass=abc; Path=/; HttpOnly; SameSite=Lax")],
  ])("fails on %s", (_label, change) => {
    const headers = productionHeaders();
    change(headers);
    expect(compareSecurityHeaders(headers).ok).toBe(false);
  });

  it("makes one read-only https request with no credentials and keeps a dated result", async () => {
    const fetcher = vi.fn(async () => new Response("ok", { status: 200, headers: productionHeaders() }));
    const result = await checkLiveSecurityHeaders("https://synthetic.invalid/ward-flow?x=1", {
      fetch: fetcher as unknown as typeof fetch,
      now: () => new Date("2026-11-10T00:00:00.000Z"),
    });
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      at: "2026-11-10T00:00:00.000Z",
      url: "https://synthetic.invalid/ward-flow",
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init).toMatchObject({ method: "GET", redirect: "manual", credentials: "omit" });
    expect(init.body).toBeUndefined();
    await expect(
      checkLiveSecurityHeaders("http://synthetic.invalid/", { fetch: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow(/https/);
  });
});
