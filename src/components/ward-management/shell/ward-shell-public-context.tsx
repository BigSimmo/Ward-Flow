"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWardFeatureFlag } from "./ward-feature-flag-store";
import type { PlaceLookup, WardAccess } from "../ward-role-access";
import type { ExecutiveReportingFoundation } from "../statistics/executive-statistics-contract";
import { communityTeamSlug } from "../community/community-derivations";
import type { WardSharedConnection } from "../ward-shared-access";

/** A UI lifetime key from the source already in force, not transport authorisation. */
export function wardShellLifetime(
  shared: WardSharedConnection,
  scenario: string,
  generation: number,
  access: WardAccess,
) {
  return JSON.stringify([
    shared.enabled ? shared.actorId : "local-demo",
    shared.workingAs,
    shared.snapshot?.accessContext,
    shared.viewEpoch,
    scenario,
    generation,
    access,
  ]);
}

/** Authenticated authority is available before any operational provider or local desk effect. */
const WardShellAuthorityContext = createContext<WardAccess | null>(null);
export function WardShellAuthorityProvider({ access, children }: { access: WardAccess; children: ReactNode }) {
  return <WardShellAuthorityContext.Provider value={access}>{children}</WardShellAuthorityContext.Provider>;
}
export function useWardShellAuthority() {
  return useContext(WardShellAuthorityContext);
}
export function useWardAccessEnabled() {
  const configured = useWardFeatureFlag("role-access");
  const authority = useWardShellAuthority();
  return configured || authority !== null;
}

/** Public naming and permission inputs only. No operational context, records or command dispatch. */
export type WardShellPublicModel = {
  places: PlaceLookup;
  placeLabel: string;
  now: number;
  authenticated?: boolean;
  switchRole?: () => void;
  /** Current authenticated actor/role/context/epoch identity; never a report revision or invented token. */
  accessLifetime?: string;
};
const WardShellPublicContext = createContext<WardShellPublicModel | null>(null);
export function WardShellPublicProvider({ value, children }: { value: WardShellPublicModel; children: ReactNode }) {
  return <WardShellPublicContext.Provider value={value}>{children}</WardShellPublicContext.Provider>;
}
export function useWardShellPublic() {
  return useContext(WardShellPublicContext);
}

/** Use the explicit public directory; never construct Unit or other domain records for a selector. */
export function executiveShellPlaces(report: ExecutiveReportingFoundation): PlaceLookup {
  const wards = new Map(report.wards.map((ward) => [ward.id, ward]));
  const eds = new Map(report.emergencyDepartments.map((ed) => [ed.id, ed]));
  const teams = new Map(report.teams.map((team) => [team.id, team]));
  const sites = new Map(report.catalogue.sites.map((site) => [site.code, site]));
  return {
    unitSiteCode: (id) => wards.get(id)?.siteCode,
    unitService: (id) => wards.get(id)?.service,
    edSiteCode: (id) => eds.get(id)?.siteCode,
    edService: (id) => eds.get(id)?.service,
    teamSlug: communityTeamSlug,
    teamService: (id) => teams.get(id)?.service ?? undefined,
    siteService: (code) => sites.get(code)?.service,
  };
}
