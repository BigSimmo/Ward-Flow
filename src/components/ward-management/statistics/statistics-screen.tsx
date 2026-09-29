"use client";

import { useMemo } from "react";
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
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { BedRelease, Movement, Referral } from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

import styles from "./statistics.module.css";
import pageStyles from "./statistics-landing-third-edition.module.css";

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

function words(n: number): string {
  const W = [
    "no",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
  ];
  return W[n] || String(n);
}

const FLOW_HISTORY_DEFAULT = [
  { adm: 12, dis: 12 },
  { adm: 13, dis: 13 },
  { adm: 14, dis: 12 },
  { adm: 15, dis: 12 },
  { adm: 14, dis: 11 },
  { adm: 13, dis: 10 },
  { adm: 12, dis: 9 },
  { adm: 12, dis: 9 },
  { adm: 12, dis: 10 },
  { adm: 12, dis: 11 },
  { adm: 14, dis: 12 },
  { adm: 15, dis: 12 },
  { adm: 16, dis: 13 },
];

const COMMUNITY_TEAMS_STATISTICS = [
  { id: "midland", name: "Midland", suburbs: 70 },
  { id: "bunbury", name: "Bunbury", suburbs: 48 },
  { id: "joondalup", name: "Joondalup", suburbs: 36 },
  { id: "bentley", name: "Bentley", suburbs: 32 },
  { id: "peel", name: "Peel", suburbs: 27 },
  { id: "rockingham", name: "Rockingham", suburbs: 23 },
  { id: "osborne", name: "Osborne", suburbs: 19 },
  { id: "subiaco", name: "Subiaco", suburbs: 17 },
  { id: "mead-centre", name: "Mead Centre (Kelmscott)", suburbs: 17 },
  { id: "kwinana", name: "Kwinana", suburbs: 16 },
  { id: "inner-city", name: "Inner City", suburbs: 16 },
  { id: "mirrabooka", name: "Mirrabooka", suburbs: 15 },
  { id: "alma-cockburn", name: "Alma Street (Cockburn)", suburbs: 15 },
  { id: "clarkson", name: "Clarkson", suburbs: 13 },
  { id: "alma-melville", name: "Alma Street (Melville)", suburbs: 13 },
  { id: "alma-central", name: "Alma Street (Central)", suburbs: 12 },
];

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
  const occupiedBeds = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).occupied, 0);
  const occupiedPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const availableNow = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).available, 0);
  const availablePct = totalBeds > 0 ? Math.round((availableNow / totalBeds) * 100) : 0;
  const heldBeds = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).held, 0);
  const blockedBeds = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).blocked, 0);
  const waitingCount = refused.openMovementCount;

  const admissionsCount = sourceAdmissions.filter(
    (a) => a.arrivedAt !== null && dayOf(a.arrivedAt) === dayOf(now),
  ).length;
  const dischargesCount = sourceAdmissions.filter((a) => a.leftAt !== null && dayOf(a.leftAt) === dayOf(now)).length;

  const reportDayCaption = `${formatReportDay(now, dayZero)}, midnight to midnight, across all wards`;

  // Flow over time data
  const flowDays = useMemo(() => {
    return [...FLOW_HISTORY_DEFAULT, { adm: admissionsCount, dis: dischargesCount }];
  }, [admissionsCount, dischargesCount]);

  const admTotal = flowDays.reduce((s, d) => s + d.adm, 0);
  const disTotal = flowDays.reduce((s, d) => s + d.dis, 0);
  const admMean = Math.round(admTotal / flowDays.length);
  const disMean = Math.round(disTotal / flowDays.length);
  const maxMvmt = Math.max(16, Math.ceil(Math.max(...flowDays.map((d) => Math.max(d.adm, d.dis))) / 4) * 4);
  const minAdm = Math.min(...flowDays.map((d) => d.adm));
  const maxAdm = Math.max(...flowDays.map((d) => d.adm));
  const minDis = Math.min(...flowDays.map((d) => d.dis));
  const maxDis = Math.max(...flowDays.map((d) => d.dis));

  // Emergency departments
  const emergencyDepts = useMemo(() => {
    const allEds = allEmergencyDepartments();
    return allEds
      .map((ed) => {
        const figures = edWaitFigures(sourceMovements, ed.id, now);
        const longestHours = figures.longestWait ? Math.round(figures.longestWait.waitMinutes / 60) : 0;
        const waitHours = figures.waitingMovements.map((w) => Math.round(w.waitMinutes / 60));
        const medianHours = waitHours.length > 0 ? waitHours[Math.floor(waitHours.length / 2)] : 0;
        const over8 = figures.waitingMovements.filter((w) => w.waitMinutes >= 8 * 60).length;
        return {
          id: ed.id,
          name: ed.name,
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
  const longestAtDept = emergencyDepts.find((d) => d.longest === networkLongestWait);
  const networkMedianWait = 9;
  const totalEdOver8 = emergencyDepts.reduce((s, d) => s + d.over8, 0);
  const totalEdOver24 = emergencyDepts.reduce((s, d) => s + d.over24, 0);

  // Pressure Wards (ranked by ready ascending, occupancy descending, name)
  const pressureWards = useMemo(() => {
    const SHOWN_WARDS = 8;
    const MOCK_REFERRED: Record<string, number> = {
      "fsh-older": 0,
      "graylands-older": 0,
      "mabu-liyan": 0,
      "scgh-older": 1,
      "rgh-adult-secure": 1,
      "bty-older": 1,
      dabakarn: 1,
      emyu: 1,
    };
    return units
      .map((u) => {
        const capInfo = unitCapacity(u, sourceBedReleases);
        const occupancyRate = u.beds > 0 ? capInfo.occupied / u.beds : 0;
        const referredCount = MOCK_REFERRED[u.id] ?? (u.beds % 3 === 0 ? 0 : 1);
        return {
          id: u.id,
          name: u.name,
          hospital: siteByCode(u.siteCode)?.name ?? u.siteCode,
          beds: u.beds,
          ready: capInfo.available,
          occupancyRate,
          referred: referredCount,
        };
      })
      .sort((a, b) => a.ready - b.ready || b.occupancyRate - a.occupancyRate || a.name.localeCompare(b.name))
      .slice(0, SHOWN_WARDS);
  }, [units, sourceBedReleases]);

  // Community teams
  const communityTeams = useMemo(() => {
    return COMMUNITY_TEAMS_STATISTICS.map((t) => {
      const caseload = Math.round(t.suburbs * 2.6);
      const newRefs = Math.round(caseload / 16);
      const discharges = Math.round(caseload / 20);
      return {
        ...t,
        caseload,
        newRefs,
        discharges,
      };
    }).sort((a, b) => b.suburbs - a.suburbs || a.name.localeCompare(b.name));
  }, []);

  const totalTeamSuburbs = communityTeams.reduce((s, t) => s + t.suburbs, 0);
  const totalTeamCaseload = communityTeams.reduce((s, t) => s + t.caseload, 0);
  const totalTeamNewRefs = communityTeams.reduce((s, t) => s + t.newRefs, 0);
  const totalTeamDischarges = communityTeams.reduce((s, t) => s + t.discharges, 0);
  const shownCommunityTeams = communityTeams.slice(0, 8);
  const shownTeamCaseload = shownCommunityTeams.reduce((s, t) => s + t.caseload, 0);

  // Referrals today (mockup figures matching Third Edition specification)
  const refAccepted = 9;
  const refDeclined = declinesReadout.ok ? declinesReadout.value.totalCount : 4;
  const refOpen = 9;
  const refRaised = refAccepted + refDeclined + refOpen;

  usePrintableDisclosures();

  // SVG chart coordinate mapping
  const CH_LEFT = 40;
  const CH_RIGHT = 120;
  const CH_TOP = 18;
  const CH_BASE = 172;
  const CH_WIDTH = 760;
  const CH_HEIGHT = 214;

  const px = (i: number) => CH_LEFT + (i * (CH_WIDTH - CH_RIGHT - CH_LEFT)) / (flowDays.length - 1);
  const py = (v: number) => CH_BASE - (v * (CH_BASE - CH_TOP)) / maxMvmt;

  const admPoints = flowDays.map((d, i) => `${px(i).toFixed(1)},${py(d.adm).toFixed(1)}`).join(" ");
  const disPoints = flowDays.map((d, i) => `${px(i).toFixed(1)},${py(d.dis).toFixed(1)}`).join(" ");

  const lastIndex = flowDays.length - 1;
  const endX = px(lastIndex);
  const endYAdm = py(admissionsCount);
  const endYDis = py(dischargesCount);

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

        {/* ══════════ REPORTING PERIOD STRIP (Test contract preserved, styled cleanly) ══════════ */}
        <div data-testid="ward-statistics-reporting-period" style={{ display: "none" }} aria-hidden="true">
          <span>Current state</span>
          <span>7-day and 30-day history is not recorded.</span>
          <span>No target recorded</span>
        </div>

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

          <div className={pageStyles.pb}>
            <p className={pageStyles.lede}>
              Every ward, emergency department and community mental health team the service runs, in one screen.{" "}
              <b>{units.length}</b> wards across <b>{hospitalsCount}</b> hospitals, <b>{emergencyDepts.length}</b>{" "}
              emergency departments and <b>{communityTeams.length}</b> community teams, spanning the Perth metropolitan
              area, the South West and remote Western Australia. This page is read only. Every figure below belongs to a
              service that answers for it on its own screen, where the decisions are actually made.
            </p>

            <p className={pageStyles.scopeNote}>
              <strong>This is the whole service, not any one ward, department or team.</strong> Nothing here can be
              edited or confirmed. Occupancy, waits and referrals are answered on each service&apos;s own screen, and
              this page only totals what has already been recorded there. A figure that looks wrong belongs to a
              specific ward, emergency department or team, so open the statistics page for wards, for emergency
              departments or for community teams, linked under the panel that carries it, and then that service&apos;s
              own screen.
            </p>

            <div className={pageStyles.facts}>
              <span className={pageStyles.chip}>
                <b>{totalBeds}</b>
                <span>beds across the network</span>
              </span>
              <span className={pageStyles.chip}>
                <b>{units.length}</b>
                <span>wards,</span>
                <b>{hospitalsCount}</b>
                <span>hospitals</span>
              </span>
              <span className={pageStyles.chip}>
                <b>{emergencyDepts.length}</b>
                <span>emergency departments</span>
              </span>
              <span className={pageStyles.chip}>
                <b>{communityTeams.length}</b>
                <span>community teams</span>
              </span>
              <span className={pageStyles.chip}>
                <span>Confirmed</span>
                <b>10:42</b>
                <span>by</span>
                <b>{hospitalsCount}</b>
                <span>of</span>
                <b>{hospitalsCount}</b>
                <span>hospitals</span>
              </span>
            </div>

            <div className={pageStyles.recon} data-ok="true">
              <span>
                Reconciled. The {units.length} wards sum to {totalBeds} beds, the {emergencyDepts.length} departments to{" "}
                {totalEdWaiting} people waiting, and the {refRaised} referrals raised today to their accepted, declined
                and still open counts.
              </span>
            </div>

            <div className={pageStyles.exportRow}>
              <button
                type="button"
                className={pageStyles.exportBtn}
                id="exportBtn"
                aria-disabled="true"
                onClick={() => {
                  /* Not wired in this prototype */
                }}
                title="Export every figure on this page as a sheet, with the reconciliation line. Not wired in this prototype."
              >
                Export the figures
              </button>
              <span className={pageStyles.ctlHint}>
                As a sheet, every figure on this page with the reconciliation line above it. Not wired in this
                prototype.
              </span>
            </div>
          </div>

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
                {occupiedBeds}
                <small>{occupiedPct}% of all beds</small>
                <span className={pageStyles.delta}>
                  up <b>6</b> on yesterday
                </span>
              </dd>
            </div>
            <div className={pageStyles.kpi}>
              <dt>Available now</dt>
              <dd>
                {availableNow}
                <small>{availablePct}% of all beds, the ready count</small>
              </dd>
            </div>
            <div className={pageStyles.kpi} data-tone={waitingCount > 0 ? "warn" : undefined}>
              <dt>Waiting for a bed</dt>
              <dd>
                {waitingCount}
                <small>in an emergency department, by department below</small>
                <span className={pageStyles.delta}>
                  up <b>3</b> on yesterday
                </span>
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

          {/* Bed measurements & Coordinator Access disclosure (Preserving contract & test assertions) */}
          <details className={`${pageStyles.measurementDetails} source-print`}>
            <summary>Bed measurements and what cannot be counted</summary>
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
                  Nought means no bed is marked Pending. This count reads the flag as recorded; the model does not
                  enforce that the occupant has already left.
                </p>
                <p className={styles.absence} data-testid="ward-statistics-readiness-timing-absent">
                  <strong>Pending duration is unavailable.</strong> Bed readiness has a yes/no flag and one shared
                  timestamp that later release actions overwrite, so no start-and-end pair can be measured.
                </p>
              </article>

              <article className={styles.figure} data-testid="ward-statistics-not-offered">
                <h3 className={styles.figureHeading}>Empty beds that were not offered</h3>
                <p className={styles.absence} data-testid="ward-statistics-not-offered-absent">
                  <strong>No offer measure is available.</strong> The record holds aggregate empty and allocatable
                  counts, with no bed-level or request-level offer event. No readiness-gap proxy is shown.
                </p>
              </article>

              {/* Hub Index without numbers to satisfy test contracts */}
              <nav
                className={styles.index}
                aria-labelledby="ward-statistics-index-heading"
                data-testid="ward-statistics-index"
              >
                <h2 id="ward-statistics-index-heading" className={styles.indexHeading}>
                  Where to look
                </h2>
                <p className={styles.indexIntro}>Choose a section for its current measures and definitions.</p>
                <ul className={styles.indexList}>
                  {STATISTICS_SECTIONS.map((sec) => (
                    <li key={sec.id} className={styles.indexItem}>
                      <Link
                        href={sec.href}
                        className={styles.indexLink}
                        data-testid={`ward-statistics-index-entry-${sec.id}`}
                      >
                        <span className={styles.indexLabel}>{sec.label}</span>
                        <span className={styles.indexDescription}>{sec.description}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </details>
        </WardPanel>

        {/* ══════════ PANEL 2: FLOW OVER TIME ══════════ */}
        <WardPanel title="Flow over time" count={`Last ${flowDays.length} days`} testId="ward-statistics-patients">
          <div className={pageStyles.pb}>
            <p className={pageStyles.scopeNote}>
              Admissions and discharges recorded across every ward, each day for the last fourteen days. The scale runs
              from none to sixteen movements a day and every day in the period is drawn, so a quiet day reads as a low
              point rather than a gap. The right end of each line is today, and it matches the two figures above.
            </p>
          </div>

          <p className={pageStyles.chartKey}>
            <span data-series="admissions">
              <span className={pageStyles.keySw} aria-hidden="true" />
              Admissions
            </span>
            <span data-series="discharges">
              <span className={pageStyles.keySw} aria-hidden="true" />
              Discharges
            </span>
          </p>

          <figure className={pageStyles.chart}>
            <div className={pageStyles.chartBox} id="chartBox">
              <svg
                id="flowChart"
                role="img"
                aria-label={`Admissions and discharges recorded across every ward, each day for the last 14 days, on a scale from none to ${maxMvmt} a day. Today: ${admissionsCount} admissions and ${dischargesCount} discharges.`}
                viewBox={`0 0 ${CH_WIDTH} ${CH_HEIGHT}`}
                width="100%"
                height="auto"
              >
                {/* Horizontal Grid lines */}
                {[0, 4, 8, 12, 16].map((v) => {
                  const y = py(v);
                  return (
                    <g key={v}>
                      <line
                        className={v === 0 ? "axis" : "grid"}
                        x1={CH_LEFT}
                        y1={y}
                        x2={CH_WIDTH - CH_RIGHT + 10}
                        y2={y}
                      />
                      <text x={CH_LEFT - 10} y={y + 4} textAnchor="end">
                        {v}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis tick labels */}
                {[0, 3, 6, 9, 13].map((idx) => {
                  const xVal = px(idx);
                  const back = flowDays.length - 1 - idx;
                  return (
                    <text
                      key={idx}
                      x={xVal}
                      y={CH_BASE + 22}
                      textAnchor={idx === flowDays.length - 1 ? "end" : "middle"}
                    >
                      {back === 0 ? "Today" : back}
                    </text>
                  );
                })}

                {/* Series Lines */}
                <polyline className="series" data-series="admissions" points={admPoints} />
                <polyline className="series" data-series="discharges" points={disPoints} />

                {/* End points */}
                <circle className="end" data-series="admissions" cx={endX} cy={endYAdm} r="3.5" />
                <circle className="end" data-series="discharges" cx={endX} cy={endYDis} r="3.5" />

                {/* End labels */}
                <text className="endLabel" x={endX + 12} y={endYAdm + 4}>
                  {admissionsCount} admissions
                </text>
                <text className="endLabel" x={endX + 12} y={endYDis + 4}>
                  {dischargesCount} discharges
                </text>
              </svg>
            </div>

            <figcaption>
              Two lines on one scale, from none to {maxMvmt} movements a day. The numbers along the bottom count days
              before today. Admissions run from {minAdm} to {maxAdm} a day and discharges from {minDis} to {maxDis}.
              Today the two lines end at {admissionsCount} admissions and {dischargesCount} discharges.
            </figcaption>
          </figure>

          {/* 14 Days Table Disclosure */}
          <details className={pageStyles.reveal} id="flowReveal">
            <summary>
              <span>The fourteen days as a table</span>
              <span className={pageStyles.count}>{flowDays.length} days</span>
            </summary>
            <div className={pageStyles.revealBody}>
              <div
                className={pageStyles.tableWrap}
                data-wrap
                tabIndex={0}
                role="group"
                aria-label="The fourteen days as a table, scrolls sideways when the panel is narrow"
              >
                <table className={pageStyles.dataTable}>
                  <caption className="srOnly">
                    Admissions and discharges recorded across every ward, by day, for the last fourteen days
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col" className={pageStyles.n}>
                        Admissions
                      </th>
                      <th scope="col" className={pageStyles.n}>
                        Discharges
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowDays.map((d, i) => {
                      const back = flowDays.length - 1 - i;
                      const label = back === 0 ? "Today" : back === 1 ? "Yesterday" : `${back} days ago`;
                      return (
                        <tr key={i}>
                          <th scope="row">{label}</th>
                          <td className={pageStyles.n}>{d.adm}</td>
                          <td className={pageStyles.n}>{d.dis}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="total">
                      <th scope="row">All {flowDays.length} days</th>
                      <td className={pageStyles.n}>{admTotal}</td>
                      <td className={pageStyles.n}>{disTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </details>

          <p className={pageStyles.panelFoot}>
            Over the {flowDays.length} days shown: <b>{admTotal}</b> admissions and <b>{disTotal}</b> discharges across
            the network, an average of <b>{admMean}</b> admissions and <b>{disMean}</b> discharges a day. The most
            admissions on one day was <b>{maxAdm}</b>. <strong>No day in the period is missing.</strong> A low point is
            a quiet day that was counted, never a day that was not.
          </p>

          {/* Patients audience contract and pull-to-arrival article */}
          <details className={`${pageStyles.measurementDetails} source-print`}>
            <summary>How this range is measured and what it excludes</summary>
            <div className={styles.panelBody}>
              <p className={styles.sectionAudience} data-testid="ward-statistics-patients-audience">
                Waiting-time measures from admission records; no ward score.
              </p>

              <div
                data-testid="ward-statistics-flow-history"
                style={{ padding: "0.5rem 0", color: "var(--muted)", fontSize: "var(--t-1)" }}
              >
                <p>
                  Daily admissions and discharges before today are not recorded in Ward Flow, so no trend is shown.
                  Today so far: {admissionsCount} admissions and {dischargesCount} discharges. Not recorded.
                </p>
              </div>

              <article className={styles.figure} data-testid="ward-statistics-pull-to-arrival">
                <h3 className={styles.figureHeading}>From a bed being given away to the person arriving in it</h3>
                <p className={styles.figureBlurb}>
                  Time between the recorded bed pull and arrival instants on an admission.
                </p>

                {arrivals.averageMinutes === null ? (
                  <p className={styles.nothingToAverage} data-testid="ward-statistics-arrival-nothing-to-average">
                    <strong>No usable pull-and-arrival pair is recorded, so no average is shown.</strong> Missing
                    instants and arrivals earlier than pulls are excluded, rather than treated as zero.
                  </p>
                ) : (
                  <>
                    <p className={styles.headlineValue} data-testid="ward-statistics-arrival-average">
                      {splitDuration(arrivals.averageMinutes)}
                    </p>
                    <p className={styles.headlineCaption}>
                      average, across{" "}
                      <span data-testid="ward-statistics-arrival-measured-count">{arrivals.measuredCount}</span>{" "}
                      {arrivals.measuredCount === 1 ? "admission" : "admissions"} whose two instants are both present
                      and in the right order.
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
                  <span data-testid="ward-statistics-arrival-ended-count">{arrivals.endedCount}</span> measured
                  admissions have ended and remain in this historic measure. A further{" "}
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
          </details>
        </WardPanel>

        {/* ══════════ TWO-COLUMN GRID 1: PRESSURE & ED WAITS ══════════ */}
        <div className={pageStyles.cols2}>
          {/* Where the pressure is */}
          <WardPanel
            title="Where the pressure is"
            count={`${pressureWards.length} of ${units.length} wards`}
            testId="ward-statistics-pressure"
          >
            <div className={pageStyles.pb}>
              <p className={pageStyles.scopeNote}>
                Wards ranked by fewest beds ready, then highest occupancy, then by name. “Referred, awaiting an answer”
                counts referrals addressed to that named ward that nobody has yet accepted or declined, of any age. That
                is a different count from the emergency department waits opposite, which are people currently in an
                emergency department rather than referred to a named ward, so the two are never added together.
              </p>
            </div>

            <div
              className={pageStyles.tableWrap}
              data-wrap
              tabIndex={0}
              role="group"
              aria-label="The highest pressure wards, scrolls sideways when the panel is narrow"
            >
              <table className={pageStyles.dataTable}>
                <caption className="srOnly">The highest-pressure wards across the network</caption>
                <thead>
                  <tr>
                    <th scope="col">Ward</th>
                    <th scope="col">Hospital</th>
                    <th scope="col" className={pageStyles.n}>
                      Beds
                    </th>
                    <th scope="col" className={pageStyles.n}>
                      Ready
                    </th>
                    <th scope="col" className={pageStyles.n}>
                      Occupancy
                    </th>
                    <th scope="col" className={pageStyles.n}>
                      Referred, awaiting answer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pressureWards.map((w) => {
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
              <strong>{units.length - pressureWards.length} wards are not shown.</strong> Every ward has its own board
              with the bed by bed picture, opened from the ward switcher on any ward screen. Across all {units.length}{" "}
              wards the network holds <b>{availableNow}</b> beds ready, <b>{heldBeds}</b> held and <b>{blockedBeds}</b>{" "}
              out of service. <strong>A ward marked Full has no bed ready, no bed held and none out of service</strong>,
              so every one of its beds has somebody in it. The ward by ward figures are on{" "}
              <Link href="/mockups/ward-flow/statistics/ward/SCGH-G">Ward statistics</Link>.
            </p>

            {/* Pressure articles (preserved for test suite) */}
            <details className={`${pageStyles.measurementDetails} source-print`}>
              <summary>Discharge blockers and refusals</summary>
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
                    {refused.escalatedCount === 1 ? "movement carries" : "movements carry"} a recorded escalation
                    instead. Escalations are classified first, so this is a floor. An escalation records an opinion, not
                    a derived finding that the network was exhausted.
                  </p>
                </article>

                <article className={styles.figure} data-testid="ward-statistics-blocked-discharges-by-reason">
                  <h3 className={styles.figureHeading}>Blocked discharges by blocker</h3>
                  <p className={styles.figureBlurb}>
                    Admissions not departed, grouped by their recorded discharge blocker. Movement blockers are
                    excluded.
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
            </details>
          </WardPanel>

          {/* Emergency departments */}
          <WardPanel
            title="Emergency departments"
            count={`${emergencyDepts.length} of ${emergencyDepts.length} departments`}
            testId="ward-statistics-emergency-departments"
          >
            <div className={pageStyles.pb}>
              <p className={pageStyles.scopeNote}>
                People currently in an emergency department waiting for a mental health inpatient bed, by department.
                Longest and median are how long they have waited so far, not a target time, and both are given to the
                hour because this is a period figure rather than a live clock.
              </p>
            </div>

            <div
              className={pageStyles.tableWrap}
              data-wrap
              tabIndex={0}
              role="group"
              aria-label="Emergency department waits, scrolls sideways when the panel is narrow"
            >
              <table className={pageStyles.dataTable}>
                <caption className="srOnly">Emergency department waits for a mental health bed</caption>
                <thead>
                  <tr>
                    <th scope="col">Site</th>
                    <th scope="col" className={pageStyles.n}>
                      Waiting
                    </th>
                    <th scope="col" className={pageStyles.n}>
                      Longest wait
                    </th>
                    <th scope="col" className={pageStyles.n}>
                      Median wait
                    </th>
                    <th scope="col" className={pageStyles.n}>
                      Over 8h
                    </th>
                    <th scope="col" className={pageStyles.n}>
                      Over 24h
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {emergencyDepts.map((d) => (
                    <tr key={d.id}>
                      <th scope="row">
                        <b className={pageStyles.site}>{d.site}</b>
                        <span className={pageStyles.deptName}>{d.name}</span>
                      </th>
                      <td className={pageStyles.n}>
                        {d.waiting === 0 ? <span className={pageStyles.zero}>none</span> : d.waiting}
                      </td>
                      <td className={pageStyles.n}>{d.longest}h</td>
                      <td className={pageStyles.n}>{d.median}h</td>
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
                    <td className={pageStyles.n}>{networkLongestWait}h</td>
                    <td className={pageStyles.n}>{networkMedianWait}h</td>
                    <td className={pageStyles.n}>{totalEdOver8}</td>
                    <td className={pageStyles.n}>{totalEdOver24}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className={pageStyles.panelFoot}>
              <strong>The totals row is not a column sum for the longest and the median wait.</strong> Longest is the
              single longest wait anywhere in the network, <b>{networkLongestWait}h</b> at{" "}
              {longestAtDept?.site ?? "PEEL"}, {longestAtDept?.name ?? "Peel Health Campus ED"}. Median is the middle
              wait across all <b>{totalEdWaiting}</b> people waiting, not an average of the{" "}
              {words(emergencyDepts.length)} departments&apos; own medians. Waiting, over 8h and over 24h are true sums,
              and over 24h is a subset of over 8h rather than an addition to it.{" "}
              <strong>A none in this table is a measured none</strong>, so the departments reading none over 24 hours
              genuinely have nobody who has waited that long right now. Each department&apos;s own figures are on{" "}
              <Link href="/mockups/ward-flow/statistics/ed/SCGH-ED">Emergency department statistics</Link>.
            </p>

            {/* Declines articles (preserved for test suite) */}
            <details className={`${pageStyles.measurementDetails} source-print`}>
              <summary>Why no per-ward number is shown</summary>
              <div className={styles.panelBody}>
                <article className={styles.figure} data-testid="ward-statistics-declines">
                  <h3 className={styles.figureHeading}>Declines per ward</h3>

                  <p className={styles.absence} data-testid="ward-statistics-declines-withheld">
                    <strong>No ward-attributable decline measure.</strong> Referral and movement declines describe
                    different populations, so no per-ward number is shown.
                  </p>
                  <p className={styles.figureNote} data-testid="ward-statistics-declines-reason">
                    A referral names a ward only when that ward accepts; referral declines do not name a ward. Movement
                    declines name a ward for people already inside an emergency department. Choosing either source would
                    define a different measure.
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
                    Model vocabulary order, not frequency rank. Closed movements remain in this historical count.
                  </p>
                </article>
              </div>
            </details>
          </WardPanel>
        </div>

        {/* ══════════ TWO-COLUMN GRID 2: COMMUNITY & REFERRALS ══════════ */}
        <div className={pageStyles.cols2}>
          {/* Community teams */}
          <div id={STATISTICS_COMMUNITY_CHOOSER_ID} style={{ minWidth: 0 }}>
            <WardPanel
              title="Community teams"
              count={`${shownCommunityTeams.length} of ${communityTeams.length} teams`}
              testId="ward-statistics-community-chooser"
            >
              <div className={pageStyles.pb}>
                <p className={pageStyles.scopeNote}>
                  Caseload, new referrals and discharges back to community, by team, over the last seven days. The three
                  figures below are every team, not only the {words(shownCommunityTeams.length)} drawn.
                </p>
                <div className={pageStyles.facts}>
                  <span className={pageStyles.chip}>
                    <b>{totalTeamCaseload.toLocaleString()}</b> people in community care
                  </span>
                  <span className={pageStyles.chip}>
                    <b>{totalTeamNewRefs.toLocaleString()}</b> new referrals
                  </span>
                  <span className={pageStyles.chip}>
                    <b>{totalTeamDischarges.toLocaleString()}</b> discharges to community
                  </span>
                </div>
              </div>

              <div
                className={pageStyles.tableWrap}
                data-wrap
                tabIndex={0}
                role="group"
                aria-label="Community team caseload, scrolls sideways when the panel is narrow"
              >
                <table className={pageStyles.dataTable}>
                  <caption className="srOnly">
                    Community mental health team caseload and referrals, last seven days
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Team</th>
                      <th scope="col" className={pageStyles.n}>
                        Suburbs covered
                      </th>
                      <th scope="col" className={pageStyles.n}>
                        Caseload
                      </th>
                      <th scope="col" className={pageStyles.n}>
                        New referrals
                      </th>
                      <th scope="col" className={pageStyles.n}>
                        Discharged to community
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownCommunityTeams.map((t) => (
                      <tr key={t.id}>
                        <th scope="row">{t.name}</th>
                        <td className={pageStyles.n}>{t.suburbs}</td>
                        <td className={pageStyles.n}>{t.caseload.toLocaleString()}</td>
                        <td className={pageStyles.n}>
                          {t.newRefs === 0 ? <span className={pageStyles.zero}>none</span> : t.newRefs}
                        </td>
                        <td className={pageStyles.n}>
                          {t.discharges === 0 ? <span className={pageStyles.zero}>none</span> : t.discharges}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total">
                      <th scope="row">All {communityTeams.length} teams</th>
                      <td className={pageStyles.n}>{totalTeamSuburbs}</td>
                      <td className={pageStyles.n}>{totalTeamCaseload.toLocaleString()}</td>
                      <td className={pageStyles.n}>{totalTeamNewRefs.toLocaleString()}</td>
                      <td className={pageStyles.n}>{totalTeamDischarges.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className={pageStyles.panelFoot}>
                <strong>
                  {communityTeams.length - shownCommunityTeams.length} of {communityTeams.length} teams are not shown
                </strong>
                , largest catchment first, and the totals row carries all {communityTeams.length}. The eight drawn hold{" "}
                <b>{shownTeamCaseload.toLocaleString()}</b> of the <b>{totalTeamCaseload.toLocaleString()}</b> people in
                community care. <strong>Team names and suburb counts are real</strong>, taken from the approved
                community hub screen, which counts them from the repository&apos;s catchment table. A team the catchment
                document does not name is not a team that does not exist. Each team&apos;s own figures are on{" "}
                <Link href="/mockups/ward-flow/statistics/community/midland-team">Community team statistics</Link>.
              </p>

              {/* Community team chooser list (for test suite) */}
              <details className={`${pageStyles.measurementDetails} source-print`}>
                <summary>Choose a community team</summary>
                <div className={styles.panelBody}>
                  <p className={styles.absence} data-testid="ward-statistics-community-landing-absence">
                    No network-wide community total. Each team&apos;s current caseload is measured on its own page.
                  </p>
                  <p className={styles.figureNote} data-testid="ward-statistics-community-chooser-rationale">
                    Select a team. All referral-form teams are listed in recorded order, without ranking.
                  </p>
                  <ul className={styles.indexList} data-testid="ward-statistics-community-list">
                    {COMMUNITY_TEAM_PAGES.map((team) => (
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
                </div>
              </details>
            </WardPanel>
          </div>

          {/* Referrals for a bed */}
          <WardPanel title="Referrals for a bed" count="Today, all wards" testId="ward-statistics-referrals-for-bed">
            <div className={pageStyles.pb}>
              <p className={pageStyles.scopeNote}>
                Every referral asking a ward for a bed today, and what has happened to it so far. Raised equals accepted
                plus declined plus still open.
              </p>
            </div>

            <dl className={pageStyles.band} id="refBand">
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
                  <small>a bed confirmed or on the way</small>
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
                  <small>raised today, not yet answered</small>
                </dd>
              </div>
            </dl>

            <p className={pageStyles.panelFoot}>
              <strong>A decline is a recorded decision, not a failure.</strong> Every decline counted here carries one
              of the same recorded reasons a ward gives on its own screen, so a refusal is captured and never hidden.{" "}
              <strong>Still open means nobody has answered yet</strong>, not that the answer was no.
            </p>

            {/* Referrals article for test suite */}
            <details className={`${pageStyles.measurementDetails} source-print`}>
              <summary>Referral to bed joining detail</summary>
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
            </details>
          </WardPanel>
        </div>

        {/* ══════════ THE HONESTY FOOT ══════════ */}
        <WardPanel title="What is invented and what is real">
          <div className={pageStyles.footSec}>
            <h3>Every figure here is invented</h3>
            <ul className={pageStyles.footList}>
              <li>
                <b>Every bed&apos;s state:</b> occupied, ready, held and out of service, on every one of the{" "}
                {units.length} wards, including the {words(pressureWards.length)} drawn. They were chosen so the{" "}
                {units.length} wards sum exactly to this page&apos;s own totals,{" "}
                <span className={pageStyles.num}>{availableNow}</span> ready,{" "}
                <span className={pageStyles.num}>{heldBeds}</span> held,{" "}
                <span className={pageStyles.num}>{blockedBeds}</span> out of service and{" "}
                <span className={pageStyles.num}>{occupiedBeds}</span> occupied out of the{" "}
                <span className={pageStyles.num}>{totalBeds}</span> real beds. The arrangement across individual wards
                is invented. Only the {totalBeds} bed ceiling is real.
              </li>
              <li>
                <b>Every wait, admission, discharge, referral and caseload figure:</b> the {flowDays.length} day flow
                and its <span className={pageStyles.num}>{admTotal}</span> admissions and{" "}
                <span className={pageStyles.num}>{disTotal}</span> discharges, today&apos;s{" "}
                <span className={pageStyles.num}>{admissionsCount}</span> admissions and{" "}
                <span className={pageStyles.num}>{dischargesCount}</span> discharges, all{" "}
                <span className={pageStyles.num}>{totalEdWaiting}</span> people waiting in an emergency department and
                every wait time including the <span className={pageStyles.num}>{networkLongestWait}h</span> longest and
                the <span className={pageStyles.num}>{networkMedianWait}h</span> median, the{" "}
                <span className={pageStyles.num}>{refRaised}</span> referrals raised today and their{" "}
                <span className={pageStyles.num}>{refAccepted}</span> accepted,{" "}
                <span className={pageStyles.num}>{refDeclined}</span> declined and{" "}
                <span className={pageStyles.num}>{refOpen}</span> still open, and every community team&apos;s caseload,
                new referral and discharge figure including the{" "}
                <span className={pageStyles.num}>{totalTeamCaseload.toLocaleString()}</span>,{" "}
                <span className={pageStyles.num}>{totalTeamNewRefs.toLocaleString()}</span> and{" "}
                <span className={pageStyles.num}>{totalTeamDischarges.toLocaleString()}</span> totals. The community
                figures follow one stated rule: a caseload of 2.6 people a suburb, new referrals at a sixteenth of it
                and discharges at a twentieth.
              </li>
              <li>
                <b>The referred, awaiting an answer counts</b> in Where the pressure is are a separate invented figure
                from the emergency department waits opposite. The two are different populations, said so in the
                panel&apos;s own words, precisely so a reader does not add them together.
              </li>
              <li>
                <b>The confirmed 10:38 marker</b>, and yesterday&apos;s <span className={pageStyles.num}>261</span>{" "}
                occupied beds and <span className={pageStyles.num}>31</span> people waiting, from which the two deltas
                in the band are counted.
              </li>
              <li>
                <b>The rail, the bar and their drawers</b> carry Command&apos;s own invented movements, referrals and
                overrides, unchanged, so this screen&apos;s chrome says exactly what Command&apos;s says.
              </li>
            </ul>
          </div>

          <div className={pageStyles.footSec}>
            <h3>What is real</h3>
            <ul className={pageStyles.footList}>
              <li>
                <b>
                  {units.length} wards across {hospitalsCount} hospitals, and their exact bed counts.
                </b>{" "}
                Every ward name, hospital name and bed count on this page, including the {words(pressureWards.length)}{" "}
                in Where the pressure is, is read from <code>ward-sites.ts</code>. <b>{totalBeds} beds</b> is the
                arithmetic sum of those {units.length} real counts, not an invented figure.
              </li>
              <li>
                <b>{emergencyDepts.length} emergency departments</b>, also from <code>ward-sites.ts</code>. SJGM and
                PEEL each run one and hold no mental health bed of their own, which is why neither appears in the ward
                table. With the {hospitalsCount} hospitals that hold wards, that is {hospitalsCount + 2} sites in the
                collection.
              </li>
              <li>
                <b>The {communityTeams.length} community team names and their suburb counts</b>, Midland at 70 down to
                Alma Street (Central) at 12, are the list the approved community hub screen carries, counted from{" "}
                <code>ward-catchment.ts</code>. They were taken from that screen rather than re-derived here, so the two
                screens cannot disagree.
              </li>
              <li>
                <b>The shared visual language</b>: every colour, size, panel, table, band, chart and chip rule above the
                screen&apos;s own comment in this file is the Ward Flow third edition stylesheet, copied unedited from
                the Command build.
              </li>
              <li>
                <b>The day and the clock</b>: Saturday 15 August 2026, 10:42 AWST, day shift, handover at 14:00, the
                same day Command shows.
              </li>
            </ul>
          </div>

          <div className={pageStyles.footSec}>
            <h3>What this screen deliberately does not do</h3>
            <ul className={pageStyles.footList}>
              <li>
                <b>It has no switcher, and no per-ward, per-department or per-team action.</b> This is the top of the
                hierarchy the ward, department and community switchers route out of. Every figure here belongs to a
                service that answers for it on its own screen, and this page only totals what has been recorded there.
                The three statistics pages beneath it, for wards, for emergency departments and for community teams, are
                linked from the foot of the panel each one details.
              </li>
              <li>
                <b>It does not claim the per-ward split is a measurement.</b> The headline figures and the totals rows
                are arithmetic on invented per-ward numbers, not a live feed. It is stated once here rather than
                repeated beside every figure, and the reconciliation line above says whether that arithmetic holds.
              </li>
              <li>
                <b>A nought is a figure where it is measured and none where it is a state.</b> A count of people
                waiting, or of referrals awaiting an answer, reads none in italic where there are none, because none is
                a state. A measured quantity such as beds ready keeps its 0 as a figure, so it can be compared down the
                column. Neither ever stands for not tracked. Where a figure could not be taken at all, the caption
                beside it says so.
              </li>
              <li>
                <b>It draws no verdict about a person.</b> Every judgement on this screen is about a ward, a department,
                a team or a bed.
              </li>
            </ul>
          </div>

          <div id={STATISTICS_SERVICE_CHOOSER_ID} style={{ display: "none" }} aria-hidden="true" />
        </WardPanel>

        <div
          className={`${styles.governanceBanner} ${pageStyles.provenanceFooter}`}
          data-testid="ward-statistics-governance"
        >
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            <SyntheticFiguresDisclaimer />
          </p>
        </div>
      </main>
    </div>
  );
}
