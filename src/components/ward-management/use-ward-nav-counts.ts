"use client";

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
import { useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { wardNavCounts, type WardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { wardPlaceIdFor } from "@/components/ward-management/ward-place";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { unitInScope } from "@/components/ward-management/ward-role-access";
import { totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";

/**
 * The sidebar's role and its counts, for whichever of the three shapes is asking.
 *
 * 🔴 **THE ICON RAIL AND THE LABELLED PANEL MUST NOT DISAGREE, AND A HOOK IS HOW THAT IS MADE
 * STRUCTURAL RATHER THAN CAREFUL.** They are separate component trees — the rail is rendered
 * hidden behind the panel rather than replaced by it — so an order or a figure wired into one and
 * not the other is invisible to anyone who only ever looks at their own preferred width. Both call
 * this; neither computes anything itself.
 *
 * ⚠️ **NO PROP, DELIBERATELY.** The shared navigation chrome (`WardBar`, formerly `ClinicalRail`)
 * is mounted across the application routes. Threading a `role` through every screen is many chances
 * to type the wrong thing, and the failure mode is a sidebar quietly ordered for somebody else.
 * `usePathname` is the same source the header's figures already read, so the two halves of the chrome
 * cannot drift apart.
 *
 * ⚠️ `wardNavCounts` is a pure function over state each caller already holds, so calling it from
 * both trees recomputes rather than shares. That is the cheap half of the trade; the expensive half
 * would be a context whose absence yields a plausible answer silently.
 *
 * ⚠️ **`placeId` IS ADDED HERE FOR THE SAME REASON `role` ALREADY IS.** `shell/ward-bar.tsx`
 * needs to scope its figures to the ward or emergency department the reader is on (the old
 * `WardSidebarAttention` list that first needed it was removed on 15 Oct 2026), and `usePathname` is the one source both the role and the id must read — computing
 * the id separately in the panel would be a second place for the two to disagree about which route
 * they are on. See `wardPlaceIdFor` in `ward-place.ts`: it is a bare id, `undefined` on any route
 * that does not name one, never a resolved or validated place.
 *
 * Capacity counts the desk's own place (Josh, 30 Oct 2026, the new sidebar and header): a desk held
 * to a site, service or ward keeps every ward's beds in view (they hold no patient), so its Capacity
 * counted the network's ready beds (26) for a site bed manager. The figure is the same rule
 * (`totalReadyBedsNow`) over the desk's own wards only. People (journeys, referrals, waits) and bed
 * releases are already narrowed by the workspace scope, so every other count is unchanged. The
 * statewide coordinator, executive and access admin count the whole network, as before.
 */
export function useWardNavCounts(): {
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
  // Q201 (Josh, 1 Nov 2026): the menu, phone dock and Tasks follow the desk chosen in "Go to a desk",
  // as the person card and the "Working as" note already do. Role access, when on, still decides.
  const personaRole = useShellPersonaRole();
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
    shellRole: personaRole,
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
