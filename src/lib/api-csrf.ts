/**
 * CSRF guard for state-changing `/api/*` requests, shared with `src/proxy.ts`.
 *
 * Pure functions with no imports, no side effects and no module state, so this is
 * safe to import from a Proxy file (see `src/lib/developer-area/headers.ts` for the
 * same constraint).
 *
 * Fetch Metadata is the primary signal: a browser that sends
 * `Sec-Fetch-Site: cross-site` is rejected outright. It is not the only signal,
 * because two shapes slip past it (audit 2026-09-02, L28):
 *
 *   - `same-site` covers every sibling subdomain of the registrable domain, so a
 *     hostile host under the same domain is vouched for by the browser.
 *   - user agents without Fetch Metadata send no `Sec-Fetch-Site` at all, so the
 *     header check simply does not run.
 *
 * In both cases the browser still sends `Origin` on a cross-origin state-changing
 * request, so an `Origin` host that does not match the host the request was
 * addressed to is rejected. Without an `Origin`, only `Sec-Fetch-Site: same-origin`
 * is accepted outright; any other Fetch Metadata value (`same-site`, `none` or an
 * unknown one) falls through to the checks below, as does a request with no Fetch
 * Metadata at all. A valid `x-ward-flow-csrf` header, or a same-host `Referer`, can
 * then vouch for it — the shape an old browser produces. A request carrying none of
 * these is refused (12 October 2026 review, A4-12): Ward Flow has no non-browser API
 * client, and failing closed means a future mutation route cannot be reached by a
 * stripped-header request. A legitimate client sends `Origin` or Fetch Metadata.
 *
 * This is defence in depth. It does not rely on any cookie's `SameSite`
 * attribute (the former clinical app's @supabase/ssr session cookies, which
 * this comment used to cite, left with that app).
 */

const CSRF_GUARDED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Whether a request is a state-changing API call the guard covers: every one under
 * `/api`, the bare `/api` path included. There is no webhook exemption any more
 * (A4-15): Ward Flow has no webhook route, and a blanket path exemption would fail
 * open for whatever route is added there later. A future webhook must be exempted
 * by its exact path, with its own signature check, in a reviewed change.
 */
export function isCsrfGuardedApiRequest(method: string, pathname: string): boolean {
  if (!CSRF_GUARDED_METHODS.has(method.toUpperCase())) return false;
  return pathname === "/api" || pathname.startsWith("/api/");
}

const WARD_FLOW_CSRF_HEADER = "x-ward-flow-csrf";

export type ApiMutationCsrfVerdict =
  | { allowed: true }
  | {
      allowed: false;
      reason: "cross_site" | "origin_mismatch" | "referer_mismatch" | "missing_browser_headers" | "invalid_csrf_header";
    };

const ALLOWED: ApiMutationCsrfVerdict = { allowed: true };

function isValidCsrfHeaderValue(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

/** The host of an absolute URL, lowercased, or null when it is not parsable. */
function hostOfUrl(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/** A bare host (or URL) value, lowercased with any scheme and path dropped, or null. */
function hostOfConfiguredValue(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  return hostOfUrl(candidate.includes("://") ? candidate : `https://${candidate}`);
}

/**
 * The public host(s) the deployment is configured to serve: `NEXT_PUBLIC_SITE_URL`
 * (the canonical origin) and Railway's provider-supplied `RAILWAY_PUBLIC_DOMAIN`, the
 * same two sources `src/lib/metadata-base.ts` trusts. Read at call time so no module
 * state is kept; an absent `process` (or unset variables) yields an empty list.
 */
export function configuredPublicHosts(): string[] {
  const env = typeof process === "undefined" ? undefined : process.env;
  return [env?.NEXT_PUBLIC_SITE_URL, env?.RAILWAY_PUBLIC_DOMAIN]
    .map(hostOfConfiguredValue)
    .filter((host): host is string => Boolean(host));
}

/**
 * Every host this request may legitimately have been addressed to.
 *
 * `requestHost` is the proxy's own view of the URL and `Host` is the header the
 * server received; neither can be set by a cross-origin page. The configured public
 * host(s) count too, because Railway terminates TLS in front of the app, so the
 * Origin a browser sends names the public domain rather than the internal one.
 *
 * `X-Forwarded-Host` is deliberately not trusted on its own (A4-08): any client can
 * send it, so trusting it would let a request vouch for whatever Origin it likes.
 * A forwarded host equal to a configured public host is already in the set, so the
 * legitimate Railway path still passes without reading it.
 */
function addressedHosts(headers: Headers, requestHost: string, publicHosts: Iterable<string>): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | null | undefined) => {
    const normalized = value?.split(",")[0]?.trim().toLowerCase();
    if (normalized) hosts.add(normalized);
  };
  add(requestHost);
  add(headers.get("host"));
  for (const host of publicHosts) add(hostOfConfiguredValue(host));
  return hosts;
}

/**
 * Whether a state-changing API request may proceed.
 *
 * `requestHost` is the host from the request URL; the `Host` header and the
 * configured public host(s) count too. `publicHosts` defaults to
 * `configuredPublicHosts()`; tests pass it explicitly. `X-Forwarded-Host` is ignored.
 */
export function apiMutationCsrfVerdict(
  headers: Headers,
  requestHost: string,
  publicHosts: Iterable<string> = configuredPublicHosts(),
): ApiMutationCsrfVerdict {
  const csrfHeader = headers.get(WARD_FLOW_CSRF_HEADER);
  if (csrfHeader !== null && !isValidCsrfHeaderValue(csrfHeader)) {
    return { allowed: false, reason: "invalid_csrf_header" };
  }

  const secFetchSite = headers.get("sec-fetch-site")?.trim().toLowerCase() ?? null;
  if (secFetchSite === "cross-site") return { allowed: false, reason: "cross_site" };

  const hosts = addressedHosts(headers, requestHost, publicHosts);

  // Present on every cross-origin state-changing browser request, including the
  // `same-site` ones Fetch Metadata vouches for. An opaque `null` Origin (sandboxed
  // iframe, some redirect chains) does not parse and is therefore rejected.
  const origin = headers.get("origin");
  if (origin !== null) {
    const originHost = hostOfUrl(origin);
    return originHost && hosts.has(originHost) ? ALLOWED : { allowed: false, reason: "origin_mismatch" };
  }

  // Same-origin Fetch Metadata without an Origin header is safe to allow immediately.
  // For same-site, none, or unknown values without Origin, fall through to Referer/CSRF checks.
  if (secFetchSite === "same-origin") return ALLOWED;

  // Explicit valid x-ward-flow-csrf header vouches for programmatic or non-browser
  // requests when Fetch Metadata and Origin are absent (A4-12).
  if (csrfHeader !== null && isValidCsrfHeaderValue(csrfHeader)) return ALLOWED;

  const referer = headers.get("referer");
  if (referer !== null) {
    const refererHost = hostOfUrl(referer);
    return refererHost && hosts.has(refererHost) ? ALLOWED : { allowed: false, reason: "referer_mismatch" };
  }

  // No Fetch Metadata, no Origin, no Referer, and no valid x-ward-flow-csrf header:
  // nothing vouches for where the request came from, so it is refused rather than
  // assumed to be a non-browser client.
  return { allowed: false, reason: "missing_browser_headers" };
}
