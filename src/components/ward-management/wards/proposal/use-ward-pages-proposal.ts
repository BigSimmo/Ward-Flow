"use client";

import { useMemo } from "react";

import { useStatisticsProposal } from "@/components/ward-management/statistics/proposal/use-statistics-proposal";

import { wardDetail } from "./ward-pages-proposal-figures";

/**
 * Every ward-pages proposal screen reads through this hook. Bed counts are the statistics
 * proposal's (one source for every bed figure); the lists under them come from `wardDetail`.
 */
export function useWardPagesProposal(unitId?: string) {
  const stats = useStatisticsProposal();
  const { world, now, wards } = stats;
  // No id opens the first ward (the preview's default). A given id that matches nothing never falls
  // back to another ward: an answer or a confirmation must not land on a ward nobody chose.
  const found = unitId ? wards.find((candidate) => candidate.unit.id === unitId) : wards[0];
  const ward = found ?? null;
  const detail = useMemo(
    () =>
      ward
        ? wardDetail(ward.unit.id, world.admissions, world.bedReleases, world.leaveBeds, world.movements, now)
        : null,
    [ward, world.admissions, world.bedReleases, world.leaveBeds, world.movements, now],
  );
  return { ...stats, ward, detail, missing: Boolean(unitId) && !found };
}
