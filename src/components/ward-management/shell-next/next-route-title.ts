import type { WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * A placed desk's own home page by its page name (Josh, 31 Oct 2026: the page name first, then the
 * place's dropdown). The app's title for these routes is the place itself, so the new frame read
 * "Dabakarn / Dabakarn", "Peel ED / Peel ED", "Midland / Midland team" and "Transport / Transport
 * desk". The words match the desk's phone dock (`next-phone-menu.tsx`), so the bar and the dock name
 * the page alike. Any other route, and any desk with no place of its own, keeps the app's title.
 */
const DESK_HOME_TITLE: Partial<Record<WardAccess["scope"]["kind"], string>> = {
  ward: "My ward",
  ed: "My ED",
  team: "My team",
  jobs: "My jobs",
};

export function nextRouteTitle(
  routeTitle: string,
  pathname: string,
  deskHomeHref: string,
  access: WardAccess,
  deskPlace: string | undefined,
): string {
  if (deskPlace === undefined) return routeTitle;
  const trim = (href: string) => href.replace(/\/+$/u, "");
  if (trim(pathname) !== trim(deskHomeHref)) return routeTitle;
  return DESK_HOME_TITLE[access.scope.kind] ?? routeTitle;
}
