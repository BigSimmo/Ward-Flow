import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  resolveRuntimeFlags,
  resolveSharedWorkspaceOrigins,
} from "../src/lib/security-headers";

// Regression guard for the "all images fail to render" incident in the former
// clinical app, whose document images loaded cross-origin from Supabase Storage.
// Cross-Origin-Embedder-Policy: require-corp blocks cross-origin subresources
// that lack a CORP/CORS opt-in, so it stays banned. Ward Flow loads no
// cross-origin media, so since 4 October 2026 img-src, media-src and
// connect-src are same-origin only and the *.supabase.co allowance is gone.
// These assertions fail loudly if either is reintroduced.

const flagVariants = [
  { name: "production", isDevelopment: false, isLocalHttpRuntime: false },
  { name: "local dev", isDevelopment: true, isLocalHttpRuntime: true },
  { name: "playwright local http", isDevelopment: false, isLocalHttpRuntime: true },
] as const;

const NONCE = "dGVzdC1ub25jZQ==";

describe("security headers", () => {
  for (const flags of flagVariants) {
    describe(flags.name, () => {
      const headers = buildSecurityHeaders(flags);
      const byKey = new Map(headers.map((header) => [header.key, header.value]));
      const csp = buildContentSecurityPolicy({ ...flags, nonce: NONCE });

      it("never sets Cross-Origin-Embedder-Policy (would block cross-origin subresources)", () => {
        expect(byKey.has("Cross-Origin-Embedder-Policy")).toBe(false);
        expect(headers.some((header) => /require-corp/i.test(header.value))).toBe(false);
      });

      it("scopes img-src to same-origin, data: and blob: (no remote origin, no bare https: wildcard)", () => {
        const imgSrc = csp.split(";").find((directive) => directive.trim().startsWith("img-src"));
        expect(imgSrc).toBeDefined();
        const sources = imgSrc!.trim().split(/\s+/);
        expect(sources).toEqual(["img-src", "'self'", "data:", "blob:"]);
        expect(csp).not.toContain("supabase.co");
      });

      it("keeps connect-src same-origin with no Supabase or third-party telemetry origin", () => {
        const connectSrc = csp.split(";").find((directive) => directive.trim().startsWith("connect-src"));
        expect(connectSrc).toBeDefined();
        expect(connectSrc!.trim()).toBe("connect-src 'self'");
        // There is no browser Sentry SDK (docs/error-tracking.md: "no client Sentry
        // bundle path"; the only inits are src/sentry.{server,edge}.config.ts), so the
        // three wildcard `*.ingest*.sentry.io` origins were an egress channel from the
        // clinical origin with no consumer (2026-09-02 audit, L34). Re-add them only
        // alongside a browser SDK and the privacy review docs/error-tracking.md requires.
        expect(connectSrc).not.toContain("sentry.io");
        // OpenAI calls are server-side only; the browser must not be allowed
        // to reach the provider origin (2026-07-13 audit, finding 12).
        expect(connectSrc).not.toContain("api.openai.com");
      });

      it("keeps the baseline hardening headers", () => {
        expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
        expect(byKey.get("X-Frame-Options")).toBe("DENY");
        expect(byKey.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
      });

      it("keeps microphone capture disabled while Clinical Ask dictation has no user entry point", () => {
        // Clinical Ask is dormant (CLINICAL_ASK_ENABLED defaults to false) and PR #2360
        // removed its composer controls, so nothing in the product records audio.
        // Grant the microphone again only with a governed dictation surface (M16).
        expect(byKey.get("Permissions-Policy")).toContain("microphone=()");
        expect(byKey.get("Permissions-Policy")).not.toContain("microphone=(self)");
        expect(byKey.get("Permissions-Policy")).not.toContain("https:");
        expect(csp).not.toContain("api.openai.com");
      });

      it("restricts PWA workers and manifests to this origin", () => {
        const workerSrc = csp.split(";").find((directive) => directive.trim().startsWith("worker-src"));
        const manifestSrc = csp.split(";").find((directive) => directive.trim().startsWith("manifest-src"));
        expect(workerSrc?.trim()).toBe("worker-src 'self'");
        expect(manifestSrc?.trim()).toBe("manifest-src 'self'");
      });
    });
  }

  it("only emits unsafe-eval in development and HSTS/upgrade-insecure-requests off local http", () => {
    const prod = buildContentSecurityPolicy({ isDevelopment: false, isLocalHttpRuntime: false, nonce: NONCE });
    const dev = buildContentSecurityPolicy({ isDevelopment: true, isLocalHttpRuntime: true, nonce: NONCE });

    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).toContain("upgrade-insecure-requests");
    expect(dev).not.toContain("upgrade-insecure-requests");

    const prodHeaders = buildSecurityHeaders({ isDevelopment: false, isLocalHttpRuntime: false });
    const localHeaders = buildSecurityHeaders({ isDevelopment: true, isLocalHttpRuntime: true });
    expect(prodHeaders.some((header) => header.key === "Strict-Transport-Security")).toBe(true);
    expect(localHeaders.some((header) => header.key === "Strict-Transport-Security")).toBe(false);
  });

  // Nonce migration (L19): in production script-src is nonce + strict-dynamic and
  // never 'unsafe-inline'. A missed inline script fails silently at runtime, so
  // this guards the policy shape that makes the nonce the only way scripts run.
  it("gates production script-src on the nonce with strict-dynamic and no unsafe-inline", () => {
    const csp = buildContentSecurityPolicy({ isDevelopment: false, isLocalHttpRuntime: false, nonce: NONCE });
    const scriptSrc = csp.split(";").find((directive) => directive.trim().startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  // Development keeps the pre-migration script-src: 'unsafe-inline' + 'unsafe-eval'
  // and NO 'strict-dynamic'. The Turbopack dev server injects HMR/runtime and
  // route-chunk <script src> tags that carry no nonce; 'strict-dynamic' would
  // disable the 'self' allow-list and block them all. See buildContentSecurityPolicy.
  it("keeps the permissive, nonce-free script-src in development", () => {
    const csp = buildContentSecurityPolicy({ isDevelopment: true, isLocalHttpRuntime: true, nonce: NONCE });
    const scriptSrc = csp.split(";").find((directive) => directive.trim().startsWith("script-src"));
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'nonce-");
  });

  // style-src still relies on 'unsafe-inline' (Next font + inline styles are not
  // nonce-tagged); the migration only hardened script-src.
  it("keeps style-src 'unsafe-inline'", () => {
    const csp = buildContentSecurityPolicy({ isDevelopment: false, isLocalHttpRuntime: false, nonce: NONCE });
    const styleSrc = csp.split(";").find((directive) => directive.trim().startsWith("style-src"));
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  // CSP is emitted per-request from proxy.ts (it carries a nonce), so the static
  // header set must not also emit it — two CSP headers would be enforced as their
  // intersection and break the app.
  it("does not emit Content-Security-Policy in the static header set", () => {
    for (const flags of flagVariants) {
      const headers = buildSecurityHeaders(flags);
      expect(headers.some((header) => header.key === "Content-Security-Policy")).toBe(false);
    }
  });

  // The shared Azure workspace is the only browser-side cross-origin caller:
  // its Function and Microsoft sign-in, and only when that Function is configured.
  describe("shared Azure workspace origins", () => {
    const directive = (csp: string, name: string) =>
      csp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name} `));

    it("adds only the configured Function origin and Microsoft sign-in", () => {
      const sharedOrigins = resolveSharedWorkspaceOrigins("https://wardflow-dev-api-aue.azurewebsites.net/api/");
      expect(sharedOrigins).toEqual([
        "https://wardflow-dev-api-aue.azurewebsites.net",
        "https://login.microsoftonline.com",
      ]);
      const csp = buildContentSecurityPolicy({
        isDevelopment: false,
        isLocalHttpRuntime: false,
        nonce: NONCE,
        sharedOrigins,
      });
      expect(directive(csp, "connect-src")).toBe(
        "connect-src 'self' https://wardflow-dev-api-aue.azurewebsites.net https://login.microsoftonline.com",
      );
      expect(directive(csp, "frame-src")).toBeUndefined();
      expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
      expect(directive(csp, "img-src")).toBe("img-src 'self' data: blob:");
    });

    it("keeps connect-src same-origin when the Function is missing, invalid or not https", () => {
      // undefined reads the build's own setting, so pin it for this test.
      vi.stubEnv("NEXT_PUBLIC_WARD_API_BASE_URL", "");
      for (const value of [undefined, "", "not a url", "http://ward-api.example"]) {
        expect(resolveSharedWorkspaceOrigins(value)).toEqual([]);
      }
      const csp = buildContentSecurityPolicy({ isDevelopment: false, isLocalHttpRuntime: false, nonce: NONCE });
      expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
      expect(directive(csp, "frame-src")).toBeUndefined();
      vi.unstubAllEnvs();
    });
  });

  // Single source of truth shared by next.config.ts and proxy.ts. The
  // isLocalHttpRuntime flag gates HTTPS-only hardening (HSTS,
  // upgrade-insecure-requests), so its derivation is security-relevant.
  describe("resolveRuntimeFlags", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("treats development as local http", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
      expect(resolveRuntimeFlags()).toEqual({ isDevelopment: true, isLocalHttpRuntime: true });
    });

    it("keeps production HTTPS-hardened unless Playwright targets local http", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
      expect(resolveRuntimeFlags()).toEqual({ isDevelopment: false, isLocalHttpRuntime: false });

      vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:4788");
      expect(resolveRuntimeFlags()).toEqual({ isDevelopment: false, isLocalHttpRuntime: true });

      vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://staging.example.com");
      expect(resolveRuntimeFlags()).toEqual({ isDevelopment: false, isLocalHttpRuntime: false });
    });
  });
});
