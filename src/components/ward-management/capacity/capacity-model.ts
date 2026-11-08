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
  bedsFreeingTodayTotal,
  networkTotals,
  networkWardRows,
  type NetworkWardRow,
} from "./capacity-derivations";
import { bedsForecast } from "./beds-forecast";
import { bedMapWards, groupBedMapWardsByService } from "./bed-map";
import { isConfirmationFresh } from "./capacity-gap-words";
import { shiftConfirmations, unchangedConfirmations } from "./shift-confirmations";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { horizonDays, sevenDayHorizon } from "@/components/ward-management/forecast/forecast-horizon";
import { useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { ownUnits } from "@/components/ward-management/reports/use-own-units";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { heldUpReleases } from "./capacity-held-up";

const NO_PLANNED: never[] = [];

/**
 * Everything the Capacity page draws, read from the derivations the screen has always used
 * (`capacity-derivations.ts`, `beds-forecast.ts`, the forecast model) and nothing computed here
 * beyond sums of their rows. The page answers "where is the mismatch", never "where could this
 * person go".
 */
export function useCapacityModel() {
  const {
    movements,
    units: everyUnit,
    bedReleases,
    admissions,
    leaveBeds,
    plannedAdmissions,
    referrals,
  } = useWardFlowSelect(
    "movements",
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "plannedAdmissions",
    "referrals",
  );
  const live = usePageLive();
  const { now } = live;
  const planned = plannedAdmissions ?? NO_PLANNED;
  const access = useEffectiveWardAccess();
  // Site bed manager (D-80): a site bed manager's figures are its own site's wards. Its
  // workspace holds only that site's people, so the network's beds against its own waiting list
  // would read as a mismatch that is not there. Other sites stay as bed counts (`otherSiteRows`).
  const siteCode = access.role === "bed_manager" && access.scope.kind === "site" ? access.scope.siteCode : undefined;
  const units = useMemo(
    () => (siteCode === undefined ? everyUnit : [...ownUnits(access, everyUnit)]),
    [siteCode, access, everyUnit],
  );

  // WF-FIG-017 (Josh, 7 Nov 2026): a bed held by name is held, not free, on every figure here.
  const reservations = useMemo(() => [...movements, ...referrals], [movements, referrals]);
  const gapRows = useMemo(
    () => bedKindGaps(movements, units, now, admissions, referrals),
    [movements, units, now, admissions, referrals],
  );
  const gapTotals = useMemo(() => bedKindTotals(gapRows), [gapRows]);
  const tomorrowByKind = useMemo(
    () => forecastByKind(units, bedReleases, admissions, movements, now, 1, planned, referrals),
    [units, bedReleases, admissions, movements, now, planned, referrals],
  );
  const forecast = useMemo(
    () => bedsForecast(units, bedReleases, admissions, movements, now, planned, referrals),
    [units, bedReleases, admissions, movements, now, planned, referrals],
  );
  const networkRows = useMemo(
    () => networkWardRows(units, now, bedReleases, admissions, leaveBeds, reservations),
    [units, now, bedReleases, admissions, leaveBeds, reservations],
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
  // WF-16: hero "Beds freeing today" from the same releasesFreeingToday source as each ward card.
  const dueOutToday = bedsFreeingTodayTotal(bedReleases, now, new Set(networkRows.map((row) => row.unit.id)));
  const oldestCount = networkRows.reduce<NetworkWardRow | undefined>(
    (oldest, row) => (oldest === undefined || row.confirmedAt < oldest.confirmedAt ? row : oldest),
    undefined,
  );
  const site = siteCode === undefined ? undefined : siteByCode(siteCode);
  // Site bed manager: road time is measured from the site's own ED, to every site's wards.
  const pressedEdId = useMemo(() => edPressure(now, movements)[0]?.ed.id, [now, movements]);
  const roadTimeFromEdId = site?.emergencyDepartment?.id ?? pressedEdId;
  // Site bed manager: every other site's wards, for bed counts only (place information,
  // no patient). Empty for every other desk, whose rows above are already the whole network.
  const otherSiteRows = useMemo(
    () =>
      siteCode === undefined
        ? []
        : networkWardRows(
            everyUnit.filter((unit) => unit.siteCode !== siteCode),
            now,
            bedReleases,
            admissions,
            leaveBeds,
            reservations,
          ),
    [siteCode, everyUnit, now, bedReleases, admissions, leaveBeds, reservations],
  );
  const otherSiteGroups = useMemo(
    () =>
      siteCode === undefined
        ? []
        : groupBedMapWardsByService(
            bedMapWards(
              everyUnit.filter((unit) => unit.siteCode !== siteCode),
              [...bedReleases],
              admissions,
              leaveBeds,
              reservations,
            ),
          ),
    [siteCode, everyUnit, bedReleases, admissions, leaveBeds, reservations],
  );

  const mapGroups = useMemo(
    () => groupBedMapWardsByService(bedMapWards(units, [...bedReleases], admissions, leaveBeds, reservations)),
    [units, bedReleases, admissions, leaveBeds, reservations],
  );

  const networkForecastModel = useForecastModel(now);
  // Site bed manager: "Try a scenario" starts from the site's own tomorrow and offers only the
  // site's wards, the same scope as the Bed forecast it sits beside.
  const forecastModel = useMemo(
    () =>
      siteCode === undefined ? networkForecastModel : { ...networkForecastModel, units, tomorrow: tomorrowByKind },
    [siteCode, networkForecastModel, units, tomorrowByKind],
  );
  const days = useMemo(() => horizonDays(now, forecastModel.dayZero), [now, forecastModel.dayZero]);
  // Site bed manager: the seven days are the site's wards, not a row for every ward.
  const weekUnits = useMemo(
    () => (siteCode === undefined ? forecastModel.units : [...ownUnits(access, forecastModel.units)]),
    [siteCode, access, forecastModel.units],
  );
  const week = useMemo(
    () => sevenDayHorizon(weekUnits, forecastModel.admissions, forecastModel.planned, now),
    [weekUnits, forecastModel.admissions, forecastModel.planned, now],
  );
  const confirmations = useMemo(() => shiftConfirmations(units, now), [units, now]);
  // Josh, 31 Oct 2026: the wards that confirmed the same number 3 or more shifts running come back
  // into This shift (smart features idea 6's safety note), named only.
  const unchanged = useMemo(() => unchangedConfirmations(units), [units]);
  const sources = forecast.sources;
  const upcoming = sources.windows.filter((window) => window.id !== "overdue");
  const sourceSummary = {
    discharges: upcoming.reduce((sum, window) => sum + window.total, 0),
    wards: new Set(
      upcoming.flatMap((window) => window.wards.filter((ward) => ward.entries.length > 0).map((ward) => ward.unitId)),
    ).size,
    // Redesign (Josh, 30 Oct): one overdue figure, as the coordinator's Capacity (dates passed, no blocker).
    overdueNotHeldUp: forecast.horizons[0]?.overdue ?? 0,
  };
  // Redesign (Josh, 30 Oct): held-up releases counted and named as Discharges counts them.
  // Site bed manager: only the site's own wards' releases, as its Discharges lists them.
  const heldUp = useMemo(() => {
    const own = new Set(units.map((unit) => unit.id));
    return heldUpReleases(
      siteCode === undefined ? bedReleases : bedReleases.filter((release) => own.has(release.unitId)),
      now,
    );
  }, [siteCode, units, bedReleases, now]);
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
    /** Every bed release, for the bed map's squares by discharge state (C4, Josh, 4 Nov 2026). */
    bedReleases,
    forecastModel,
    days,
    week,
    confirmations,
    unchanged,
    sourceSummary,
    heldUp,
    wardsToCheck,
    site,
    otherSiteRows,
    otherSiteGroups,
    plannedBooked: planned.filter((booking) => booking.state === "booked").length,
    /** The wards the Mismatch figures count: the site's own for a site bed manager, else all. */
    gapUnits: units,
  };
}

export type CapacityModel = ReturnType<typeof useCapacityModel>;
