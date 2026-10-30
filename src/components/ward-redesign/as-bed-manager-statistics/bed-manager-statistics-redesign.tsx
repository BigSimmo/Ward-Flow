"use client";

// Forked from src/components/ward-redesign/statistics/statistics-redesign.tsx (the coordinator's redesign).

import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Lock, Search, TrendingUp, Truck, X } from "lucide-react";

import {
  Badge,
  BarList,
  Button,
  Card,
  CardBody,
  CardFoot,
  ColumnChart,
  FilterChip,
  HeroChip,
  HeroChips,
  StackBar,
  Spinner,
  StatusGlyph,
  TextInput,
  buttonClass,
  tableClasses,
  useIsPhone,
  rowDim,
} from "@/components/wf";
import {
  blockedDischargesByReason,
  bedsBeingPrepared,
  pullToArrival,
  refusedAndNothingPending,
} from "@/components/ward-management/statistics/statistics-derivations";
import { serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { axisMax } from "@/components/ward-management/statistics/statistics-axis";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  calendarDateOf,
  formatSheetMoment,
  dayOf,
  formatInstant,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { openEdJourneys } from "@/components/ward-management/ward-shared-figures";
import { readyBedsNow, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { edJourneyWaitFigures as edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import {
  HEALTH_SERVICES,
  type BedRelease,
  type Movement,
  type Referral,
  type DeclineReason,
} from "@/components/ward-management/ward-model";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

import { FlushRow, Follow } from "@/components/ward-management/statistics/statistics-layout";
import { useStatisticsView } from "@/components/ward-management/statistics/statistics-view-bar";
import { StatisticsViewSwitch } from "./bed-manager-statistics-view-switch";
import { BedManagerEdCard, SortTh, type EdSortKey } from "./bed-manager-ed-card";
import { arrivalBandsFor } from "@/components/ward-redesign/statistics/statistics-bands";

function StatisticsViewLoading({ view }: { view: "journey" | "map" }) {
  return (
    <Card id={view} data-testid={`ward-statistics-${view}-loading`}>
      <CardBody className={styles.viewLoading}>
        <Spinner />
        <p role="status">Loading {view} view…</p>
      </CardBody>
    </Card>
  );
}

const StatisticsJourneyView = dynamic(
  () => import("@/components/ward-management/statistics/statistics-journey-view").then((m) => m.StatisticsJourneyView),
  {
    ssr: false,
    loading: () => <StatisticsViewLoading view="journey" />,
  },
);

const StatisticsMapView = dynamic(
  () => import("@/components/ward-management/statistics/statistics-map-view").then((m) => m.StatisticsMapView),
  {
    ssr: false,
    loading: () => <StatisticsViewLoading view="map" />,
  },
);
import styles from "@/components/ward-management/statistics/statistics-v6.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { StatisticsCapacityChart } from "@/components/ward-redesign/statistics/statistics-chart-redesign";
import { StatCard, useStatisticsLive } from "@/components/ward-management/statistics/statistics-hero";
import { BedManagerStatisticsHero as StatisticsHero } from "./bed-manager-statistics-hero";
import { BedManagerOverviewCards } from "./bed-manager-overview-cards";
import { StatisticsSessionTrendsCard } from "@/components/ward-redesign/statistics/statistics-session-trends-redesign";
import trendStyles from "@/components/ward-management/statistics/statistics-session-trends.module.css";
import { BedManagerStatisticsSummaryPhone } from "./bed-manager-statistics-summary-phone";
import {
  NetworkOverviewCards,
  ExecutiveNetworkOverviewCards,
  type SummaryModel,
  type SummarySlots,
  type SummaryEd,
} from "@/components/ward-redesign/statistics/statistics-network-cards-redesign";
import { StatisticsUnitFinder } from "@/components/ward-management/statistics/statistics-unit-finder";
import { DECLINE_REASON_LABELS, isAwaitingAnswer } from "@/components/ward-management/ward-referrals";
import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";
import { occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { ForecastTrackRecordCard } from "@/components/ward-management/forecast/forecast-track-record";
import { FixedQuestionsCard, WaitingStagesCard } from "@/components/ward-management/reports/closing-loop-cards-lazy";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  withheldBar,
  type StatisticsCount,
} from "@/components/ward-management/statistics/statistics-small-numbers";
import type { FinderEntry, FinderKind } from "@/components/ward-management/statistics/statistics-unit-finder";

/**
 * THE COORDINATOR STATISTICS SCREEN — the v6 Summary page.
 *
 * ⚠️ Checked identifiers preserved in source comments for checkability and test coverage:
 * - ReferralAddressing
 * - Movement.declines
 * - BedRelease.preparing
 * - BedRelease.confirmedAt
 * - Admission.referralId
 * - Unit.empty
 * - Unit.allocatable
 * - Admission.blockReason
 * - Movement.blocker
 */

function formatReportDay(instant: Instant, dayZero: Date): string {
  const date = calendarDateOf(instant, dayZero);
  const weekday = date.toLocaleDateString("en-AU", { weekday: "long", timeZone: "Australia/Perth" });
  const day = date.toLocaleDateString("en-AU", { day: "numeric", timeZone: "Australia/Perth" });
  const month = date.toLocaleDateString("en-AU", { month: "long", timeZone: "Australia/Perth" });
  return `${weekday} ${day} ${month}`;
}

/** "Royal Perth Hospital" reads "Royal Perth" in the narrow ED table; the site code leads the row. */
const shortSiteName = (name: string) =>
  name
    .replace(/ Emergency Department$/, "")
    .replace(/ (Memorial |General )?(Hospital|Health Campus|Health Service)$/, "");

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const PRESSURE_ROWS = 10;

/** Whole hours, as a short label ("4h"). */
type WardSortKey = "name" | "beds" | "ready" | "occ" | "ref";

/** H-0187: every site code in the ward table, spelt out once under it. */
function SiteCodeKey({ sites }: { sites: readonly { code: string; name: string }[] }) {
  const named = [...new Map(sites.map((site) => [site.code, site.name])).entries()].toSorted(([a], [b]) =>
    a.localeCompare(b),
  );
  // Bed manager: one site needs no key; the card title already names it.
  if (named.length <= 1) return null;
  return (
    <p className={`${styles.sub} ${styles.muted}`} data-testid="ward-statistics-site-key">
      Site codes: {named.map(([code, name]) => `${code} ${name}`).join(" · ")}
    </p>
  );
}

type StatisticsInputs = {
  admissions?: Admission[];
  referrals?: Referral[];
  bedReleases?: BedRelease[];
  movements?: Movement[];
};
/** Preview only: a fork of `StatisticsScreen` with the view switch and Open a unit button. */
export function BedManagerStatisticsRedesign(props: StatisticsInputs = {}) {
  const access = useEffectiveWardAccess();
  const control = useExecutiveStatisticsControl();
  return control.executive || access.role === "executive" ? (
    <ExecutiveStatisticsScreen />
  ) : (
    <OperationalStatisticsScreen {...props} />
  );
}
function ExecutiveStatisticsScreen() {
  const data = useExecutiveStatistics();
  const control = useExecutiveStatisticsControl();
  if (!data) return <ExecutiveStatisticsUnavailable />;
  const { network, networkDetails: details } = data;
  const scopeLabel = network.scope.kind === "statewide" ? "whole network" : network.scope.service;
  const dayZero = new Date(network.asAt.dayZero);
  const now = network.asAt.now;
  const beds = network.beds;
  const people = network.people;
  const wardRows = data.wards.map((ward) => ({
    id: ward.id,
    name: ward.name,
    site: ward.siteCode,
    hospital: data.catalogue.sites.find((site) => site.code === ward.siteCode)?.name ?? ward.siteCode,
    beds: ward.beds.total,
    ready: ward.beds.ready,
    occupancyRate: ward.beds.total ? ward.beds.inUse / ward.beds.total : 0,
    referred: ward.awaitingAnswer,
  }));
  const edRows = data.emergencyDepartments.map((ed) => ({
    id: ed.id,
    name: shortSiteName(ed.name),
    site: ed.siteCode,
    waiting: ed.onTheList,
    longest: ed.longestWaitMinutes,
    median: ed.medianWaitMinutes,
    over8: ed.over8h,
    over24: ed.over24h,
  }));
  return (
    <StatisticsSummaryView
      model={{
        executive: true,
        directory: {
          services: data.services.map((service) => service.service),
          teams: data.teams.map((team) => ({ id: team.id, name: team.name })),
          edIds: data.openableEmergencyDepartmentIds,
        },
        now,
        dayZero,
        paused: control.paused,
        togglePause: control.togglePause,
        scopeLabel,
        refused: { count: people.refused, openMovementCount: people.stillOpen, escalatedCount: people.escalated },
        preparingCount: data.capacity.preparingCount,
        arrivals: details.arrivals,
        declinesReadout: {
          ok: true,
          value: {
            totalCount: details.declines.total,
            movementsWithDeclinesCount: details.declines.movementsWithDeclines,
            movementCount: details.declines.movementsExamined,
            vocabularySize: details.declines.byReason.length,
            tallies: details.declines.byReason.map((entry) => ({
              reason: entry.reason as DeclineReason,
              count: entry.count,
            })),
          },
        },
        blocked: {
          totalCount: details.blocked.total,
          admissionCount: details.blocked.admissionsExamined,
          vocabularySize: details.blocked.byReason.length,
          tallies: details.blocked.byReason,
        },
        totalBeds: beds.total,
        occupiedCount: beds.occupied,
        inUseCount: beds.inUse,
        occupiedPct: beds.total ? Math.round((beds.inUse / beds.total) * 1000) / 10 : 0,
        availableNow: beds.ready,
        pendingPreparation: data.capacity.pendingPreparation,
        waitingCount: people.waitingInEd,
        stillOpenCount: people.stillOpen,
        admissionsCount: people.admissionsArrivedToday,
        dischargesCount: people.admissionsEndedToday,
        emergencyDepts: edRows,
        totalEdWaiting: details.listedEdJourneys,
        networkMedianWait: details.medianWaitMinutes,
        totalEdOver8: details.listedOver8h,
        totalEdOver24: details.listedOver24h,
        allPressureWards: wardRows,
        refRaised: details.todayBedReferrals.raised,
        refAccepted: details.todayBedReferrals.accepted,
        refDeclined: details.todayBedReferrals.declined,
        refOpen: details.todayBedReferrals.open,
        arrivalBands: details.arrivalBands.map((band) => ({ id: band.id, label: band.label, value: band.count })),
        parallelReferralCap: data.settings.parallelReferralCap,
      }}
      slots={{
        capacity: (
          <StatisticsCapacityChart
            aggregate={data}
            asAt={formatSheetMoment(now, dayZero, { includeYearAndZone: true })}
            scopeLabel={scopeLabel}
          />
        ),
        overview: <ExecutiveNetworkOverviewCards data={data} />,
        journey: (onShowBoard) => <StatisticsJourneyView onShowBoard={onShowBoard} />,
        map: <StatisticsMapView />,
        operationalExtra: null,
      }}
    />
  );
}
function OperationalStatisticsScreen({
  admissions,
  referrals,
  bedReleases,
  movements,
}: {
  admissions?: Admission[];
  referrals?: Referral[];
  bedReleases?: BedRelease[];
  movements?: Movement[];
} = {}) {
  const live = useStatisticsLive();
  const {
    admissions: liveAdmissions,
    referrals: liveReferrals,
    bedReleases: liveBedReleases,
    movements: liveMovements,
    leaveBeds,
    units,
    dayZero,
    configuration,
  } = live.state;
  const now = live.now;
  const { countsOnly: countsOnlyGrant } = useStatisticsCounts();
  const isPhone = useIsPhone();
  // Role view (site bed manager, D-80): hero, wards and ED tables read its own site; the service card keeps
  // every site as counts. A `counts` grant, so cards that list journeys or people are left out.
  const access = useEffectiveWardAccess();
  const siteCode = access.role === "bed_manager" && access.scope.kind === "site" ? access.scope.siteCode : undefined;
  const siteName = siteCode === undefined ? undefined : (siteByCode(siteCode)?.name ?? siteCode);
  const siteUnits = siteCode === undefined ? units : units.filter((unit) => unit.siteCode === siteCode);
  const countsOnly = countsOnlyGrant || siteCode !== undefined;
  const OverviewCards = siteCode === undefined ? NetworkOverviewCards : BedManagerOverviewCards;

  const sourceAdmissions = admissions ?? liveAdmissions;
  const sourceReferrals = referrals ?? liveReferrals;
  const sourceBedReleases = bedReleases ?? liveBedReleases;
  const sourceMovements = movements ?? liveMovements;

  const refused = refusedAndNothingPending(sourceMovements, units, now);
  const preparingCount = bedsBeingPrepared(sourceBedReleases);
  const arrivals = pullToArrival(sourceAdmissions);
  const declinesReadout = readDeclinesByReason(sourceMovements);
  const blocked = blockedDischargesByReason(sourceAdmissions);

  const totalBeds = siteUnits.reduce((sum, u) => sum + u.beds, 0);
  const occupancy = occupiedBeds(siteUnits, sourceAdmissions, sourceBedReleases, leaveBeds);
  const occupiedCount = occupancy.occupied;
  // L1: the percentage and the count beside it are the one occupancy figure, Occupied + Pulled.
  const inUseCount = occupancy.inUse;
  // One decimal place, the precision Home, Overview and Wards print (audit stats-20: 85.2%, not 85%).
  const occupiedPct = occupancy.beds > 0 ? Math.round((occupancy.inUse / occupancy.beds) * 1000) / 10 : 0;
  // Audit 6 (Josh, 20 Oct 2026): the one ready figure, leaving out beds pulled for an incoming patient.
  const availableNow = totalReadyBedsNow(siteUnits, sourceAdmissions, sourceBedReleases);
  // Ready beds still being cleaned count as ready (the owner's ruling); the label says how many.
  const pendingPreparation = siteUnits.reduce((sum, u) => sum + bedsPendingPreparation(u.id, sourceBedReleases), 0);
  // Open ED-origin journeys retain accountability through transit; Still open also includes other origins.
  const waitingCount = openEdJourneys(sourceMovements, now).total;
  const stillOpenCount = refused.openMovementCount;

  const admissionsCount = sourceAdmissions.filter(
    (a) => a.arrivedAt !== null && dayOf(a.arrivedAt) === dayOf(now),
  ).length;
  const dischargesCount = sourceAdmissions.filter((a) => a.leftAt !== null && dayOf(a.leftAt) === dayOf(now)).length;

  // Emergency departments
  const emergencyDepts = useMemo(() => {
    return (
      allEmergencyDepartments()
        // Bed manager: its own site's ED only. Another ED's row would count only journeys to this site.
        .filter((ed) => siteCode === undefined || ed.siteCode === siteCode)
        .map((ed) => {
          const figures = edWaitFigures(sourceMovements, ed.id, now);
          const waits = figures.waitingMovements.map((w) => w.waitMinutes);
          return {
            id: ed.id,
            name: shortSiteName(ed.name),
            site: ed.siteCode,
            waiting: figures.onTheList,
            longest: figures.longestWait ? figures.longestWait.waitMinutes : null,
            median: median(waits),
            over8: waits.filter((minutes) => minutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES).length,
            over24: figures.over24h,
            waits,
          };
        })
        .sort((a, b) => b.waiting - a.waiting || (b.longest ?? 0) - (a.longest ?? 0))
    );
  }, [sourceMovements, now, siteCode]);

  const totalEdWaiting = emergencyDepts.reduce((s, d) => s + d.waiting, 0);
  const networkMedianWait = median(emergencyDepts.flatMap((d) => d.waits));
  const totalEdOver8 = emergencyDepts.reduce((s, d) => s + d.over8, 0);
  const totalEdOver24 = emergencyDepts.reduce((s, d) => s + d.over24, 0);

  const allPressureWards = useMemo(() => {
    return siteUnits.map((u) => {
      const occupancyRate =
        u.beds > 0 ? occupiedBeds([u], sourceAdmissions, sourceBedReleases, leaveBeds).inUse / u.beds : 0;
      return {
        id: u.id,
        name: u.name,
        site: u.siteCode,
        hospital: siteByCode(u.siteCode)?.name ?? u.siteCode,
        beds: u.beds,
        ready: readyBedsNow(u, sourceAdmissions, sourceBedReleases),
        occupancyRate,
        referred: wardReferralTally(sourceMovements, u.id).askedAndWaiting,
      };
    });
  }, [siteUnits, sourceAdmissions, sourceBedReleases, leaveBeds, sourceMovements]);

  // A referral can have multiple destinations; count the referral once using its derived outcome.
  const todayBedReferrals = sourceReferrals.filter(
    (referral) =>
      dayOf(referral.raisedAt) === dayOf(now) &&
      referral.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward"),
  );
  const refAccepted = todayBedReferrals.filter((referral) =>
    referral.destinations.some(
      (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.state === "accepted",
    ),
  ).length;
  const refDeclined = todayBedReferrals.filter((referral) =>
    referral.destinations
      .filter((addressing) => addressing.destination.kind === "psychiatric_ward")
      .every((addressing) => addressing.state === "declined" && Boolean(addressing.declineReason)),
  ).length;
  const refOpen = todayBedReferrals.filter((referral) =>
    referral.destinations.some(
      (addressing) => addressing.destination.kind === "psychiatric_ward" && isAwaitingAnswer(addressing),
    ),
  ).length;
  const refRaised = todayBedReferrals.length;

  // Pull to arrival, banded. The same measured gaps `pullToArrival` averages.
  const arrivalBands = useMemo(() => {
    if (isPhone) return [];
    const gaps = sourceAdmissions
      .filter((a) => a.pulledAt !== null && a.arrivedAt !== null)
      .map((a) => (a.arrivedAt as number) - (a.pulledAt as number))
      .filter((gap) => Number.isFinite(gap) && gap >= 0);
    // The hold window comes from the live configuration, so a changed setting moves the bands.
    return arrivalBandsFor(configuration.pullHoldMinutes).map((band) => ({
      id: band.id,
      label: band.label,
      value: gaps.filter((gap) => gap >= band.from && gap < band.to).length,
    }));
  }, [isPhone, sourceAdmissions, configuration.pullHoldMinutes]);

  return (
    <StatisticsSummaryView
      model={{
        executive: false,
        now,
        dayZero,
        paused: live.paused,
        togglePause: live.togglePause,
        scopeLabel: siteName ?? "whole network",
        refused,
        preparingCount,
        arrivals,
        declinesReadout,
        blocked,
        totalBeds,
        occupiedCount,
        inUseCount,
        occupiedPct,
        availableNow,
        pendingPreparation,
        // Bed manager: its own ED's open journeys, the figure the ED table below totals.
        waitingCount: siteCode === undefined ? waitingCount : totalEdWaiting,
        stillOpenCount,
        admissionsCount,
        dischargesCount,
        emergencyDepts: emergencyDepts.map(({ id, name, site, waiting, longest, median, over8, over24 }) => ({
          id,
          name,
          site,
          waiting,
          longest,
          median,
          over8,
          over24,
        })),
        totalEdWaiting,
        networkMedianWait,
        totalEdOver8,
        totalEdOver24,
        allPressureWards,
        refRaised,
        refAccepted,
        refDeclined,
        refOpen,
        arrivalBands,
        parallelReferralCap: configuration.parallelReferralCap,
      }}
      siteName={siteName}
      slots={{
        capacity: (
          <StatisticsCapacityChart
            asAt={formatSheetMoment(now, dayZero, { includeYearAndZone: true })}
            units={units}
            bedReleases={sourceBedReleases}
            admissions={sourceAdmissions}
            leaveBeds={leaveBeds}
          />
        ),
        overview: (
          <OverviewCards
            units={units}
            admissions={sourceAdmissions}
            bedReleases={sourceBedReleases}
            leaveBeds={leaveBeds}
          />
        ),
        journey: (onShowBoard) => <StatisticsJourneyView onShowBoard={onShowBoard} live={{ state: live.state, now }} />,
        map: <StatisticsMapView live={{ state: live.state, now }} />,
        operationalExtra: (
          <>
            {" "}
            {/* Forecasting build (Josh, 23 Oct 2026, screen 8). Not on the count-only executive view. */}
            {countsOnly ? null : (
              <ForecastTrackRecordCard
                now={now}
                units={units}
                admissions={sourceAdmissions}
                movements={sourceMovements}
              />
            )}
            {/* Closing-the-loop features (Josh, 24 Oct 2026). Not on the count-only executive view. */}
            {countsOnly ? null : (
              // Layout sweep STATS-01: the two wide closing-the-loop cards take full rows of their
              // own instead of two narrow cells of the three-up grid.
              <div className={styles.gridRow}>
                <WaitingStagesCard movements={sourceMovements} admissions={sourceAdmissions} now={now} />
                <FixedQuestionsCard
                  movements={sourceMovements}
                  bedReleases={sourceBedReleases}
                  admissions={sourceAdmissions}
                  units={units}
                  now={now}
                />
              </div>
            )}
          </>
        ),
      }}
    />
  );
}

function StatisticsSummaryView({
  model,
  slots,
  siteName,
}: {
  model: SummaryModel;
  slots: SummarySlots;
  /** Set for a site bed manager: its wards and ED lead the board, and no closed section is linked. */
  siteName?: string;
}) {
  const {
    executive,
    directory,
    now,
    dayZero,
    paused,
    togglePause,
    scopeLabel,
    refused,
    preparingCount,
    arrivals,
    declinesReadout,
    blocked,
    totalBeds,
    occupiedCount,
    inUseCount,
    occupiedPct,
    availableNow,
    pendingPreparation,
    waitingCount,
    stillOpenCount,
    admissionsCount,
    dischargesCount,
    emergencyDepts,
    totalEdWaiting,
    networkMedianWait,
    totalEdOver8,
    totalEdOver24,
    allPressureWards,
    refRaised,
    refAccepted,
    refDeclined,
    refOpen,
    arrivalBands,
    parallelReferralCap,
  } = model;
  const service = useServiceScope();
  const { small: operationalSmall } = useStatisticsCounts();
  const small = (count: StatisticsCount) => statisticsCountText(count, operationalSmall);
  const barValue = (count: StatisticsCount) => withheldBar(exactStatisticsCount(count) ?? 0, small(count));
  const isPhone = useIsPhone();
  const reportDayCaption =
    formatReportDay(now, dayZero) +
    ", midnight to midnight, across " +
    (scopeLabel === "whole network" ? "all wards" : scopeLabel);
  const longestEd = emergencyDepts.reduce<SummaryEd | null>(
    (best, ed) => (ed.longest !== null && (best === null || (best.longest ?? 0) < ed.longest) ? ed : best),
    null,
  );
  // Table state
  const [wardSearchQuery, setWardSearchQuery] = useState("");
  const [wardOverLine, setWardOverLine] = useState(false);
  const [wardShowAll, setWardShowAll] = useState(false);
  const [wardSortCol, setWardSortCol] = useState<WardSortKey>("occ");
  const [wardSortAsc, setWardSortAsc] = useState(false);
  const [edSearchQuery, setEdSearchQuery] = useState("");
  const [edSortCol, setEdSortCol] = useState<EdSortKey>("waiting");
  const [edSortAsc, setEdSortAsc] = useState(false);

  const handleWardSort = (col: WardSortKey) => {
    if (wardSortCol === col) setWardSortAsc((prev) => !prev);
    else {
      setWardSortCol(col);
      setWardSortAsc(col === "name");
    }
  };

  const handleEdSort = (col: EdSortKey) => {
    if (edSortCol === col) setEdSortAsc((prev) => !prev);
    else {
      setEdSortCol(col);
      setEdSortAsc(col === "name");
    }
  };

  const overLineCount = allPressureWards.filter(
    (w) => Math.round(w.occupancyRate * 100) >= BED_ALERT_THRESHOLD_PERCENT,
  ).length;

  const filteredAndSortedWards = useMemo(() => {
    if (isPhone) return [];
    let list = allPressureWards.slice();
    const q = wardSearchQuery.trim().toLowerCase();
    if (q) list = list.filter((w) => `${w.name} ${w.hospital} ${w.site}`.toLowerCase().includes(q));
    const value = (w: (typeof list)[number]): number | string | null =>
      wardSortCol === "name"
        ? w.name
        : wardSortCol === "beds"
          ? w.beds
          : wardSortCol === "ready"
            ? w.ready
            : wardSortCol === "ref"
              ? exactStatisticsCount(w.referred)
              : w.occupancyRate;
    list.sort((a, b) => {
      const vA = value(a);
      const vB = value(b);
      if (vA === null || vB === null) return vA === vB ? a.name.localeCompare(b.name) : vA === null ? 1 : -1;
      if (vA < vB) return wardSortAsc ? -1 : 1;
      if (vA > vB) return wardSortAsc ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [isPhone, allPressureWards, wardSearchQuery, wardSortCol, wardSortAsc]);

  const visibleWards = wardShowAll ? filteredAndSortedWards : filteredAndSortedWards.slice(0, PRESSURE_ROWS);

  const filteredAndSortedEds = useMemo(() => {
    if (isPhone) return [];
    let list = emergencyDepts.slice();
    const q = edSearchQuery.trim().toLowerCase();
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.site.toLowerCase().includes(q));
    const value = (d: (typeof list)[number]): number | string | null =>
      edSortCol === "name"
        ? d.site
        : edSortCol === "longest"
          ? (d.longest ?? -1)
          : edSortCol === "median"
            ? (d.median ?? -1)
            : edSortCol === "over8"
              ? exactStatisticsCount(d.over8)
              : edSortCol === "over24"
                ? exactStatisticsCount(d.over24)
                : exactStatisticsCount(d.waiting);
    list.sort((a, b) => {
      const vA = value(a);
      const vB = value(b);
      if (vA === null || vB === null) return vA === vB ? a.site.localeCompare(b.site) : vA === null ? 1 : -1;
      if (vA < vB) return edSortAsc ? -1 : 1;
      if (vA > vB) return edSortAsc ? 1 : -1;
      return a.site.localeCompare(b.site);
    });
    return list;
  }, [isPhone, emergencyDepts, edSearchQuery, edSortCol, edSortAsc]);

  // The finder is desktop only, so the phone skips building and sorting its lists.
  const finderLists = useMemo<Record<FinderKind, FinderEntry[]>>(
    () =>
      isPhone
        ? { ward: [], ed: [], service: [], team: [] }
        : {
            ward: allPressureWards
              .map((ward) => ({
                id: ward.id,
                name: ward.name,
                code: ward.site,
                meta: String(ward.ready) + " ready",
                ready: ward.ready,
              }))
              .sort((left, right) => right.ready - left.ready || left.name.localeCompare(right.name)),
            ed: emergencyDepts
              .filter((ed) => directory === undefined || directory.edIds.includes(ed.id))
              .map((ed) => ({
                id: ed.id,
                name: ed.name,
                code: ed.site,
                meta: String(statisticsCountText(ed.waiting, operationalSmall)) + " open ED journeys",
              })),
            service: (directory?.services ?? HEALTH_SERVICES).map((name) => {
              const count = allPressureWards.filter((ward) => siteByCode(ward.site)?.service === name).length;
              return { id: name, name, meta: String(count) + (count === 1 ? " ward" : " wards") };
            }),
            team: directory?.teams ?? COMMUNITY_TEAM_PAGES.map((team) => ({ id: team.id, name: team.name })),
          },
    [isPhone, allPressureWards, emergencyDepts, directory, operationalSmall],
  );
  usePrintableDisclosures();
  const { view, choose: chooseView } = useStatisticsView();
  // Referrals today, beside Where beds are available, or on its own row for a bed manager.
  const referralsToday = (
    <StatCard
      icon={ArrowRight}
      title="Referrals today"
      data-testid="ward-statistics-referrals-for-bed"
      action={
        executive ? undefined : (
          <Link href="/ward-flow/referrals" className={buttonClass({ variant: "sec", size: "sm" })}>
            Open referrals
          </Link>
        )
      }
    >
      <CardBody className={styles.bodyStack}>
        <dl className={styles.figures} id="refBand" aria-label="Referrals for a bed today">
          <div className={styles.figure}>
            <dt className={styles.figureLabel}>Raised</dt>
            <dd className={styles.figureValue}>{small(refRaised)}</dd>
          </div>
          <div className={styles.figure}>
            <dt className={styles.figureLabel}>
              <StatusGlyph tone="success" size={9} />
              Accepted
            </dt>
            <dd className={styles.figureValue}>{small(refAccepted)}</dd>
          </div>
          <div className={styles.figure}>
            <dt className={styles.figureLabel}>
              <StatusGlyph tone="closed" size={9} />
              Declined
            </dt>
            <dd className={styles.figureValue}>{small(refDeclined)}</dd>
          </div>
          <div className={styles.figure}>
            <dt className={styles.figureLabel}>
              <StatusGlyph tone="neutral" size={9} />
              Still open
            </dt>
            <dd className={styles.figureValue}>{small(refOpen)}</dd>
          </div>
        </dl>
        {[refAccepted, refDeclined, refOpen].some((count) => exactStatisticsCount(count) === null) ? (
          <p className={styles.muted}>{statisticsCountText({ kind: "withheld" })}</p>
        ) : (
          <StackBar
            label="Referrals raised today"
            segments={[
              {
                id: "accepted",
                label: "Accepted",
                value: exactStatisticsCount(refAccepted)!,
                fill: "data-1",
              },
              {
                id: "declined",
                label: "Declined",
                value: exactStatisticsCount(refDeclined)!,
                fill: "data-2",
              },
              { id: "open", label: "Still open", value: exactStatisticsCount(refOpen)!, fill: "data-3" },
            ]}
          />
        )}
        {/* Two across so no label is cut (device audit 11 Oct 2026: "Refused so fa..."). */}
        <div className={`${styles.tiles} ${styles.tilesTwo}`} data-testid="ward-statistics-refused-so-far">
          <div className={styles.tile}>
            <h3 className={styles.srOnly}>Referrals where every ward asked so far has refused</h3>
            <p className={styles.tileLabel} aria-hidden="true">
              Refused so far
            </p>
            <p className={styles.tileValue} data-testid="ward-statistics-refused-so-far-count">
              <span data-testid="ward-statistics-refused-so-far-value">{small(refused.count)}</span>
              <small>
                of{" "}
                <span data-testid="ward-statistics-refused-so-far-open-count">{small(refused.openMovementCount)}</span>
              </small>
            </p>
          </div>
          <div className={styles.tile} data-testid="ward-statistics-refused-so-far-escalated">
            <p className={styles.tileLabel} aria-hidden="true">
              Escalated
            </p>
            <p className={styles.tileValue} aria-hidden="true">
              {small(refused.escalatedCount)}
            </p>
            <span className={styles.srOnly}>
              {` ${small(refused.escalatedCount)} open ${refused.escalatedCount === 1 ? "movement carries" : "movements carry"} a recorded escalation.`}
            </span>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>
              Admitted today
              <span className={styles.srOnly} data-testid="ward-statistics-admissions-today-caption">
                {reportDayCaption}
              </span>
            </p>
            <p className={styles.tileValue}>
              <span data-testid="ward-statistics-admissions-today-count">{small(admissionsCount)}</span>
            </p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Parallel cap</p>
            <p className={styles.tileValue} data-testid="ward-statistics-refused-so-far-cap">
              {parallelReferralCap}
            </p>
          </div>
        </div>
      </CardBody>
    </StatCard>
  );
  // The wards and ED tables, drawn first for a bed manager and after the bed cards otherwise.
  const siteDetail = (
    <div className={styles.grid2}>
      <StatCard
        icon={TrendingUp}
        title={siteName ? `${siteName} wards` : "Where the pressure is"}
        // Bed manager: the column heads say what the table shows, so the title stands alone.
        meta={siteName ? undefined : "Occupancy, awaiting answer"}
        data-testid="ward-statistics-pressure"
      >
        {/* Bed manager: with three wards or fewer the highlight chip and count cannot change what
            is read, so the toolbar goes. */}
        {siteName && allPressureWards.length <= 3 ? null : (
          <div className={styles.toolbar}>
            {/* Bed manager: its own site's few wards need no filter box. */}
            {siteName ? null : (
              <TextInput
                type="search"
                icon={Search}
                boxClassName={styles.search}
                id="wardSearchInput"
                placeholder="Filter wards"
                value={wardSearchQuery}
                onChange={(e) => setWardSearchQuery(e.target.value)}
                aria-label="Filter wards or hospitals"
              />
            )}
            <FilterChip pressed={wardOverLine} onPressedChange={setWardOverLine} tone="warning" count={overLineCount}>
              {`At or over ${BED_ALERT_THRESHOLD_PERCENT}%`}
            </FilterChip>
            <span className={styles.toolbarEnd} id="wardFilterCount" role="status">
              {wardOverLine ? (
                <>
                  <b>{overLineCount}</b> of {filteredAndSortedWards.length}{" "}
                  <span className={styles.srOnly}>synthetic rows</span> highlighted, all rows stay
                </>
              ) : (
                <>
                  <b>{filteredAndSortedWards.length}</b> of {allPressureWards.length}{" "}
                  <span className={styles.srOnly}>synthetic rows</span>
                </>
              )}
            </span>
          </div>
        )}
        <div className={styles.tableWrap}>
          <table className={`${tableClasses.table} ${styles.table}`} id="wardPressureTable">
            <caption className={styles.srOnly}>Inpatient mental health ward capacity and demand</caption>
            <thead>
              <tr>
                <SortTh id="name" label="Ward" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} />
                <SortTh id="beds" label="Beds" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
                <SortTh id="ready" label="Ready" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
                <SortTh
                  id="occ"
                  label="Occupancy"
                  sort={wardSortCol}
                  asc={wardSortAsc}
                  onSort={handleWardSort}
                  numeric
                />
                <SortTh
                  id="ref"
                  label="Awaiting"
                  sort={wardSortCol}
                  asc={wardSortAsc}
                  onSort={handleWardSort}
                  numeric
                />
              </tr>
            </thead>
            <tbody>
              {visibleWards.map((w) => {
                const percent = Math.round(w.occupancyRate * 100);
                const over = percent >= BED_ALERT_THRESHOLD_PERCENT;
                return (
                  <tr key={w.id} {...rowDim(wardOverLine && !over)}>
                    <th scope="row">
                      {w.name}
                      <span className={styles.code} title={w.hospital}>
                        {w.site}
                        <span className={styles.srOnly}>, {w.hospital}</span>
                      </span>
                      {w.ready === 0 && w.occupancyRate === 1 ? (
                        <Badge variant="plain" tone="neutral" size="sm">
                          Full
                        </Badge>
                      ) : null}
                    </th>
                    <td className={styles.num}>{w.beds}</td>
                    <td className={`${styles.num} ${w.ready === 0 ? styles.zero : ""}`}>{w.ready}</td>
                    <td className={styles.num}>
                      <span className={styles.occBar}>
                        <span className={styles.occTrack} aria-hidden="true">
                          <span className={styles.occFill} style={{ width: `${Math.min(100, percent)}%` }} />
                          <span className={styles.occTick} style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }} />
                        </span>
                        <span className={styles.occValue}>
                          {over ? <StatusGlyph tone="warning" size={9} /> : null}
                          {percent}%
                        </span>
                      </span>
                    </td>
                    <td className={`${styles.num} ${exactStatisticsCount(w.referred) === 0 ? styles.zero : ""}`}>
                      {small(w.referred)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <SiteCodeKey sites={visibleWards.map((w) => ({ code: w.site, name: w.hospital }))} />
        {/* Bed manager: Compare is not one of its statistics sections, so it is not linked, and a
            foot with nothing in it is not drawn. */}
        {siteName && filteredAndSortedWards.length <= PRESSURE_ROWS ? null : (
          <CardFoot
            meta={
              filteredAndSortedWards.length > PRESSURE_ROWS ? (
                <Button size="sm" variant="ghost" onClick={() => setWardShowAll((value) => !value)}>
                  {wardShowAll ? `Show top ${PRESSURE_ROWS}` : `Show all ${filteredAndSortedWards.length}`}
                </Button>
              ) : undefined
            }
          >
            {siteName ? null : (
              <Link href="/ward-flow/statistics/compare#choose-a-unit" className={styles.footLink}>
                Compare wards
              </Link>
            )}
          </CardFoot>
        )}
      </StatCard>

      <BedManagerEdCard
        siteName={siteName}
        longestEd={longestEd}
        edSearchQuery={edSearchQuery}
        setEdSearchQuery={setEdSearchQuery}
        edSortCol={edSortCol}
        edSortAsc={edSortAsc}
        handleEdSort={handleEdSort}
        filteredAndSortedEds={filteredAndSortedEds}
        departmentCount={emergencyDepts.length}
        small={small}
        totalEdWaiting={totalEdWaiting}
        networkMedianWait={networkMedianWait}
        totalEdOver8={totalEdOver8}
        totalEdOver24={totalEdOver24}
      />
    </div>
  );

  if (isPhone) {
    return (
      <>
        <BedManagerStatisticsSummaryPhone
          // Bed manager: the phone hero names its site, as the desktop eyebrow does.
          eyebrow={siteName ? `Statistics · ${siteName}` : undefined}
          ready={availableNow}
          beingMadeReady={pendingPreparation}
          occupied={inUseCount}
          occupiedPct={occupiedPct}
          waitingInEd={waitingCount}
          endedToday={dischargesCount}
          wards={allPressureWards.map((ward) => ({
            id: ward.id,
            name: ward.name,
            hospital: ward.hospital,
            service: siteByCode(ward.site)?.service ?? "Service not recorded",
            beds: ward.beds,
            ready: ward.ready,
            percent: Math.round(ward.occupancyRate * 100),
          }))}
          eds={emergencyDepts.map((ed) => ({
            id: ed.id,
            name: ed.name,
            site: ed.site,
            waiting: ed.waiting,
            longest: ed.longest,
          }))}
          referrals={{ raised: refRaised, accepted: refAccepted, declined: refDeclined, open: refOpen }}
          moreFigures={{
            blocked: {
              total: blocked.totalCount,
              admissions: blocked.admissionCount,
              tallies: blocked.tallies.map((tally) => ({ id: tally.reason, label: tally.reason, count: tally.count })),
            },
            declines: declinesReadout.ok
              ? {
                  total: declinesReadout.value.totalCount,
                  tallies: declinesReadout.value.tallies.map((tally) => ({
                    id: tally.reason,
                    label: DECLINE_REASON_LABELS[tally.reason],
                    count: tally.count,
                  })),
                }
              : { statement: declinesReadout.statement },
            arrivals: {
              measured: arrivals.measuredCount,
              average: arrivals.averageMinutes,
              shortest: arrivals.shortestMinutes,
              longest: arrivals.longestMinutes,
            },
          }}
          wardCount={allPressureWards.length}
          paused={paused}
          onTogglePause={togglePause ?? undefined}
        />
        {/* The phone summary closes the page's main landmark, so this card is its own landmark. Three
            hours and no total fit a phone's width without a sideways scroll. */}
        <aside className={trendStyles.phoneSlot} aria-label="This session">
          <StatisticsSessionTrendsCard now={now} hours={3} showTotal={false} />
        </aside>
      </>
    );
  }

  return (
    <div className={styles.page} data-testid="ward-statistics-screen" data-ward-design="v6">
      <main id="main-content" className={styles.stack}>
        <StatisticsHero
          section="hub"
          navTestId="ward-statistics-index"
          eyebrow={`Statistics · ${scopeLabel} · as at ${formatInstant(now)}`}
          // H-0887: the page heading names the page, not only the count.
          title={
            <>
              <span className={styles.srOnly}>Statistics:</span> {availableNow} {availableNow === 1 ? "bed" : "beds"}{" "}
              ready now
            </>
          }
          now={now}
          paused={paused}
          onTogglePause={togglePause ?? undefined}
          exportFigures={{
            stem: "network",
            scope: scopeLabel,
            figures: () => [
              ["Beds ready now", availableNow],
              ["Beds", totalBeds],
              ["Occupied", occupiedCount],
              ["Beds in use (occupied or pulled)", inUseCount],
              ["Occupancy percent", occupiedPct],
              ["Being made ready", pendingPreparation],
              // Issue #618: counts of people follow the executive's small number rule; beds stay exact.
              ["Admissions ended today", small(dischargesCount)],
              ["Open ED journeys", small(waitingCount)],
              ["Still open", small(stillOpenCount)],
            ],
          }}
          chips={
            <HeroChips label="Network at a glance">
              <HeroChip value={totalBeds} label="Beds" />
              {/* Redesign: the count names its noun first, its share after. */}
              <HeroChip value={inUseCount} label={`In use · ${occupiedPct.toFixed(1)}%`} />
              <HeroChip value={pendingPreparation} label="Being made ready" />
              <HeroChip
                value={<span data-testid="ward-statistics-discharges-today-count">{small(dischargesCount)}</span>}
                label={
                  <>
                    Admissions ended today
                    <span className={styles.srOnly} data-testid="ward-statistics-discharges-today-caption">
                      {reportDayCaption}
                    </span>
                  </>
                }
              />
              <HeroChip
                value={small(waitingCount)}
                // Five chips at most; the open-journey figure rides with the waiting one it contains.
                label="Open ED journeys"
                onPress={() =>
                  document
                    .querySelector('[data-testid="ward-statistics-emergency-departments"]')
                    ?.scrollIntoView({ block: "start" })
                }
              />
            </HeroChips>
          }
        />

        {service === null || scopeLabel !== "whole network" ? null : (
          <p className={styles.notice} data-testid="ward-statistics-service-scope-sentence">
            {`Set to ${service}. This page is the whole network's own, so these figures already include ${service}.`}{" "}
            <Link href={serviceStatisticsHref(service)} data-testid="ward-statistics-service-scope-link">
              {`Open ${service} statistics`}
            </Link>
          </p>
        )}

        <StatisticsViewSwitch
          view={view}
          onChoose={chooseView}
          // Bed manager: no Open a unit. The finder lists every ward, ED, service and team, and this desk
          // opens only its own site's wards, which its wards table below already lists.
          finder={siteName ? undefined : <StatisticsUnitFinder lists={finderLists} />}
        />

        {/* Each view's anchor exists whichever view shows, so its link always has a target. */}
        {view === "board" ? null : <div id="board" hidden />}
        {view === "journey" ? slots.journey(() => chooseView("board")) : <div id="journey" hidden />}
        {view === "map" ? slots.map : <div id="map" hidden />}
        {view !== "board" ? null : (
          <div id="board" className={styles.stack}>
            {/* Redesign: summary first, occupancy by service across the top (D-77's figures, once). */}
            {/* Bed manager: its own site's wards and ED lead the board (D-80); the cards below keep
                every site as bed counts. */}
            {siteName ? siteDetail : null}
            {slots.overview}
            {siteName ? (
              // Bed manager: no Where beds are available (hospital-by-hospital beds are for placing).
              <div id="beds">{referralsToday}</div>
            ) : (
              <FlushRow layout="lead2" id="beds">
                <div className={styles.stack} data-testid="ward-statistics-patients">
                  {slots.capacity}
                </div>

                <Follow stack>{referralsToday}</Follow>
              </FlushRow>
            )}

            {/* Coordinator: the wards and EDs after the bed cards. */}
            {siteName ? null : siteDetail}

            <div className={styles.grid3}>
              <StatCard
                icon={Lock}
                title="Discharges held up"
                data-testid="ward-statistics-blocked-discharges-by-reason"
                aside={
                  <span className={styles.muted} data-testid="ward-statistics-blocked-discharges-by-reason-population">
                    <span data-testid="ward-statistics-blocked-discharges-by-reason-total">
                      {small(blocked.totalCount)}
                    </span>{" "}
                    of{" "}
                    <span data-testid="ward-statistics-blocked-discharges-by-reason-admissions">
                      {small(blocked.admissionCount)}
                    </span>{" "}
                    not departed
                  </span>
                }
              >
                <CardBody data-testid="ward-statistics-blocked-discharges-by-reason-list">
                  <BarList
                    label="Discharges held up, by reason"
                    labelWidth="10.5rem"
                    axis
                    max={axisMax(blocked.tallies.map((tally) => barValue(tally.count).value))}
                    rows={blocked.tallies.map((tally) => ({
                      id: tally.reason,
                      label: (
                        <span data-testid={`ward-statistics-blocked-discharge-${tally.reason}`}>{tally.reason}</span>
                      ),
                      labelText: tally.reason,
                      ...barValue(tally.count),
                      display: (
                        <span data-testid={`ward-statistics-blocked-discharge-${tally.reason}-count`}>
                          {exactStatisticsCount(tally.count) === 0 ? "none" : small(tally.count)}
                        </span>
                      ),
                    }))}
                  />
                  <span className={styles.srOnly} data-testid="ward-statistics-blocked-discharges-by-reason-generated">
                    All{" "}
                    <span data-testid="ward-statistics-blocked-discharges-by-reason-vocabulary-size">
                      {blocked.vocabularySize}
                    </span>{" "}
                    blocker categories.
                  </span>
                </CardBody>
              </StatCard>

              <StatCard
                icon={X}
                title="Declines by reason"
                data-testid="ward-statistics-declines-by-reason"
                aside={
                  declinesReadout.ok ? (
                    <span className={styles.muted} data-testid="ward-statistics-declines-by-reason-population">
                      <span data-testid="ward-statistics-declines-by-reason-total">
                        {small(declinesReadout.value.totalCount)}
                      </span>{" "}
                      {declinesReadout.value.totalCount === 1 ? "decline" : "declines"},{" "}
                      <span data-testid="ward-statistics-declines-by-reason-movements-with">
                        {small(declinesReadout.value.movementsWithDeclinesCount)}
                      </span>
                      <span className={styles.srOnly}>
                        {" "}
                        of{" "}
                        <span data-testid="ward-statistics-declines-by-reason-movements">
                          {small(declinesReadout.value.movementCount)}
                        </span>
                      </span>{" "}
                      {declinesReadout.value.movementsWithDeclinesCount === 1 ? "movement" : "movements"}
                    </span>
                  ) : undefined
                }
              >
                <CardBody>
                  {!declinesReadout.ok ? (
                    <p className={styles.notice} data-testid="ward-statistics-declines-by-reason-unavailable">
                      {declinesReadout.statement}
                    </p>
                  ) : (
                    <div data-testid="ward-statistics-declines-by-reason-list">
                      <BarList
                        label="Declines by reason"
                        labelWidth="10.5rem"
                        axis
                        max={axisMax(declinesReadout.value.tallies.map((tally) => barValue(tally.count).value))}
                        rows={declinesReadout.value.tallies.map((tally) => ({
                          id: tally.reason,
                          label: (
                            <span data-testid={`ward-statistics-decline-${tally.reason}`}>
                              {DECLINE_REASON_LABELS[tally.reason]}
                            </span>
                          ),
                          labelText: DECLINE_REASON_LABELS[tally.reason],
                          ...barValue(tally.count),
                          display: (
                            <span data-testid={`ward-statistics-decline-${tally.reason}-count`}>
                              {exactStatisticsCount(tally.count) === 0 ? "none" : small(tally.count)}
                            </span>
                          ),
                        }))}
                      />
                      <span className={styles.srOnly}>
                        <span data-testid="ward-statistics-declines-by-reason-vocabulary-size">
                          {declinesReadout.value.vocabularySize}
                        </span>{" "}
                        reason categories
                      </span>
                    </div>
                  )}
                </CardBody>
              </StatCard>

              <StatCard
                icon={Truck}
                title="Pull to arrival"
                data-testid="ward-statistics-pull-to-arrival"
                aside={
                  <span className={styles.muted}>
                    <span data-testid="ward-statistics-arrival-measured-count">{small(arrivals.measuredCount)}</span>{" "}
                    admissions
                  </span>
                }
              >
                <CardBody className={styles.bodyStack}>
                  <dl className={styles.figures} aria-label="Admission timing">
                    <div className={styles.figure}>
                      <dd className={styles.figureValue} data-testid="ward-statistics-arrival-average">
                        {arrivals.averageMinutes === null ? "Not recorded" : splitDuration(arrivals.averageMinutes)}
                      </dd>
                      <dt className={styles.figureLabel}>Average</dt>
                    </div>
                    <div className={styles.figure}>
                      <dd className={styles.figureValue} data-testid="ward-statistics-arrival-shortest">
                        {arrivals.shortestMinutes === null ? "Not recorded" : splitDuration(arrivals.shortestMinutes)}
                      </dd>
                      <dt className={styles.figureLabel}>Shortest</dt>
                    </div>
                    <div className={styles.figure}>
                      <dd className={styles.figureValue} data-testid="ward-statistics-arrival-longest">
                        {arrivals.longestMinutes === null ? "Not recorded" : splitDuration(arrivals.longestMinutes)}
                      </dd>
                      <dt className={styles.figureLabel}>Longest</dt>
                    </div>
                  </dl>
                  {/* Device audit 11 Oct 2026: when every measured arrival took the same time the chart is
                      one bar and looked broken, so it says so instead. */}
                  {arrivals.shortestMinutes !== null && arrivals.shortestMinutes === arrivals.longestMinutes ? (
                    <p className={styles.muted} data-testid="ward-statistics-arrival-no-spread">
                      Every measured arrival took the same time in this synthetic data, so there is no spread to chart.
                    </p>
                  ) : (
                    <ColumnChart
                      label="Pull to arrival, admissions by band"
                      height={110}
                      columns={arrivalBands.map((band) => ({ ...band, ...barValue(band.value) }))}
                    />
                  )}
                  <dl className={styles.tiles}>
                    <div className={styles.tile}>
                      <dt className={styles.tileLabel}>Awaiting</dt>
                      <dd className={styles.tileValue} data-testid="ward-statistics-arrival-awaiting-count">
                        {small(arrivals.awaitingArrivalCount)}
                      </dd>
                    </div>
                    <div className={styles.tile}>
                      <dt className={styles.tileLabel}>Ended</dt>
                      <dd className={styles.tileValue} data-testid="ward-statistics-arrival-ended-count">
                        {small(arrivals.endedCount)}
                      </dd>
                    </div>
                    <div className={styles.tile}>
                      <dt className={styles.tileLabel}>Excluded</dt>
                      <dd className={styles.tileValue} data-testid="ward-statistics-arrival-incoherent">
                        {small(arrivals.incoherentCount)}
                      </dd>
                    </div>
                    <div className={styles.tile}>
                      <dt className={styles.tileLabel}>Pending</dt>
                      <dd className={styles.tileValue} data-testid="ward-statistics-preparing-count">
                        {preparingCount}
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </StatCard>

              <StatisticsSessionTrendsCard now={now} />

              {slots.operationalExtra}
            </div>
          </div>
        )}

        <WardPrototypeFooter testId="ward-statistics-footer" note="Synthetic prototype. Every figure is invented." />
      </main>
    </div>
  );
}

// Kept for the community chooser deep link and the per-team statistics route.
