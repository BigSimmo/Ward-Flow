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
  const ward = wards.find((candidate) => candidate.unit.id === unitId) ?? wards[0];
  const detail = useMemo(
    () =>
      ward
        ? wardDetail(ward.unit.id, world.admissions, world.bedReleases, world.leaveBeds, world.movements, now)
        : null,
    [ward, world.admissions, world.bedReleases, world.leaveBeds, world.movements, now],
  );
  return { ...stats, ward, detail };
}
