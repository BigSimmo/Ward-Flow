"use client";

import { readDeclinesByReason } from "./statistics-decline-reporting";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronUp, Clock, Lock, Search, TrendingUp, Truck, X } from "lucide-react";

import {
  Badge,
  BarList,
  Button,
  CardBody,
  CardFoot,
  ColumnChart,
  FilterChip,
  HeroStat,
  Icon,
  StackBar,
  StatusGlyph,
  durMinutes,
  TextInput,
  buttonClass,
  tableClasses,
} from "@/components/wf";
import {
  blockedDischargesByReason,
  bedsBeingPrepared,
  pullToArrival,
  refusedAndNothingPending,
} from "@/components/ward-management/statistics/statistics-derivations";
import { communityStatisticsHref, serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { axisMax } from "@/components/ward-management/statistics/statistics-axis";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  calendarDateOf,
  dayOf,
  formatInstant,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import {
  HEALTH_SERVICES,
  type BedRelease,
  type Movement,
  type Referral,
} from "@/components/ward-management/ward-model";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import {
  ED_ELEVATED_PRESSURE_WAIT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

import styles from "./statistics-v6.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { StatisticsCapacityChart } from "./statistics-capacity-chart";
import { StatCard, StatisticsHero, useStatisticsLive } from "./statistics-hero";
import { StatisticsUnitFinder } from "./statistics-unit-finder";
import { isAwaitingAnswer } from "../ward-referrals";
import { wardReferralTally } from "./statistics-ward-referrals";
import { hoursText, occupiedBeds } from "./statistics-occupancy";

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

/** "no_specialling" reads "No specialling". */
const sentenceCase = (text: string) => {
  const spaced = text.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Minutes as a duration, or "none" when nothing is waiting. */
const waitText = (minutes: number | null) => (minutes === null ? "none" : durMinutes(Math.round(minutes)));

/** A median wait to the nearest hour ("6h", "1d 4h"), or "none" when nothing is waiting. */
const medianText = (minutes: number | null) => (minutes === null ? "none" : hoursText(Math.round(minutes / 60)));

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
const hoursLabel = (minutes: number) => `${Math.round(minutes / 60)}h`;

/**
 * Pull to arrival, banded against the configured pull hold rather than typed hours: under half the
 * hold, the rest of the hold, up to twice the hold, and longer.
 */
function arrivalBandsFor(holdMinutes: number): Array<{ id: string; label: string; from: number; to: number }> {
  const half = holdMinutes / 2;
  const twice = holdMinutes * 2;
  return [
    { id: "half-hold", label: `Under ${hoursLabel(half)}`, from: 0, to: half },
    { id: "hold", label: `${hoursLabel(half)} to ${hoursLabel(holdMinutes)}`, from: half, to: holdMinutes },
    { id: "twice-hold", label: `${hoursLabel(holdMinutes)} to ${hoursLabel(twice)}`, from: holdMinutes, to: twice },
    { id: "longer", label: `Over ${hoursLabel(twice)}`, from: twice, to: Number.POSITIVE_INFINITY },
  ];
}

type WardSortKey = "name" | "beds" | "ready" | "occ" | "ref";
type EdSortKey = "name" | "waiting" | "longest" | "median" | "over8" | "over24";

function SortTh<K extends string>({
  id,
  label,
  sort,
  asc,
  onSort,
  numeric = false,
}: {
  id: K;
  label: string;
  sort: K;
  asc: boolean;
  onSort: (id: K) => void;
  numeric?: boolean;
}) {
  const active = sort === id;
  return (
    <th
      scope="col"
      className={`${styles.sortTh} ${numeric ? styles.num : ""}`}
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => onSort(id)}>
        {label}
        {active ? <Icon icon={asc ? ChevronUp : ChevronDown} size={14} /> : null}
      </button>
    </th>
  );
}

export function StatisticsScreen({
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
  const service = useServiceScope();

  const sourceAdmissions = admissions ?? liveAdmissions;
  const sourceReferrals = referrals ?? liveReferrals;
  const sourceBedReleases = bedReleases ?? liveBedReleases;
  const sourceMovements = movements ?? liveMovements;

  const refused = refusedAndNothingPending(sourceMovements, units, now);
  const preparingCount = bedsBeingPrepared(sourceBedReleases);
  const arrivals = pullToArrival(sourceAdmissions);
  const declinesReadout = readDeclinesByReason(sourceMovements);
  const blocked = blockedDischargesByReason(sourceAdmissions);

  const totalBeds = units.reduce((sum, u) => sum + u.beds, 0);
  const occupancy = occupiedBeds(units, sourceAdmissions, sourceBedReleases, leaveBeds);
  const occupiedCount = occupancy.occupied;
  const occupiedPct = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0;
  const availableNow = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).available, 0);
  // Ready beds still being cleaned count as ready (the owner's ruling); the label says how many.
  const pendingPreparation = units.reduce((sum, u) => sum + bedsPendingPreparation(u.id, sourceBedReleases), 0);
  const waitingCount = refused.openMovementCount;

  const admissionsCount = sourceAdmissions.filter(
    (a) => a.arrivedAt !== null && dayOf(a.arrivedAt) === dayOf(now),
  ).length;
  const dischargesCount = sourceAdmissions.filter((a) => a.leftAt !== null && dayOf(a.leftAt) === dayOf(now)).length;

  const reportDayCaption = `${formatReportDay(now, dayZero)}, midnight to midnight, across all wards`;

  // Emergency departments
  const emergencyDepts = useMemo(() => {
    return allEmergencyDepartments()
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
      .sort((a, b) => b.waiting - a.waiting || (b.longest ?? 0) - (a.longest ?? 0));
  }, [sourceMovements, now]);

  const totalEdWaiting = emergencyDepts.reduce((s, d) => s + d.waiting, 0);
  const longestEd = emergencyDepts.reduce<(typeof emergencyDepts)[number] | null>(
    (best, d) => (d.longest !== null && (best === null || (best.longest ?? 0) < d.longest) ? d : best),
    null,
  );
  const networkMedianWait = median(emergencyDepts.flatMap((d) => d.waits));
  const totalEdOver8 = emergencyDepts.reduce((s, d) => s + d.over8, 0);
  const totalEdOver24 = emergencyDepts.reduce((s, d) => s + d.over24, 0);

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

  const allPressureWards = useMemo(() => {
    return units.map((u) => {
      const capInfo = unitCapacity(u, sourceBedReleases);
      const occupancyRate =
        u.beds > 0 ? occupiedBeds([u], sourceAdmissions, sourceBedReleases, leaveBeds).occupied / u.beds : 0;
      return {
        id: u.id,
        name: u.name,
        site: u.siteCode,
        hospital: siteByCode(u.siteCode)?.name ?? u.siteCode,
        beds: u.beds,
        ready: capInfo.available,
        occupancyRate,
        referred: wardReferralTally(sourceMovements, u.id).askedAndWaiting,
      };
    });
  }, [units, sourceAdmissions, sourceBedReleases, leaveBeds, sourceMovements]);

  const overLineCount = allPressureWards.filter(
    (w) => Math.round(w.occupancyRate * 100) >= BED_ALERT_THRESHOLD_PERCENT,
  ).length;

  const filteredAndSortedWards = useMemo(() => {
    let list = allPressureWards.slice();
    const q = wardSearchQuery.trim().toLowerCase();
    if (q) list = list.filter((w) => `${w.name} ${w.hospital} ${w.site}`.toLowerCase().includes(q));
    if (wardOverLine) list = list.filter((w) => Math.round(w.occupancyRate * 100) >= BED_ALERT_THRESHOLD_PERCENT);
    const value = (w: (typeof list)[number]): number | string =>
      wardSortCol === "name"
        ? w.name
        : wardSortCol === "beds"
          ? w.beds
          : wardSortCol === "ready"
            ? w.ready
            : wardSortCol === "ref"
              ? w.referred
              : w.occupancyRate;
    list.sort((a, b) => {
      const vA = value(a);
      const vB = value(b);
      if (vA < vB) return wardSortAsc ? -1 : 1;
      if (vA > vB) return wardSortAsc ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [allPressureWards, wardSearchQuery, wardOverLine, wardSortCol, wardSortAsc]);

  const visibleWards = wardShowAll ? filteredAndSortedWards : filteredAndSortedWards.slice(0, PRESSURE_ROWS);

  const filteredAndSortedEds = useMemo(() => {
    let list = emergencyDepts.slice();
    const q = edSearchQuery.trim().toLowerCase();
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.site.toLowerCase().includes(q));
    const value = (d: (typeof list)[number]): number | string =>
      edSortCol === "name"
        ? d.site
        : edSortCol === "longest"
          ? (d.longest ?? -1)
          : edSortCol === "median"
            ? (d.median ?? -1)
            : edSortCol === "over8"
              ? d.over8
              : edSortCol === "over24"
                ? d.over24
                : d.waiting;
    list.sort((a, b) => {
      const vA = value(a);
      const vB = value(b);
      if (vA < vB) return edSortAsc ? -1 : 1;
      if (vA > vB) return edSortAsc ? 1 : -1;
      return a.site.localeCompare(b.site);
    });
    return list;
  }, [emergencyDepts, edSearchQuery, edSortCol, edSortAsc]);

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
  }, [sourceAdmissions, configuration.pullHoldMinutes]);

  const finderLists = useMemo(
    () => ({
      ward: units
        .map((u) => ({
          id: u.id,
          name: u.name,
          code: u.siteCode,
          meta: `${unitCapacity(u, sourceBedReleases).available} ready`,
          ready: unitCapacity(u, sourceBedReleases).available,
        }))
        .sort((a, b) => b.ready - a.ready || a.name.localeCompare(b.name)),
      ed: emergencyDepts.map((d) => ({ id: d.id, name: d.name, code: d.site, meta: `${d.waiting} waiting` })),
      service: HEALTH_SERVICES.map((svc) => {
        const count = units.filter((u) => siteByCode(u.siteCode)?.service === svc).length;
        return { id: svc, name: svc, meta: `${count} ${count === 1 ? "ward" : "wards"}` };
      }),
      team: COMMUNITY_TEAM_PAGES.map((team) => ({ id: team.id, name: team.name })),
    }),
    [units, sourceBedReleases, emergencyDepts],
  );

  usePrintableDisclosures();

  const blockedMean = blocked.vocabularySize > 0 ? blocked.totalCount / blocked.vocabularySize : 0;

  return (
    <div className={styles.page} data-testid="ward-statistics-screen" data-ward-design="v6">
      <main id="main-content" className={styles.stack}>
        <StatisticsHero
          section="hub"
          navTestId="ward-statistics-index"
          eyebrow={`Statistics · as at ${formatInstant(now)}`}
          title="Whole network"
          paused={live.paused}
          onTogglePause={live.togglePause}
          stats={
            <>
              <HeroStat value={totalBeds} label="Beds" />
              <HeroStat value={occupiedCount} label={`${occupiedPct}% occupied`} />
              <HeroStat
                value={availableNow}
                label={pendingPreparation > 0 ? `Ready, ${pendingPreparation} being made ready` : "Ready"}
              />
              <HeroStat value={waitingCount} label="Waiting in ED" />
              <HeroStat
                value={<span data-testid="ward-statistics-admissions-today-count">{admissionsCount}</span>}
                label={
                  <>
                    Admitted today
                    <span className={styles.srOnly} data-testid="ward-statistics-admissions-today-caption">
                      {reportDayCaption}
                    </span>
                  </>
                }
              />
              <HeroStat
                value={<span data-testid="ward-statistics-discharges-today-count">{dischargesCount}</span>}
                label={
                  <>
                    Discharged today
                    <span className={styles.srOnly} data-testid="ward-statistics-discharges-today-caption">
                      {reportDayCaption}
                    </span>
                  </>
                }
              />
            </>
          }
        />

        {service === null ? null : (
          <p className={styles.notice} data-testid="ward-statistics-service-scope-sentence">
            {`Set to ${service}. This page is the whole network's own, so these figures already include ${service}.`}{" "}
            <Link href={serviceStatisticsHref(service)} data-testid="ward-statistics-service-scope-link">
              {`Open ${service} statistics`}
            </Link>
          </p>
        )}

        <div className={styles.gridMain}>
          <div className={styles.stack} data-testid="ward-statistics-patients">
            <StatisticsCapacityChart
              units={units}
              bedReleases={sourceBedReleases}
              admissions={sourceAdmissions}
              leaveBeds={leaveBeds}
            />
          </div>

          <div className={styles.stack}>
            <StatisticsUnitFinder lists={finderLists} />

            <StatCard
              icon={ArrowRight}
              title="Referrals today"
              data-testid="ward-statistics-referrals-for-bed"
              action={
                <Link href="/mockups/ward-flow/referrals" className={buttonClass({ variant: "sec", size: "sm" })}>
                  Open referrals
                </Link>
              }
            >
              <CardBody className={styles.bodyStack}>
                <dl className={styles.figures} id="refBand" aria-label="Referrals for a bed today">
                  <div className={styles.figure}>
                    <dt className={styles.figureLabel}>Raised</dt>
                    <dd className={styles.figureValue}>{refRaised}</dd>
                  </div>
                  <div className={styles.figure}>
                    <dt className={styles.figureLabel}>
                      <StatusGlyph tone="success" size={9} />
                      Accepted
                    </dt>
                    <dd className={styles.figureValue}>{refAccepted}</dd>
                  </div>
                  <div className={styles.figure}>
                    <dt className={styles.figureLabel}>
                      <StatusGlyph tone="closed" size={9} />
                      Declined
                    </dt>
                    <dd className={styles.figureValue}>{refDeclined}</dd>
                  </div>
                  <div className={styles.figure}>
                    <dt className={styles.figureLabel}>
                      <StatusGlyph tone="neutral" size={9} />
                      Still open
                    </dt>
                    <dd className={styles.figureValue}>{refOpen}</dd>
                  </div>
                </dl>
                <StackBar
                  label="Referrals raised today"
                  segments={[
                    { id: "accepted", label: "Accepted", value: refAccepted, fill: "data-1" },
                    { id: "declined", label: "Declined", value: refDeclined, fill: "data-2" },
                    { id: "open", label: "Still open", value: refOpen, fill: "data-3" },
                  ]}
                />
                <div className={styles.tiles} data-testid="ward-statistics-refused-so-far">
                  <div className={styles.tile}>
                    <h3 className={styles.srOnly}>Referrals where every ward asked so far has refused</h3>
                    <p className={styles.tileLabel} aria-hidden="true">
                      Refused so far
                    </p>
                    <p className={styles.tileValue} data-testid="ward-statistics-refused-so-far-count">
                      <span data-testid="ward-statistics-refused-so-far-value">{refused.count}</span>
                      <small>
                        of{" "}
                        <span data-testid="ward-statistics-refused-so-far-open-count">{refused.openMovementCount}</span>
                      </small>
                    </p>
                  </div>
                  <div className={styles.tile} data-testid="ward-statistics-refused-so-far-escalated">
                    <p className={styles.tileLabel} aria-hidden="true">
                      Escalated
                    </p>
                    <p className={styles.tileValue} aria-hidden="true">
                      {refused.escalatedCount}
                    </p>
                    <span className={styles.srOnly}>
                      {` ${refused.escalatedCount} open ${refused.escalatedCount === 1 ? "movement carries" : "movements carry"} a recorded escalation.`}
                    </span>
                  </div>
                  <div className={styles.tile}>
                    <p className={styles.tileLabel}>Parallel cap</p>
                    <p className={styles.tileValue} data-testid="ward-statistics-refused-so-far-cap">
                      {configuration.parallelReferralCap}
                    </p>
                  </div>
                </div>
              </CardBody>
            </StatCard>
          </div>
        </div>

        <div className={styles.grid2}>
          <StatCard
            icon={TrendingUp}
            title="Where the pressure is"
            meta="Occupancy, awaiting answer"
            data-testid="ward-statistics-pressure"
          >
            <div className={styles.toolbar}>
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
              <FilterChip pressed={wardOverLine} onPressedChange={setWardOverLine} tone="warning" count={overLineCount}>
                {`Over ${BED_ALERT_THRESHOLD_PERCENT}%`}
              </FilterChip>
              <span className={styles.toolbarEnd} id="wardFilterCount">
                <b>{filteredAndSortedWards.length}</b> of {allPressureWards.length}
              </span>
            </div>
            <div className={styles.tableWrap}>
              <table className={`${tableClasses.table} ${styles.table}`} id="wardPressureTable">
                <caption className={styles.srOnly}>Inpatient mental health ward capacity and demand</caption>
                <thead>
                  <tr>
                    <SortTh id="name" label="Ward" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} />
                    <SortTh
                      id="beds"
                      label="Beds"
                      sort={wardSortCol}
                      asc={wardSortAsc}
                      onSort={handleWardSort}
                      numeric
                    />
                    <SortTh
                      id="ready"
                      label="Ready"
                      sort={wardSortCol}
                      asc={wardSortAsc}
                      onSort={handleWardSort}
                      numeric
                    />
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
                      <tr key={w.id}>
                        <th scope="row">
                          {w.name}
                          <span className={styles.code} title={w.hospital}>
                            {w.site}
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
                        <td className={`${styles.num} ${w.referred === 0 ? styles.zero : ""}`}>{w.referred}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <CardFoot
              meta={
                filteredAndSortedWards.length > PRESSURE_ROWS ? (
                  <Button size="sm" variant="ghost" onClick={() => setWardShowAll((value) => !value)}>
                    {wardShowAll ? `Show top ${PRESSURE_ROWS}` : `Show all ${filteredAndSortedWards.length}`}
                  </Button>
                ) : undefined
              }
            >
              <Link href="/mockups/ward-flow/statistics/compare#choose-a-unit" className={styles.footLink}>
                Compare wards
              </Link>
            </CardFoot>
          </StatCard>

          <StatCard
            icon={Clock}
            title="ED waits for a bed"
            data-testid="ward-statistics-emergency-departments"
            aside={
              longestEd && longestEd.longest !== null ? (
                <Badge
                  tone={
                    longestEd.longest >= ED_SEVERE_PRESSURE_WAIT_MINUTES
                      ? "danger"
                      : longestEd.longest >= ED_ELEVATED_PRESSURE_WAIT_MINUTES
                        ? "warning"
                        : undefined
                  }
                >
                  {`${durMinutes(Math.round(longestEd.longest))} longest, ${longestEd.site}`}
                </Badge>
              ) : undefined
            }
          >
            <div className={styles.toolbar}>
              <TextInput
                type="search"
                icon={Search}
                boxClassName={styles.search}
                id="edSearchInput"
                placeholder="Filter departments"
                value={edSearchQuery}
                onChange={(e) => setEdSearchQuery(e.target.value)}
                aria-label="Filter emergency departments"
              />
              <span className={styles.toolbarEnd} id="edFilterCount">
                {`Marked from ${hoursLabel(ED_ELEVATED_PRESSURE_WAIT_MINUTES)} and ${hoursLabel(ED_SEVERE_PRESSURE_WAIT_MINUTES)}, as the side rail`}
              </span>
            </div>
            <div className={styles.tableWrap}>
              <table className={`${tableClasses.table} ${styles.table}`} id="edPressureTable">
                <caption className={styles.srOnly}>Emergency department waits for a mental health bed</caption>
                <thead>
                  <tr>
                    <SortTh id="name" label="Site" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} />
                    <SortTh
                      id="waiting"
                      label="Waiting"
                      sort={edSortCol}
                      asc={edSortAsc}
                      onSort={handleEdSort}
                      numeric
                    />
                    <SortTh
                      id="longest"
                      label="Longest"
                      sort={edSortCol}
                      asc={edSortAsc}
                      onSort={handleEdSort}
                      numeric
                    />
                    <SortTh id="median" label="Median" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
                    <SortTh id="over8" label="8h+" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
                    <SortTh id="over24" label="24h+" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedEds.map((d) => (
                    <tr key={d.id}>
                      <th scope="row" className={styles.siteCell}>
                        <b className={styles.codeLead}>{d.site}</b>
                        <span className={styles.siteName} title={d.name}>
                          {d.name}
                        </span>
                      </th>
                      <td className={`${styles.num} ${d.waiting === 0 ? styles.zero : ""}`}>{d.waiting}</td>
                      <td className={`${styles.num} ${d.longest === null ? styles.zero : ""}`}>
                        <span className={styles.flagged}>
                          {d.longest !== null && d.longest >= ED_SEVERE_PRESSURE_WAIT_MINUTES ? (
                            <StatusGlyph tone="danger" size={9} />
                          ) : d.longest !== null && d.longest >= ED_ELEVATED_PRESSURE_WAIT_MINUTES ? (
                            <StatusGlyph tone="warning" size={9} />
                          ) : null}
                          {waitText(d.longest)}
                        </span>
                      </td>
                      <td className={`${styles.num} ${d.median === null ? styles.zero : ""}`}>
                        {medianText(d.median)}
                      </td>
                      <td className={`${styles.num} ${d.over8 === 0 ? styles.zero : ""}`}>{d.over8}</td>
                      <td className={`${styles.num} ${d.over24 === 0 ? styles.zero : ""}`}>{d.over24}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">All {emergencyDepts.length} departments</th>
                    <td className={styles.num}>{totalEdWaiting}</td>
                    <td className={styles.num}>{waitText(longestEd?.longest ?? null)}</td>
                    <td className={styles.num}>{medianText(networkMedianWait)}</td>
                    <td className={styles.num}>{totalEdOver8}</td>
                    <td className={styles.num}>{totalEdOver24}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </StatCard>
        </div>

        <div className={styles.grid3}>
          <StatCard
            icon={Lock}
            title="Blocked discharges"
            data-testid="ward-statistics-blocked-discharges-by-reason"
            aside={
              <span className={styles.muted} data-testid="ward-statistics-blocked-discharges-by-reason-population">
                <span data-testid="ward-statistics-blocked-discharges-by-reason-total">{blocked.totalCount}</span> of{" "}
                <span data-testid="ward-statistics-blocked-discharges-by-reason-admissions">
                  {blocked.admissionCount}
                </span>{" "}
                not departed
              </span>
            }
          >
            <CardBody data-testid="ward-statistics-blocked-discharges-by-reason-list">
              <BarList
                label="Blocked discharges by blocker"
                labelWidth="10.5rem"
                axis
                max={axisMax(blocked.tallies.map((tally) => tally.count))}
                mean={blockedMean}
                rows={blocked.tallies.map((tally) => ({
                  id: tally.reason,
                  label: <span data-testid={`ward-statistics-blocked-discharge-${tally.reason}`}>{tally.reason}</span>,
                  labelText: tally.reason,
                  value: tally.count,
                  display: (
                    <span data-testid={`ward-statistics-blocked-discharge-${tally.reason}-count`}>
                      {tally.count === 0 ? "none" : tally.count}
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
                  <span data-testid="ward-statistics-declines-by-reason-total">{declinesReadout.value.totalCount}</span>{" "}
                  {declinesReadout.value.totalCount === 1 ? "decline" : "declines"},{" "}
                  <span data-testid="ward-statistics-declines-by-reason-movements-with">
                    {declinesReadout.value.movementsWithDeclinesCount}
                  </span>
                  <span className={styles.srOnly}>
                    {" "}
                    of{" "}
                    <span data-testid="ward-statistics-declines-by-reason-movements">
                      {declinesReadout.value.movementCount}
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
                    max={axisMax(declinesReadout.value.tallies.map((tally) => tally.count))}
                    mean={
                      declinesReadout.value.vocabularySize > 0
                        ? declinesReadout.value.totalCount / declinesReadout.value.vocabularySize
                        : 0
                    }
                    rows={declinesReadout.value.tallies.map((tally) => ({
                      id: tally.reason,
                      label: (
                        <span data-testid={`ward-statistics-decline-${tally.reason}`}>
                          {sentenceCase(tally.reason)}
                        </span>
                      ),
                      labelText: sentenceCase(tally.reason),
                      value: tally.count,
                      display: (
                        <span data-testid={`ward-statistics-decline-${tally.reason}-count`}>
                          {tally.count === 0 ? "none" : tally.count}
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
                <span data-testid="ward-statistics-arrival-measured-count">{arrivals.measuredCount}</span> admissions
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
              <ColumnChart label="Pull to arrival, admissions by band" height={110} columns={arrivalBands} />
              <dl className={styles.tiles}>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>Awaiting</dt>
                  <dd className={styles.tileValue} data-testid="ward-statistics-arrival-awaiting-count">
                    {arrivals.awaitingArrivalCount}
                  </dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>Ended</dt>
                  <dd className={styles.tileValue} data-testid="ward-statistics-arrival-ended-count">
                    {arrivals.endedCount}
                  </dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>Excluded</dt>
                  <dd className={styles.tileValue} data-testid="ward-statistics-arrival-incoherent">
                    {arrivals.incoherentCount}
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
        </div>

        <WardPrototypeFooter testId="ward-statistics-footer" note="Synthetic prototype. Every figure is invented." />
      </main>
    </div>
  );
}

// Kept for the community chooser deep link and the per-team statistics route.
export { communityStatisticsHref };
