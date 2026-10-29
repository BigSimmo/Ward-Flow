"use client";

import { useMemo } from "react";

import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePageLive } from "@/components/ward-management/ward-page-live";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import {
  bedKindGaps,
  bedKindTotals,
  networkTotals,
  networkWardRows,
  type NetworkWardRow,
} from "@/components/ward-management/capacity/capacity-derivations";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import { isConfirmationFresh } from "@/components/ward-management/capacity/capacity-gap-words";
import { shiftConfirmations } from "@/components/ward-management/capacity/shift-confirmations";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { horizonDays, sevenDayHorizon } from "@/components/ward-management/forecast/forecast-horizon";
import { useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";

const NO_PLANNED: never[] = [];

/**
 * Everything the redesigned Capacity page draws, read from the same derivations as today's
 * `CapacityScreen` (`capacity-screen.tsx`) and nothing computed here beyond sums of their rows.
 * The page answers "where is the mismatch", never "where could this person go".
 */
export function useCapacityModel() {
  const { movements, units, bedReleases, admissions, leaveBeds, plannedAdmissions } = useWardFlowSelect(
    "movements",
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "plannedAdmissions",
  );
  const live = usePageLive();
  const { now } = live;
  const planned = plannedAdmissions ?? NO_PLANNED;

  const gapRows = useMemo(() => bedKindGaps(movements, units, now, admissions), [movements, units, now, admissions]);
  const gapTotals = useMemo(() => bedKindTotals(gapRows), [gapRows]);
  const tomorrowByKind = useMemo(
    () => forecastByKind(units, bedReleases, admissions, movements, now, 1, planned),
    [units, bedReleases, admissions, movements, now, planned],
  );
  const forecast = useMemo(
    () => bedsForecast(units, bedReleases, admissions, movements, now, planned),
    [units, bedReleases, admissions, movements, now, planned],
  );
  const networkRows = useMemo(
    () => networkWardRows(units, now, bedReleases, admissions, leaveBeds),
    [units, now, bedReleases, admissions, leaveBeds],
  );
  const totals = useMemo(() => networkTotals(networkRows), [networkRows]);
  const occupancy = useMemo(
    () =>
      wardOccupancy(
        networkRows.map((row) => row.unit),
        admissions,
        bedReleases,
      ),
    [networkRows, admissions, bedReleases],
  );
  const lockedReady = networkRows.reduce((sum, row) => sum + row.lockedReady, 0);
  const pulled = networkRows.reduce((sum, row) => sum + row.pulled, 0);
  const freeingValues = networkRows.map((row) => row.freeing).filter((value): value is number => value !== undefined);
  const dueOutToday = freeingValues.length > 0 ? freeingValues.reduce((sum, value) => sum + value, 0) : undefined;
  const oldestCount = networkRows.reduce<NetworkWardRow | undefined>(
    (oldest, row) => (oldest === undefined || row.confirmedAt < oldest.confirmedAt ? row : oldest),
    undefined,
  );
  const roadTimeFromEdId = useMemo(() => edPressure(now, movements)[0]?.ed.id, [now, movements]);

  const mapGroups = useMemo(
    () => groupBedMapWardsByService(bedMapWards(units, [...bedReleases], admissions, leaveBeds)),
    [units, bedReleases, admissions, leaveBeds],
  );

  const forecastModel = useForecastModel(now);
  const days = useMemo(() => horizonDays(now, forecastModel.dayZero), [now, forecastModel.dayZero]);
  const week = useMemo(
    () => sevenDayHorizon(forecastModel.units, forecastModel.admissions, forecastModel.planned, now),
    [forecastModel.units, forecastModel.admissions, forecastModel.planned, now],
  );
  const confirmations = useMemo(() => shiftConfirmations(units, now), [units, now]);
  const sources = forecast.sources;
  const upcoming = sources.windows.filter((window) => window.id !== "overdue");
  const sourceSummary = {
    discharges: upcoming.reduce((sum, window) => sum + window.total, 0),
    wards: new Set(
      upcoming.flatMap((window) => window.wards.filter((ward) => ward.entries.length > 0).map((ward) => ward.unitId)),
    ).size,
    overdue: sources.windows.find((window) => window.id === "overdue")?.total ?? 0,
  };
  // Wards a coordinator should look at first: none ready, or a count past its freshness limit.
  const wardsToCheck = networkRows
    .filter((row) => !row.unit.isClosed && (row.ready === 0 || !isConfirmationFresh(row.unit, now)))
    .sort((a, b) => a.confirmedAt - b.confirmedAt);

  return {
    live,
    now,
    gapRows,
    gapTotals,
    tomorrowByKind,
    forecast,
    networkRows,
    totals,
    occupancy,
    alertAt: BED_ALERT_THRESHOLD_PERCENT,
    lockedReady,
    openReady: totals.ready - lockedReady,
    pulled,
    dueOutToday,
    oldestCount,
    roadTimeFromEdId,
    mapGroups,
    forecastModel,
    days,
    week,
    confirmations,
    sourceSummary,
    wardsToCheck,
    plannedBooked: planned.filter((booking) => booking.state === "booked").length,
  };
}

export type CapacityModel = ReturnType<typeof useCapacityModel>;
