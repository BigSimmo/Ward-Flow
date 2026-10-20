/**
 * The header's Back control (Josh, 20 Oct 2026). A drill-down screen, one opened from a list,
 * swaps the phone's Menu button for Back, and the desktop bar leads with Back. Back returns to the
 * previous in-app screen, or to the screen's parent when it was opened from a link or a new tab.
 * The pages in the rail and the dock are starting points and keep Menu.
 */

const BASE = "/ward-flow";

type DrillDown = { readonly pattern: RegExp; readonly parent: (match: RegExpExecArray) => string };

/** Screens below a list, each with the page it falls back to. Order matters: `/people/new` first. */
const DRILL_DOWNS: readonly DrillDown[] = [
  { pattern: /^\/ward-flow\/people\/new\/?$/u, parent: () => `${BASE}/search` },
  { pattern: /^\/ward-flow\/people\/[^/]+\/?$/u, parent: () => `${BASE}/movements` },
  { pattern: /^\/ward-flow\/movements\/[^/]+\/?$/u, parent: () => `${BASE}/movements` },
  { pattern: /^\/ward-flow\/ward\/([^/]+)\/answer\/?$/u, parent: (match) => `${BASE}/ward/${match[1]}` },
  { pattern: /^\/ward-flow\/referrals\/new\/?$/u, parent: () => `${BASE}/referrals` },
  {
    pattern: /^\/ward-flow\/statistics\/(?:ward|ed|community|service)\/[^/]+\/?$/u,
    parent: () => `${BASE}/statistics`,
  },
  { pattern: /^\/ward-flow\/bed-meeting\/agenda\/?$/u, parent: () => `${BASE}/capacity` },
  { pattern: /^\/ward-flow\/reports\/(?:downtime|chronology)\/?$/u, parent: () => BASE },
];

/** One ward, ED or community team. It is a drill-down unless it is the desk's own place. */
const PLACE_PAGES: readonly (DrillDown & { readonly kind: "unit" | "ed" | "team" })[] = [
  { kind: "unit", pattern: /^\/ward-flow\/ward\/([^/]+)\/?$/u, parent: () => `${BASE}/wards` },
  { kind: "unit", pattern: /^\/ward-flow\/board\/([^/]+)\/?$/u, parent: () => `${BASE}/wards` },
  { kind: "ed", pattern: /^\/ward-flow\/ed\/([^/]+)\/?$/u, parent: () => `${BASE}/ed` },
  { kind: "team", pattern: /^\/ward-flow\/community\/([^/]+)\/?$/u, parent: () => `${BASE}/community` },
];

function placeKey(pathname: string): string | undefined {
  for (const page of PLACE_PAGES) {
    const match = page.pattern.exec(pathname);
    if (match) return `${page.kind}:${match[1]}`;
  }
  return undefined;
}

/**
 * The parent page Back falls back to, or `undefined` when this screen keeps Menu. `deskHomeHref`
 * is the desk's own home, so a ward nurse's own ward (and its bed board) stays a starting point.
 */
export function wardBackParent(pathname: string, deskHomeHref: string): string | undefined {
  for (const drill of DRILL_DOWNS) {
    const match = drill.pattern.exec(pathname);
    if (match) return drill.parent(match);
  }
  const key = placeKey(pathname);
  if (!key || key === placeKey(deskHomeHref)) return undefined;
  for (const page of PLACE_PAGES) {
    const match = page.pattern.exec(pathname);
    if (match) return page.parent(match);
  }
  return undefined;
}

/*
 * Whether this tab has moved between Ward Flow screens since it loaded. Without it, Back on a page
 * opened from an email or another site would follow the browser history out of Ward Flow.
 */
let firstPathname: string | undefined;
let movedInApp = false;

/** Called by the bar on every route change. */
export function noteWardRoute(pathname: string): void {
  if (firstPathname === undefined) firstPathname = pathname;
  else if (pathname !== firstPathname) movedInApp = true;
}

export function hasMovedInWardFlow(): boolean {
  return movedInApp;
}

/** Tests only: forget the routes seen so far. */
export function resetWardRouteHistory(): void {
  firstPathname = undefined;
  movedInApp = false;
}
