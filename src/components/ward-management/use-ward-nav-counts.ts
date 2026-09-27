"use client";

import { usePathname } from "next/navigation";

import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { wardNavCounts, type WardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { wardPlaceIdFor } from "@/components/ward-management/ward-place";

/**
 * The sidebar's role and its counts, for whichever of the three shapes is asking.
 *
 * 🔴 **THE ICON RAIL AND THE LABELLED PANEL MUST NOT DISAGREE, AND A HOOK IS HOW THAT IS MADE
 * STRUCTURAL RATHER THAN CAREFUL.** They are separate component trees — the rail is rendered
 * hidden behind the panel rather than replaced by it — so an order or a figure wired into one and
 * not the other is invisible to anyone who only ever looks at their own preferred width. Both call
 * this; neither computes anything itself.
 *
 * ⚠️ **NO PROP, DELIBERATELY.** `ClinicalRail` is mounted 35 times across 27 files. Threading a
 * `role` through every one of them is 35 chances to type the wrong thing, and the failure mode is a
 * sidebar quietly ordered for somebody else. `usePathname` is the same source the header's figures
 * already read, so the two halves of the chrome cannot drift apart.
 *
 * ⚠️ `wardNavCounts` is a pure function over state each caller already holds, so calling it from
 * both trees recomputes rather than shares. That is the cheap half of the trade; the expensive half
 * would be a context whose absence yields a plausible answer silently.
 *
 * ⚠️ **`placeId` IS ADDED HERE FOR THE SAME REASON `role` ALREADY IS.** `WardSidebarAttention`
 * (`ward-sidebar-content.tsx`) needs to scope its list to the ward or emergency department the
 * reader is on, and `usePathname` is the one source both the role and the id must read — computing
 * the id separately in the panel would be a second place for the two to disagree about which route
 * they are on. See `wardPlaceIdFor` in `ward-place.ts`: it is a bare id, `undefined` on any route
 * that does not name one, never a resolved or validated place.
 */
export function useWardNavCounts(): { role: WardChromeRole; counts: WardNavCounts; placeId: string | undefined } {
  const pathname = usePathname() ?? "";
  const { movements, units, referrals, bedReleases, leaveBeds } = useWardFlow();
  const now = useWardFlowClock();
  return {
    role: wardChromeRole(pathname),
    counts: wardNavCounts({ movements, units, referrals, bedReleases, leaveBeds, now }),
    placeId: wardPlaceIdFor(pathname),
  };
}
