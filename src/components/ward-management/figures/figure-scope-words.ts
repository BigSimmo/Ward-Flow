/**
 * THE SCOPE WORD BESIDE A FIGURE (R-FIGS-11, R-BEDS-5; figures spec 3.3, D-220).
 *
 * A desk-scoped figure says whose figure it is with ONE word beside it, never a sentence (Josh,
 * 14 Nov 2026 wording rule): "Network", "RPH", "Dabakarn", "Midland". The word comes from the desk's access scope (`WardAccessScope`, the one permission source), the service
 * chosen in the header, and the row's own scope kind (`FigureRow.scope`).
 *
 * `figureScope` (`shell/ward-figure-scope.ts`) keeps its job: the "Network-wide" tag for a figure
 * that ignores a chosen service. The rail's hover title (`countScopeNote`,
 * `shell-next/next-rail-parts.tsx`) keeps its sentence; phase 2 makes both read this word.
 *
 * Phase 1: no screen reads this yet. Pure: no React, no browser API.
 */
import type { FigureScopeKind } from "@/components/ward-management/figures/figure-row";
import type { HealthService } from "@/components/ward-management/ward-model";
import type { WardAccessScope } from "@/components/ward-management/ward-role-access";
import { healthServiceAcronym } from "@/components/ward-management/ward-service-scope";

/** The word for the whole network. */
export const NETWORK_SCOPE_WORD = "Network";

/** One-word names the caller already holds for a ward or ED scope ("Dabakarn", "Armadale"). */
export type FigureScopeNames = {
  readonly ward?: string;
  readonly ed?: string;
};

function serviceWord(service: HealthService | null | undefined): string {
  return service ? healthServiceAcronym(service) || service : NETWORK_SCOPE_WORD;
}

/** The word for a figure that follows the desk: the desk's own place, or the chosen service. */
function deskWord(scope: WardAccessScope, service: HealthService | null, names: FigureScopeNames): string {
  switch (scope.kind) {
    case "statewide":
      return serviceWord(service);
    case "service":
      return serviceWord(scope.service);
    case "site":
      return scope.siteCode;
    case "ward":
      return names.ward ?? "Ward";
    case "ed":
      return names.ed ?? "ED";
    case "team":
      return scope.teamName;
    case "jobs":
      return scope.service ? serviceWord(scope.service) : NETWORK_SCOPE_WORD;
  }
}

/**
 * "Network", "RPH", "Dabakarn", "Armadale" or "Midland": the one scope word for one figure on one
 * desk. A "patient" figure is about one person and has no scope word (""). A "ward", "ed" or "team"
 * figure on a desk of another kind names the place it was given, or says "Ward", "ED" or "Team".
 */
export function figureScopeWords(
  scope: WardAccessScope,
  service: HealthService | null,
  rowScope: FigureScopeKind,
  names: FigureScopeNames = {},
): string {
  switch (rowScope) {
    case "network":
      return NETWORK_SCOPE_WORD;
    case "patient":
      return "";
    case "service":
      return serviceWord(service);
    case "ward":
      return scope.kind === "ward" ? deskWord(scope, service, names) : (names.ward ?? "Ward");
    case "ed":
      return scope.kind === "ed" ? deskWord(scope, service, names) : (names.ed ?? "ED");
    case "team":
      return scope.kind === "team" ? deskWord(scope, service, names) : "Team";
    case "desk":
      return deskWord(scope, service, names);
  }
}
