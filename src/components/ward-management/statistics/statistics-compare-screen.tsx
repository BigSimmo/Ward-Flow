"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { isOpen, unitCapacity } from "@/components/ward-management/ward-derivations";
import type { EmergencyDepartment, Movement, Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { allWardStatistics, type WardStatistics } from "@/components/ward-management/ward-statistics";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import styles from "./statistics-third-edition.module.css";

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
  const { units: liveUnits, admissions: liveAdmissions, movements, bedReleases = [] } = useWardFlow();
  const now = useWardFlowClock();
  const admissions = admissionsOverride ?? liveAdmissions;
  const units = unitsOverride ?? liveUnits;
  const emergencyDepartments = edsOverride ?? allEmergencyDepartments();

  const [activeTab, setActiveTab] = useState<"split" | "matrix" | "chooser">("split");

  // 1. Inpatient Network KPI figures
  const totalBeds = units.reduce((sum, u) => sum + u.beds, 0);
  const readyBeds = units.reduce((sum, u) => sum + unitCapacity(u, bedReleases).available, 0);
  const readyPct = totalBeds > 0 ? ((readyBeds / totalBeds) * 100).toFixed(1) : "0.0";

  // 2. Average Length of Stay KPI figures
  const wardStats = allWardStatistics(units, admissions, now);
  const validStays = wardStats.filter(({ statistics }) => statistics.averageLengthOfStayDays !== null);
  const networkAvgStay =
    validStays.length > 0
      ? (
          validStays.reduce((s, { statistics }) => s + (statistics.averageLengthOfStayDays ?? 0), 0) / validStays.length
        ).toFixed(1)
      : "—";
  const totalBlockers = wardStats.reduce((s, { statistics }) => s + statistics.readyToLeaveCannot, 0);
  const totalLongStays = wardStats.reduce((s, { statistics }) => s + statistics.longStays, 0);

  // 3. ED Placement Demand figures
  const openMovements = movements.filter(isOpen);
  const edWaitingCount = openMovements.length;
  const urgentCount = openMovements.filter((m) => m.flaggedUrgent).length;
  const unplacedCount = openMovements.filter((m) => m.acceptedUnitId === undefined).length;

  // 4. Placement Buffer figures
  const netCapacity = readyBeds - edWaitingCount;
  const placementRatio = edWaitingCount > 0 ? (readyBeds / edWaitingCount).toFixed(2) : "—";

  const section = statisticsSectionById("compare");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'compare' section");

  return (
    <StatisticsSectionFrame
      section={section}
      title="Ward and ED comparisons"
      subtitle=""
      testId="ward-statistics-compare-screen"
      design="third-edition"
    >
      {/* ══════════ KPI SUMMARY CARDS ══════════ */}
      <div className={styles.kpiGrid} id="compareKpiGrid">
        <div className={styles.kpiCard} data-tone="accent">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Inpatient Network</span>
            <span className={styles.monoBadge}>All Services</span>
          </div>
          <div className={styles.kpiValRow}>
            <span className={styles.kpiVal}>{units.length}</span>
            <span className={styles.kpiSub}>wards / {totalBeds} beds</span>
          </div>
          <span className={styles.kpiSub}>
            <strong>{readyBeds}</strong> beds available ({readyPct}%)
          </span>
        </div>

        <div className={styles.kpiCard} data-tone="warn">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Average Length of Stay</span>
            <span className={styles.monoBadge}>Recorded wards</span>
          </div>
          <div className={styles.kpiValRow}>
            <span className={styles.kpiVal}>{networkAvgStay === "—" ? "Not recorded" : `${networkAvgStay}d`}</span>
            <span className={styles.kpiSub}>Mean of recorded ward averages</span>
          </div>
          <span className={styles.kpiSub}>
            <strong>{totalBlockers}</strong> blockers &middot; <strong>{totalLongStays}</strong> &gt;3mo
          </span>
        </div>

        <div className={styles.kpiCard} data-tone="danger">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>ED Placement Demand</span>
            <span className={styles.monoBadge}>Active Requests</span>
          </div>
          <div className={styles.kpiValRow}>
            <span className={styles.kpiVal}>{edWaitingCount}</span>
            <span className={styles.kpiSub}>waiting now</span>
          </div>
          <span className={styles.kpiSub}>
            <strong>{urgentCount}</strong> urgent &middot; <strong>{unplacedCount}</strong> awaiting ward
          </span>
        </div>

        <div className={styles.kpiCard} data-tone="good">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Placement Buffer</span>
            <span className={styles.monoBadge}>Demand Ratio</span>
          </div>
          <div className={styles.kpiValRow}>
            <span className={styles.kpiVal}>{placementRatio}x</span>
            <span className={styles.kpiSub}>ready vs ED demand</span>
          </div>
          <span className={styles.kpiSub}>
            <strong>{netCapacity >= 0 ? `+${netCapacity}` : netCapacity}</strong> net bed buffer
          </span>
        </div>
      </div>

      {/* ══════════ FLOW BALANCE BANNER ══════════ */}
      <div className={styles.flowBalanceCard}>
        <div className={styles.balanceInfo}>
          <h3 className={styles.balanceTitle}>Statewide Patient Flow Balance</h3>
          <p className={styles.balanceSubtitle}>
            Instant comparison between emergency department demand and inpatient bed readiness.
          </p>
        </div>
        <div className={styles.balanceMetrics}>
          <div className={styles.balanceItem}>
            <span className={styles.bVal}>{readyBeds}</span>
            <span className={styles.bLbl}>Ready Beds</span>
          </div>
          <div className={styles.balanceItem}>
            <span className={styles.bVal}>{edWaitingCount}</span>
            <span className={styles.bLbl}>ED Patients</span>
          </div>
          <div className={styles.balanceItem}>
            <span className={styles.bVal} style={{ color: netCapacity >= 0 ? "var(--good)" : "var(--danger)" }}>
              {netCapacity >= 0 ? `+${netCapacity}` : netCapacity}
            </span>
            <span className={styles.bLbl}>Net Capacity</span>
          </div>
        </div>
      </div>

      {/* ══════════ SOVEREIGN TABS ══════════ */}
      <div className={styles.sovereignTabs} role="tablist" aria-label="Comparison views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "split"}
          className={`${styles.sovereignTab} ${activeTab === "split" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("split")}
        >
          Split Comparison
          <span className={styles.tabBadge}>{units.length + emergencyDepartments.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "matrix"}
          className={`${styles.sovereignTab} ${activeTab === "matrix" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("matrix")}
        >
          Correlation Matrix
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "chooser"}
          className={`${styles.sovereignTab} ${activeTab === "chooser" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("chooser")}
        >
          Unit Directory
        </button>
      </div>

      <details className={`${styles.measureDetails} source-print`}>
        <summary>Scope &amp; attribution limits</summary>
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
                  <strong>Referrals received fail differently.</strong> Referred wards are stored as a LIST, not a
                  single ward, because one referral can be live at several wards. A per-ward total would therefore sum
                  to more than the number of referrals that exist.
                </p>
              </div>
            </details>
          </div>
        </WardPanel>
      </details>

      <div className={styles.compareRegion}>
        <WardPanel title="Wards" count={`${units.length} wards`}>
          <div className={styles.panelBody}>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Average length of stay by ward</h3>
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
            <CompareTable
              className={styles.compareWardTable}
              testId="ward-statistics-compare-wards"
              rowHeader="Ward"
              columns={WARD_COLUMNS}
              rows={allWardStatistics(units, admissions, now).map(({ unit, statistics }) => ({
                id: unit.id,
                name: unit.name,
                row: statistics,
              }))}
            />
          </div>
        </WardPanel>
      </div>

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
            <CompareTable
              className={styles.compareEdTable}
              testId="ward-statistics-compare-eds"
              rowHeader="Department"
              columns={ED_COLUMNS}
              rows={emergencyDepartments.map((department) => {
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

      <div id={STATISTICS_UNIT_CHOOSER_ID} className={styles.compareRegion}>
        <WardPanel
          title="Choose a ward or emergency department"
          count={`${units.length + emergencyDepartments.length} units`}
          testId="ward-statistics-compare-chooser"
        >
          <div className={styles.panelBody}>
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
      <details className={`${styles.measureDetails} source-print`}>
        <summary>Data provenance &amp; attribution limits</summary>
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
              for every ward, and {joinNames(ED_COLUMNS.map((column) => column.header))} for every department. Nothing
              on this screen is a real person, a real bed or a real referral.
            </p>
            <p className={styles.note}>
              <strong>What is real</strong> is only the naming: the wards, the hospitals that hold them, and the
              emergency departments — above and in the chooser below — are read from the network&apos;s own tables at
              render time rather than typed here, in the fixed order the prototype records them, and every figure set
              beside those names is invented.
            </p>
          </div>
        </WardPanel>
      </details>
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
          {rows.map(({ id, name, row }) => {
            const href = rowHeader.toLowerCase() === "ward" ? wardStatisticsHref(id) : edStatisticsHref(id);
            return (
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
            );
          })}
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
  stay: number | null;
  unit: Unit;
  tooltipLeft: number;
}

function WardAlosBarChart({ units, admissions, now }: { units: Unit[]; admissions: Admission[]; now: number }) {
  const [hoveredWard, setHoveredWard] = useState<HoveredWardState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (units.length === 0) return null;

  const stats = allWardStatistics(units, admissions, now);
  const W = 1120;
  const H = 360;
  const padLeft = 100;
  const padRight = 25;
  const padTop = 32;
  const padBottom = 108;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const maximum = Math.max(0, ...stats.map(({ statistics }) => statistics.averageLengthOfStayDays ?? 0));
  const tickStep = Math.max(1, Math.ceil(maximum / 5));
  const maxStay = tickStep * 5;

  const py = (v: number) => padTop + plotH * (1 - v / maxStay);

  const n = Math.max(stats.length, 1);
  const colW = plotW / n;
  const barW = Math.max(Math.min(colW - 6, 26), 12);

  return (
    <div ref={containerRef} className={styles.barChartBox}>
      <p className={styles.emptyNote}>Average among arrived admissions on each ward, in days. No target recorded.</p>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-label="Ward average length of stay bar chart"
        style={{ display: "block", width: "100%", maxWidth: `${W}px`, height: "auto" }}
      >
        {/* Scale from recorded stays, with a12px label floor. */}
        {Array.from({ length: 6 }, (_, i) => i * tickStep).map((v) => {
          const y = py(v);
          return (
            <g key={v}>
              <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="var(--line)" strokeWidth="1" />
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
          const stay = statistics.averageLengthOfStayDays;
          const by = py(stay ?? 0);
          const bh = padTop + plotH - by;
          const color = stay === null ? "transparent" : "var(--accent)";

          const shortName = unit.name.length > 14 ? `${unit.name.slice(0, 13)}…` : unit.name;
          const lx = (bx + barW / 2).toFixed(1);
          const ly = (padTop + plotH + 14).toFixed(1);

          const numW = 42;
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
                height={stay === null ? 1 : bh}
                fill={color}
                rx={3}
                onMouseEnter={() => {
                  const width = Math.min(W, containerRef.current?.clientWidth ?? W);
                  setHoveredWard({
                    idx: i,
                    bx,
                    by,
                    stay,
                    unit,
                    tooltipLeft: Math.max(10, Math.min((bx / W) * width, width - 170)),
                  });
                }}
                onMouseLeave={() => setHoveredWard(null)}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${unit.name}: ${stay === null ? "Not recorded" : `${stay.toFixed(1)} days average stay`}`}
                onFocus={() => {
                  const width = Math.min(W, containerRef.current?.clientWidth ?? W);
                  setHoveredWard({
                    idx: i,
                    bx,
                    by,
                    stay,
                    unit,
                    tooltipLeft: Math.max(10, Math.min((bx / W) * width, width - 170)),
                  });
                }}
                onBlur={() => setHoveredWard(null)}
              >
                <title>
                  {`${unit.name}: ${stay === null ? "Not recorded" : `${stay.toFixed(1)} days average stay`}`}
                </title>
              </rect>

              {/* Printed values stay visible; missing averages are not zero. */}
              {
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
                    fill="var(--ink)"
                  >
                    {stay === null ? "—" : stay.toFixed(1)}
                  </text>
                </g>
              }

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
                <title>{unit.name}</title>
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
            left: `${hoveredWard.tooltipLeft}px`,
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
            <b>{hoveredWard.stay === null ? "Not recorded" : `${hoveredWard.stay.toFixed(1)} days`}</b>
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
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div ref={containerRef} className={styles.barChartBox}>
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
              <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="var(--line)" strokeWidth="1" />
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
            ? site.name.replace(
                / Emergency Department$| Hospital$| Health Service$| Health Campus$| Public Hospital$/,
                "",
              )
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
            left: `${Math.min(
              Math.max(10, (hoveredEd.bx / W) * (containerRef.current?.clientWidth ?? W)),
              (containerRef.current?.clientWidth ?? W) - 170,
            )}px`,
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
