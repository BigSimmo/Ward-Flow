// Read by `src/proxy.ts`. The `/mockups` layout that `DEVELOPER_AREA_HEADER` used to
// signal was deleted as dead code (production audit UISR-05, 25 Oct 2026): `/mockups`
// holds only a route handler, which no layout wraps. The former `DeveloperAreaGate` sign-in gate was
// removed with the developer key on 28 September 2026 (owner decision): any
// "gated" prefix below is publicly exempt from the production mockup block, not
// guarded by a sign-in, and since Ward Flow left /mockups the list is empty. Pure string constants only
// — no side effects, no stateful singletons — so this is safe to import from a
// Proxy file per its "no shared modules/globals" guidance.
//
// Deliberately not under `src/lib/mockups/**` or anything matching `*mockup*`:
// this is real production authorization code (it runs in `src/proxy.ts` on
// every request), and `no-restricted-imports` forbids production code from
// depending on anything path-matched as mockup/design-scratch.

/** Set to "1" by proxy.ts only for the gated prefixes below; stripped from every
 *  other /mockups/** request so a client cannot spoof it and read a hidden
 *  design-scratch mockup by sending the header itself. */
export const DEVELOPER_AREA_HEADER = "x-developer-area";

/** The exact requested path+query, so a sign-in redirect can return the visitor
 *  to the specific page they asked for (e.g. a deep Caring Contact route), not
 *  just the area root. */
export const DEVELOPER_AREA_PATH_HEADER = "x-developer-area-path";

/** Trusted request marker for Ward Flow's database-free runtime. `src/proxy.ts`
 * strips any client-supplied copy and restores it only for the exact Ward Flow
 * subtree before the root layout reads it. */
export const WARD_FLOW_OFFLINE_HEADER = "x-ward-flow-offline";

/** Ward Flow remains inside the repository for shared Next.js/design tooling,
 * but it is a standalone synthetic prototype rather than a Clinical KB surface. */
export const WARD_FLOW_PATH_PREFIX = "/ward-flow";

export function isWardFlowPath(pathname: string): boolean {
  return pathname === WARD_FLOW_PATH_PREFIX || pathname.startsWith(`${WARD_FLOW_PATH_PREFIX}/`);
}

/** Subtrees under `/mockups` that stay public in production, as exact prefixes. Empty since
 *  19 October 2026: Ward Flow and its sign-in screen moved out of `/mockups` to `/ward-flow` and
 *  `/ward-flow-sign-in` (rollout readiness review item 3.2), so production no longer depends on
 *  this list, and every `/mockups/**` path is blocked there. The old addresses redirect in
 *  `src/proxy.ts`.
 *
 *  If a subtree ever has to be added back, match exact-or-slash only (`isDeveloperGatedPath`),
 *  so a look-alike such as `/mockups/care-plan-archive` stays blocked, and never widen it to
 *  `/mockups`.
 *
 *  🔴 Keep this note ABOVE the array and never inside it. `readDeveloperGatedPrefixes` in
 *  `scripts/check-mockup-retirement.mjs` extracts every quoted or backticked span between the
 *  brackets, so a comment placed among the entries turns each of its code spans into a phantom
 *  prefix — measured 2026-09-12, when doing so reddened two retirement gates at once. */
export const DEVELOPER_GATED_PATH_PREFIXES = [] as readonly string[];

/**
 * Whether a pathname is inside one of the gated subtrees. Exact-or-slash, so a
 * look-alike such as `/mockups/care-plan-archive` is NOT a match.
 *
 * Lives here, beside the prefixes, so `src/proxy.ts` never carries a second copy
 * of this predicate: a duplicate is exactly what drifts, and the proxy's blanket
 * production block is a security guard, where drifting means failing open.
 */
export function isDeveloperGatedPath(pathname: string): boolean {
  return DEVELOPER_GATED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
