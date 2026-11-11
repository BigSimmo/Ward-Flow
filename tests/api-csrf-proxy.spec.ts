import { expect, test } from "playwright/test";

import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "../src/lib/api-csrf";

/**
 * Helper to derive base origin and host for simulated request headers.
 */
function resolveOriginAndHost(baseURL?: string) {
  const url = new URL(baseURL ?? "http://localhost:3000");
  return {
    origin: url.origin,
    host: url.host,
  };
}

test.describe("API CSRF proxy integration (#72282V)", () => {
  test("matching Origin & Host -> reaches the existing route method boundary", async ({ request, baseURL }) => {
    const { origin, host } = resolveOriginAndHost(baseURL);
    const response = await request.post("/api/health", {
      headers: {
        origin,
        host,
        "sec-fetch-site": "same-origin",
      },
      data: {},
    });

    // Health is GET-only: Next returns 405 only after the proxy allows this POST.
    // Assert the route itself exists so a retired/misspelled endpoint cannot pass.
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(response.status()).toBe(405);
  });

  test("Sec-Fetch-Site: cross-site -> 403 Forbidden", async ({ request, baseURL }) => {
    const { origin, host } = resolveOriginAndHost(baseURL);
    const response = await request.post("/api/health", {
      headers: {
        origin,
        host,
        "sec-fetch-site": "cross-site",
      },
      data: {},
    });

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.code).toBe("cross_site_forbidden");
    expect(data.error).toBe("Cross-site request blocked.");
  });

  test("Mismatched Origin vs Host -> 403 Forbidden", async ({ request, baseURL }) => {
    const { host } = resolveOriginAndHost(baseURL);
    const response = await request.post("/api/health", {
      headers: {
        origin: "https://evil-attacker.example.com",
        host,
      },
      data: {},
    });

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.code).toBe("cross_site_forbidden");
    expect(data.error).toBe("Cross-site request blocked.");
  });

  test("Spoofed X-Forwarded-Host matching a foreign Origin -> 403 Forbidden (A4-08)", async ({ request, baseURL }) => {
    const { host } = resolveOriginAndHost(baseURL);
    const spoofedDomain = "evil-attacker.example.com";

    const response = await request.post("/api/health", {
      headers: {
        origin: `https://${spoofedDomain}`,
        host,
        "x-forwarded-host": spoofedDomain, // Client-sent; must not vouch for the Origin
        "sec-fetch-site": "same-site",
      },
      data: {},
    });

    expect(response.status()).toBe(403);
  });
});

test.describe("apiMutationCsrfVerdict pure contract under simulated proxy headers", () => {
  const internalHost = "localhost:3000";
  const externalHost = "ward-flow.example.test";
  const externalOrigin = `https://${externalHost}`;

  test("isCsrfGuardedApiRequest guards state-changing API endpoints, webhooks included (A4-15)", () => {
    expect(isCsrfGuardedApiRequest("POST", "/api/health")).toBe(true);
    expect(isCsrfGuardedApiRequest("PUT", "/api/account/preferences")).toBe(true);
    expect(isCsrfGuardedApiRequest("PATCH", "/api/clinical-quality")).toBe(true);
    expect(isCsrfGuardedApiRequest("DELETE", "/api/documents/123")).toBe(true);
    expect(isCsrfGuardedApiRequest("GET", "/api/documents")).toBe(false);
    expect(isCsrfGuardedApiRequest("POST", "/api/webhooks/incoming")).toBe(true);
  });

  test("matching Origin & Host -> allowed verdict", () => {
    const headers = new Headers({
      host: internalHost,
      origin: `http://${internalHost}`,
      "sec-fetch-site": "same-origin",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost)).toEqual({ allowed: true });
  });

  test("Sec-Fetch-Site: cross-site -> rejected with cross_site reason", () => {
    const headers = new Headers({
      host: internalHost,
      origin: `http://${internalHost}`,
      "sec-fetch-site": "cross-site",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost)).toEqual({
      allowed: false,
      reason: "cross_site",
    });
  });

  test("Mismatched Origin vs Host -> rejected with origin_mismatch reason", () => {
    const headers = new Headers({
      host: internalHost,
      origin: "https://evil-attacker.example.com",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost)).toEqual({
      allowed: false,
      reason: "origin_mismatch",
    });
  });

  test("X-Forwarded-Host equal to the configured public host -> allowed verdict", () => {
    const headers = new Headers({
      host: internalHost,
      "x-forwarded-host": `${externalHost}, internal-proxy`,
      origin: externalOrigin,
      "sec-fetch-site": "same-site",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost, [externalOrigin])).toEqual({ allowed: true });
  });

  test("Spoofed X-Forwarded-Host without a configured public host -> origin_mismatch (A4-08)", () => {
    const headers = new Headers({
      host: internalHost,
      "x-forwarded-host": externalHost,
      origin: externalOrigin,
      "sec-fetch-site": "same-site",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost, [])).toEqual({ allowed: false, reason: "origin_mismatch" });
  });
});
