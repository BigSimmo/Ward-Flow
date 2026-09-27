import { NextResponse, type NextRequest } from "next/server";

import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "@/lib/api-csrf";
import {
  DEVELOPER_AREA_HEADER,
  DEVELOPER_AREA_PATH_HEADER,
  DEVELOPER_GATED_PATH_PREFIXES,
  WARD_FLOW_OFFLINE_HEADER,
  isDeveloperGatedPath,
  isWardFlowPath,
} from "@/lib/developer-area/headers";
import { buildContentSecurityPolicy, resolveRuntimeFlags } from "@/lib/security-headers";

// Next 16 renamed the `middleware` file convention to `proxy` (see
// node_modules/next/dist/docs/.../file-conventions/proxy.md). Proxy defaults to
// the Node.js runtime.
//
// Jobs:
//   1. Content-Security-Policy nonce. A fresh per-request nonce is generated and
//      threaded into the SSR request (`x-nonce` + the CSP header, which Next.js
//      parses to stamp its framework/bundle scripts) and onto the response so the
//      browser enforces it. This is why the CSP header lives here and not in
//      next.config.ts: a nonce cannot be a build-time constant. Using a nonce
//      opts pages into dynamic rendering (app/layout.tsx reads the nonce), which
//      is inherent to nonce-based CSP.
//   2. CSRF guard for API mutations. Fetch Metadata plus an Origin/Referer host
//      check on state-changing API requests (see `@/lib/api-csrf` for why
//      `Sec-Fetch-Site: cross-site` alone is not enough).
//   3. Developer-area and Ward Flow trust markers. Strips any client-supplied
//      copy of the developer-area and Ward Flow offline headers and restores
//      them only for the matching request path, so a client cannot spoof its
//      way past `DeveloperAreaGate` or Ward Flow's database-free runtime.

/**
 * Retired paths that forward, query string intact, to the surface that
 * replaced them. Resolved here as one 307 rather than left to a page's own
 * `redirect()`, which can otherwise stream a slower client-side redirect. The
 * page keeps its own redirect as a backstop for anything the matcher misses.
 */
const staticRouteRedirects: Record<string, string> = {
  // Ward Flow Constellation was retired in Phase 2; keep
  // /mockups/ward-flow/constellation as an intentional unlinked compatibility
  // redirect to /mockups/ward-flow/network so historical deep-links match the
  // page backstop (PR #2303). Ward Flow moved under the developer-gated
  // /mockups/ward-flow prefix in the sandbox move (see
  // src/lib/developer-area/headers.ts); the constellation redirect moved with it.
  "/mockups/ward-flow/constellation": "/mockups/ward-flow/network",
};

// Same runtime flags next.config.ts uses for the static headers, so the nonce'd
// CSP matches the rest of the policy (unsafe-eval in dev, HTTPS upgrade off local
// http). Evaluated once at module load.
const { isDevelopment, isLocalHttpRuntime } = resolveRuntimeFlags();

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A fresh, unguessable nonce per request (see Next.js CSP guide). Buffer+base64
  // matches the documented pattern and keeps the value header-safe.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy({ isDevelopment, isLocalHttpRuntime, nonce });

  // Fetch Metadata plus an Origin/Referer host check (see `@/lib/api-csrf` for why
  // `Sec-Fetch-Site: cross-site` alone is not enough).
  if (isCsrfGuardedApiRequest(request.method, pathname)) {
    const verdict = apiMutationCsrfVerdict(request.headers, request.nextUrl.host);
    if (!verdict.allowed) {
      const response = NextResponse.json(
        { error: "Cross-site request blocked.", code: "cross_site_forbidden" },
        { status: 403 },
      );
      response.headers.set("content-security-policy", csp);
      return response;
    }
  }

  // Request headers Next.js reads during SSR: `x-nonce` for our own inline
  // <script>, and the CSP header from which Next extracts the nonce for its
  // scripts.
  const requestHeadersWithNonce = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    // Untrusted: strip unconditionally so a client cannot set this header itself
    // and spoof past the parent `/mockups` layout's production gate on a route
    // that is not actually one of the developer-gated subtrees listed in
    // DEVELOPER_GATED_PATH_PREFIXES. Deliberately not re-listed here: the
    // enumeration went stale when a fourth prefix was added and the comment was
    // not (2026-09-02 audit, L76). Read the constant.
    headers.delete(DEVELOPER_AREA_HEADER);
    headers.delete(DEVELOPER_AREA_PATH_HEADER);
    headers.delete(WARD_FLOW_OFFLINE_HEADER);
    if (isDeveloperGatedPath(pathname)) {
      headers.set(DEVELOPER_AREA_HEADER, "1");
      headers.set(DEVELOPER_AREA_PATH_HEADER, `${pathname}${request.nextUrl.search}`);
    }
    if (isWardFlowPath(pathname)) {
      headers.set(WARD_FLOW_OFFLINE_HEADER, "1");
    }
    return headers;
  };
  // Every response the browser sees must carry the enforced CSP header.
  const withCsp = (response: NextResponse) => {
    response.headers.set("content-security-policy", csp);
    return response;
  };

  const redirectTarget = staticRouteRedirects[pathname];

  if (redirectTarget) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTarget;
    return withCsp(NextResponse.redirect(url));
  }

  if (shouldBlockProductionMockups(pathname)) {
    return withCsp(new NextResponse(null, { status: 404 }));
  }

  return withCsp(NextResponse.next({ request: { headers: requestHeadersWithNonce() } }));
}

export function shouldBlockProductionMockups(
  pathname: string,
  environment: Record<string, string | undefined> = process.env,
) {
  if (!pathname.startsWith("/mockups") || environment.NODE_ENV !== "production") return false;

  // Every subtree listed in DEVELOPER_GATED_PATH_PREFIXES carries its own
  // signed-in-administrator gate (`DeveloperAreaGate`, applied in each subtree's
  // layout via the x-developer-area header set above), so let them through this
  // blanket block and let that gate run instead of a bare 404. The prefixes are
  // named once, in `src/lib/developer-area/headers.ts`, and not re-listed here:
  // this comment kept naming a smaller set for months after a fourth prefix was
  // added (2026-09-02 audit, L76). The match is exact-or-slash, so a look-alike path
  // such as `/mockups/care-plan-archive` is NOT let through. Every other
  // /mockups/** path is unaffected.
  if (isDeveloperGatedPath(pathname)) return false;

  // Mockups remain unavailable in every normal production process. The one
  // exception is the repository-owned, isolated Playwright server when its
  // advisory project explicitly opts into mockup coverage. Instrumentation
  // separately refuses PLAYWRIGHT_OFFLINE_MODE outside the inert loopback and
  // isolated .next-playwright profile.
  return !(environment.PLAYWRIGHT_OFFLINE_MODE === "true" && environment.NEXT_PUBLIC_MOCKUPS_ENABLED === "true");
}

export const config = {
  // API routes always run through the proxy, even when the last path segment
  // looks like a static image. Extension skips apply only to non-API assets.
  matcher: [
    "/api/:path*",
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
