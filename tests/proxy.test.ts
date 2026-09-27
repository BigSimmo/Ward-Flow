import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy, shouldBlockProductionMockups } from "../src/proxy";
import { DEVELOPER_GATED_PATH_PREFIXES } from "@/lib/developer-area/headers";

// The proxy owns the per-request nonce CSP (see src/proxy.ts). CI's verify:ui
// only exercises the *dev* CSP path (Turbopack keeps 'unsafe-inline'); these
// unit tests run under NODE_ENV=test, so buildContentSecurityPolicy takes its
// production branch — this is the only automated coverage of the strict,
// shipped nonce policy.

function requestFor(path = "/"): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`));
}

function scriptSrcOf(csp: string): string {
  const directive = csp.split(";").find((d) => d.trim().startsWith("script-src"));
  if (!directive) throw new Error(`no script-src in CSP: ${csp}`);
  return directive.trim();
}

describe("proxy content-security-policy", () => {
  it("emits a per-request nonce with strict-dynamic and no unsafe-inline (production shape)", async () => {
    const res = await proxy(requestFor("/"));
    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeTruthy();

    const scriptSrc = scriptSrcOf(csp!);
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=_-]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("preserves the other CSP directives unchanged", async () => {
    const csp = (await proxy(requestFor("/"))).headers.get("content-security-policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self' data: blob: https://*.supabase.co;");
    // No browser Sentry SDK exists, so connect-src carries no third-party telemetry
    // origin (2026-09-02 audit, L34).
    expect(csp).toContain("connect-src 'self' https://*.supabase.co;");
    expect(csp).not.toContain("sentry.io");
    // OpenAI calls are server-side only; the browser must not be allowed to
    // reach the provider origin (2026-07-13 audit, finding 12).
    expect(csp).not.toContain("api.openai.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("generates a fresh, unguessable nonce on every request", async () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const csp = (await proxy(requestFor("/"))).headers.get("content-security-policy")!;
      const nonce = csp.match(/'nonce-([^']+)'/)![1];
      expect(nonce.length).toBeGreaterThanOrEqual(16);
      nonces.add(nonce);
    }
    expect(nonces.size).toBe(5);
  });

  it("threads the same nonce into the SSR request headers (x-nonce)", async () => {
    const res = await proxy(requestFor("/"));
    const cspNonce = res.headers.get("content-security-policy")!.match(/'nonce-([^']+)'/)![1];

    // NextResponse.next({ request: { headers } }) forwards overridden request
    // headers back through the response via x-middleware-request-* so the SSR
    // render sees x-nonce. Assert the forwarded nonce matches the enforced CSP.
    const overridden = res.headers.get("x-middleware-override-headers") ?? "";
    expect(overridden).toContain("x-nonce");
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(cspNonce);
  });
});

describe("production mockup boundary", () => {
  it("blocks ordinary production traffic and permits only the explicit isolated Playwright advisory profile", () => {
    expect(shouldBlockProductionMockups("/mockups/tools-workflow-board", { NODE_ENV: "production" })).toBe(true);
    expect(
      shouldBlockProductionMockups("/mockups/tools-workflow-board", {
        NODE_ENV: "production",
        PLAYWRIGHT_OFFLINE_MODE: "true",
      }),
    ).toBe(true);
    expect(
      shouldBlockProductionMockups("/mockups/tools-workflow-board", {
        NODE_ENV: "production",
        NEXT_PUBLIC_MOCKUPS_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      shouldBlockProductionMockups("/mockups/tools-workflow-board", {
        NODE_ENV: "production",
        PLAYWRIGHT_OFFLINE_MODE: "true",
        NEXT_PUBLIC_MOCKUPS_ENABLED: "true",
      }),
    ).toBe(false);
    expect(shouldBlockProductionMockups("/applications", { NODE_ENV: "production" })).toBe(false);
  });

  // #L69: ward-flow is one of the entries in DEVELOPER_GATED_PATH_PREFIXES but had
  // no coverage here at all — a dropped prefix would fail closed (404), but
  // nothing would catch it.
  it("lets the Ward Flow subtree through the blanket block, and keeps a look-alike prefix blocked", () => {
    for (const path of ["/mockups/ward-flow", "/mockups/ward-flow/constellation"]) {
      expect(shouldBlockProductionMockups(path, { NODE_ENV: "production" }), path).toBe(false);
    }
    expect(shouldBlockProductionMockups("/mockups/ward-flow-archive", { NODE_ENV: "production" })).toBe(true);
  });
});

describe("developer-area header (x-developer-area)", () => {
  it("sets the header only for developer-gated paths, and strips a client-supplied copy elsewhere", async () => {
    const wardFlowSignInRequest = requestFor("/mockups/ward-flow-sign-in");
    const wardFlowSignInResponse = await proxy(wardFlowSignInRequest);
    expect(wardFlowSignInResponse.headers.get("x-middleware-request-x-developer-area")).toBe("1");
    expect(wardFlowSignInResponse.headers.get("x-middleware-request-x-developer-area-path")).toBe(
      "/mockups/ward-flow-sign-in",
    );

    // A path that merely starts with the same characters is not a prefix match.
    const lookAlikeResponse = await proxy(requestFor("/mockups/ward-flow-archive"));
    expect(lookAlikeResponse.headers.get("x-middleware-request-x-developer-area")).toBeNull();

    const otherRequest = requestFor("/documents/some-id");
    otherRequest.headers.set("x-developer-area", "1");
    otherRequest.headers.set("x-developer-area-path", "/mockups/ward-flow-sign-in");
    const otherResponse = await proxy(otherRequest);
    // Spoofed header must not survive into the forwarded request.
    expect(otherResponse.headers.get("x-middleware-request-x-developer-area")).toBeNull();
    expect(otherResponse.headers.get("x-middleware-request-x-developer-area-path")).toBeNull();
  });

  it("sets the trusted offline marker only for Ward Flow and strips a spoofed copy elsewhere", async () => {
    const wardResponse = await proxy(requestFor("/mockups/ward-flow/capacity"));
    expect(wardResponse.headers.get("x-middleware-request-x-ward-flow-offline")).toBe("1");

    const clinicalRequest = requestFor("/documents/some-id");
    clinicalRequest.headers.set("x-ward-flow-offline", "1");
    const clinicalResponse = await proxy(clinicalRequest);
    expect(clinicalResponse.headers.get("x-middleware-request-x-ward-flow-offline")).toBeNull();
  });

  // #L69: the case above only exercises one gated prefix directly, so a
  // regression that dropped another prefix from DEVELOPER_GATED_PATH_PREFIXES
  // would fail closed (a bare 404 via the blanket production block) rather than
  // open — safe, but silent, and a reviewer would not know to look for the
  // others. Iterates the constant itself so this cannot silently narrow again.
  it("sets the header for every prefix in DEVELOPER_GATED_PATH_PREFIXES, not only the one the case above names", async () => {
    for (const prefix of DEVELOPER_GATED_PATH_PREFIXES) {
      const deepPath = `${prefix}/deep/path`;
      const response = await proxy(requestFor(deepPath));
      expect(response.headers.get("x-middleware-request-x-developer-area"), deepPath).toBe("1");
      expect(response.headers.get("x-middleware-request-x-developer-area-path"), deepPath).toBe(deepPath);
    }
  });
});

describe("static compatibility redirects", () => {
  it("forwards retired constellation deep-links to the network destination", async () => {
    const response = await proxy(requestFor("/mockups/ward-flow/constellation"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/mockups/ward-flow/network");
  });
});

describe("cross-site mutation blocking", () => {
  it("blocks cross-site POST requests to API routes with 403", async () => {
    const request = new NextRequest(new URL("http://localhost/api/documents"), {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    const response = await proxy(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("cross_site_forbidden");
  });

  it("allows same-origin API mutations", async () => {
    const request = new NextRequest(new URL("http://localhost/api/documents"), {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin" },
    });
    const response = await proxy(request);
    expect(response.status).not.toBe(403);
  });
});

describe("API CSRF guard beyond Sec-Fetch-Site: cross-site (L28)", () => {
  function mutation(headers: Record<string, string>) {
    return new NextRequest(new URL("http://localhost/api/documents"), { method: "POST", headers });
  }

  it("blocks a same-site request whose Origin is a sibling subdomain", async () => {
    const response = await proxy(mutation({ "sec-fetch-site": "same-site", origin: "http://evil.localhost" }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("cross_site_forbidden");
  });

  it("blocks a request without Fetch Metadata whose Origin does not match the request host", async () => {
    const response = await proxy(mutation({ origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("cross_site_forbidden");
  });

  it("blocks a request without Fetch Metadata or Origin whose Referer is another host", async () => {
    const response = await proxy(mutation({ referer: "https://attacker.example/form" }));
    expect(response.status).toBe(403);
  });

  it("allows a request without Fetch Metadata whose Origin matches the request host", async () => {
    const response = await proxy(mutation({ origin: "http://localhost" }));
    expect(response.status).not.toBe(403);
  });

  it("allows a non-browser client that sends neither Fetch Metadata, Origin nor Referer", async () => {
    const response = await proxy(mutation({}));
    expect(response.status).not.toBe(403);
  });

  it("does not apply the Origin check to webhook routes", async () => {
    const request = new NextRequest(new URL("http://localhost/api/webhooks/supabase"), {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });
    const response = await proxy(request);
    expect(response.status).not.toBe(403);
  });
});

// The developer-gated area grew from two prefixes to four, and three comments went on
// describing "the two prototypes" / "the two developer-gated subtrees" — under-describing
// the authorization surface on the files that implement it (2026-09-02 audit, L76/L82).
// The durable fix is that a comment names the constant instead of counting, so this guard
// checks the naming rather than any particular wording.
describe("developer-gated area comments name the constant instead of counting (L76/L82)", () => {
  const commented = ["src/proxy.ts", "src/app/mockups/layout.tsx"] as const;

  it("points every gated-area comment at DEVELOPER_GATED_PATH_PREFIXES", () => {
    for (const relativePath of commented) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(source).toContain("DEVELOPER_GATED_PATH_PREFIXES");
      // Any wording that fixes the number is what went stale before.
      expect(source).not.toMatch(/\btwo (?:prototypes|developer-gated|subtrees)/i);
      expect(source).not.toMatch(/\bthe two (?:subtrees|prefixes)\b/i);
    }
  });
});
