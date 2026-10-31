"use client";

// Fork of src/components/ward-management/use-ward-nav-counts.ts: the rail's counts for the desk's own place.

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { WARD_SHELL_ROLE, wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useAccessShellRole, useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { wardNavCounts, type WardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { wardPlaceIdFor } from "@/components/ward-management/ward-place";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { unitInScope } from "@/components/ward-management/ward-role-access";
import { totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";

/**
 * The real hook's role, counts and place id (see its file for why the rail, dock and menu share one
 * hook). One change, approved by Josh on 30 Oct 2026:
 *
 * ROLE BRANCH (bed_manager, and any desk held to a site, service or ward): the workspace scope keeps
 * every ward's beds in view (they hold no patient), so the rail's Capacity counted the network's ready
 * beds (26) for a site bed manager. Capacity's figure is now the same rule (`totalReadyBedsNow`) over
 * the desk's own wards only. People (journeys, referrals, waits) and bed releases are already narrowed
 * by the workspace scope, so every other count is the real hook's, unchanged.
 * The statewide coordinator, executive and access admin count the whole network, as before.
 */
export function usePreviewNavCounts(): {
  role: WardChromeRole;
  /** The signed-in person's role (`WARD_SHELL_ROLE`): nav order and Tasks follow this, never the route. */
  shellRole: WardChromeRole;
  counts: WardNavCounts;
  placeId: string | undefined;
} {
  const pathname = usePathname() ?? "";
  const { movements, units, referrals, bedReleases, leaveBeds, admissions } = useWardFlowSelect(
    "movements",
    "units",
    "referrals",
    "bedReleases",
    "leaveBeds",
    "admissions",
  );
  const now = useWardFlowClock();
  const thresholds = useDueSoonThresholds();
  const network = useWardNetwork();
  const service = useServiceScope();
  const routeRole = wardChromeRole(pathname);
  // Role access plan: a non-coordinator desk's nav and Tasks follow its own role.
  const deskRole = useAccessShellRole(WARD_SHELL_ROLE);
  const { scope } = useEffectiveWardAccess();
  const placeUnits = useMemo(() => {
    if (scope.kind !== "site" && scope.kind !== "service" && scope.kind !== "ward") return null;
    const places = wardPlaceLookup(units);
    return units.filter((unit) => unitInScope(scope, unit.id, places));
  }, [scope, units]);
  const counts = wardNavCounts({
    movements,
    units,
    sites: network.sites,
    referrals,
    bedReleases,
    leaveBeds,
    admissions,
    now,
    thresholds,
    service,
  });
  return {
    role: deskRole === WARD_SHELL_ROLE ? routeRole : deskRole,
    shellRole: deskRole,
    counts:
      placeUnits && counts.capacity
        ? {
            ...counts,
            capacity: { ...counts.capacity, value: totalReadyBedsNow(placeUnits, admissions ?? [], bedReleases) },
          }
        : counts,
    placeId: wardPlaceIdFor(pathname),
  };
}
