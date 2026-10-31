import type { Unit } from "@/components/ward-management/ward-model";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { accessPlaceLabel } from "./ward-access-labels";

/**
 * The bar's place chip names the desk's own place, not the service or "Statewide" (Josh, 30 Oct
 * 2026, every desk but the coordinator). The words are the app's own (`accessPlaceLabel`), shortened
 * where the chip would otherwise wrap: an ED by its short name ("Peel ED", as All EDs prints it), a
 * team as "Midland team" and the transport desk as itself. Undefined where the bar keeps its service
 * picker: the coordinator, and a statewide desk (executive, access admin), whose place is the whole
 * state and "Statewide" already says so.
 */
export function deskPlaceLabel(access: WardAccess, units: readonly Unit[]): string | undefined {
  const scope = access.scope;
  if (access.role === "coordinator" || scope.kind === "statewide") return undefined;
  switch (scope.kind) {
    case "ed":
      return edShortName(edById(scope.edId) ?? { id: scope.edId }) || accessPlaceLabel(access, units);
    case "team":
      return `${scope.teamName} team`;
    case "jobs":
      return scope.service === undefined ? "Transport desk" : `${scope.service} transport`;
    default:
      return accessPlaceLabel(access, units);
  }
}

/**
 * A placed desk's own home page by its page name (Josh, 31 Oct 2026: the page name first, then the
 * place's dropdown). The app's title for these routes is the place itself, so the bar read
 * "Dabakarn / Dabakarn", "Peel ED / Peel ED", "Midland / Midland team" and "Transport / Transport
 * desk". The words match the desk's phone dock (`ward-phone-menu.tsx`), so the bar and the dock name
 * the page alike. Any other route, and any desk with no place of its own, keeps the app's title.
 */
const DESK_HOME_TITLE: Partial<Record<WardAccess["scope"]["kind"], string>> = {
  ward: "My ward",
  ed: "My ED",
  team: "My team",
  jobs: "My jobs",
};

export function deskHomeRouteTitle(
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
