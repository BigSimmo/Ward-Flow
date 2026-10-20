import { NextResponse, type NextRequest } from "next/server";

import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "@/lib/api-csrf";
import {
  DEVELOPER_AREA_HEADER,
  DEVELOPER_AREA_PATH_HEADER,
  WARD_FLOW_OFFLINE_HEADER,
  isDeveloperGatedPath,
  isWardFlowPath,
} from "@/lib/developer-area/headers";
import { buildContentSecurityPolicy, resolveRuntimeFlags, resolveSharedWorkspaceOrigins } from "@/lib/security-headers";
import { isUnknownWardFlowPlace } from "@/components/ward-management/ward-known-places";

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
//      them only for the matching request path, so a client cannot spoof the
//      production mockup exemption or Ward Flow's database-free runtime. There
//      is no sign-in gate behind these markers: the developer key was removed on
//      28 September 2026 at the owner's request, and the Ward Flow subtrees are
//      public synthetic-data prototypes (see src/app/ward-flow/layout.tsx).

/**
 * Retired paths that forward, query string intact, to the surface that
 * replaced them. Resolved here as one 307 rather than left to a page's own
 * `redirect()`, which can otherwise stream a slower client-side redirect. The
 * page keeps its own redirect as a backstop for anything the matcher misses.
 */
const staticRouteRedirects: Record<string, string> = {
  // Ward Flow Constellation was retired in Phase 2 and the Network screen it
  // forwarded to on 19 October 2026; both stay as unlinked compatibility
  // redirects to Home so historical deep-links match the page backstops
  // (PR #2303). The redirects moved with Ward Flow, first into
  // /mockups/ward-flow and then, on 19 October 2026, out to /ward-flow.
  "/ward-flow/constellation": "/ward-flow",
  "/ward-flow/network": "/ward-flow",
};

/**
 * Ward Flow's addresses before it left /mockups on 19 October 2026 (rollout readiness review item
 * 3.2). Old links, bookmarks and installed apps keep working: each forwards permanently, query
 * string intact, to the same screen at its new address. `/mockups/ward-flow-digest` is a design
 * reference, not a screen, so it stays where it is.
 */
const movedPrefixes = [
  ["/mockups/ward-flow-sign-in", "/ward-flow-sign-in"],
  ["/mockups/ward-flow", "/ward-flow"],
] as const;

/** The new address for a path under a moved prefix, or null. */
export function movedRouteTarget(pathname: string): string | null {
  for (const [from, to] of movedPrefixes) {
    if (pathname !== from && !pathname.startsWith(`${from}/`)) continue;
    const moved = `${to}${pathname.slice(from.length)}`;
    return staticRouteRedirects[moved] ?? moved;
  }
  return null;
}

// Same runtime flags next.config.ts uses for the static headers, so the nonce'd
// CSP matches the rest of the policy (unsafe-eval in dev, HTTPS upgrade off local
// http). Evaluated once at module load.
const { isDevelopment, isLocalHttpRuntime } = resolveRuntimeFlags();
const sharedOrigins = resolveSharedWorkspaceOrigins();

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A fresh, unguessable nonce per request (see Next.js CSP guide). Buffer+base64
  // matches the documented pattern and keeps the value header-safe.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy({ isDevelopment, isLocalHttpRuntime, nonce, sharedOrigins });

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
    // and spoof past the parent `/mockups` layout's production block on a route
    // that is not actually one of the publicly exempt subtrees listed in
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

  const movedTarget = movedRouteTarget(pathname);

  if (movedTarget) {
    const url = request.nextUrl.clone();
    url.pathname = movedTarget;
    return withCsp(NextResponse.redirect(url, 308));
  }

  const redirectTarget = staticRouteRedirects[pathname];

  if (redirectTarget) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTarget;
    return withCsp(NextResponse.redirect(url));
  }

  if (shouldBlockProductionMockups(pathname)) {
    return withCsp(new NextResponse(null, { status: 404 }));
  }

  // DA-32: a ward, department, team or service address that names nothing is a real 404. It is
  // rewritten to an address no route serves, so Next renders its not-found page with a 404 status;
  // the page's own `notFound()` would come too late, after `loading.tsx` has started a 200.
  if (isUnknownWardFlowPlace(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/ward-flow/unknown-place";
    return withCsp(NextResponse.rewrite(url, { request: { headers: requestHeadersWithNonce() } }));
  }

  return withCsp(NextResponse.next({ request: { headers: requestHeadersWithNonce() } }));
}

export function shouldBlockProductionMockups(
  pathname: string,
  environment: Record<string, string | undefined> = process.env,
) {
  if (!pathname.startsWith("/mockups") || environment.NODE_ENV !== "production") return false;

  // Every subtree listed in DEVELOPER_GATED_PATH_PREFIXES is deliberately public
  // in production: the owner removed the developer key (and with it the former
  // signed-in-administrator gate) on 28 September 2026, so Ward Flow's synthetic
  // prototype opens without one. The constant's name predates that decision; it
  // now lists the exempt subtrees, not gated ones. The prefixes are
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
  // API routes always run through the proxy. Only real static assets skip it:
  // Next's own build output and image optimiser, and the two root icon files the
  // app ships (src/app/favicon.ico, src/app/icon.svg). There is no blanket image
  // extension skip any more (A4-6): a page route whose last segment merely ends
  // in .png or .svg must still get the CSP and the trust-header stripping.
  // PWA plan item 7 (Oct 2026) also skips the generated app images and the
  // manifest by whole path, never by extension: /icons/* and /apple-icon are
  // image route handlers, /screenshots/* are static images and
  // /manifest.webmanifest is JSON. None is a page, reads a trust header or
  // runs script, so the per-request nonce does nothing for them. The service
  // worker script and the offline page stay in: the worker runs under the CSP
  // its own script was sent with, which keeps its fetches same-origin.
  matcher: [
    "/api/:path*",
    "/((?!api(?:/|$)|_next/static/|_next/image(?:/|$)|favicon\\.ico$|icon\\.svg$|icons/|apple-icon$|screenshots/|manifest\\.webmanifest$).*)",
  ],
};
