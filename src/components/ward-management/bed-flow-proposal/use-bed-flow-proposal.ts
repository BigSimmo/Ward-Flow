"use client";

import { useMemo } from "react";

import {
  bedKindGaps,
  bedKindTotals,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import {
  releasesToday,
  totalReleases,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { useStatisticsProposal } from "@/components/ward-management/statistics/proposal/use-statistics-proposal";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";
import type { Instant } from "@/components/ward-management/ward-clock";

/** Stages where the person has no bed yet. From "Bed pulled" on, a bed is already held for them. */
export const STILL_NEEDS_A_BED: readonly MovementStage[] = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
];

export function stillNeedsABed(movement: Movement): boolean {
  return isOpen(movement) && STILL_NEEDS_A_BED.includes(movement.stage);
}

/** Same rule the current Capacity screen uses (copied there too); within the ward's own window. */
export function confirmationIsFresh(unit: Unit, now: Instant): boolean {
  return now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes;
}

/**
 * Capacity and Network redesign proposal (5 October 2026). Builds on the statistics proposal's one
 * set of bed figures, so every bed number here matches the proposed Statistics screens, and adds
 * the bed-kind mismatch, the forecast and the per-ward confirmation facts from the engine's own
 * capacity derivations. Nothing is re-derived here.
 */
export function useBedFlowProposal() {
  const stats = useStatisticsProposal();
  const { world, now, wards } = stats;
  const { units, movements, bedReleases, admissions, leaveBeds, refreshRequests } = world;

  return useMemo(() => {
    const open = movements.filter(isOpen);
    const needing = open.filter(stillNeedsABed);
    // Only people still without a bed are matched against ready beds. The current screen counts
    // every open movement, including people whose bed is already pulled or who are on their way.
    const gaps = bedKindGaps(needing, units, now);
    const gapTotals = bedKindTotals(gaps);
    const rows = networkWardRows(units, now, bedReleases, admissions, leaveBeds);
    const lockedReadyByUnit = new Map(rows.map((row) => [row.unit.id, row.lockedReady]));
    const releases = totalReleases(wards);
    return {
      ...stats,
      open,
      needing,
      gaps,
      gapTotals,
      lockedReadyByUnit,
      lockedReady: rows.reduce((sum, row) => sum + row.lockedReady, 0),
      releases,
      freeToday: releasesToday(releases),
      forecast: bedsForecast(units, bedReleases, admissions, movements, now),
      stale: wards.filter((ward) => !confirmationIsFresh(ward.unit, now)),
      lastRefreshRequest: (unitId: string) => refreshRequests.filter((request) => request.unitId === unitId).at(-1)?.at,
    };
  }, [stats, now, wards, units, movements, bedReleases, admissions, leaveBeds, refreshRequests]);
}
