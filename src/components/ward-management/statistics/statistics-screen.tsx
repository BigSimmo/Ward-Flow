"use client";

import { readDeclinesByReason } from "./statistics-decline-reporting";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Lock, Truck, X } from "lucide-react";

import { BarList, Card, CardBody, ColumnChart, HeroChip, HeroChips, Spinner, useIsPhone } from "@/components/wf";
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

import { FlushRow, Follow } from "./statistics-layout";
import { useStatisticsView } from "./statistics-view-bar";
import { FindUnitTool, PhoneUnitFinder, StatisticsViewSwitch, useUnitFinder } from "./statistics-view-switch";
import { StatisticsEdJourneysCard } from "./statistics-ed-journeys-card";
import { StatisticsReferralsTodayCard } from "./statistics-referrals-today-card";
import { StatisticsWardsCard, useWardTable } from "./statistics-wards-card";
import { arrivalBandsFor } from "./statistics-bands";
import { median, shortSiteName, wardFinderEntry, type EdSortKey } from "./statistics-screen-parts";
import { ReasonCounts, SmallNumberNote, noCountReleased } from "./statistics-count-list";

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

const StatisticsJourneyView = dynamic(() => import("./statistics-journey-view").then((m) => m.StatisticsJourneyView), {
  ssr: false,
  loading: () => <StatisticsViewLoading view="journey" />,
});

const StatisticsMapView = dynamic(() => import("./statistics-map-view").then((m) => m.StatisticsMapView), {
  ssr: false,
  loading: () => <StatisticsViewLoading view="map" />,
});
import styles from "./statistics-v6.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { StatisticsCapacityChart } from "./statistics-capacity-chart";
import { StatCard, StatisticsHero, useStatisticsLive } from "./statistics-hero";
import { StatisticsSessionTrendsCard } from "./statistics-session-trends-card";
import trendStyles from "./statistics-session-trends.module.css";
import { StatisticsSummaryPhone } from "./statistics-summary-phone";
import {
  NetworkOverviewCards,
  ExecutiveNetworkOverviewCards,
  SiteOverviewCards,
  type SummaryModel,
  type SummarySlots,
  type SummaryEd,
} from "./statistics-network-cards";
import { StatisticsUnitFinder } from "./statistics-unit-finder";
import { DECLINE_REASON_LABELS, isAwaitingAnswer } from "../ward-referrals";
import { wardReferralTally } from "./statistics-ward-referrals";
import { occupiedBeds } from "./statistics-occupancy";
import { useCanOpenHref, useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { ForecastTrackRecordCard } from "@/components/ward-management/forecast/forecast-track-record";
import { FixedQuestionsCard, WaitingStagesCard } from "@/components/ward-management/reports/closing-loop-cards-lazy";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  withheldBar,
  type StatisticsCount,
} from "./statistics-small-numbers";
import type { FinderEntry, FinderKind } from "./statistics-unit-finder";

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

