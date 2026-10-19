import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Mechanical route enumeration for `tests/ward-no-dead-ends.dom.test.tsx`.
 *
 * ⚠️ **NEVER A HAND-WRITTEN ROUTE LIST.** This codebase has scar tissue on exactly that mistake —
 * `ward-nav.test.ts`'s own header records three separate merge collisions on a hand-counted route
 * total, and `ward-route-component-binding.test.ts` exists because "a route tally kept by hand …
 * is three chances to be complete and one chance to be caught." Both functions here read the
 * filesystem fresh every run, the same discipline those two files already use.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const APP_ROOT = path.join(REPO_ROOT, "src", "app");
const WARD_FLOW_ROOT = path.join(APP_ROOT, "ward-flow");

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkPages(dir: string, names: readonly string[] = ["page.tsx"]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkPages(full, names));
    else if (names.includes(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The App Router path segments for a `page.tsx`, with route-group segments (`(search-app)`)
 * dropped — they organise files on disk but never appear in the URL a browser requests.
 */
function routeSegmentsOf(file: string): string[] {
  return path
    .relative(APP_ROOT, file)
    .split(path.sep)
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
}

export type AppRoutes = {
  staticRoutes: Set<string>;
  dynamicPatterns: RegExp[];
};

/**
 * Every route the whole app serves — not only Ward Flow — because a control this file examines
 * may legitimately link to the developer hub, another mode, or anywhere else under `src/app`.
 * Used only to answer "does this href resolve to a page on disk", never to attribute meaning to
 * which page it is. A `route.ts` handler counts too: the Ward Flow Digest (`/mockups/ward-flow-digest`)
 * is served by one, and Settings links to it.
 */
export function scanAppRoutes(): AppRoutes {
  const staticRoutes = new Set<string>();
  const dynamicPatterns: RegExp[] = [];
  for (const file of walkPages(APP_ROOT, ["page.tsx", "route.ts"])) {
    const segments = routeSegmentsOf(file);
    const dynamic = segments.some((segment) => /^\[.+\]$/.test(segment));
    if (dynamic) {
      const pattern = segments.map((segment) => (/^\[.+\]$/.test(segment) ? "[^/]+" : escapeRegex(segment))).join("/");
      dynamicPatterns.push(new RegExp(`^/${pattern}$`));
    } else {
      staticRoutes.add(segments.length === 0 ? "/" : `/${segments.join("/")}`);
    }
  }
  return { staticRoutes, dynamicPatterns };
}

/** Strips query and hash, and a single trailing slash, before matching. */
export function hrefResolvesToRoute(href: string, routes: AppRoutes): boolean {
  const clean = (href.split("?")[0] ?? href).split("#")[0] ?? href;
  const normalised = clean.length > 1 && clean.endsWith("/") ? clean.slice(0, -1) : clean;
  if (routes.staticRoutes.has(normalised)) return true;
  return routes.dynamicPatterns.some((pattern) => pattern.test(normalised));
}

export type WardFlowRouteInfo = {
  /** `/ward-flow/...`, matching what `usePathname()`/an `href` would carry. */
  route: string;
  dynamic: boolean;
  /** True when the page's own default export calls `redirect(...)` and renders nothing to click. */
  redirectOnly: boolean;
};

/**
 * Every Ward Flow `page.tsx` on disk, each flagged for whether it redirects rather than renders.
 * Redirect detection mirrors `ward-route-component-binding.test.ts`'s own `componentRenderedBy` —
 * same signal (a `redirect(` call in the default export's body), read independently here so this
 * file has no import-order dependency on that one.
 */
export function scanWardFlowRoutes(): WardFlowRouteInfo[] {
  return walkPages(WARD_FLOW_ROOT).map((file) => {
    const segments = routeSegmentsOf(file);
    const route = `/${segments.join("/")}`;
    const dynamic = segments.some((segment) => /^\[.+\]$/.test(segment));
    const source = readFileSync(file, "utf8");
    const body = source.slice(source.indexOf("export default"));
    // D-39 (15 Oct 2026): a record page redirects an OLD raw-id link to its coded address and
    // otherwise renders a screen. Only a page that redirects and renders nothing is redirect-only.
    const rendersAScreen = /\breturn\s*\(?\s*</u.test(body);
    const redirectOnly = /\bredirect\(\s*["'`]/u.test(body) && !rendersAScreen;
    return { route, dynamic, redirectOnly };
  });
}
