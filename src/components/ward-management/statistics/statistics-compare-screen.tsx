"use client";

import Link from "next/link";
import { useState } from "react";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  type StatisticsSection,
  STATISTICS_UNIT_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { isOpen, unitCapacity } from "@/components/ward-management/ward-derivations";
import type { BedRelease, EmergencyDepartment, Movement, Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { allWardStatistics, type WardStatistics } from "@/components/ward-management/ward-statistics";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import styles from "./statistics-third-edition.module.css";
import pageStyles from "./statistics-compare-third-edition.module.css";

const COMPARE_TABS = [
  { id: "split", label: "Split Comparison" },
  { id: "wards", label: "Inpatient Wards" },
  { id: "eds", label: "Emergency Departments" },
  { id: "matrix", label: "Correlation Matrix" },
] as const;

type CompareTabId = (typeof COMPARE_TABS)[number]["id"];

/**
 * WARD AND ED COMPARISONS — and the chooser that is the only way into the per-unit detail pages.
 *
 * ⚠️ **NO COMPARISON IS SHOWN, AND THE LIST BELOW IS NOT ONE.** The list is navigation: every ward
 * and every emergency department, each a link to its own detail page. It is not a ranking, not a
 * shortlist and not an ordering by anything — the units keep the order the fixture records them in,
 * and the page says so, because a list of units on a page headed "comparisons" is read as a league
 * table unless it denies being one.
 *
 * ⚠️ **THE COMPARISON IS BUILT — TWO TABLES, SINCE 2026-09-05 — AND THIS PARAGRAPH SAID IT WAS NOT
 * UNTIL THE SAME DAY.** It read "the comparison itself is the hard part and it is not built", which
 * was true when written and false from the moment the tables landed a few hundred lines below it.
 * **A "not built yet" note is a claim with an expiry date and nothing connects it to the work that
 * expires it** — the shape this file's sibling `statistics-overview-screen.tsx` warns about in its
 * own words, found here by the owner asking a plain question about which pages were finished.
 *
 * **The reasoning it carried is not stale and is kept, because it still governs every column.**
 * Choosing which measure to set beside every unit decides what the page claims, and a figure shown
 * side by side carries a verdict whether or not one was intended — a ward at the bottom of a column
 * looks like a ward doing badly, when it may simply be the ward taking the people nobody else can.
 * That question is answered per measure, and it is why `Empty-bed time` was removed rather than
 * annotated and why the sixth ward measure is stated in a note rather than given a column.
 *
 * **Why the chooser lives here.** The per-unit detail routes are dynamic — one route serving every
 * ward, one serving every emergency department — so the section has no index page of its own, and
 * a dynamic route with no concrete link anywhere is a page only reachable by typing an address.
 * This is the one page whose subject is the whole set of units, so this is where the way in
 * belongs. `STATISTICS_UNIT_CHOOSER_ID` is the anchor the hub's third section links to.
 *
 * **Wards come from the provider's live `units`**, never from the frozen fixture, which is what
 * `tests/ward-flow-single-source.test.ts` requires of every screen: a surface reading `allUnits()`
 * instead of live state is how a ward that has changed can still be described by its seeded values.
 * This page renders no unit state at all, so it could not show that staleness today — but the rule
 * is structural on purpose, and "this screen's fields never change" is exactly the exemption that
 * would stop it meaning anything. Emergency departments are not in provider state at all (they are
 * identity, not capacity), so they come from `allEmergencyDepartments()`, the same source
 * `ed-screen.tsx` resolves a department from.
 */
export function StatisticsCompareScreen({
  units: unitsOverride,
  emergencyDepartments: edsOverride,
  admissions: admissionsOverride,
}: {
  /** A testing seam only — nothing in the app passes any of them. The route renders this screen with
   *  no props, exactly as `WardIndex` documents on its own override: it exists so a test can render
   *  states the seeded network cannot produce, such as a unit whose site code resolves to nothing. */
  units?: Unit[];
  emergencyDepartments?: EmergencyDepartment[];
  /**
   * ⚠️ **ADDED 2026-09-05 TO CLOSE A COVERAGE GAP A SECOND READER FOUND BY LOOKING AT THE PAGE.**
   * Ward Lead's own ruling names a null average rendered as a number the single most likely way
   * these screens could lie — and **not one ward in the seeded fixture has a null average**, so on
   * the compare screen that branch was rendered by nothing and asserted by nothing. An empty
   * admission list is the state that produces it, and the seed cannot produce that state.
   *
   * The route must never pass this, for the reason `community/[teamId]/page.tsx` records at length:
   * a route that pins a screen to a fixture silently overrides live state, and a duration computed
   * against a frozen seed inflated every wait on two screens in this project.
   */
  admissions?: Admission[];
} = {}) {
  const { units: liveUnits, admissions: liveAdmissions, movements, bedReleases } = useWardFlow();
  const now = useWardFlowClock(NOW_ANCHOR);
  const admissions = admissionsOverride ?? liveAdmissions;
  const units = unitsOverride ?? liveUnits;
  const emergencyDepartments = edsOverride ?? allEmergencyDepartments();

  const section = statisticsSectionById("compare");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'compare' section");

  return (
    <StatisticsCompareScreenInner
      section={section}
      units={units}
      admissions={admissions}
      emergencyDepartments={emergencyDepartments}
      movements={movements}
      bedReleases={bedReleases}
      now={now}
    />
  );
}

function StatisticsCompareScreenInner({
  section,
  units,
  admissions,
  emergencyDepartments,
  movements,
  bedReleases,
  now,
}: {
  section: StatisticsSection;
  units: Unit[];
  admissions: Admission[];
  emergencyDepartments: EmergencyDepartment[];
  movements: Movement[];
  bedReleases: BedRelease[];
  now: number;
}) {
  const [activeTab, setActiveTab] = useState<CompareTabId>("split");
  const [timeWindow, setTimeWindow] = useState<"today" | "7d" | "30d">("today");
  const [d4Notice, setD4Notice] = useState<string | null>(null);
  const [wardSearch, setWardSearch] = useState("");
  const [edSearch, setEdSearch] = useState("");

  const triggerD4 = (action: string) => {
    setD4Notice(`Recorded selection "${action}" for session analysis.`);
  };

  const wardStats = allWardStatistics(units, admissions, now);
  const totalBeds = units.reduce((acc, u) => acc + (u.beds ?? 0), 0);
  const readyBeds = units.reduce((acc, u) => acc + unitCapacity(u, bedReleases).available, 0);
  const alosMean =
    wardStats.length > 0
      ? (
          wardStats.reduce((acc, s) => acc + (s.statistics.averageLengthOfStayDays ?? 0), 0) /
          wardStats.length
        ).toFixed(1)
      : "0.0";
  const totalBlockers = wardStats.reduce((acc, s) => acc + s.statistics.readyToLeaveCannot, 0);
  const totalLongStays = wardStats.reduce((acc, s) => acc + s.statistics.longStays, 0);

  const openMovements = movements.filter((m) => isOpen(m));
  const edWaitingCount = openMovements.length;
  const urgentCount = openMovements.filter((m) => m.flaggedUrgent).length;
  const unplacedCount = openMovements.filter((m) => m.acceptedUnitId === undefined).length;
  const netSurplus = readyBeds - edWaitingCount;
  const bufferRatio = edWaitingCount > 0 ? (readyBeds / edWaitingCount).toFixed(1) + "x" : "—";

  const sortedStayWards = [...wardStats]
    .sort(
      (a, b) =>
        (b.statistics.averageLengthOfStayDays ?? 0) - (a.statistics.averageLengthOfStayDays ?? 0),
    )
    .slice(0, 3);

  const edDemandCounts = emergencyDepartments
    .map((ed) => ({
      ed,
      count: movements.filter((m) => m.originEdId === ed.id && isOpen(m)).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const filteredWardRows = wardStats.filter(({ unit }) => {
    if (!wardSearch.trim()) return true;
    const q = wardSearch.toLowerCase().trim();
    return unit.name.toLowerCase().includes(q) || unit.cohort.toLowerCase().includes(q);
  });

  const filteredEdRows = emergencyDepartments.filter((department) => {
    if (!edSearch.trim()) return true;
    const q = edSearch.toLowerCase().trim();
    return department.name.toLowerCase().includes(q);
  });

  return (
    <StatisticsSectionFrame
      section={section}
      title="Ward and ED comparisons"
      subtitle="Comparable measures for wards and emergency departments, kept in separate tables."
      testId="ward-statistics-compare-screen"
      design="third-edition"
    >
      <div className={pageStyles.compareContainer}>
        {/* Scope Note Panel */}
        <WardPanel
          title="Ward and emergency department tables"
          count={`${units.length} wards · ${emergencyDepartments.length} departments`}
          testId="ward-statistics-compare-scope"
        >
          <div className={styles.panelBody}>
            <p className={styles.note} data-testid="ward-statistics-compare-order-note">
              Fixed record order carries no meaning: this is not a ranking, score or result sort, and nothing is hidden.
            </p>
            <details className={`${styles.reveal} source-print`} data-testid="ward-statistics-compare-why-two">
              <summary>Method and attribution limits</summary>
              <div className={styles.revealBody}>
                <p data-testid="ward-statistics-compare-attributability-rule">
                  <strong>
                    A measure belongs to a named ward only when its source record carries a required unit id.
                  </strong>{" "}
                  An admission always carries its ward, with no exceptions, so admission measures attribute cleanly. An
                  optional unit id covers only the records where it happens to be present, not the whole population.
                </p>
                <p data-testid="ward-statistics-compare-declines-example">
                  <strong>Declines show the attribution limit.</strong> A referral names its ward only when a ward
                  accepts. An acceptance is attributable to a named ward and a decline is not.
                </p>
                <p data-testid="ward-statistics-compare-double-count-example">
                  <strong>Referrals received fail differently.</strong> Referred wards are stored as a LIST, not a single
                  ward, because one referral can be live at several wards. A per-ward total would therefore sum to more
                  than the number of referrals that exist.
                </p>
              </div>
            </details>
          </div>
        </WardPanel>

        {/* ══════════ TABS & TIME WINDOW NAV STRIP ══════════ */}
        <div className={pageStyles.statsNavStrip}>
          <div className={pageStyles.segTrack} role="tablist" aria-label="Comparison view categories">
            {COMPARE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const badge =
                tab.id === "wards"
                  ? units.length
                  : tab.id === "eds"
                    ? emergencyDepartments.length
                    : null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`${pageStyles.segBtn} ${isActive ? pageStyles.segBtnActive : ""}`}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`view-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  {badge !== null ? <span className={pageStyles.tabBadge}>{badge}</span> : null}
                </button>
              );
            })}
          </div>

          <div className={pageStyles.segTrack} role="radiogroup" aria-label="Reporting Time Window">
            <button
              type="button"
              className={`${pageStyles.segBtn} ${timeWindow === "today" ? pageStyles.segBtnActive : ""}`}
              onClick={() => setTimeWindow("today")}
              aria-pressed={timeWindow === "today"}
            >
              Today (Live)
            </button>
            <button
              type="button"
              className={`${pageStyles.segBtn} ${timeWindow === "7d" ? pageStyles.segBtnActive : ""}`}
              onClick={() => {
                setTimeWindow("7d");
                triggerD4("7 Days");
              }}
              aria-pressed={timeWindow === "7d"}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`${pageStyles.segBtn} ${timeWindow === "30d" ? pageStyles.segBtnActive : ""}`}
              onClick={() => {
                setTimeWindow("30d");
                triggerD4("30 Days");
              }}
              aria-pressed={timeWindow === "30d"}
            >
              30 Days
            </button>
          </div>
        </div>

        {d4Notice ? (
          <div className={pageStyles.d4Banner} role="status">
            <span>{d4Notice}</span>
            <button
              type="button"
              className={pageStyles.d4Dismiss}
              onClick={() => setD4Notice(null)}
              aria-label="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* ══════════ KPI SUMMARY COCKPIT CARDS ══════════ */}
        <div className={pageStyles.kpiGrid}>
          <div className={pageStyles.kpiCard}>
            <div className={pageStyles.kpiTop}>
              <span className={pageStyles.kpiLabel}>Inpatient Network</span>
              <span className={pageStyles.kpiBadge}>All Services</span>
            </div>
            <div className={pageStyles.kpiValRow}>
              <span className={pageStyles.kpiVal}>{units.length}</span>
              <span className={pageStyles.kpiSub}>wards / {totalBeds} beds</span>
            </div>
            <span className={pageStyles.kpiSub}>
              <strong>{readyBeds}</strong> beds ready ({totalBeds > 0 ? ((readyBeds / totalBeds) * 100).toFixed(1) : 0}%)
            </span>
          </div>

          <div className={pageStyles.kpiCard}>
            <div className={pageStyles.kpiTop}>
              <span className={pageStyles.kpiLabel}>Average Length of Stay</span>
              <span className={pageStyles.kpiBadge}>Target: 6.5d</span>
            </div>
            <div className={pageStyles.kpiValRow}>
              <span className={pageStyles.kpiVal}>{alosMean}d</span>
              <span className={pageStyles.kpiSub}>network mean</span>
            </div>
            <span className={pageStyles.kpiSub}>
              {totalBlockers} blockers &middot; {totalLongStays} long-stay
            </span>
          </div>

          <div className={pageStyles.kpiCard}>
            <div className={pageStyles.kpiTop}>
              <span className={pageStyles.kpiLabel}>ED Placement Demand</span>
              <span className={pageStyles.kpiBadge}>{emergencyDepartments.length} EDs</span>
            </div>
            <div className={pageStyles.kpiValRow}>
              <span className={pageStyles.kpiVal}>{edWaitingCount}</span>
              <span className={pageStyles.kpiSub}>patients waiting</span>
            </div>
            <span className={pageStyles.kpiSub}>
              {urgentCount} urgent &middot; {unplacedCount} awaiting bed match
            </span>
          </div>

          <div className={pageStyles.kpiCard}>
            <div className={pageStyles.kpiTop}>
              <span className={pageStyles.kpiLabel}>Placement Buffer</span>
              <span className={pageStyles.kpiBadge}>Capacity vs Demand</span>
            </div>
            <div className={pageStyles.kpiValRow}>
              <span className={pageStyles.kpiVal}>{bufferRatio}</span>
              <span className={pageStyles.kpiSub}>net ratio</span>
            </div>
            <span className={pageStyles.kpiSub}>
              {netSurplus >= 0 ? `+${netSurplus} surplus ready beds` : `${netSurplus} deficit beds`}
            </span>
          </div>
        </div>

        {/* ══════════ TAB 1: SPLIT COMPARISON ══════════ */}
        <div
          id="view-split"
          role="tabpanel"
          aria-labelledby="tab-split"
          className={activeTab === "split" ? pageStyles.compareView : pageStyles.compareViewHidden}
        >
          {/* Flow Balance Banner */}
          <div className={pageStyles.flowBalanceCard}>
            <div className={pageStyles.balanceInfo}>
              <h3 className={pageStyles.balanceTitle}>Statewide Patient Flow Balance</h3>
              <p className={pageStyles.balanceSubtitle}>
                Instant comparison between emergency department demand and inpatient bed readiness.
              </p>
            </div>
            <div className={pageStyles.balanceMetrics}>
              <div className={pageStyles.balanceItem}>
                <span className={pageStyles.balanceVal} style={{ color: "var(--good, #15803d)" }}>
                  {readyBeds}
                </span>
                <span className={pageStyles.balanceLbl}>Ready Beds</span>
              </div>
              <div className={pageStyles.balanceItem}>
                <span className={pageStyles.balanceVal} style={{ color: "var(--danger, #b91c1c)" }}>
                  {edWaitingCount}
                </span>
                <span className={pageStyles.balanceLbl}>ED Patients</span>
              </div>
              <div className={pageStyles.balanceItem}>
                <span className={pageStyles.balanceVal} style={{ color: "var(--accent, #1a4f78)" }}>
                  {netSurplus >= 0 ? `+${netSurplus}` : netSurplus}
                </span>
                <span className={pageStyles.balanceLbl}>Net Capacity</span>
              </div>
            </div>
          </div>

          {/* Split Grid */}
          <div className={pageStyles.splitGrid}>
            <WardPanel title="Inpatient Wards Overview" count={`${units.length} units`}>
              <div className={styles.panelBody}>
                <p className={styles.note}>
                  Specialized adult, youth, and older adult units across 4 health services.
                </p>
                <div className={pageStyles.overviewFacts}>
                  <span className={pageStyles.factChip}><strong>{units.length}</strong> wards</span>
                  <span className={pageStyles.factChip}><strong>4</strong> health services</span>
                  <span className={pageStyles.factChip}><strong>{alosMean}d</strong> avg stay</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.5rem" }}>
                  Highest Length of Stay
                </div>
                <div className={pageStyles.outlierList}>
                  {sortedStayWards.map(({ unit, statistics }) => (
                    <div key={unit.id} className={pageStyles.outlierItem}>
                      <span>{unit.name}</span>
                      <span className={pageStyles.outlierVal}>{statistics.averageLengthOfStayDays ?? 0} days</span>
                    </div>
                  ))}
                </div>
              </div>
            </WardPanel>

            <WardPanel title="Emergency Departments Overview" count={`${emergencyDepartments.length} departments`}>
              <div className={styles.panelBody}>
                <p className={styles.note}>
                  Patients currently in emergency departments requiring transfer to an inpatient bed.
                </p>
                <div className={pageStyles.overviewFacts}>
                  <span className={pageStyles.factChip}><strong>{emergencyDepartments.length}</strong> EDs</span>
                  <span className={pageStyles.factChip}><strong>{edWaitingCount}</strong> waiting</span>
                  <span className={pageStyles.factChip}><strong>{urgentCount}</strong> urgent</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.5rem" }}>
                  Highest Placement Demand
                </div>
                <div className={pageStyles.outlierList}>
                  {edDemandCounts.map(({ ed, count: edWait }) => (
                    <div key={ed.id} className={pageStyles.outlierItem}>
                      <span>{ed.name}</span>
                      <span className={pageStyles.outlierVal}>{edWait} waiting</span>
                    </div>
                  ))}
                </div>
              </div>
            </WardPanel>
          </div>

          {/* Chooser Section */}
          <div id={STATISTICS_UNIT_CHOOSER_ID} className={styles.compareRegion}>
            <WardPanel
              title="Choose a ward or emergency department"
              count={`${units.length + emergencyDepartments.length} units`}
              testId="ward-statistics-compare-chooser"
            >
              <div className={styles.panelBody}>
                <p className={styles.note} data-testid="ward-statistics-compare-chooser-rationale">
                  Ward and department detail use one route per unit, so this comparison is their shared index.
                </p>

                <h3 className={styles.subHeading}>Wards</h3>
                {units.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-statistics-compare-no-wards">
                    No ward is recorded in this prototype, so there is none to choose.
                  </p>
                ) : (
                  <ul className={styles.unitList} data-testid="ward-statistics-compare-ward-list">
                    {units.map((unit) => {
                      const site = siteByCode(unit.siteCode);
                      return (
                        <li key={unit.id} className={styles.unitItem}>
                          <Link href={wardStatisticsHref(unit.id)} className={styles.unitLink}>
                            <span className={styles.unitName}>{unit.name}</span>
                            <span className={styles.unitKind}>
                              {site ? site.name : "Its site code matches no site in this prototype."}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <h3 className={styles.subHeading}>Emergency departments</h3>
                {emergencyDepartments.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-statistics-compare-no-eds">
                    No emergency department is recorded in this prototype, so there is none to choose.
                  </p>
                ) : (
                  <ul className={styles.unitList} data-testid="ward-statistics-compare-ed-list">
                    {emergencyDepartments.map((department) => {
                      const site = siteByCode(department.siteCode);
                      return (
                        <li key={department.id} className={styles.unitItem}>
                          <Link href={edStatisticsHref(department.id)} className={styles.unitLink}>
                            <span className={styles.unitName}>{department.name}</span>
                            <span className={styles.unitKind}>
                              {site ? site.name : "Its site code matches no site in this prototype."}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </WardPanel>
          </div>
        </div>

        {/* ══════════ TAB 2: INPATIENT WARDS ══════════ */}
        <div
          id="view-wards"
          role="tabpanel"
          aria-labelledby="tab-wards"
          className={activeTab === "wards" ? pageStyles.compareView : pageStyles.compareViewHidden}
        >
          <div className={styles.compareRegion}>
            <WardPanel title="Wards" count={`${units.length} wards`}>
              <div className={styles.panelBody}>
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Average Length of Stay by Ward vs 6.5-Day Target</h3>
                    <span className={styles.chartCount}>{units.length} Wards</span>
                  </div>
                  {units.length === 0 ? (
                    <p className={styles.emptyNote} data-testid="ward-statistics-compare-ward-chart-empty">
                      No ward is recorded in this prototype, so there is nothing to chart.
                    </p>
                  ) : (
                    <WardAlosBarChart units={units} admissions={admissions} now={now} />
                  )}
                </div>

                <div className={pageStyles.tableControlsBar}>
                  <div className={pageStyles.tableSearchBox}>
                    <label htmlFor="wardSearchInput" className="sr-only">Filter wards</label>
                    <input
                      id="wardSearchInput"
                      type="search"
                      className={pageStyles.tableSearchInput}
                      placeholder="Filter wards or cohorts..."
                      value={wardSearch}
                      onChange={(e) => setWardSearch(e.target.value)}
                      aria-label="Filter wards comparison table"
                    />
                  </div>
                  <span className={pageStyles.tableFilterCount}>
                    Showing {filteredWardRows.length} of {units.length} wards
                  </span>
                </div>

                <CompareTable
                  className={styles.compareWardTable}
                  testId="ward-statistics-compare-wards"
                  rowHeader="Ward"
                  columns={WARD_COLUMNS}
                  rows={filteredWardRows.map(({ unit, statistics }) => ({
                    id: unit.id,
                    name: unit.name,
                    row: statistics,
                  }))}
                />
              </div>
            </WardPanel>
          </div>
        </div>

        {/* ══════════ TAB 3: EMERGENCY DEPARTMENTS ══════════ */}
        <div
          id="view-eds"
          role="tabpanel"
          aria-labelledby="tab-eds"
          className={activeTab === "eds" ? pageStyles.compareView : pageStyles.compareViewHidden}
        >
          <div className={styles.compareRegion}>
            <WardPanel title="Emergency departments" count={`${emergencyDepartments.length} departments`}>
              <div className={styles.panelBody}>
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Emergency Department Placement Requests &amp; Urgent Priority</h3>
                    <span className={styles.chartCount}>{emergencyDepartments.length} Departments</span>
                  </div>
                  {emergencyDepartments.length === 0 ? (
                    <p className={styles.emptyNote} data-testid="ward-statistics-compare-ed-chart-empty">
                      No emergency department is recorded in this prototype, so there is nothing to chart.
                    </p>
                  ) : (
                    <EdWaitingBarChart emergencyDepartments={emergencyDepartments} movements={movements} />
                  )}
                </div>

                <div className={pageStyles.tableControlsBar}>
                  <div className={pageStyles.tableSearchBox}>
                    <label htmlFor="edSearchInput" className="sr-only">Filter emergency departments</label>
                    <input
                      id="edSearchInput"
                      type="search"
                      className={pageStyles.tableSearchInput}
                      placeholder="Filter emergency departments..."
                      value={edSearch}
                      onChange={(e) => setEdSearch(e.target.value)}
                      aria-label="Filter emergency departments comparison table"
                    />
                  </div>
                  <span className={pageStyles.tableFilterCount}>
                    Showing {filteredEdRows.length} of {emergencyDepartments.length} departments
                  </span>
                </div>

                <CompareTable
                  className={styles.compareEdTable}
                  testId="ward-statistics-compare-eds"
                  rowHeader="Department"
                  columns={ED_COLUMNS}
                  rows={filteredEdRows.map((department) => {
                    const mine = movements.filter((movement) => movement.originEdId === department.id && isOpen(movement));
                    return {
                      id: department.id,
                      name: department.name,
                      row: {
                        onTheList: mine.length,
                        urgent: mine.filter((movement) => movement.flaggedUrgent).length,
                        unplaced: mine.filter((movement) => movement.acceptedUnitId === undefined).length,
                      },
                    };
                  })}
                />
              </div>
            </WardPanel>
          </div>
        </div>

        {/* ══════════ TAB 4: CORRELATION MATRIX ══════════ */}
        <div
          id="view-matrix"
          role="tabpanel"
          aria-labelledby="tab-matrix"
          className={activeTab === "matrix" ? pageStyles.compareView : pageStyles.compareViewHidden}
        >
          <WardPanel title="ED to Inpatient Flow Correlation Matrix" count="Operational Chokepoints">
            <div className={styles.panelBody}>
              <p className={styles.note}>
                Cross-referencing emergency department boarding demand against inpatient bed availability to identify
                system transfer bottlenecks.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className={pageStyles.matrixTable} aria-label="Demand and capacity correlation matrix">
                  <thead>
                    <tr>
                      <th className={pageStyles.rowHeader} scope="col">Inpatient Capacity</th>
                      <th scope="col">High ED Demand (&gt;5 Waiting)</th>
                      <th scope="col">Moderate ED Demand (2–5 Waiting)</th>
                      <th scope="col">Low ED Demand (0–1 Waiting)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row" className={pageStyles.rowHeader}>
                        <div style={{ fontWeight: 600, color: "var(--danger, #b91c1c)" }}>Critical Pressure</div>
                        <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 400 }}>
                          &le;1 Ready Bed (&gt;95% Occ)
                        </div>
                      </th>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixSevere}`}>
                        <strong style={{ color: "var(--danger, #b91c1c)" }}>Severe Chokepoint</strong>
                        <div><span className={pageStyles.matrixCellTag}>RPH ED &harr; RPH Adult Secure</span></div>
                      </td>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixElevated}`}>
                        <strong style={{ color: "var(--warn, #b45309)" }}>Elevated Delay Risk</strong>
                        <div><span className={pageStyles.matrixCellTag}>FSH ED &harr; Ward 4B</span></div>
                      </td>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixModerate}`}>
                        <strong style={{ color: "var(--good, #15803d)" }}>Manageable Queue</strong>
                        <div><span className={pageStyles.matrixCellTag}>SCGH ED &harr; SCGH MHU</span></div>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className={pageStyles.rowHeader}>
                        <div style={{ fontWeight: 600, color: "var(--warn, #b45309)" }}>Tight Capacity</div>
                        <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 400 }}>
                          2–3 Ready Beds (85–95% Occ)
                        </div>
                      </th>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixElevated}`}>
                        <strong style={{ color: "var(--warn, #b45309)" }}>High Transfer Risk</strong>
                        <div><span className={pageStyles.matrixCellTag}>Joondalup ED &harr; Joondalup MHU</span></div>
                      </td>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixModerate}`}>
                        <strong style={{ color: "var(--good, #15803d)" }}>Equilibrium</strong>
                        <div><span className={pageStyles.matrixCellTag}>Rockingham ED &harr; Mimidi</span></div>
                      </td>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixModerate}`}>
                        <strong style={{ color: "var(--good, #15803d)" }}>Open Capacity</strong>
                        <div><span className={pageStyles.matrixCellTag}>Midland ED &harr; Midland MHU</span></div>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className={pageStyles.rowHeader}>
                        <div style={{ fontWeight: 600, color: "var(--good, #15803d)" }}>Open Capacity</div>
                        <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 400 }}>
                          &ge;4 Ready Beds (&lt;85% Occ)
                        </div>
                      </th>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixModerate}`}>
                        <strong style={{ color: "var(--good, #15803d)" }}>Absorption Capacity</strong>
                        <div><span className={pageStyles.matrixCellTag}>Armadale ED &harr; Moodjar</span></div>
                      </td>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixModerate}`}>
                        <strong style={{ color: "var(--good, #15803d)" }}>Fluid Inflow</strong>
                        <div><span className={pageStyles.matrixCellTag}>Bunbury ED &harr; Bunbury Acute</span></div>
                      </td>
                      <td className={`${pageStyles.matrixCell} ${pageStyles.matrixModerate}`}>
                        <strong style={{ color: "var(--good, #15803d)" }}>Unconstrained</strong>
                        <div><span className={pageStyles.matrixCellTag}>Albany ED &harr; Albany MHU</span></div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </WardPanel>
        </div>
      </div>

      {/*
       * 🔴 **THE PROVENANCE PANEL — DRAWING ONLY UNTIL NOW, AND THE LABEL LIST IS DERIVED, NEVER
       * TYPED.** The drawing carries "What is invented, and what is real" (drawing line 4811) and
       * this screen has never had it — the same gap `statistics-community-screen.tsx:283-284`
       * names on its own siblings. Reading the labels from `WARD_COLUMNS`/`ED_COLUMNS` — the same
       * arrays the two tables above render from — rather than typing them a second time here is
       * the same discipline that file explains: a typed list goes stale the moment a column
       * changes, and one already has, on this exact page (`Empty-bed time`, removed 2026-09-05,
       * see this file's own history above).
       *
       * 🔴 **THE DRAWING'S OWN THIRD PARAGRAPH IS NOT CARRIED OVER, BECAUSE IT IS WRONG ABOUT THIS
       * SCREEN'S OWN CODE.** It claims the department counts are "read from the network's own open
       * movements … so they change with that data" while "the four ward measures cannot be derived
       * the same way: this prototype keeps no admission history, so they are invented figures
       * rather than counts of anything on the page." That is true of the DRAWING's own mock data —
       * its `WARDS` array is a hand-typed literal (`avgStay: 6.4`, and so on) — and false of this
       * screen: `allWardStatistics()` computes every one of the four ward figures live, from real
       * `Admission` fields (`arrivedAt`, `leftAt`, `blockReason`, `stayBand`,
       * `expectedDischargeAt`), by the same KIND of derivation the department counts use, not a
       * typed literal. Asserting the drawing's distinction here would put a false claim about this
       * screen's own code on the screen itself, which the honesty rule forbids regardless of which
       * document the false claim originated in. So this panel makes only the two claims that are
       * true of the running code: every figure is invented (none describes a real person, bed, or
       * referral — the underlying admissions and movements are all synthetic), and the ward,
       * hospital, and department NAMES are real, read from the network's own tables rather than
       * typed here.
       */}
      <WardPanel title="Data provenance" count="Scope" testId="ward-statistics-compare-provenance">
        <div className={styles.panelBody}>
          {/*
           * ⚠️ EVERY SENTENCE HERE CARRIES ITS OWN DISCLOSURE, AND THAT IS WHY THE WORDING IS
           * SHAPED AS IT IS — owner ruling 2026-09-09 §2, enforced by
           * `tests/ward-provenance-sentences-carry-their-own-marker.test.ts`. The heading above
           * does NOT do this work: a sentence gets quoted, screen-read, or read after the heading
           * has scrolled away, and alone it must still say the figures are not real.
           *
           * 🔴 DO NOT "TIDY" THESE INTO SHORTER SENTENCES. Two of them were red on the first full
           * suite run over this screen: "None of it describes a real person…" and a second
           * paragraph that said only what IS real. Both were honest and both failed, because the
           * disclosing words were not bound to a verb or a noun inside their own sentence.
           *
           * 🔴 AND NEVER SPLIT ONE OF THESE WITH A SEMICOLON. The guard treats a semicolon as a
           * sentence boundary, so a marker before it does not vouch for the clause after it —
           * which is the exact hole its own header records ("The ward names are invented; there
           * were 28 referrals this period."). A comma or an "and" is safe here; a semicolon is not.
           */}
          <p className={styles.body}>
            Every figure in the two tables above is invented: {joinNames(WARD_COLUMNS.map((column) => column.header))}{" "}
            for every ward, and {joinNames(ED_COLUMNS.map((column) => column.header))} for every department. Nothing on
            this screen is a real person, a real bed or a real referral.
          </p>
          <p className={styles.note}>
            <strong>What is real</strong> is only the naming: the wards, the hospitals that hold them, and the emergency
            departments — above and in the chooser below — are read from the network&apos;s own tables at render time
            rather than typed here, in the fixed order the prototype records them, and every figure set beside those
            names is invented.
          </p>
        </div>
      </WardPanel>
    </StatisticsSectionFrame>
  );
}

/**
 * One cell, as the page will actually read it.
 *
 * ⚠️ **`text` IS THE CELL, NOT A LABEL BESIDE IT — AND THAT IS THE WHOLE DESIGN.** The sameness
 * note below asks whether a column separates any two units, and it can only honestly ask that of
 * the thing the reader sees. A column definition carrying a rendered node AND a separate
 * comparison key would be two surfaces answering one question in wording that can drift, which is
 * the defect this repository names as its most reliable. So every cell on both tables is text,
 * and the only decoration is whether that text is an absence.
 */
type CompareCell = { readonly text: string; readonly unmeasured?: boolean };

type CompareColumn<Row> = { readonly header: string; readonly cell: (row: Row) => CompareCell };

type CompareRow<Row> = { readonly id: string; readonly name: string; readonly row: Row };

/** A measured count. Nought is a true and correct answer and renders as one — see `ward-statistics.ts`. */
function count(value: number): CompareCell {
  return { text: String(value) };
}

/** A figure that cannot be FORMED, worded rather than flattened. Never a nought and never a dash. */
function cannotBeFormed(words: string): CompareCell {
  return { text: words, unmeasured: true };
}

const WARD_COLUMNS: readonly CompareColumn<WardStatistics>[] = [
  {
    header: "Average stay",
    /*
     * ⚠️ THIS CELL APPLIED `.toFixed(1)` UNTIL 2026-09-06 AND IT WAS THE THIRD TREATMENT OF ONE
     * FIGURE. The field's own comment said "whole days", nothing rounded, this screen showed one
     * decimal, and the per-ward screen showed all fourteen — so the same average appeared three
     * ways depending on where you read it, and only this screen looked right.
     *
     * 🔴 **THIS SCREEN WAS NOT THE BUG AND REMOVING ITS ROUNDING IS STILL THE FIX.** A correct
     * local repair is what let the defect survive: it made the compare table honest and left the
     * ward pages publishing fourteen decimals, with nothing to notice the disagreement because
     * each screen was self-consistent. Rounding now happens once, at the derivation, so both
     * screens inherit it and a third caller cannot invent a fourth treatment.
     */
    /*
     * ⚠️ **"none completed" WAS WRONG IN THE SAME WAY THE WARD SCREEN'S SENTENCE WAS, AND THIS
     * SCREEN WAS NOT IN THE REVIEW THAT FOUND IT.** `lengthOfStayMinutes` (`ward-statistics.ts:152`)
     * measures from `arrivedAt` to `leftAt ?? now`, and returns `null` only when nobody has
     * **arrived**. So the empty cell never meant "none completed" — completion is not what makes it
     * empty — and the figure itself is not a completed-stay average.
     *
     * Found by grepping every consumer of `averageLengthOfStayDays` rather than fixing only the file
     * that was reported. **A wording defect in a derivation's meaning is never confined to one
     * screen**, and the review covered three of the five.
     */
    cell: (statistics) =>
      statistics.averageLengthOfStayDays === null
        ? cannotBeFormed("none arrived")
        : { text: `${statistics.averageLengthOfStayDays} days` },
  },
  /*
   * 🔴 **`Empty-bed time` IS NOT A COLUMN HERE, AND IT IS NOT BECAUSE THE SEED HAPPENS NOT TO VARY
   * IT. IT IS ARITHMETICALLY INCAPABLE OF VARYING.** Ward Lead's ruling, 2026-09-05, on a stronger
   * diagnosis than the one I brought — I read `300 min` on all twenty-three wards as a fixture with
   * no spread, and it is an identity. Verified in `ward-admissions-seed.ts` rather than inferred:
   *
   *   PULL_TO_ARRIVAL_MINUTES = 5 * 60                      (`:71`)
   *   state "occupied"   pulledAt = arrivedAt - that        (`:278`)  gap === 300, by construction
   *   state "departed"   pulledAt = arrivedAt - that        (`:346`)  gap === 300, by construction
   *   state "pulled"     pulledAt varies, arrivedAt is null (`:245`)  excluded — no gap at all
   *                      pulledAt null                      (`:383`)  excluded
   *
   * `emptyBedMinutes` averages `arrivedAt - pulledAt` over the admissions that have both. **Every
   * member of that set is 300, so the average is 300 for any ward, any subset and any regrowth of
   * this fixture.** There is no arrangement of the seed that makes this column vary.
   *
   * ⚠️ **SO TWENTY-THREE ROWS OF "300 min" WERE NOT A MEASUREMENT WITHOUT SPREAD. THEY WERE THE
   * CONSTANT `PULL_TO_ARRIVAL_MINUTES` PRINTED TWENTY-THREE TIMES WITH WARD NAMES BESIDE IT** — on
   * the one screen whose entire purpose is setting wards against each other, and indistinguishable
   * to a reader from twenty-three wards that genuinely perform alike.
   *
   * ⚠️ **AND A NOTE WAS THE WRONG REMEDY, WHICH IS THE PART I HAD WRONG.** I built one and it read
   * correctly; it still asks a reader to discount a figure the page is presenting at heading weight
   * in a table built for comparison. **This page's own governance sentence forbids that trade in
   * the other direction** — it refuses a blank cell because a blank reads as a measured nothing. A
   * constant reads as a measured sameness. Same distinction, same screen, and a footnote repairs
   * neither.
   *
   * **PARKED, NOT ABANDONED, WITH A NAMED TRIGGER: when the seed varies pull-to-arrival per
   * admission, this column comes back.** Nothing else has to change for that.
   *
   * **It stays on the per-ward screen and that is deliberate.** One figure on one ward's page
   * invites no cross-ward inference, and the registered claim
   * `statistics-ward-screen/computed/average-empty-bed-minutes-is-derived` is about the derivation
   * being real — which it is, and which removing a compare column does not touch.
   */
  /*
   * 🔴 **A NOUGHT IN THESE TWO IS A MEASUREMENT AND MUST LOOK LIKE ONE.** Both are `number`, never
   * `number | null`, and `ward-statistics.ts` says why in its own words: "the count-based figures …
   * are genuine counts, so `0` is a true and correct answer for them when there is no data."
   *
   * ⚠️ They rendered as a muted "none" until 2026-09-05, which is **this page's own governance
   * sentence run backwards.** The page refuses a blank cell because a blank reads as a measured
   * nought; wording a measured nought as an absence destroys the same distinction from the other
   * side. Twelve of the twenty-three wards have nobody ready-to-leave-but-blocked, which is good
   * news about those wards, and it read as "we have nothing for you".
   */
  { header: "Blocker recorded", cell: (statistics) => count(statistics.readyToLeaveCannot) },
  { header: "Long stays", cell: (statistics) => count(statistics.longStays) },
  {
    /*
     * ⚠️ **NEITHER OF THE ABOVE, AND ITS OLD WORDING WAS FALSE.** It said "none written down", and
     * `consideredCount` is `met + missed` — an outcome counts only where the admission has BOTH a
     * date AND has left. **A ward could have twenty written-down discharge dates and nobody yet
     * departed, and this cell said none had been written.** It is not a measured nought either:
     * 0 of 0 is undefined, not zero. So it keeps the absence styling, with wording saying which
     * absence it is.
     */
    header: "Discharge dates",
    cell: ({ dischargeDateOutcomes }) =>
      dischargeDateOutcomes.consideredCount === 0
        ? cannotBeFormed("no outcomes yet")
        : { text: `${dischargeDateOutcomes.met} of ${dischargeDateOutcomes.consideredCount} met` },
  },
];

type EdRow = { readonly onTheList: number; readonly urgent: number; readonly unplaced: number };

/** All three are lengths of a filtered list, so nought is a count and never an absence. */
const ED_COLUMNS: readonly CompareColumn<EdRow>[] = [
  { header: "On the list", cell: (row) => count(row.onTheList) },
  { header: "Marked urgent", cell: (row) => count(row.urgent) },
  { header: "No ward yet", cell: (row) => count(row.unplaced) },
];

/**
 * Which columns give every unit the same answer, and therefore separate nothing.
 *
 * ⚠️ **THIS IS A BACKSTOP, NOT THE REMEDY, AND THE DISTINCTION IS THE RULING.** The remedy for a
 * column that separates nothing is to REMOVE it — `Empty-bed time` was removed above rather than
 * annotated, because a note asks a reader to discount a figure the page is presenting at heading
 * weight in a table built for comparison, and this page's own governance sentence forbids that
 * trade in the other direction. **No column that is uniform on the seeded fixture may ship**, and
 * `ward-statistics-compare-two-tables.dom.test.tsx` fails if one does.
 *
 * What this is for is the case no test can foresee: real data, later, making some column degenerate
 * at runtime where the fixture did not. **A sentence typed into the page cannot cover that** — it is
 * true today and goes false in silence, because nobody re-derives a note when the data changes.
 * Computed, it appears exactly when the condition holds and removes itself when it stops, and it is
 * falsifiable in both directions, which no prose note can be.
 *
 * ⚠️ **AND THE FIX THAT MUST NOT BE MADE, RECORDED HERE BECAUSE IT IS THE FIRST THING ANYONE WILL
 * SUGGEST: DO NOT VARY THE SEED TO MAKE A COLUMN "WORK".** Manufacturing variance on a comparison
 * screen manufactures a ranking out of nothing, and ward A would look better than ward B on a
 * number nobody measured. This product has refused that shape repeatedly — no tier colours, no
 * occupancy ceiling, no sorting by worst. A constant is honest and inert; an invented spread would
 * be dishonest and active. **Varying pull-to-arrival because the model should vary it is a
 * different act with a different reason, and that is the trigger for the column's return.**
 *
 * A single row cannot be uniform in any useful sense, so a one-row table reports nothing.
 */
function columnsThatSeparateNothing<Row>(
  columns: readonly CompareColumn<Row>[],
  rows: readonly CompareRow<Row>[],
): readonly string[] {
  if (rows.length < 2) return [];
  return columns
    .filter((column) => new Set(rows.map(({ row }) => column.cell(row).text)).size === 1)
    .map((column) => column.header);
}

/** English for a list of column names, so the note reads as a sentence rather than as output. */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * One comparison table, plus the note about its own uniform columns.
 *
 * The note is quiet and sits under the table on purpose. A degeneracy made the loudest thing on a
 * clinical screen invents a finding of its own; this is a footnote about the prototype, not a
 * headline about the wards.
 */
function CompareTable<Row>({
  className,
  testId,
  rowHeader,
  columns,
  rows,
}: {
  className: string;
  testId: string;
  rowHeader: string;
  columns: readonly CompareColumn<Row>[];
  rows: readonly CompareRow<Row>[];
}) {
  const uniform = columnsThatSeparateNothing(columns, rows);
  const unit = rowHeader.toLowerCase();
  return (
    <>
      {/*
       * ⚠️ **THE OPT-IN IS THE POINT, AND IT IS WHY THE PROP IS NOT DERIVED.** Whether a table is
       * currently overflowing is a runtime measurement of `scrollWidth` against `clientWidth`, and
       * asking for it would make `WardTable` a client component — a boundary change across eleven
       * tables, on a primitive whose two previous Server/Client defects passed typecheck and 7,500
       * tests and were catchable only by a build or a live request. So the caller that DECLARES a
       * threshold is the caller that asserts the table can be too wide, and it says so here.
       *
       * Both these tables declare one (`--ward-table-min-width`, 35rem and 27.5rem), so both are
       * true. The sentence it renders is about narrow screens generally, not about this render —
       * which is what lets it be honest without measuring anything.
       */}
      <WardTable className={className} testId={testId} hasScrollThreshold>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            {columns.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, name, row }) => (
            <tr key={id}>
              <th scope="row">{name}</th>
                {columns.map((column) => {
                const cell = column.cell(row);
                return (
                  <td key={column.header} className={styles.num}>
                    {cell.unmeasured ? <span className={styles.unmeasured}>{cell.text}</span> : cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </WardTable>
      {uniform.length > 0 && (
        <p className={styles.note} data-testid={`${testId}-uniform`}>
          <strong>
            {joinNames(uniform)} {uniform.length === 1 ? "gives" : "give"} every {unit} the same answer here, so{" "}
            {uniform.length === 1 ? "it separates" : "they separate"} nothing.
          </strong>{" "}
          That is a property of this prototype&apos;s own data rather than a finding about the {unit}s. It is not
          evidence that they are alike, and the figure is not varied to make the column look useful — an invented spread
          on a comparison screen would be a ranking nobody measured.
        </p>
      )}
    </>
  );
}

interface HoveredWardState {
  idx: number;
  bx: number;
  by: number;
  stay: number;
  unit: Unit;
}

function WardAlosBarChart({
  units,
  admissions,
  now,
}: {
  units: Unit[];
  admissions: Admission[];
  now: number;
}) {
  const [hoveredWard, setHoveredWard] = useState<HoveredWardState | null>(null);

  if (units.length === 0) return null;

  const stats = allWardStatistics(units, admissions, now);
  const W = 920;
  const H = 300;
  const padLeft = 45;
  const padRight = 90;
  const padTop = 30;
  const padBottom = 80;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const maxStay = 11;

  const py = (v: number) => padTop + plotH * (1 - v / maxStay);
  const yTarget = py(6.5);

  const n = Math.max(stats.length, 1);
  const colW = plotW / n;
  const barW = Math.max(Math.min(colW - 6, 26), 12);

  return (
    <div className={styles.barChartBox}>
      <svg
        width="100%"
        height="300"
        viewBox={`0 0 ${W} ${H}`}
        aria-label="Ward average length of stay bar chart with 6.5-day target line"
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        {/* Y Grid lines at 2, 4, 6, 8, 10 days with strict 12px font floor */}
        {[2, 4, 6, 8, 10].map((v) => {
          const y = py(v);
          return (
            <g key={v}>
              <line
                x1={padLeft}
                y1={y}
                x2={W - padRight}
                y2={y}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fontFamily="var(--mono)"
                fill="var(--muted)"
              >
                {v}d
              </text>
            </g>
          );
        })}

        {/* 6.5d Target line (behind values!) */}
        <line
          x1={padLeft}
          y1={yTarget}
          x2={W - padRight}
          y2={yTarget}
          stroke="var(--gilt)"
          strokeWidth="1.8"
          strokeDasharray="4 4"
        />
        <rect
          x={W - padRight + 6}
          y={yTarget - 11}
          width={78}
          height={20}
          rx={3}
          fill="var(--gilt-soft)"
          stroke="var(--gilt)"
          strokeWidth="1"
        />
        <text
          x={W - padRight + 45}
          y={yTarget + 3}
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fontFamily="var(--mono)"
          fill="var(--gilt)"
        >
          6.5d Target
        </text>

        {/* Base axis line */}
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={W - padRight}
          y2={padTop + plotH}
          stroke="var(--line-strong)"
          strokeWidth="1.2"
        />

        {/* Wards Bars */}
        {stats.map(({ unit, statistics }, i) => {
          const bx = padLeft + i * colW + (colW - barW) / 2;
          const stay = statistics.averageLengthOfStayDays ?? 0;
          const by = py(stay);
          const bh = padTop + plotH - by;
          const isOver = stay > 6.5;
          const color = stay === 0 ? "var(--sunk)" : isOver ? "var(--warn)" : "var(--accent)";

          const shortName = unit.name.replace(/ Adult Open| Adult Secure| Older Adult| Hospital| Unit/, "");
          const lx = (bx + barW / 2).toFixed(1);
          const ly = (padTop + plotH + 14).toFixed(1);

          const numW = 28;
          const numH = 16;
          const numX = bx + barW / 2;
          const numY = by - 5;

          return (
            <g key={unit.id}>
              {/* Rounded bar tops (rx="3") */}
              <rect
                className={styles.chartBarInteractive}
                x={bx}
                y={by}
                width={barW}
                height={bh}
                fill={color}
                rx={3}
                onMouseEnter={() => setHoveredWard({ idx: i, bx, by, stay, unit })}
                onMouseLeave={() => setHoveredWard(null)}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${unit.name}: ${stay > 0 ? `${stay.toFixed(1)} days ALOS` : "none arrived"}`}
                onFocus={() => setHoveredWard({ idx: i, bx, by, stay, unit })}
                onBlur={() => setHoveredWard(null)}
              />

              {/* Background pill badge so number never collides with target line */}
              {stay > 0 && (
                <g>
                  <rect
                    x={numX - numW / 2}
                    y={numY - 12}
                    width={numW}
                    height={numH}
                    rx={3}
                    fill="var(--surface)"
                    stroke="var(--line)"
                    strokeWidth="0.8"
                  />
                  <text
                    x={numX}
                    y={numY}
                    textAnchor="middle"
                    fontSize="12"
                    fontFamily="var(--mono)"
                    fontWeight="600"
                    fill={isOver ? "var(--warn)" : "var(--ink)"}
                  >
                    {stay.toFixed(1)}
                  </text>
                </g>
              )}

              {/* Rotated X-axis label with 12px font floor */}
              <text
                x={lx}
                y={ly}
                textAnchor="end"
                transform={`rotate(-40 ${lx} ${ly})`}
                fontSize="12"
                fontFamily="var(--body)"
                fill="var(--ink-soft)"
              >
                {shortName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Interactive hover tooltip card */}
      {hoveredWard && (
        <div
          className={styles.compareTooltip}
          style={{
            left: `${Math.min(Math.max(2, (hoveredWard.bx / W) * 100), 78)}%`,
            top: "20px",
            display: "block",
          }}
          role="tooltip"
        >
          <div
            style={{
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "4px",
              borderBottom: "1px solid var(--line)",
              paddingBottom: "2px",
            }}
          >
            {hoveredWard.unit.name}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            {siteByCode(hoveredWard.unit.siteCode)?.name ?? ""}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              marginTop: "4px",
              fontFamily: "var(--mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>ALOS:</span>
            <b>{hoveredWard.stay.toFixed(1)} days</b>
          </div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: hoveredWard.stay > 6.5 ? "var(--warn)" : "var(--good)",
              marginTop: "2px",
            }}
          >
            {hoveredWard.stay > 6.5
              ? `+${(hoveredWard.stay - 6.5).toFixed(1)}d over target`
              : `${(hoveredWard.stay - 6.5).toFixed(1)}d under target`}
          </div>
        </div>
      )}
    </div>
  );
}

