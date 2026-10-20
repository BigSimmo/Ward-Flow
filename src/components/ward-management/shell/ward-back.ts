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
 * Whether there is a Ward Flow screen behind this one in the tab's history. Without it, Back on a
 * page opened from an email or another site would follow the browser history out of Ward Flow.
 * Where the browser has the Navigation API, the current history entry must sit after the one the
 * tab landed on (so browser Back to the landing page counts as no history). Elsewhere it falls back
 * to whether the route has changed since the page loaded.
 */
let firstPathname: string | undefined;
let landingIndex: number | undefined;
let movedInApp = false;

function historyIndex(): number | undefined {
  const index = (globalThis as { navigation?: { currentEntry?: { index?: number } | null } }).navigation?.currentEntry
    ?.index;
  return typeof index === "number" && index >= 0 ? index : undefined;
}

/** Called by the bar on every route change. */
export function noteWardRoute(pathname: string): void {
  if (firstPathname === undefined) {
    firstPathname = pathname;
    landingIndex = historyIndex();
  } else if (pathname !== firstPathname) movedInApp = true;
}

export function hasMovedInWardFlow(): boolean {
  const index = historyIndex();
  if (index !== undefined && landingIndex !== undefined) return index > landingIndex;
  return movedInApp;
}

/** Tests only: forget the routes seen so far. */
export function resetWardRouteHistory(): void {
  firstPathname = undefined;
  landingIndex = undefined;
  movedInApp = false;
}
