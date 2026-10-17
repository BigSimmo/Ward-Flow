import { describe, expect, it } from "vitest";
import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "@/lib/api-csrf";

// The proxy's CSRF guard for state-changing /api/* requests. Fetch Metadata is the
// primary signal; when a browser omits it, or sends `same-site` for a sibling
// subdomain, the Origin (then Referer) host must match the host the request was
// addressed to. Absent Origin AND absent Referer is refused (12 October 2026 review, A4-12).

function headersOf(entries: Record<string, string>) {
  return new Headers(entries);
}

describe("isCsrfGuardedApiRequest", () => {
  it("guards mutating methods on every /api path, webhooks and bare /api included (A4-12, A4-15)", () => {
    expect(isCsrfGuardedApiRequest("POST", "/api/documents")).toBe(true);
    expect(isCsrfGuardedApiRequest("PUT", "/api/documents")).toBe(true);
    expect(isCsrfGuardedApiRequest("PATCH", "/api/documents")).toBe(true);
    expect(isCsrfGuardedApiRequest("DELETE", "/api/documents")).toBe(true);
    expect(isCsrfGuardedApiRequest("GET", "/api/documents")).toBe(false);
    expect(isCsrfGuardedApiRequest("POST", "/api/webhooks/supabase")).toBe(true);
    expect(isCsrfGuardedApiRequest("POST", "/api")).toBe(true);
    expect(isCsrfGuardedApiRequest("POST", "/documents")).toBe(false);
  });
});

