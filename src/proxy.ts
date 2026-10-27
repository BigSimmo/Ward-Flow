import { NextResponse, type NextRequest } from "next/server";

import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "@/lib/api-csrf";
import { DEVELOPER_AREA_HEADER, DEVELOPER_AREA_PATH_HEADER, isDeveloperGatedPath } from "@/lib/developer-area/headers";
import {
  FRONT_DOOR_PASS_COOKIE,
  FRONT_DOOR_SIGN_IN_PATH,
  frontDoorRequired,
  frontDoorSecret,
  isFrontDoorOpenPath,
  safeNextPath,
  verifyPass,
} from "@/lib/front-door-pass";
import { buildContentSecurityPolicy, resolveRuntimeFlags, resolveSharedWorkspaceOrigins } from "@/lib/security-headers";

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
//      is inherent to nonce-based CSP. PERF-03 (owner ruling, 21 October 2026):
//      keep the per-request nonce and do not edge-cache HTML. A cached page would
//      replay one nonce to every visitor, so dynamic pages are the accepted cost.
//   2. CSRF guard for API mutations. Fetch Metadata plus an Origin/Referer host
//      check on state-changing API requests (see `@/lib/api-csrf` for why
//      `Sec-Fetch-Site: cross-site` alone is not enough).
//   3. Developer-area trust marker. Strips any client-supplied copy of the two
//      developer-area headers and sets them again only for a path in
//      DEVELOPER_GATED_PATH_PREFIXES, so a client cannot spoof the production
//      mockup exemption. That list is empty since Ward Flow left /mockups on
//      19 October 2026, so today the headers are only ever stripped. There is
//      no sign-in gate behind the marker: the developer key was removed on
//      28 September 2026 at the owner's request, and Ward Flow is a public
//      synthetic-data prototype (see src/app/ward-flow/layout.tsx).
//   4. The front door (Josh, 27 October 2026). Off unless the hosted switch
//      `WARD_FRONT_DOOR=required` is set. Then every page and API answers only to
//      a browser holding a signed pass (`@/lib/front-door-pass`): a page sends
//      the visitor to /sign-in, an API call is refused. The pass opens the door
//      only; the shared workspace still checks each account's own sign-in.

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
  // Device sweep A10 (Josh, 26 Oct 2026, decision A33): the other alias pages forwarded only after
  // the app shell had loaded, so the redirect was a second full page load and showed the "Restored
  // the last successful save" notice when nothing had failed. Forwarding here never renders the shell.
  "/ward-flow/command": "/ward-flow",
  "/ward-flow/queue": "/ward-flow/waiting",
  "/ward-flow/escalation": "/ward-flow/waiting",
  "/ward-flow/exceptions": "/ward-flow/waiting",
  "/ward-flow/delays": "/ward-flow/waiting",
  "/ward-flow/statistics/overview": "/ward-flow/statistics",
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
    if (isDeveloperGatedPath(pathname)) {
      headers.set(DEVELOPER_AREA_HEADER, "1");
      headers.set(DEVELOPER_AREA_PATH_HEADER, `${pathname}${request.nextUrl.search}`);
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

  const door = await frontDoorVerdict(request);
  if (door) return withCsp(door);

  if (shouldBlockProductionMockups(pathname)) {
    return withCsp(new NextResponse(null, { status: 404 }));
  }

  return withCsp(NextResponse.next({ request: { headers: requestHeadersWithNonce() } }));
}

/**
 * The front door: null lets the request through, otherwise the response that stops it. Off unless
 * `WARD_FRONT_DOOR=required`. Without a valid pass a page goes to /sign-in, carrying where the
 * visitor was going, and an API call gets 401. A missing signing secret fails closed.
 */
export async function frontDoorVerdict(
  request: NextRequest,
  environment: Record<string, string | undefined> = process.env,
): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl;
  if (!frontDoorRequired(environment) || isFrontDoorOpenPath(pathname)) return null;
  const pass = await verifyPass(frontDoorSecret(environment), request.cookies.get(FRONT_DOOR_PASS_COOKIE)?.value);
  if (pass) return null;
  if (pathname === "/api" || pathname.startsWith("/api/"))
    return NextResponse.json({ error: "Sign in first.", code: "front_door" }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = FRONT_DOOR_SIGN_IN_PATH;
  url.search = "";
  if (pathname === "/ward-flow" || pathname.startsWith("/ward-flow/"))
    url.searchParams.set("next", safeNextPath(pathname + search));
  return NextResponse.redirect(url, 307);
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
  // The icon and screenshot skips name the real files, not their shapes (keep them in step
  // with src/app/icons and public/screenshots; tests/ward-pwa-manifest.test.ts checks):
  // an unknown /icons/x or /screenshots/x renders the app's 404 page, which
  // must still get the CSP.
  matcher: [
    "/api/:path*",
    "/((?!api(?:/|$)|_next/static/|_next/image(?:/|$)|favicon\\.ico$|icon\\.svg$|icons/(?:icon-(?:96|192|512)|(?:maskable|monochrome)-(?:192|512)|startup-(?:1170x2532|1284x2778|1179x2556|1290x2796|1206x2622|1320x2868|750x1334))$|apple-icon$|screenshots/(?:home|referrals|ward)-narrow\\.webp$|manifest\\.webmanifest$).*)",
  ],
};
