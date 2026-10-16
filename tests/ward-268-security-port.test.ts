/**
 * Security-plumbing fixes ported from #268 (8 Oct 2026 review, A4-6, A4-7, A4-12 to A4-15).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
// Next.js 16.3.x exports the proxy matcher under its original middleware name.
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";

import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "@/lib/api-csrf";
import { localProjectRequestIdentityPayload } from "@/lib/local-project-guard";
import { GET as digestGet } from "../src/app/mockups/ward-flow-digest/route";
import { config as proxyConfig, proxy } from "../src/proxy";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("A4-6: only real static assets skip the proxy", () => {
  const matches = (url: string) => unstable_doesProxyMatch({ config: proxyConfig, nextConfig: {}, url });
  it("runs the proxy for page routes ending in an image extension", () => {
    expect(matches("/mockups/ward-flow/board.png")).toBe(true);
    expect(matches("/mockups/ward-flow/people/logo.svg")).toBe(true);
    expect(matches("/report.jpg")).toBe(true);
    expect(matches("/api/health")).toBe(true);
  });
  it("still skips Next's build output and the root icons", () => {
    expect(matches("/_next/static/chunks/main.js")).toBe(false);
    expect(matches("/_next/static/media/logo.png")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/icon.svg")).toBe(false);
  });
  it("strips a spoofed trust header on such a route", async () => {
    expect(matches("/documents/x.png")).toBe(true);
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

describe("A4-7: root public/*.html mockups", () => {
  it("are sent with a noindex header", () => {
    const config = read("next.config.ts");
    expect(config).toMatch(
      /source: "\/:file\(\[\^\/\]\+\\\\\.html\)",\s*headers: \[\{ key: "X-Robots-Tag", value: "noindex, nofollow" \}\]/,
    );
  });
  it("load no unpinned or external third-party script and carry noindex meta tags", () => {
    for (const file of ["public/capacity-table-mockup.html", "public/referral-board-mockup.html"]) {
      const html = read(file);
      expect(html, file).not.toContain("gstatic.com/antigravity");
      expect(html, file).not.toContain("cdn.tailwindcss.com");
      expect(html, file).toMatch(/<meta\s+name="robots"\s+content="noindex,\s*nofollow"\s*\/?>/i);
      // Any quote style, and protocol-relative `//host/file.js` as well as `http(s):`.
      const externalScripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(?:"|')?\s*((?:https?:)?\/\/[^"'\s>]+)/gi)];
      expect(
        externalScripts.map(([, src]) => src),
        file,
      ).toEqual([]);
    }
  });
});

describe("A4-14: the digest route checks production itself", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("answers 404 in production without relying on the proxy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await digestGet()).status).toBe(404);
  });
  it("still serves the design reference outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const response = await digestGet();
    expect(response.status).toBe(200);
  });
});
