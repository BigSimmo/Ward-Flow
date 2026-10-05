"use client";

import { useMemo } from "react";

import { refusedAndNothingPending } from "@/components/ward-management/statistics/statistics-derivations";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";

import { edRows, networkFigures, serviceFigures, wardFigures } from "./statistics-proposal-figures";

/** Every proposal screen reads the live shared state through this one hook, so they cannot disagree. */
export function useStatisticsProposal() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  const { units, admissions, bedReleases, leaveBeds, movements, dayZero } = world;

  return useMemo(() => {
    const wards = wardFigures(units, admissions, bedReleases, leaveBeds, movements, now);
    const eds = edRows(movements, now);
    const services = serviceFigures(wards, eds);
    const network = networkFigures(wards);
    const waiting = refusedAndNothingPending(movements, units, now).openMovementCount;
    return {
      world,
      now,
      wards,
      eds,
      services,
      network,
      waiting,
      asAt: `As at ${formatSheetMoment(now, dayZero)}`,
    };
  }, [world, now, units, admissions, bedReleases, leaveBeds, movements, dayZero]);
}