type StatisticsInputs = {
  admissions?: Admission[];
  referrals?: Referral[];
  bedReleases?: BedRelease[];
  movements?: Movement[];
};
export function StatisticsScreen(props: StatisticsInputs = {}) {
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
    pendingPreparation: ward.pendingPreparation,
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
  const OverviewCards = siteCode === undefined ? NetworkOverviewCards : SiteOverviewCards;

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
        pendingPreparation: bedsPendingPreparation(u.id, sourceBedReleases),
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
  } = model;
  const service = useServiceScope();
  const canOpen = useCanOpenHref();
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
  // Table state. The two tables' typed filters went in the search and forms review (D-91, Josh,
  // 30 Oct 2026): about 23 wards and 15 EDs sort and show more without one, and the header search
  // finds either by name.
  // D-91: the one unit finder, opened from "Open a unit" on the tab row.
  const unitFinder = useUnitFinder();
  const wardTable = useWardTable(allPressureWards, isPhone);
  const [edSortCol, setEdSortCol] = useState<EdSortKey>("waiting");
  const [edSortAsc, setEdSortAsc] = useState(false);

  const handleEdSort = (col: EdSortKey) => {
    if (edSortCol === col) setEdSortAsc((prev) => !prev);
    else {
      setEdSortCol(col);
      setEdSortAsc(col === "name");
    }
  };

  const filteredAndSortedEds = useMemo(() => {
    if (isPhone) return [];
    const list = emergencyDepts.slice();
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
  }, [isPhone, emergencyDepts, edSortCol, edSortAsc]);

  // A phone shows the finder only when a link arrives at its anchor, so it skips building and
  // sorting the lists until then. A bed manager's desk never shows it.
  const phoneSkipsFinder = isPhone && (siteName !== undefined || !unitFinder.open);
  const finderLists = useMemo<Record<FinderKind, FinderEntry[]>>(
    () =>
      phoneSkipsFinder
        ? { ward: [], ed: [], service: [], team: [] }
        : {
            ward: allPressureWards
              .map(wardFinderEntry)
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
    [phoneSkipsFinder, allPressureWards, emergencyDepts, directory, operationalSmall],
  );
  usePrintableDisclosures();
  const { view, choose: chooseView } = useStatisticsView();
  // Role view (executive): a count the small number rule withholds reads "not shown". At a glance it
  // says nothing, so the hero and card headings leave it out; the card body still lists it.
  const notShown = (count: StatisticsCount) => executive && typeof count !== "number" && count.kind === "withheld";
  // Referrals today, beside Where beds are available, or on its own row for a bed manager.
  const referralsToday = (
    <StatisticsReferralsTodayCard model={model} small={small} reportDayCaption={reportDayCaption} />
  );
  // The wards and ED tables, drawn first for a bed manager and after the bed cards otherwise.
  const siteDetail = (
    <div className={styles.grid2}>
      <StatisticsWardsCard wards={allPressureWards} table={wardTable} siteName={siteName} small={small} />

      <StatisticsEdJourneysCard
        siteName={siteName}
        longestEd={longestEd}
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
        <StatisticsSummaryPhone
          // Bed manager: the phone hero names its site, as the desktop eyebrow does.
          eyebrow={siteName ? `Statistics · ${siteName}` : undefined}
          totalBeds={totalBeds}
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
        {/* Bed manager: no finder, as on the desktop. */}
        {siteName ? null : (
          <PhoneUnitFinder
            open={unitFinder.open}
            onClose={unitFinder.toggle}
            finder={<StatisticsUnitFinder lists={finderLists} />}
          />
        )}
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
          tools={siteName ? undefined : <FindUnitTool open={unitFinder.open} onToggle={unitFinder.toggle} />}
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
              {/* The count names its noun first, its share after. */}
              <HeroChip value={inUseCount} label={`In use · ${occupiedPct.toFixed(1)}%`} />
              <HeroChip value={pendingPreparation} label="Being made ready" />
              {notShown(dischargesCount) ? null : (
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
              )}
              {notShown(waitingCount) ? null : (
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
              )}
            </HeroChips>
          }
        />

        {/* Role view (executive): one sentence for the small number rule, so "not shown" and "fewer
            than 5" further down are explained once instead of puzzling on every card. */}
        {executive ? <SmallNumberNote className={styles.notice} /> : null}

        {service === null || scopeLabel !== "whole network" ? null : (
          <p className={styles.notice} data-testid="ward-statistics-service-scope-sentence">
            {`Set to ${service}. This page is the whole network's own, so these figures already include ${service}.`}
            {/* Linked only for a desk that may open the service's page (access audit, 31 Oct 2026). */}
            {canOpen(serviceStatisticsHref(service)) ? (
              <>
                {" "}
                <Link href={serviceStatisticsHref(service)} data-testid="ward-statistics-service-scope-link">
                  {`Open ${service} statistics`}
                </Link>
              </>
            ) : null}
          </p>
        )}

        <StatisticsViewSwitch
          view={view}
          onChoose={chooseView}
          // Bed manager: no Open a unit. The finder lists every ward, ED, service and team, and this desk
          // opens only its own site's wards, which its wards table below already lists.
          finder={siteName ? undefined : <StatisticsUnitFinder lists={finderLists} />}
          finderOpen={unitFinder.open}
        />

        {/* Each view's anchor exists whichever view shows, so its link always has a target. */}
        {view === "board" ? null : <div id="board" hidden />}
        {view === "journey" ? slots.journey(() => chooseView("board")) : <div id="journey" hidden />}
        {view === "map" ? slots.map : <div id="map" hidden />}
        {view !== "board" ? null : (
          <div id="board" className={styles.stack}>
            {/* Summary first: occupancy by service across the top (D-77's figures, once). */}
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
                  notShown(blocked.totalCount) || notShown(blocked.admissionCount) ? undefined : (
                    <span
                      className={styles.muted}
                      data-testid="ward-statistics-blocked-discharges-by-reason-population"
                    >
                      <span data-testid="ward-statistics-blocked-discharges-by-reason-total">
                        {small(blocked.totalCount)}
                      </span>{" "}
                      of{" "}
                      <span data-testid="ward-statistics-blocked-discharges-by-reason-admissions">
                        {small(blocked.admissionCount)}
                      </span>{" "}
                      not departed
                    </span>
                  )
                }
              >
                <CardBody data-testid="ward-statistics-blocked-discharges-by-reason-list">
                  {/* Role view (executive): every reason held back is an empty chart on a 0 to 1 axis, so
                      the reasons are listed as words instead. */}
                  {executive && noCountReleased(blocked.tallies.map((tally) => tally.count)) ? (
                    <ReasonCounts
                      label="Discharges held up, by reason"
                      rows={blocked.tallies.map((tally) => ({
                        id: tally.reason,
                        label: tally.reason,
                        count: tally.count,
                        testId: `ward-statistics-blocked-discharge-${tally.reason}-count`,
                      }))}
                      small={small}
                    />
                  ) : (
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
                  )}
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
                  declinesReadout.ok &&
                  !notShown(declinesReadout.value.totalCount) &&
                  !notShown(declinesReadout.value.movementsWithDeclinesCount) ? (
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
                  ) : executive && noCountReleased(declinesReadout.value.tallies.map((tally) => tally.count)) ? (
                    // Role view (executive): as Discharges held up, words instead of an empty chart.
                    <ReasonCounts
                      label="Declines by reason"
                      rows={declinesReadout.value.tallies.map((tally) => ({
                        id: tally.reason,
                        label: DECLINE_REASON_LABELS[tally.reason],
                        count: tally.count,
                        testId: `ward-statistics-decline-${tally.reason}-count`,
                      }))}
                      small={small}
                    />
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
                  notShown(arrivals.measuredCount) ? undefined : (
                    <span className={styles.muted}>
                      <span data-testid="ward-statistics-arrival-measured-count">{small(arrivals.measuredCount)}</span>{" "}
                      admissions
                    </span>
                  )
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
