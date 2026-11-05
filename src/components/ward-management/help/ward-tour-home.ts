"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { communityTeamById, communityTeamSlug } from "../community/community-derivations";
import { usePersonaDeskId } from "../settings/persona-sync";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { edHref, teamHref, unitHref } from "../shell/ward-facade";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { wardPlaceIdFor } from "../ward-place";
import { homeHrefFor, type WardAccess } from "../ward-role-access";
import { edById } from "../ward-sites";
import { useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";
import type { TourRole } from "./ward-tour-steps";

const COMMUNITY_ROUTE = /\/ward-flow\/community\/([^/?#]+)/;
const FIXED_HOMES: Partial<Record<TourRole, string>> = {
  coordinator: "/ward-flow",
  officer: "/ward-flow/transport/officer",
  bed_manager: "/ward-flow/capacity",
  executive: "/ward-flow/statistics",
  // Access admin lands on Settings; the tour itself walks Governance.
  admin: "/ward-flow/governance",
};

type TourHomeInputs = {
  role: TourRole;
  access: WardAccess;
  pathname: string;
  deskId?: string;
  /** Undefined means there is no operational provider, unlike an available empty collection. */
  units?: readonly { id: string }[];
  executive: boolean;
};

/** Shared home resolution for header Help and the tour; no clinical figures are derived here. */
export function resolveTourHome({ role, access, pathname, deskId, units, executive }: TourHomeInputs) {
  if (executive) return { home: FIXED_HOMES.executive, deskHome: FIXED_HOMES.executive };
  if (!units) return { home: FIXED_HOMES[role], deskHome: FIXED_HOMES[role] };
  const scope = access.role === role ? access.scope : undefined;
  const routePlace = wardPlaceIdFor(pathname);
  let home = FIXED_HOMES[role];
  if (role === "ward") {
    const unitId = scope?.kind === "ward" ? scope.unitIds[0] : (routePlace ?? deskId);
    if (unitId && units.some((unit) => unit.id === unitId)) home = unitHref(unitId);
  }
  if (role === "ed") {
    const edId = scope?.kind === "ed" ? scope.edId : (routePlace ?? deskId);
    const ed = edId ? edById(edId) : undefined;
    if (ed) home = edHref(ed.id);
  }
  if (role === "community") {
    const slug =
      scope?.kind === "team" ? communityTeamSlug(scope.teamName) : (COMMUNITY_ROUTE.exec(pathname)?.[1] ?? deskId);
    const team = slug ? communityTeamById(slug) : null;
    if (team) home = teamHref(team.id);
  }
  const deskHome = access.role === role ? homeHrefFor(access, communityTeamSlug) : home;
  if (access.role === role && role !== "admin" && role !== "coordinator") home = deskHome;
  return { home, deskHome };
}

/** Home eligibility does not subscribe to movements, census, report figures or task derivations. */
export function useTourHome(role: TourRole) {
  const pathname = usePathname() ?? "";
  const access = useEffectiveWardAccess();
  const deskId = usePersonaDeskId();
  const flow = useOptionalWardFlowSelect("units");
  const units = flow?.units;
  const executive = useExecutiveStatisticsControl().executive;
  return useMemo(
    () => resolveTourHome({ role, access, pathname, deskId, units, executive }),
    [role, access, pathname, deskId, units, executive],
  );
}
