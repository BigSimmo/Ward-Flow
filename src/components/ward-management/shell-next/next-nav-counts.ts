"use client";

// Fork of src/components/ward-management/use-ward-nav-counts.ts: the rail's counts for the desk's own place.

import { usePathname } from "next/navigation";

import { WARD_SHELL_ROLE, wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useAccessShellRole } from "@/components/ward-management/shell/ward-access-store";
import type { WardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { useDeskNavCounts } from "@/components/ward-management/use-desk-nav-counts";
import { wardPlaceIdFor } from "@/components/ward-management/ward-place";

/**
 * The real hook's role, counts and place id (see its file for why the rail, dock and menu share one
 * hook). The counts are the real hook's own (`useDeskNavCounts`): every desk adjustment (Capacity
 * over the desk's own wards, Josh 30 Oct 2026; a ward desk's offers, A9-30; a team desk's referrals,
 * R-STRUCT-24) lives in `wardNavCounts`, so the two forks cannot drift (D-220). The one difference
 * kept here: the shell role is the access desk's, not the persona chosen in "Go to a desk".
 */
export function useNextNavCounts(): {
  role: WardChromeRole;
  /** The signed-in person's role (`WARD_SHELL_ROLE`): nav order and Tasks follow this, never the route. */
  shellRole: WardChromeRole;
  counts: WardNavCounts;
  placeId: string | undefined;
} {
  const pathname = usePathname() ?? "";
  const routeRole = wardChromeRole(pathname);
  // Role access plan: a non-coordinator desk's nav and Tasks follow its own role.
  const deskRole = useAccessShellRole(WARD_SHELL_ROLE);
  return {
    role: deskRole === WARD_SHELL_ROLE ? routeRole : deskRole,
    shellRole: deskRole,
    counts: useDeskNavCounts(),
    placeId: wardPlaceIdFor(pathname),
  };
}
