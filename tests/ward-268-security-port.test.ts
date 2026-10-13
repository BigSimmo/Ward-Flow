/**
 * Security-plumbing fixes ported from #268 (8 Oct 2026 review, A4-6, A4-12, A4-13, A4-15).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "@/lib/api-csrf";
import { localProjectRequestIdentityPayload } from "@/lib/local-project-guard";
import { config as proxyConfig, proxy } from "../src/proxy";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("A4-6: only real static assets skip the proxy", () => {
  const pageMatcher = new RegExp(`^${proxyConfig.matcher[1]}$`);
  it("runs the proxy for page routes ending in an image extension", () => {
    expect(pageMatcher.test("/mockups/ward-flow/board.png")).toBe(true);
    expect(pageMatcher.test("/mockups/ward-flow/people/logo.svg")).toBe(true);
    expect(pageMatcher.test("/report.jpg")).toBe(true);
  });
  it("still skips Next's build output and the root icons", () => {
    expect(pageMatcher.test("/_next/static/chunks/main.js")).toBe(false);
    expect(pageMatcher.test("/_next/image")).toBe(false);
    expect(pageMatcher.test("/favicon.ico")).toBe(false);
    expect(pageMatcher.test("/icon.svg")).toBe(false);
    expect(pageMatcher.test("/api/health")).toBe(false);
  });
  it("strips a spoofed trust header on such a route", async () => {
    const request = new NextRequest(new URL("http://localhost/documents/x.png"));
    request.headers.set("x-developer-area", "1");
    const response = await proxy(request);
    expect(response.headers.get("content-security-policy")).toBeTruthy();
    expect(response.headers.get("x-middleware-request-x-developer-area")).toBeNull();
  });
});

describe("A4-12 and A4-15: API CSRF guard", () => {
  it("refuses a header-less mutation", () => {
    expect(apiMutationCsrfVerdict(new Headers(), "localhost")).toEqual({
      allowed: false,
      reason: "missing_browser_headers",
    });
    expect(apiMutationCsrfVerdict(new Headers({ origin: "http://localhost" }), "localhost").allowed).toBe(true);
  });
  it("guards bare /api and /api/webhooks/** like every other API path", () => {
    expect(isCsrfGuardedApiRequest("POST", "/api")).toBe(true);
    expect(isCsrfGuardedApiRequest("POST", "/api/webhooks/anything")).toBe(true);
    expect(isCsrfGuardedApiRequest("GET", "/api")).toBe(false);
  });
  it("blocks a header-less POST to bare /api through the proxy", async () => {
    const response = await proxy(new NextRequest(new URL("http://localhost/api"), { method: "POST" }));
    expect(response.status).toBe(403);
  });
});

describe("A4-13: local server exposure", () => {
  it("a non-loopback Host header cannot loosen the local port rule", () => {
    const payload = localProjectRequestIdentityPayload(
      new Request("http://127.0.0.1:3000/api/local-project-id", { headers: { host: "rebind.example" } }),
    );
    expect(payload.localServer.safeLocalOrigin).toBe(false);
    expect(payload.localServer.currentPort).toBe(3000);
  });
  it("the dev server binds to loopback unless WARD_FLOW_DEV_HOST opts in", () => {
    const script = read("scripts/dev-free-port.mjs");
    expect(script).toContain('process.env.WARD_FLOW_DEV_HOST?.trim() || "127.0.0.1"');
    expect(script).not.toMatch(/"--hostname",\s*"0\.0\.0\.0"/);
  });
});