describe("apiMutationCsrfVerdict", () => {
  const requestHost = "psychiatry.tools";

  it("rejects Sec-Fetch-Site: cross-site regardless of Origin", () => {
    expect(
      apiMutationCsrfVerdict(
        headersOf({ "sec-fetch-site": "cross-site", origin: "https://psychiatry.tools" }),
        requestHost,
      ),
    ).toEqual({ allowed: false, reason: "cross_site" });
  });

  it("allows same-origin Fetch Metadata with no Origin header (existing browser flow)", () => {
    expect(apiMutationCsrfVerdict(headersOf({ "sec-fetch-site": "same-origin" }), requestHost)).toEqual({
      allowed: true,
    });
  });

  it("allows same-origin Fetch Metadata whose Origin matches the request host", () => {
    expect(
      apiMutationCsrfVerdict(
        headersOf({ "sec-fetch-site": "same-origin", origin: "https://psychiatry.tools" }),
        requestHost,
      ),
    ).toEqual({ allowed: true });
  });

  it("rejects Sec-Fetch-Site: same-site when Origin is a sibling subdomain", () => {
    expect(
      apiMutationCsrfVerdict(
        headersOf({ "sec-fetch-site": "same-site", origin: "https://evil.psychiatry.tools" }),
        requestHost,
      ),
    ).toEqual({ allowed: false, reason: "origin_mismatch" });
  });

  it("rejects Sec-Fetch-Site: same-site without Origin when Referer is missing or cross-origin", () => {
    expect(apiMutationCsrfVerdict(headersOf({ "sec-fetch-site": "same-site" }), requestHost)).toEqual({
      allowed: false,
      reason: "missing_browser_headers",
    });

    expect(
      apiMutationCsrfVerdict(
        headersOf({ "sec-fetch-site": "same-site", referer: "https://evil.psychiatry.tools/page" }),
        requestHost,
      ),
    ).toEqual({ allowed: false, reason: "referer_mismatch" });

    expect(
      apiMutationCsrfVerdict(
        headersOf({ "sec-fetch-site": "same-site", referer: "https://psychiatry.tools/page" }),
        requestHost,
      ),
    ).toEqual({ allowed: true });
  });

  it("rejects a mismatched Origin when Fetch Metadata is absent", () => {
    expect(apiMutationCsrfVerdict(headersOf({ origin: "https://attacker.example" }), requestHost)).toEqual({
      allowed: false,
      reason: "origin_mismatch",
    });
  });

  it("rejects an opaque `null` Origin and an unparsable Origin", () => {
    expect(apiMutationCsrfVerdict(headersOf({ origin: "null" }), requestHost)).toEqual({
      allowed: false,
      reason: "origin_mismatch",
    });
    expect(apiMutationCsrfVerdict(headersOf({ origin: "not a url" }), requestHost)).toEqual({
      allowed: false,
      reason: "origin_mismatch",
    });
  });

  it("allows a matching Origin when Fetch Metadata is absent (older browsers)", () => {
    expect(apiMutationCsrfVerdict(headersOf({ origin: "https://psychiatry.tools" }), requestHost)).toEqual({
      allowed: true,
    });
    // Host comparison is case-insensitive and port-aware.
    expect(
      apiMutationCsrfVerdict(headersOf({ origin: "http://LOCALHOST:3000", host: "localhost:3000" }), "localhost:3000"),
    ).toEqual({ allowed: true });
    expect(
      apiMutationCsrfVerdict(headersOf({ origin: "http://localhost:3001", host: "localhost:3000" }), "localhost:3000"),
    ).toEqual({ allowed: false, reason: "origin_mismatch" });
  });

  it("accepts the Host and X-Forwarded-Host headers as the addressed host", () => {
    expect(
      apiMutationCsrfVerdict(
        headersOf({ origin: "https://psychiatry.tools", host: "psychiatry.tools" }),
        "internal.railway.app",
      ),
    ).toEqual({ allowed: true });
    expect(
      apiMutationCsrfVerdict(
        headersOf({
          origin: "https://psychiatry.tools",
          host: "internal.railway.app",
          "x-forwarded-host": "psychiatry.tools",
        }),
        "internal.railway.app",
      ),
    ).toEqual({ allowed: true });
  });

  it("falls back to Referer when Fetch Metadata and Origin are both absent", () => {
    expect(apiMutationCsrfVerdict(headersOf({ referer: "https://attacker.example/page" }), requestHost)).toEqual({
      allowed: false,
      reason: "referer_mismatch",
    });
    expect(apiMutationCsrfVerdict(headersOf({ referer: "https://psychiatry.tools/documents" }), requestHost)).toEqual({
      allowed: true,
    });
  });

  it("refuses a request with no Fetch Metadata, no Origin and no Referer (A4-12)", () => {
    expect(apiMutationCsrfVerdict(headersOf({}), requestHost)).toEqual({
      allowed: false,
      reason: "missing_browser_headers",
    });
  });

  it("does not consult Referer once Fetch Metadata vouches for the request", () => {
    expect(
      apiMutationCsrfVerdict(
        headersOf({ "sec-fetch-site": "same-origin", referer: "https://attacker.example/" }),
        requestHost,
      ),
    ).toEqual({ allowed: true });
  });

  describe("x-ward-flow-csrf header validation (A4-12)", () => {
    it("allows a request with valid x-ward-flow-csrf: '1' when Origin and Fetch Metadata are absent", () => {
      expect(apiMutationCsrfVerdict(headersOf({ "x-ward-flow-csrf": "1" }), requestHost)).toEqual({ allowed: true });
    });

    it("allows a request with valid x-ward-flow-csrf: 'true' (case-insensitive and trimmed)", () => {
      expect(apiMutationCsrfVerdict(headersOf({ "x-ward-flow-csrf": "true" }), requestHost)).toEqual({
        allowed: true,
      });
      expect(apiMutationCsrfVerdict(headersOf({ "x-ward-flow-csrf": " TRUE " }), requestHost)).toEqual({
        allowed: true,
      });
    });

    it("rejects an explicitly invalid x-ward-flow-csrf header", () => {
      expect(apiMutationCsrfVerdict(headersOf({ "x-ward-flow-csrf": "" }), requestHost)).toEqual({
        allowed: false,
        reason: "invalid_csrf_header",
      });
      expect(apiMutationCsrfVerdict(headersOf({ "x-ward-flow-csrf": "0" }), requestHost)).toEqual({
        allowed: false,
        reason: "invalid_csrf_header",
      });
      expect(apiMutationCsrfVerdict(headersOf({ "x-ward-flow-csrf": "false" }), requestHost)).toEqual({
        allowed: false,
        reason: "invalid_csrf_header",
      });
      expect(apiMutationCsrfVerdict(headersOf({ "x-ward-flow-csrf": "token123" }), requestHost)).toEqual({
        allowed: false,
        reason: "invalid_csrf_header",
      });
    });

    it("rejects an invalid x-ward-flow-csrf header even when Origin matches", () => {
      expect(
        apiMutationCsrfVerdict(headersOf({ origin: "https://psychiatry.tools", "x-ward-flow-csrf": "0" }), requestHost),
      ).toEqual({
        allowed: false,
        reason: "invalid_csrf_header",
      });
    });

    it("rejects mismatched Origin even when valid x-ward-flow-csrf is present", () => {
      expect(
        apiMutationCsrfVerdict(headersOf({ origin: "https://attacker.example", "x-ward-flow-csrf": "1" }), requestHost),
      ).toEqual({
        allowed: false,
        reason: "origin_mismatch",
      });
    });

    it("rejects Sec-Fetch-Site: cross-site even when valid x-ward-flow-csrf is present", () => {
      expect(
        apiMutationCsrfVerdict(headersOf({ "sec-fetch-site": "cross-site", "x-ward-flow-csrf": "1" }), requestHost),
      ).toEqual({
        allowed: false,
        reason: "cross_site",
      });
    });
  });
});