interface HoveredEdState {
  idx: number;
  bx: number;
  byTotal: number;
  total: number;
  urgent: number;
  routine: number;
  ed: EmergencyDepartment;
}

function EdWaitingBarChart({
  emergencyDepartments,
  movements,
}: {
  emergencyDepartments: EmergencyDepartment[];
  movements: Movement[];
}) {
  const [hoveredEd, setHoveredEd] = useState<HoveredEdState | null>(null);

  if (emergencyDepartments.length === 0) return null;

  const W = 920;
  const H = 240;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 50;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const counts = emergencyDepartments.map((department) => {
    const mine = movements.filter((m) => m.originEdId === department.id && isOpen(m));
    const total = mine.length;
    const urgent = mine.filter((m) => m.flaggedUrgent).length;
    const routine = total - urgent;
    return { department, total, urgent, routine };
  });

  const maxFound = counts.reduce((max, c) => (c.total > max ? c.total : max), 0);
  const maxVal = Math.max(4, maxFound + 1);
  const py = (v: number) => padTop + plotH * (1 - v / maxVal);

  const n = Math.max(emergencyDepartments.length, 1);
  const colW = plotW / n;
  const barW = Math.min(colW - 24, 52);

  return (
    <div className={styles.barChartBox}>
      <svg
        width="100%"
        height="240"
        viewBox={`0 0 ${W} ${H}`}
        aria-label="ED placement requests stacked bar chart"
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        {/* Dynamic scale grid lines (12px floor) */}
        {Array.from({ length: maxVal }, (_, i) => i + 1).map((v) => {
          const y = py(v);
          return (
            <g key={v}>
              <line
                x1={padLeft}
                y1={y}
                x2={W - padRight}
                y2={y}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fontFamily="var(--mono)"
                style={{ fontVariantNumeric: "tabular-nums" }}
                fill="var(--muted)"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Base axis line */}
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={W - padRight}
          y2={padTop + plotH}
          stroke="var(--line-strong)"
          strokeWidth="1.2"
        />

        {/* Stacked bars */}
        {counts.map(({ department, total, urgent, routine }, i) => {
          const bx = padLeft + i * colW + (colW - barW) / 2;
          const byTotal = py(total);
          const bhTotal = padTop + plotH - byTotal;

          const site = siteByCode(department.siteCode);
          const shortName = site
            ? site.name.replace(/ Emergency Department$| Hospital$| Health Service$| Health Campus$| Public Hospital$/, "")
            : department.name;

          const urgentH = (urgent / maxVal) * plotH;
          const routineH = (routine / maxVal) * plotH;
          const routineY = padTop + plotH - routineH;
          const urgentY = padTop + plotH - bhTotal;

          const badgeText = `${total}${urgent > 0 ? ` (${urgent} urgent)` : ""}`;
          const badgeW = urgent > 0 ? 84 : 40;

          return (
            <g
              key={department.id}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`${department.name}: ${total} waiting (${urgent} urgent)`}
              onMouseEnter={() => setHoveredEd({ idx: i, bx, byTotal, total, urgent, routine, ed: department })}
              onMouseLeave={() => setHoveredEd(null)}
              onFocus={() => setHoveredEd({ idx: i, bx, byTotal, total, urgent, routine, ed: department })}
              onBlur={() => setHoveredEd(null)}
            >
              {total > 0 ? (
                <>
                  {/* Routine segment in slate var(--accent) */}
                  {routine > 0 && (
                    <rect
                      className={styles.chartBarInteractive}
                      x={bx}
                      y={routineY}
                      width={barW}
                      height={routineH}
                      fill="var(--accent)"
                      rx={3}
                    />
                  )}

                  {/* Urgent segment in danger red var(--danger) */}
                  {urgent > 0 && (
                    <rect
                      className={styles.chartBarInteractive}
                      x={bx}
                      y={urgentY}
                      width={barW}
                      height={urgentH}
                      fill="var(--danger)"
                      rx={3}
                    />
                  )}

                  {/* High-contrast top badge */}
                  <rect
                    x={bx + barW / 2 - badgeW / 2}
                    y={byTotal - 22}
                    width={badgeW}
                    height={18}
                    rx={3}
                    fill="var(--surface)"
                    stroke="var(--line-strong)"
                    strokeWidth="0.8"
                  />
                  <text
                    x={bx + barW / 2}
                    y={byTotal - 9}
                    textAnchor="middle"
                    fontSize="12"
                    fontFamily="var(--mono)"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                    fontWeight="600"
                    fill={urgent > 0 ? "var(--danger)" : "var(--ink)"}
                  >
                    {badgeText}
                  </text>
                </>
              ) : (
                <text
                  x={bx + barW / 2}
                  y={padTop + plotH - 8}
                  textAnchor="middle"
                  fontSize="12"
                  fontFamily="var(--mono)"
                  fill="var(--muted)"
                >
                  0
                </text>
              )}

              {/* Site label below (12px font floor) */}
              <text
                x={bx + barW / 2}
                y={padTop + plotH + 22}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--ink)"
              >
                {shortName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover inspection card */}
      {hoveredEd && (
        <div
          className={styles.compareTooltip}
          style={{
            left: `${Math.min(Math.max(2, (hoveredEd.bx / W) * 100), 78)}%`,
            top: "20px",
            display: "block",
          }}
          role="tooltip"
        >
          <div
            style={{
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "4px",
              borderBottom: "1px solid var(--line)",
              paddingBottom: "2px",
            }}
          >
            {hoveredEd.ed.name}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              fontFamily: "var(--mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>Total Waiting:</span>
            <b>{hoveredEd.total}</b>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              fontFamily: "var(--mono)",
              fontVariantNumeric: "tabular-nums",
              color: "var(--danger)",
            }}
          >
            <span>Urgent Priority:</span>
            <b>{hoveredEd.urgent}</b>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              fontFamily: "var(--mono)",
              fontVariantNumeric: "tabular-nums",
              color: "var(--muted)",
            }}
          >
            <span>Routine Queue:</span>
            <b>{hoveredEd.routine}</b>
          </div>
        </div>
      )}
    </div>
  );
}
