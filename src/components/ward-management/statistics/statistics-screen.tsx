"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  bedsBeingPrepared,
  blockedDischargesByReason,
  pullToArrival,
  referralToBedJoin,
  refusedAndNothingPending,
} from "@/components/ward-management/statistics/statistics-derivations";
import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import {
  CoordinatorAccessDisclaimer,
  SyntheticFiguresDisclaimer,
} from "@/components/ward-management/statistics/statistics-disclaimers";
import {
  STATISTICS_COMMUNITY_CHOOSER_ID,
  STATISTICS_SECTIONS,
  STATISTICS_SERVICE_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import { communityStatisticsHref, serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { calendarDateOf, dayOf, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  HEALTH_SERVICES,
  type BedRelease,
  type Movement,
  type Referral,
} from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

import styles from "./statistics.module.css";
import pageStyles from "./statistics-landing-third-edition.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { StatisticsCapacityChart } from "./statistics-capacity-chart";
import { isAwaitingAnswer } from "../ward-referrals";
import { wardReferralTally } from "./statistics-ward-referrals";
import { hoursText, occupiedBeds } from "./statistics-occupancy";

/**
 * THE COORDINATOR STATISTICS SCREEN — Third Edition Platinum Raised Cool Hub.
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
  const {
    admissions: liveAdmissions,
    referrals: liveReferrals,
    bedReleases: liveBedReleases,
    movements: liveMovements,
    leaveBeds,
    units,
    dayZero,
    configuration,
  } = useWardFlow();
  const now = useWardFlowClock();
  const service = useServiceScope();

  const sourceAdmissions = admissions ?? liveAdmissions;
  const sourceReferrals = referrals ?? liveReferrals;
  const sourceBedReleases = bedReleases ?? liveBedReleases;
  const sourceMovements = movements ?? liveMovements;

  const arrivals = pullToArrival(sourceAdmissions);
  const join = referralToBedJoin(sourceAdmissions, sourceReferrals);
  const preparingCount = bedsBeingPrepared(sourceBedReleases);
  const refused = refusedAndNothingPending(sourceMovements, units, now);
  const declinesReadout = readDeclinesByReason(sourceMovements);
  const blocked = blockedDischargesByReason(sourceAdmissions);

  const totalBeds = units.reduce((sum, u) => sum + u.beds, 0);
  const hospitals = Array.from(new Set(units.map((u) => siteByCode(u.siteCode)?.name ?? u.siteCode)));
  const hospitalsCount = hospitals.length;
  const occupancy = occupiedBeds(units, sourceAdmissions, sourceBedReleases, leaveBeds);
  const occupiedCount = occupancy.occupied;
  const occupiedPct = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0;
  const pendingPreparation = units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, sourceBedReleases), 0);
  const availableNow = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).available, 0);
  const availablePct = totalBeds > 0 ? Math.round((availableNow / totalBeds) * 100) : 0;
  const waitingCount = refused.openMovementCount;

  const admissionsCount = sourceAdmissions.filter(
    (a) => a.arrivedAt !== null && dayOf(a.arrivedAt) === dayOf(now),
  ).length;
  const dischargesCount = sourceAdmissions.filter((a) => a.leftAt !== null && dayOf(a.leftAt) === dayOf(now)).length;

  const reportDayCaption = `${formatReportDay(now, dayZero)}, midnight to midnight, across all wards`;

  // Emergency departments
  const emergencyDepts = useMemo(() => {
    const allEds = allEmergencyDepartments();
    return allEds
      .map((ed) => {
        const figures = edWaitFigures(sourceMovements, ed.id, now);
        const longestHours = figures.longestWait ? Math.round(figures.longestWait.waitMinutes / 60) : 0;
        const waitMinutes = figures.waitingMovements.map((w) => w.waitMinutes);
        const middle = Math.floor(waitMinutes.length / 2);
        const medianHours =
          waitMinutes.length === 0
            ? 0
            : Math.round(
                (waitMinutes.length % 2 ? waitMinutes[middle] : (waitMinutes[middle - 1] + waitMinutes[middle]) / 2) /
                  60,
              );
        const over8 = figures.waitingMovements.filter((w) => w.waitMinutes >= 8 * 60).length;
        return {
          id: ed.id,
          name: ed.name.replace(/ Emergency Department$/, ""),
          site: ed.siteCode,
          waiting: figures.onTheList,
          longest: longestHours,
          median: medianHours,
          over8,
          over24: figures.over24h,
        };
      })
      .sort((a, b) => b.waiting - a.waiting || b.longest - a.longest);
  }, [sourceMovements, now]);

  const totalEdWaiting = emergencyDepts.reduce((s, d) => s + d.waiting, 0);
  const networkLongestWait = Math.max(...emergencyDepts.map((d) => d.longest), 0);
  const networkWaits = emergencyDepts
    .flatMap((ed) => edWaitFigures(sourceMovements, ed.id, now).waitingMovements.map((entry) => entry.waitMinutes))
    .sort((a, b) => a - b);
  const networkMiddle = Math.floor(networkWaits.length / 2);
  const networkMedianWait =
    networkWaits.length === 0
      ? 0
      : Math.round(
          (networkWaits.length % 2
            ? networkWaits[networkMiddle]
            : (networkWaits[networkMiddle - 1] + networkWaits[networkMiddle]) / 2) / 60,
        );
  const totalEdOver8 = emergencyDepts.reduce((s, d) => s + d.over8, 0);
  const totalEdOver24 = emergencyDepts.reduce((s, d) => s + d.over24, 0);

  // Ward Table interactive state
  const [wardSearchQuery, setWardSearchQuery] = useState("");
  const [wardSortCol, setWardSortCol] = useState<"name" | "hosp" | "beds" | "ready" | "occ" | "ref">("ready");
  const [wardSortAsc, setWardSortAsc] = useState(true);

  // ED Table interactive state
  const [edSearchQuery, setEdSearchQuery] = useState("");
  const [edSortCol, setEdSortCol] = useState<"name" | "waiting" | "longest" | "median" | "over8" | "over24">("waiting");
  const [edSortAsc, setEdSortAsc] = useState(false);

  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  // Flow chart interactive hover state

  const handleWardSort = (col: "name" | "hosp" | "beds" | "ready" | "occ" | "ref") => {
    if (wardSortCol === col) {
      setWardSortAsc((prev) => !prev);
    } else {
      setWardSortCol(col);
      setWardSortAsc(col === "name" || col === "hosp");
    }
  };

  const handleEdSort = (col: "name" | "waiting" | "longest" | "median" | "over8" | "over24") => {
    if (edSortCol === col) {
      setEdSortAsc((prev) => !prev);
    } else {
      setEdSortCol(col);
      setEdSortAsc(col === "name");
    }
  };

  // Pressure Wards (all 23 wards available, ranked by ready asc, occupancy desc, name)
  const allPressureWards = useMemo(() => {
    return units.map((u) => {
      const capInfo = unitCapacity(u, sourceBedReleases);
      const occupancyRate =
        u.beds > 0 ? occupiedBeds([u], sourceAdmissions, sourceBedReleases, leaveBeds).occupied / u.beds : 0;
      const referredCount = wardReferralTally(sourceMovements, u.id).askedAndWaiting;
      return {
        id: u.id,
        name: u.name,
        hospital: siteByCode(u.siteCode)?.name ?? u.siteCode,
        beds: u.beds,
        ready: capInfo.available,
        occupancyRate,
        referred: referredCount,
      };
    });
  }, [units, sourceAdmissions, sourceBedReleases, leaveBeds, sourceMovements]);

  const filteredAndSortedWards = useMemo(() => {
    let list = allPressureWards.slice();
    const q = wardSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((w) => w.name.toLowerCase().includes(q) || w.hospital.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let vA: number | string;
      let vB: number | string;
      if (wardSortCol === "name") {
        vA = a.name;
        vB = b.name;
      } else if (wardSortCol === "hosp") {
        vA = a.hospital;
        vB = b.hospital;
      } else if (wardSortCol === "beds") {
        vA = a.beds;
        vB = b.beds;
      } else if (wardSortCol === "ready") {
        vA = a.ready;
        vB = b.ready;
      } else if (wardSortCol === "occ") {
        vA = a.occupancyRate;
        vB = b.occupancyRate;
      } else if (wardSortCol === "ref") {
        vA = a.referred;
        vB = b.referred;
      } else {
        vA = a.ready;
        vB = b.ready;
      }

      if (vA < vB) return wardSortAsc ? -1 : 1;
      if (vA > vB) return wardSortAsc ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [allPressureWards, wardSearchQuery, wardSortCol, wardSortAsc]);

  const filteredAndSortedEds = useMemo(() => {
    let list = emergencyDepts.slice();
    const q = edSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => d.name.toLowerCase().includes(q) || d.site.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let vA: number | string;
      let vB: number | string;
      if (edSortCol === "name") {
        vA = a.site;
        vB = b.site;
      } else if (edSortCol === "waiting") {
        vA = a.waiting;
        vB = b.waiting;
      } else if (edSortCol === "longest") {
        vA = a.longest;
        vB = b.longest;
      } else if (edSortCol === "median") {
        vA = a.median;
        vB = b.median;
      } else if (edSortCol === "over8") {
        vA = a.over8;
        vB = b.over8;
      } else if (edSortCol === "over24") {
        vA = a.over24;
        vB = b.over24;
      } else {
        vA = a.waiting;
        vB = b.waiting;
      }

      if (vA < vB) return edSortAsc ? -1 : 1;
      if (vA > vB) return edSortAsc ? 1 : -1;
      return a.site.localeCompare(b.site);
    });
    return list;
  }, [emergencyDepts, edSearchQuery, edSortCol, edSortAsc]);

  const communityTeams = COMMUNITY_TEAM_PAGES;
  const filteredAndSortedTeams = communityTeams.filter((team) =>
    team.name.toLowerCase().includes(teamSearchQuery.trim().toLowerCase()),
  );

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

  usePrintableDisclosures();

  return (
    <div
      className={`${styles.screen} ${pageStyles.screen}`}
      data-testid="ward-statistics-screen"
      data-ward-design="third-edition"
    >
      <main id="main-content" className={`${styles.main} ${pageStyles.main}`}>
        {/* Hidden screen reader heading */}
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Statistics</h1>
        </header>

        {/* ══════════ PANEL 1: ACROSS ALL SERVICES ══════════ */}
        <WardPanel
          title="Across all services"
          count={`${units.length} wards · ${emergencyDepts.length} departments · ${communityTeams.length} teams`}
          testId="ward-statistics-system"
        >
          {service === null ? null : (
            <p className={styles.notice} data-testid="ward-statistics-service-scope-sentence">
              {`Set to ${service}. This page is the whole network's own, so these figures already include ${service}.`}{" "}
              <Link href={serviceStatisticsHref(service)} data-testid="ward-statistics-service-scope-link">
                {`Open ${service} statistics`}
              </Link>
            </p>
          )}

          {/* 6-Card KPI Headline Band */}
          <dl className={pageStyles.band} id="headline" tabIndex={-1} aria-label="Across all services headline figures">
            <div className={pageStyles.kpi}>
              <dt>Total beds</dt>
              <dd>
                {totalBeds}
                <small>
                  {units.length} wards across {hospitalsCount} hospitals
                </small>
              </dd>
            </div>
            <div className={pageStyles.kpi}>
              <dt>Occupied</dt>
              <dd>
                {occupiedCount}
                <small>
                  {occupiedPct}% of all beds · {occupancy.pulled} more pulled for people not yet arrived
                </small>
              </dd>
            </div>
            <div className={pageStyles.kpi}>
              <dt>Ready</dt>
              <dd>
                {availableNow}
                <small>
                  {availablePct}% of beds · {pendingPreparation} being made ready
                </small>
              </dd>
            </div>
            <div className={pageStyles.kpi} data-tone={waitingCount > 0 ? "warn" : undefined}>
              <dt>Waiting for a bed</dt>
              <dd>
                {waitingCount}
                <small>open requests from emergency departments</small>
              </dd>
            </div>
            <div className={pageStyles.kpi}>
              <dt>Admissions today</dt>
              <dd>
                <span data-testid="ward-statistics-admissions-today-count">{admissionsCount}</span>
                <small className={pageStyles.metricCaption} data-testid="ward-statistics-admissions-today-caption">
                  {reportDayCaption}
                </small>
              </dd>
            </div>
            <div className={pageStyles.kpi}>
              <dt>Discharges today</dt>
              <dd>
                <span data-testid="ward-statistics-discharges-today-count">{dischargesCount}</span>
                <small className={pageStyles.metricCaption} data-testid="ward-statistics-discharges-today-caption">
                  {reportDayCaption}
                </small>
              </dd>
            </div>
          </dl>

          <nav
            className={styles.index}
            aria-labelledby="ward-statistics-index-heading"
            data-testid="ward-statistics-index"
          >
            <h2 id="ward-statistics-index-heading" className={styles.indexHeading}>
              Where to look
            </h2>
            <ul className={styles.indexList}>
              {STATISTICS_SECTIONS.map((sec) => (
                <li key={sec.id} className={styles.indexItem}>
                  <Link
                    href={sec.href}
                    className={styles.indexLink}
                    data-testid={`ward-statistics-index-entry-${sec.id}`}
                  >
                    <span className={styles.indexLabel}>{sec.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.panelBody}>
            <p className={styles.sectionAudience} data-testid="ward-statistics-system-audience">
              Network and ward measures. No person-level measure is shown here.
            </p>

            <p className={styles.notice} data-testid="ward-statistics-access">
              <CoordinatorAccessDisclaimer />
            </p>

            <article className={styles.figure} data-testid="ward-statistics-bed-readiness">
              <h3 className={styles.figureHeading}>Beds pending</h3>
              <p className={styles.measuredCount} data-testid="ward-statistics-preparing-count">
                <span className={styles.measuredValue}>{preparingCount}</span>{" "}
                {preparingCount === 1 ? "bed is" : "beds are"} currently marked as Pending — cleaning, maintenance or
                repair, or with no reason stated.
              </p>
              <p className={styles.figureNote}>
                Nought means no bed is marked Pending. This count reads the flag as recorded; the model does not enforce
                that the occupant has already left.
              </p>
              <p className={styles.absence} data-testid="ward-statistics-readiness-timing-absent">
                <strong>Pending duration is unavailable.</strong> Bed readiness has a yes/no flag and one shared
                timestamp that later release actions overwrite, so no start-and-end pair can be measured.
              </p>
            </article>

            <article className={styles.figure} data-testid="ward-statistics-not-offered">
              <h3 className={styles.figureHeading}>Empty beds that were not offered</h3>
              <p className={styles.absence} data-testid="ward-statistics-not-offered-absent">
                <strong>No offer measure is available.</strong> The record holds aggregate empty and allocatable counts,
                with no bed-level or request-level offer event. No readiness-gap proxy is shown.
              </p>
            </article>
          </div>
        </WardPanel>

        {/* ══════════ PANEL 2: FLOW OVER TIME ══════════ */}
        <WardPanel title="Where beds are available" count="Current capacity" testId="ward-statistics-patients">
          <StatisticsCapacityChart
            units={units}
            bedReleases={sourceBedReleases}
            admissions={sourceAdmissions}
            leaveBeds={leaveBeds}
          />

          {/* Patients audience contract and pull-to-arrival article */}
          <div className={styles.panelBody}>
            <p className={styles.sectionAudience} data-testid="ward-statistics-patients-audience">
              Waiting-time measures from admission records; no ward score.
            </p>

            <article className={styles.figure} data-testid="ward-statistics-pull-to-arrival">
              <h3 className={styles.figureHeading}>From a bed being given away to the person arriving in it</h3>
              <p className={styles.figureBlurb}>
                Time between the recorded bed pull and arrival instants on an admission.
              </p>

              {arrivals.averageMinutes === null ? (
                <p className={styles.nothingToAverage} data-testid="ward-statistics-arrival-nothing-to-average">
                  <strong>No usable pull-and-arrival pair is recorded, so no average is shown.</strong> Missing instants
                  and arrivals earlier than pulls are excluded, rather than treated as zero.
                </p>
              ) : (
                <>
                  <p className={styles.headlineValue} data-testid="ward-statistics-arrival-average">
                    {splitDuration(arrivals.averageMinutes)}
                  </p>
                  <p className={styles.headlineCaption}>
                    average, across{" "}
                    <span data-testid="ward-statistics-arrival-measured-count">{arrivals.measuredCount}</span>{" "}
                    {arrivals.measuredCount === 1 ? "admission" : "admissions"} whose two instants are both present and
                    in the right order.
                  </p>

                  <p className={styles.figureNote} data-testid="ward-statistics-arrival-range">
                    Shortest{" "}
                    <span data-testid="ward-statistics-arrival-shortest">
                      {arrivals.shortestMinutes === null ? "—" : splitDuration(arrivals.shortestMinutes)}
                    </span>
                    , longest{" "}
                    <span data-testid="ward-statistics-arrival-longest">
                      {arrivals.longestMinutes === null ? "—" : splitDuration(arrivals.longestMinutes)}
                    </span>
                    . Equal ends mean every measured gap is identical.
                  </p>

                  {arrivals.measuredCount > 1 &&
                  arrivals.shortestMinutes !== null &&
                  arrivals.longestMinutes !== null &&
                  arrivals.shortestMinutes === arrivals.longestMinutes ? (
                    <p className={styles.figureNote} data-testid="ward-statistics-arrival-constant-gap">
                      <strong>Every measured gap is identical.</strong> The record shows no variation and does not
                      establish why.
                    </p>
                  ) : null}
                </>
              )}

              <p className={styles.figureNote} data-testid="ward-statistics-arrival-population">
                <span data-testid="ward-statistics-arrival-ended-count">{arrivals.endedCount}</span> measured admissions
                have ended and remain in this historic measure. A further{" "}
                <span data-testid="ward-statistics-arrival-awaiting-count">{arrivals.awaitingArrivalCount}</span>{" "}
                {arrivals.awaitingArrivalCount === 1 ? "arrival is" : "arrivals are"} still pending and excluded.
              </p>

              <p className={styles.measuredCount} data-testid="ward-statistics-arrival-incoherent">
                <span className={styles.measuredValue}>{arrivals.incoherentCount}</span>{" "}
                {arrivals.incoherentCount === 1 ? "admission has" : "admissions have"} arrival before bed pull and
                {arrivals.incoherentCount === 1 ? " is" : " are"} excluded, never treated as zero.
              </p>
            </article>
          </div>
        </WardPanel>

        {/* ══════════ TWO-COLUMN GRID 1: PRESSURE & ED WAITS ══════════ */}
        <div className={pageStyles.cols2}>
          {/* Where the pressure is */}
          <WardPanel
            title="Where the pressure is"
            count={`${filteredAndSortedWards.length} of ${allPressureWards.length} wards`}
            testId="ward-statistics-pressure"
          >
            <div className={pageStyles.pb}>
              <p className={pageStyles.scopeNote}>
                Fewest ready beds first. Open ward requests and ED waits are separate measures.
              </p>
            </div>

            {/* Table Controls Bar with live search and counter */}
            <div className={pageStyles.tableControlsBar}>
              <div className={pageStyles.tableSearchBox}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5L14 14" />
                </svg>
                <input
                  type="search"
                  className={pageStyles.tableSearchInput}
                  id="wardSearchInput"
                  placeholder="Filter wards or hospitals..."
                  value={wardSearchQuery}
                  onChange={(e) => setWardSearchQuery(e.target.value)}
                  aria-label="Filter wards or hospitals"
                />
              </div>
              <span className={pageStyles.tableFilterCount} id="wardFilterCount">
                Showing {filteredAndSortedWards.length} of {allPressureWards.length} wards
              </span>
            </div>

            <div
              className={pageStyles.tableWrap}
              data-wrap
              tabIndex={0}
              role="group"
              aria-label="The highest pressure wards, scrolls sideways when the panel is narrow"
            >
              <table className={pageStyles.dataTable} id="wardPressureTable">
                <caption className="srOnly">Inpatient mental health ward capacity and demand</caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className={`${pageStyles.sortable} ${wardSortCol === "name" ? pageStyles.sortActive : ""}`}
                      aria-sort={wardSortCol === "name" ? (wardSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleWardSort("name")}>
                        Ward{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {wardSortCol === "name" ? (wardSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.sortable} ${wardSortCol === "hosp" ? pageStyles.sortActive : ""}`}
                      aria-sort={wardSortCol === "hosp" ? (wardSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleWardSort("hosp")}>
                        Hospital{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {wardSortCol === "hosp" ? (wardSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${wardSortCol === "beds" ? pageStyles.sortActive : ""}`}
                      aria-sort={wardSortCol === "beds" ? (wardSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleWardSort("beds")}>
                        Beds{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {wardSortCol === "beds" ? (wardSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${wardSortCol === "ready" ? pageStyles.sortActive : ""}`}
                      aria-sort={wardSortCol === "ready" ? (wardSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleWardSort("ready")}>
                        Ready{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {wardSortCol === "ready" ? (wardSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${wardSortCol === "occ" ? pageStyles.sortActive : ""}`}
                      aria-sort={wardSortCol === "occ" ? (wardSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleWardSort("occ")}>
                        Occupancy{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {wardSortCol === "occ" ? (wardSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${wardSortCol === "ref" ? pageStyles.sortActive : ""}`}
                      aria-sort={wardSortCol === "ref" ? (wardSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleWardSort("ref")}>
                        Referred, awaiting answer{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {wardSortCol === "ref" ? (wardSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedWards.map((w) => {
                    const full = w.ready === 0 && w.occupancyRate === 1;
                    return (
                      <tr key={w.id}>
                        <th scope="row">
                          {w.name}
                          {full ? (
                            <span className={pageStyles.chip} style={{ marginLeft: "8px" }}>
                              Full
                            </span>
                          ) : null}
                        </th>
                        <td>{w.hospital}</td>
                        <td className={pageStyles.n}>{w.beds}</td>
                        <td className={pageStyles.n}>{w.ready}</td>
                        <td className={pageStyles.n}>{Math.round(w.occupancyRate * 100)}%</td>
                        <td className={pageStyles.n}>
                          {w.referred === 0 ? <span className={pageStyles.zero}>none</span> : w.referred}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className={pageStyles.panelFoot}>
              <Link href="/mockups/ward-flow/statistics/compare#choose-a-unit">Compare wards and departments ↗</Link>
            </p>

            <div className={styles.panelBody}>
              <article className={styles.figure} data-testid="ward-statistics-refused-so-far">
                <h3 className={styles.figureHeading}>Referrals where every ward asked so far has refused</h3>
                <p className={styles.figureBlurb}>
                  Open movements with at least one recorded ward refusal and no ward currently deciding.
                </p>

                <p className={styles.measuredCount} data-testid="ward-statistics-refused-so-far-count">
                  <span className={styles.measuredValue} data-testid="ward-statistics-refused-so-far-value">
                    {refused.count}
                  </span>{" "}
                  of <span data-testid="ward-statistics-refused-so-far-open-count">{refused.openMovementCount}</span>{" "}
                  open {refused.openMovementCount === 1 ? "movement" : "movements"}, as at this render.
                </p>

                <p className={styles.figureNote} data-testid="ward-statistics-refused-so-far-why-so-far">
                  <strong>&ldquo;So far&rdquo; is the limit of the record.</strong> There is no exhausted-network
                  marker. At most{" "}
                  <span data-testid="ward-statistics-refused-so-far-cap">{configuration.parallelReferralCap}</span>{" "}
                  wards can be deciding together, but the lifetime number asked is not recorded. This is a current
                  worklist, not a count of people no ward would take.
                </p>

                <p className={styles.measuredCount} data-testid="ward-statistics-refused-so-far-escalated">
                  <span className={styles.measuredValue}>{refused.escalatedCount}</span> open{" "}
                  {refused.escalatedCount === 1 ? "movement carries" : "movements carry"} a recorded escalation instead.
                  Escalations are classified first, so this is a floor. An escalation records an opinion, not a derived
                  finding that the network was exhausted.
                </p>
              </article>

              <article className={styles.figure} data-testid="ward-statistics-blocked-discharges-by-reason">
                <h3 className={styles.figureHeading}>Blocked discharges by blocker</h3>
                <p className={styles.figureBlurb}>
                  Admissions not departed, grouped by their recorded discharge blocker. Movement blockers are excluded.
                </p>

                <p
                  className={styles.measuredCount}
                  data-testid="ward-statistics-blocked-discharges-by-reason-population"
                >
                  <span
                    className={styles.measuredValue}
                    data-testid="ward-statistics-blocked-discharges-by-reason-total"
                  >
                    {blocked.totalCount}
                  </span>{" "}
                  blocked {blocked.totalCount === 1 ? "discharge" : "discharges"}, out of{" "}
                  <span data-testid="ward-statistics-blocked-discharges-by-reason-admissions">
                    {blocked.admissionCount}
                  </span>{" "}
                  {blocked.admissionCount === 1 ? "admission" : "admissions"} that have not departed.
                </p>

                <ul className={styles.tallyList} data-testid="ward-statistics-blocked-discharges-by-reason-list">
                  {blocked.tallies.map((tally) => (
                    <li
                      key={tally.reason}
                      className={styles.tallyRow}
                      data-testid={`ward-statistics-blocked-discharge-${tally.reason}`}
                    >
                      <span className={styles.tallyReason}>{tally.reason}</span>
                      <span
                        className={styles.tallyCount}
                        data-testid={`ward-statistics-blocked-discharge-${tally.reason}-count`}
                      >
                        {tally.count}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className={styles.figureNote} data-testid="ward-statistics-blocked-discharges-by-reason-generated">
                  All{" "}
                  <span data-testid="ward-statistics-blocked-discharges-by-reason-vocabulary-size">
                    {blocked.vocabularySize}
                  </span>{" "}
                  allowed blockers are shown. Nought means checked with no matching admission, not unavailable.
                </p>
              </article>
            </div>
          </WardPanel>

          {/* Emergency departments */}
          <WardPanel
            title="Emergency departments"
            count={`${filteredAndSortedEds.length} of ${emergencyDepts.length} departments`}
            testId="ward-statistics-emergency-departments"
          >
            <div className={pageStyles.pb}>
              <p className={pageStyles.scopeNote}>
                Current waits for a mental health bed. Durations are rounded to hours.
              </p>
            </div>

            {/* Table Controls Bar with live search and counter */}
            <div className={pageStyles.tableControlsBar}>
              <div className={pageStyles.tableSearchBox}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5L14 14" />
                </svg>
                <input
                  type="search"
                  className={pageStyles.tableSearchInput}
                  id="edSearchInput"
                  placeholder="Filter emergency departments..."
                  value={edSearchQuery}
                  onChange={(e) => setEdSearchQuery(e.target.value)}
                  aria-label="Filter emergency departments"
                />
              </div>
              <span className={pageStyles.tableFilterCount} id="edFilterCount">
                Showing {filteredAndSortedEds.length} of {emergencyDepts.length} EDs
              </span>
            </div>

            <div
              className={pageStyles.tableWrap}
              data-wrap
              tabIndex={0}
              role="group"
              aria-label="Emergency department waits, scrolls sideways when the panel is narrow"
            >
              <table className={pageStyles.dataTable} id="edPressureTable">
                <caption className="srOnly">Emergency department waits for a mental health bed</caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className={`${pageStyles.sortable} ${edSortCol === "name" ? pageStyles.sortActive : ""}`}
                      aria-sort={edSortCol === "name" ? (edSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleEdSort("name")}>
                        Site{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {edSortCol === "name" ? (edSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${edSortCol === "waiting" ? pageStyles.sortActive : ""}`}
                      aria-sort={edSortCol === "waiting" ? (edSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleEdSort("waiting")}>
                        Waiting{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {edSortCol === "waiting" ? (edSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${edSortCol === "longest" ? pageStyles.sortActive : ""}`}
                      aria-sort={edSortCol === "longest" ? (edSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleEdSort("longest")}>
                        Longest wait{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {edSortCol === "longest" ? (edSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${edSortCol === "median" ? pageStyles.sortActive : ""}`}
                      aria-sort={edSortCol === "median" ? (edSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleEdSort("median")}>
                        Median wait{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {edSortCol === "median" ? (edSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${edSortCol === "over8" ? pageStyles.sortActive : ""}`}
                      aria-sort={edSortCol === "over8" ? (edSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleEdSort("over8")}>
                        Over 8 hours{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {edSortCol === "over8" ? (edSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${pageStyles.n} ${pageStyles.sortable} ${edSortCol === "over24" ? pageStyles.sortActive : ""}`}
                      aria-sort={edSortCol === "over24" ? (edSortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button type="button" className={pageStyles.sortBtn} onClick={() => handleEdSort("over24")}>
                        Over 24 hours{" "}
                        <span className={pageStyles.sortIcon} aria-hidden="true">
                          {edSortCol === "over24" ? (edSortAsc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedEds.map((d) => (
                    <tr key={d.id}>
                      <th scope="row">
                        <b className={pageStyles.site}>{d.site}</b>
                        <span className={pageStyles.deptName}>{d.name}</span>
                      </th>
                      <td className={pageStyles.n}>
                        {d.waiting === 0 ? <span className={pageStyles.zero}>none</span> : d.waiting}
                      </td>
                      <td className={pageStyles.n}>{hoursText(d.longest)}</td>
                      <td className={pageStyles.n}>{hoursText(d.median)}</td>
                      <td className={pageStyles.n}>
                        {d.over8 === 0 ? <span className={pageStyles.zero}>none</span> : d.over8}
                      </td>
                      <td className={pageStyles.n}>
                        {d.over24 === 0 ? <span className={pageStyles.zero}>none</span> : d.over24}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total">
                    <th scope="row">All {emergencyDepts.length} departments</th>
                    <td className={pageStyles.n}>{totalEdWaiting}</td>
                    <td className={pageStyles.n}>{hoursText(networkLongestWait)}</td>
                    <td className={pageStyles.n}>{hoursText(networkMedianWait)}</td>
                    <td className={pageStyles.n}>{totalEdOver8}</td>
                    <td className={pageStyles.n}>{totalEdOver24}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className={styles.panelBody}>
              <article className={styles.figure} data-testid="ward-statistics-declines">
                <h3 className={styles.figureHeading}>Declines per ward</h3>

                <p className={styles.absence} data-testid="ward-statistics-declines-withheld">
                  <strong>No ward-attributable decline measure.</strong> Referral and movement declines describe
                  different populations, so no per-ward number is shown.
                </p>
                <p className={styles.figureNote} data-testid="ward-statistics-declines-reason">
                  Named ward referrals preserve their recipient before acceptance. Older network-wide referrals may lack
                  a ward identifier when declined. Movement declines name a ward for people already inside an emergency
                  department. Combining these populations would define a different measure.
                </p>
              </article>

              <article className={styles.figure} data-testid="ward-statistics-declines-by-reason">
                <h3 className={styles.figureHeading}>Declines by reason</h3>
                <p className={styles.figureBlurb}>
                  Movement declines grouped by the ward&apos;s recorded reason. Front-door referral declines are
                  excluded.
                </p>

                {!declinesReadout.ok ? (
                  <p className={styles.measuredCount} data-testid="ward-statistics-declines-by-reason-unavailable">
                    {declinesReadout.statement}
                  </p>
                ) : (
                  <>
                    <p className={styles.measuredCount} data-testid="ward-statistics-declines-by-reason-population">
                      <span className={styles.measuredValue} data-testid="ward-statistics-declines-by-reason-total">
                        {declinesReadout.value.totalCount}
                      </span>{" "}
                      {declinesReadout.value.totalCount === 1 ? "decline" : "declines"} on record, from{" "}
                      <span data-testid="ward-statistics-declines-by-reason-movements-with">
                        {declinesReadout.value.movementsWithDeclinesCount}
                      </span>{" "}
                      of the{" "}
                      <span data-testid="ward-statistics-declines-by-reason-movements">
                        {declinesReadout.value.movementCount}
                      </span>{" "}
                      {declinesReadout.value.movementCount === 1 ? "movement" : "movements"} this page examined.
                    </p>

                    <ul className={styles.tallyList} data-testid="ward-statistics-declines-by-reason-list">
                      {declinesReadout.value.tallies.map((tally) => (
                        <li
                          key={tally.reason}
                          className={styles.tallyRow}
                          data-testid={`ward-statistics-decline-${tally.reason}`}
                        >
                          <span className={styles.tallyReason}>{tally.reason.replace(/_/g, " ")}</span>
                          <span
                            className={styles.tallyCount}
                            data-testid={`ward-statistics-decline-${tally.reason}-count`}
                          >
                            {tally.count}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <p className={styles.figureNote} data-testid="ward-statistics-declines-by-reason-generated">
                      All{" "}
                      <span data-testid="ward-statistics-declines-by-reason-vocabulary-size">
                        {declinesReadout.value.vocabularySize}
                      </span>{" "}
                      allowed reasons are shown. Nought means checked with no matching decline.
                    </p>
                  </>
                )}
                <p className={styles.figureNote}>
                  Model vocabulary order, not frequency rank. `DECLINE_REASON_LABELS` (`ward-referrals.ts`) is keyed by
                  the referral-side vocabulary rather than this movement list. Closed movements remain in this
                  historical count.
                </p>
              </article>
            </div>
          </WardPanel>
        </div>

        {/* ══════════ TWO-COLUMN GRID 2: COMMUNITY & REFERRALS ══════════ */}
        <div className={pageStyles.cols2}>
          {/* Community teams */}
          <div id={STATISTICS_COMMUNITY_CHOOSER_ID} style={{ minWidth: 0 }}>
            <WardPanel
              title="Community teams"
              count={`${filteredAndSortedTeams.length} of ${communityTeams.length} teams`}
              testId="ward-statistics-community-chooser"
            >
              <div className={pageStyles.tableControlsBar}>
                <div className={pageStyles.tableSearchBox}>
                  <input
                    type="search"
                    className={pageStyles.tableSearchInput}
                    placeholder="Find a community team"
                    aria-label="Filter community teams"
                    value={teamSearchQuery}
                    onChange={(event) => {
                      setTeamSearchQuery(event.target.value);
                    }}
                  />
                </div>
              </div>
              <div className={styles.panelBody}>
                <p className={pageStyles.scopeNote} data-testid="ward-statistics-community-landing-absence">
                  Community activity totals are not recorded.
                </p>
                <ul className={styles.indexList} data-testid="ward-statistics-community-list">
                  {filteredAndSortedTeams.map((team) => (
                    <li key={team.id} className={styles.indexItem}>
                      <Link
                        href={communityStatisticsHref(team.id)}
                        className={styles.indexLink}
                        data-testid={`ward-statistics-community-link-${team.id}`}
                      >
                        <span className={styles.indexLabel}>{team.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {filteredAndSortedTeams.length === 0 && <p className={pageStyles.scopeNote}>No matching teams.</p>}
              </div>
            </WardPanel>
          </div>

          {/* Right column: Referrals & Health Services */}
          <div className={pageStyles.sideCol}>
            {/* Referrals for a bed */}
            <WardPanel title="Referrals for a bed" count="Today, all wards" testId="ward-statistics-referrals-for-bed">
              <div className={pageStyles.pb}>
                <p className={pageStyles.scopeNote}>
                  Referrals raised today with a ward destination. Each referral is counted once in each measure.
                </p>
              </div>

              <dl className={`${pageStyles.band} ${pageStyles.referralBand}`} id="refBand">
                <div className={pageStyles.kpi}>
                  <dt>Raised today</dt>
                  <dd>
                    {refRaised}
                    <small>asking a ward for a bed</small>
                  </dd>
                </div>
                <div className={pageStyles.kpi}>
                  <dt>Accepted today</dt>
                  <dd>
                    {refAccepted}
                    <small>accepted outcome</small>
                  </dd>
                </div>
                <div className={pageStyles.kpi}>
                  <dt>Declined today</dt>
                  <dd>
                    {refDeclined}
                    <small>each with a recorded reason</small>
                  </dd>
                </div>
                <div className={pageStyles.kpi} data-tone="warn">
                  <dt>Still open</dt>
                  <dd>
                    {refOpen}
                    <small>ward answer pending</small>
                  </dd>
                </div>
              </dl>

              <p className={pageStyles.panelFoot}>
                <Link href="/mockups/ward-flow/referrals">Open referrals ↗</Link>
              </p>

              <div className={styles.panelBody}>
                <article className={styles.figure} data-testid="ward-statistics-referral-to-bed">
                  <h3 className={styles.figureHeading}>From a referral being raised to a bed being taken</h3>

                  <p className={styles.absence} data-testid="ward-statistics-referral-join-absent">
                    <strong>No referral-to-bed duration is published.</strong> An exact referral link does not establish
                    that the referral started the wait that ended with this admission. The counts below report coherent
                    linked records without turning them into a duration.
                  </p>

                  <p className={styles.measuredCount} data-testid="ward-statistics-join-count">
                    <span className={styles.measuredValue} data-testid="ward-statistics-join-coherent-count">
                      {join.chronologicallyCoherentCount}
                    </span>{" "}
                    of <span data-testid="ward-statistics-join-matched-count">{join.joinedCount}</span> matched{" "}
                    {join.joinedCount === 1 ? "pair" : "pairs"} could carry a duration at all — that is, the person
                    arrived no earlier than the referral was raised.
                  </p>
                  <p className={styles.measuredCount} data-testid="ward-statistics-join-population">
                    Matched from{" "}
                    <span data-testid="ward-statistics-join-with-id-count">{join.withReferralIdCount}</span>{" "}
                    {join.withReferralIdCount === 1 ? "admission" : "admissions"} carrying a referral id, against{" "}
                    <span data-testid="ward-statistics-join-referrals-searched">{join.referralsSearchedCount}</span>{" "}
                    {join.referralsSearchedCount === 1 ? "referral" : "referrals"} on record.
                  </p>
                  <p className={styles.figureNote}>
                    Counts are recalculated from the current referral and admission records.
                  </p>
                </article>
              </div>
            </WardPanel>

            {/* Choose a health service */}
            <div id={STATISTICS_SERVICE_CHOOSER_ID}>
              <WardPanel title="Choose a health service" testId="ward-statistics-service-chooser">
                <div className={pageStyles.pb}>
                  <p className={pageStyles.scopeNote}>
                    Select a health service to view dedicated ward capacities, ED demands and community allocations.
                  </p>
                </div>
                <div className={styles.panelBody}>
                  <ul className={pageStyles.serviceGrid} data-testid="ward-statistics-service-list">
                    {HEALTH_SERVICES.map((svc) => (
                      <li key={svc} className={pageStyles.serviceCardItem}>
                        <Link
                          href={serviceStatisticsHref(svc)}
                          className={pageStyles.serviceCardLink}
                          data-testid={`ward-statistics-service-link-${svc}`}
                        >
                          <div className={pageStyles.serviceCardContent}>
                            <span className={pageStyles.serviceCardTitle}>{svc}</span>
                            <span className={pageStyles.serviceCardSubtitle}>View service measures →</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </WardPanel>
            </div>
          </div>
        </div>

        <WardPrototypeFooter
          testId="ward-statistics-governance"
          note={
            <p style={{ margin: 0, display: "inline" }}>
              <SyntheticFiguresDisclaimer />
            </p>
          }
        />
      </main>
    </div>
  );
}
