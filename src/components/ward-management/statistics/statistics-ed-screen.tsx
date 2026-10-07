"use client";

import { StatisticsInsightChart } from "./statistics-insight-chart";
import { StatisticsDetailPanel } from "./statistics-detail-panel";

import Link from "next/link";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import { edWaitBands, edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { MINUTES_PER_DAY, clockState, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { edStatisticsHref, movementHref } from "@/components/ward-management/shell/ward-facade";

import chartStyles from "./statistics.module.css";
import styles from "./statistics-sections.module.css";
import v4 from "./statistics-v4.module.css";
import pageStyles from "./statistics-ed-third-edition.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import {
  LONG_WAIT_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
  VERY_LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

// Geometry for the elapsed-wait dot chart. Fixed, unitless numbers in an SVG `viewBox` — never a
// CSS length in a component prop, which `chartStyles.chartSvg` (`width: 100%; height: auto`)
// already scales for every viewport.
const CHART_WIDTH = 320;
const CHART_HEIGHT = 96;
const CHART_AXIS_Y = 78;
const CHART_DOT_RADIUS = 4.5;
const CHART_LANE_STEP = 11;
// Dots within this many minutes of each other stack into their own lane rather than drawing on
// top of one another — two hours, wide enough that a handful of open movements per department
// read as separate marks without needing real collision detection for a chart this small.
const CHART_BUCKET_MINUTES = 120;

/** Never a literal hex — the same discipline `DemonstrationChart` holds to for its own stroke. */
function waitDotColor(tone: "danger" | "warning" | undefined): string {
  if (tone === "danger") return "var(--ward-danger)";
  if (tone === "warning") return "var(--ward-warning)";
  return "var(--text)";
}

/**
 * ONE EMERGENCY DEPARTMENT IN DETAIL — the per-department statistics page.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO**, for the same reason the ward
 * screen beside this one does: an empty shell and "there is no such department" render identically,
 * and a reader who takes the first for the second believes something false about a real place. This
 * screen never falls back to a different department, and it names the id it could not resolve —
 * the same discipline `edById` itself holds to.
 *
 * ⚠️ **THE DISCLAIMER IS ON BOTH STATES.** The not-found page is still a page of this prototype.
 *
 * ⚠️ **A WARD AND AN EMERGENCY DEPARTMENT ARE NOT ONE LIST WITH A FLAG.** They are different
 * records: `EmergencyDepartment` carries an id, a site code and a name and nothing else, while a
 * `Unit` carries cohort, security, authorisation and capacity. That is why there are two routes and
 * two screens rather than one taking a kind, and it is also why the figures each hold are not the
 * same figures — a department has no beds to be occupied, so none of the three counts below is a
 * bed measure.
 *
 * **The department comes from `allEmergencyDepartments()` via `edById`**, which is where
 * `ed-screen.tsx` resolves one from too. Emergency departments are not in provider state at all:
 * the provider holds `units`, because unit capacity changes as the prototype runs, and a
 * department's identity does not. `movements`, unlike the department itself, DOES come from the
 * provider (`useWardFlow()`) rather than a frozen fixture, because who is on the list right now is
 * exactly the kind of fact that changes as the prototype runs.
 *
 * ⚠️ **ADDED 2026-09-05: THE THREE FIGURES `Movement.originEdId` CAN SUPPORT.** Until now this page
 * showed no figure at all. `originEdId` is a required field on every movement, so a count keyed to
 * it never misattributes anyone and never leaves anyone out — the same property
 * `statistics-compare-screen.tsx` relies on for its own department table, and the same three
 * derivations, so the two pages can never disagree about one department.
 *
 * ⚠️ **ADDED 2026-09-06: THE WAIT-TIME CENTREPIECE — BUILT, NOT RESTYLED.** `Movement.openedAt` is a
 * required `Instant` on every movement, so `now - openedAt` is a real elapsed wait for everybody
 * still on the list above, computed here for the first time. It is drawn as one dot per waiting
 * person on an elapsed-time axis with lines at 24 and 48 hours, and the longest waits are named in a
 * table beneath it — the same population "On the list" already counts, never a second definition of
 * who is waiting. Every duration is formatted through `splitDuration` (`ward-clock.ts`), never by
 * hand: a sibling screen on this estate once printed raw minutes where every other screen printed
 * hours and minutes for the same value, and that must not happen again here.
 *
 * ⚠️ **STILL NOT SHOWN, EACH FOR A NAMED REASON RATHER THAN BY OMISSION.** How busy the department
 * is, "left before being seen", the individual legs of a journey (referral raised, ward acceptance,
 * bed pull, arrival), and any split of where a movement's closure sent somebody are explained in the
 * section below the figures.
 */
export function StatisticsEdScreen({
  edId,
  movements: movementsOverride,
}: {
  edId: string;
  /**
   * TEST-ONLY, same discipline as `StatisticsWardScreen`'s `admissions` override. The one production
   * caller, `src/app/mockups/ward-flow/statistics/ed/[edId]/page.tsx`, passes only `edId` — verified
   * by reading it, not assumed. This exists so a test can seed a movement with a known `openedAt`
   * relative to a known `now` rather than depending on whatever the shared seed happens to contain
   * today, which is exactly the fixture-accident risk `tests/ward-statistics-number-agreement.dom.
   * test.tsx` already names for this screen.
   */
  movements?: Movement[];
}) {
  const { movements: liveMovements, patients, referrals } = useWardFlow();
  const now = useWardFlowClock();
  const movements = movementsOverride ?? liveMovements;
  const department = edById(edId);

  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  if (!department) {
    return (
      <StatisticsSectionFrame
        section={section}
        title="Emergency department not found"
        subtitle="The address names an emergency department this prototype does not have."
        testId="ward-statistics-ed-screen"
        design="third-edition"
      >
        <div className={styles.notFoundBlock}>
          {/* No heading here, and NOT a WardPanel: that primitive requires a title and the frame's own `<h1>` already reads "Emergency department not
              found", and a second heading restating it was the near-duplicate fix round 1 found. */}
          <p className={styles.notFoundBody} data-testid="ward-statistics-ed-unresolved">
            No emergency department in this prototype has the id <span className={styles.unresolvedId}>{edId}</span>. It
            may have been renamed or removed, or the id in the address may be wrong. This page never falls back to a
            different department, because a page showing the wrong department under the right heading is worse than a
            page showing nothing.
          </p>
          <p className={styles.body}>
            <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ed-chooser-link">
              Choose an emergency department from the comparisons page
            </Link>{" "}
            to reach one that does exist.
          </p>
        </div>
      </StatisticsSectionFrame>
    );
  }

  const site = siteByCode(department.siteCode);

  /*
   * ⚠️ **THE SAME THREE DERIVATIONS THE COMPARISONS TABLE USES, ON PURPOSE.** `originEdId` is a
   * required field on every `Movement` (see the attributable paragraph below), which is why a
   * count built from it never misattributes anyone and never leaves anyone out. Read from
   * `statistics-compare-screen.tsx`'s `ED_COLUMNS` row builder rather than re-derived independently,
   * so the single-department page and the comparisons page cannot disagree about the same
   * department on the same render.
   */
  /*
   * 🔴 **CALLED, NOT COMPUTED — AND FOR ONE COMMIT TODAY THIS SCREEN DID BOTH, WHICH WAS WORSE
   * THAN EITHER.** `statistics-ed-waits.ts` was extracted FROM these lines and the screen was left
   * still computing them inline, so two code paths produced the same figures and nothing compared
   * them. ⚠️ **Duplicated work produces no conflict and no red — it is invisible by construction
   * until the two drift**, and a subagent reading the module's own doc comment found it saying it
   * had been extracted from a screen that had not adopted it.
   */
  const { onTheList, urgent, unplaced, waitingMovements, over24h, over48h, longestWait, allDepartmentMovements } =
    edWaitFigures(movements, department.id, now);

  /*
   * ⚠️ **THE SAME POPULATION AS "ON THE LIST" ABOVE, NEVER A SECOND DEFINITION OF WAITING.**
   * `departmentMovements` is already every open movement whose origin is this department — that
   * already IS "everyone currently waiting", so this reuses it rather than re-filtering `movements`
   * a second way that could quietly drift from the figure above it.
   *
   * `Math.max(..., 0)` guards the same case `formatElapsed` guards for itself: a movement whose
   * `openedAt` sits after `now` would otherwise read as a negative wait, which is not a real state
   * this page has any business rendering.
   */
  // (waiting list, the two overlapping hour figures and the longest wait all come from the same
  // `edWaitFigures` call above — one population, one definition of waiting.)

  /*
   * ⚠️ **ALL MOVEMENTS THIS DEPARTMENT HAS EVER ORIGINATED, NOT ONLY THE OPEN ONES ABOVE.** A
   * decline is a historical fact that stays true after the movement it was made against is admitted
   * or otherwise closes (`declinesByReason`'s own doc comment says so), so scoping it to
   * `departmentMovements` would silently drop every decline attached to a movement that has since
   * reached a bed — undercounting exactly the movements this department was most successful at
   * placing.
   *
   * ⚠️ **NEVER SUMMED — "no free bed" and "not suitable" are different problems with different
   * fixes** (more Ready beds fixes the first, never the second). `no_bed` is the model's own name
   * for a capacity refusal; every other member of `DECLINE_REASONS` is a mismatch between this
   * patient and that ward, which is what "not suitable" means here.
   */
  /*
   * 🔴 **THIS LINE SURVIVED THE FIRST REPAIR, AND FINDING THAT IS THE POINT.** One commit ago I
   * replaced the screen's inline wait maths with a single `edWaitFigures` call and said in the commit
   * message that the duplication was gone. **It was not: `allDepartmentMovements` is the NINTH field
   * that call returns, and I destructured eight.** ⚠️ **I fixed the instance I had been SHOWN and
   * reported it as the SET** — which is a diagnosis another lane wrote down about itself four times
   * today, and I read it, and did it anyway within the hour. **A true statement about a subset,
   * published at the width of the whole.**
   */

  // Called, never recomputed: the same waiting list the figures above are counted from.
  const bands = edWaitBands(movements, department.id, now);

  /*
   * 🔴 **EVERY DEPARTMENT, THROUGH THE SAME FUNCTION THIS PAGE READS ITSELF WITH.** `edWaitFigures`
   * once per department, so a row for THIS department is arithmetically the same object the panels
   * above render — the table and the page cannot come to disagree about one department.
   *
   * ⚠️ **"Breached" IS NARROWER THAN THE WORD SUGGESTS, AND THE PAGE SAYS SO.** `clockState(...)
   * === "breached"` is the predicate `buildActionInbox` and `ward-pressure.ts` already use, reused
   * rather than re-derived a third way. **But `legalForm.dueAt` is authored only for a transport or
   * transfer order** — the owner's 2026-08-23 correction removed it from the examination and
   * detention forms — **so this column can never report a missed Mental Health Act deadline.** A
   * reader who takes it for one has made the most consequential misreading this screen offers.
   */
  const comparison = allEmergencyDepartments().map((each) => {
    const figures = edWaitFigures(movements, each.id, now);
    return {
      department: each,
      figures,
      breached: figures.departmentMovements.filter(
        (movement) =>
          movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) === "breached",
      ).length,
    };
  });
  /*
   * ⚠️ **REPORTED IN PLACE, NOT THROWN.** `declinesByReason` throws on a decline reason outside
   * `DECLINE_REASONS`, which is right — a categorical breakdown must never quietly shrink its own
   * total. But this screen calls it during render, and everything else on the page — the elapsed-
   * wait chart, the wait table, the longest wait, the disposition prose — is computed from
   * timestamps and does not touch the decline vocabulary at all. **A throw here would cost a
   * coordinator the wait chart because of a field the wait chart never reads.**
   *
   * Ward Lead's ruling, 2026-09-07, applied identically at all three call sites. Bounded to this
   * class — a malformed value in a categorical breakdown the rest of the screen is independent of.
   *
   * 🔴 **THE TWO COUNTS DEGRADE DIFFERENTLY, AND THAT IS THE WHOLE REASON THIS SITE IS NOT A COPY
   * OF THE OTHER TWO.** `noFreeBedDeclineCount` filters for `no_bed` directly and never consults
   * the vocabulary, so it stays TRUE even when a malformed reason is present. `notSuitable` is
   * derived by SUBTRACTION from the total, so a total that could not be computed makes it
   * unknowable — and a subtraction against a partial total would silently understate exactly the
   * figure a ward is judged on. So the first still renders and the second says it cannot be
   * computed. **Withholding the sound figure alongside the unsound one would be its own false
   * claim: it would read as "no ward refused for want of a bed".**
   */
  // Copied because the derivation hands back a `readonly` array and `readDeclinesByReason` takes a
  // mutable one. ⚠️ The spread is the honest fix; a cast would silence the one thing telling me the
  // derivation intends its output not to be edited.
  const declinesReadout = readDeclinesByReason([...allDepartmentMovements]);
  const noFreeBedDeclineCount = allDepartmentMovements
    .flatMap((movement) => movement.declines)
    .filter((decline) => decline.reason === "no_bed").length;
  /*
   * 🔴 **THIS BUCKET IS NOT A CLINICAL JUDGEMENT AND MUST NOT BE NAMED AS ONE.** It is
   * `totalCount - no_bed`, so it holds the other six members of `DECLINE_REASONS` — and one of them,
   * `bed_pulled_for_earlier_referral`, is a CAPACITY outcome. The reducer's own refusal when a unit
   * has no allocatable bed reads *"no allocatable bed remains at {unit} (the ward's allocatable
   * count is N)"* — it reports the count it checked and deliberately names no cause, because the
   * guard cannot tell a bed pulled for an earlier referral from a ward simply confirming zero
   * (`ward-flow-reducer.ts:1466`). The heading said "Declined as not suitable" and the note said more
   * beds "would never touch" these. **More beds would resolve that member exactly.**
   *
   * ⚠️ **"every reason a ward can give" was also wider than the figure.** A ward can also refuse a
   * front-door referral from `REFERRAL_DECLINE_REASONS`, a separate vocabulary this count cannot see
   * and which `statistics-derivations.ts` forbids merging with this one.
   */
  const notSuitableDeclineCount = declinesReadout.ok
    ? declinesReadout.value.totalCount - noFreeBedDeclineCount
    : undefined;

  /*
   * The axis always reaches past 48 hours, even on a day nobody has waited that long, so the
   * threshold line is never drawn off the edge of the chart — and it reaches past the longest
   * actual wait too, so that dot is never drawn ON the edge, which would read as "at least this
   * long" rather than the exact value the table beside it names.
   */
  const axisMaxMinutes = Math.max(2 * MINUTES_PER_DAY, ...waitingMovements.map((entry) => entry.waitMinutes)) + 4 * 60;
  const threshold24hX = (MINUTES_PER_DAY / axisMaxMinutes) * CHART_WIDTH;
  const threshold48hX = ((2 * MINUTES_PER_DAY) / axisMaxMinutes) * CHART_WIDTH;

  const laneCountByBucket = new Map<number, number>();
  const waitDots = waitingMovements.map((entry) => {
    const bucket = Math.floor(entry.waitMinutes / CHART_BUCKET_MINUTES);
    const lane = laneCountByBucket.get(bucket) ?? 0;
    laneCountByBucket.set(bucket, lane + 1);
    const x = Math.min(
      Math.max((entry.waitMinutes / axisMaxMinutes) * CHART_WIDTH, CHART_DOT_RADIUS),
      CHART_WIDTH - CHART_DOT_RADIUS,
    );
    const y = CHART_AXIS_Y - CHART_DOT_RADIUS - lane * CHART_LANE_STEP;
    const tone: "danger" | "warning" | undefined =
      entry.waitMinutes >= 2 * MINUTES_PER_DAY
        ? "danger"
        : entry.waitMinutes >= MINUTES_PER_DAY
          ? "warning"
          : undefined;
    return { ...entry, x, y, tone };
  });

  const chartDescription =
    onTheList === 0
      ? "Nobody from this department currently has an open movement, so there is nothing to plot on the elapsed-time axis."
      : `${onTheList} ${onTheList === 1 ? "person" : "people"} with an open placement from this department, one dot each, ` +
        `positioned by elapsed time since their movement opened. ${over24h} past 24 hours, ${over48h} past 48. ` +
        `Longest wait: ${longestWait ? splitDuration(longestWait.waitMinutes) : "none"}.`;

  return (
    <StatisticsSectionFrame
      section={section}
      title={department.name}
      subtitle=""
      testId="ward-statistics-ed-screen"
      design="third-edition"
    >
      <WardPanel
        title={department.name}
        count={`${onTheList} open ${onTheList === 1 ? "placement" : "placements"}`}
        testId="ward-statistics-ed-identity"
      >
        <div className={styles.panelBody} role="group" aria-label="Emergency department identity content" tabIndex={0}>
          <p className={styles.body} data-testid="ward-statistics-ed-site">
            {site
              ? `${department.name} is recorded at ${site.name}.`
              : `${department.name} carries a site code this prototype has no site for, so it cannot be placed at a hospital here.`}
          </p>
        </div>
        <dl className={pageStyles.kpiBand}>
          <div>
            <dt>Waiting for a bed</dt>
            <dd>{onTheList}</dd>
            <dd className={pageStyles.kpiCaption}>open requests from this department</dd>
          </div>
          <div>
            <dt>Longest wait</dt>
            <dd>{longestWait ? splitDuration(longestWait.waitMinutes) : "none"}</dd>
            {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
            <dd className={pageStyles.kpiCaption}>
              {longestWait
                ? resolveSubjectPatient(longestWait.movement, { patients, referrals }).formalName
                : "no open placement"}
            </dd>
          </div>
          <div>
            <dt>Marked urgent</dt>
            <dd>{urgent}</dd>
            <dd className={pageStyles.kpiCaption}>of the {onTheList} waiting</dd>
          </div>
          <div>
            <dt>Over 24 hours</dt>
            <dd>{over24h}</dd>
            <dd className={pageStyles.kpiCaption}>your default, not a legal limit</dd>
          </div>
          <div>
            <dt>No ward yet</dt>
            <dd>{unplaced}</dd>
            <dd className={pageStyles.kpiCaption}>no accepting ward recorded</dd>
          </div>
        </dl>
      </WardPanel>
      <StatisticsInsightChart
        title="Open placement waits"
        variant="timeline"
        defaultSort="value"
        testId="statistics-ed-waits-chart"
        groups={[
          { id: "urgent", label: "Marked urgent" },
          { id: "unplaced", label: "No accepting ward" },
        ]}
        metrics={[
          {
            id: "hours",
            label: "Elapsed since movement opened",
            unit: "h",
            note: `One dot per open placement. ${LONG_WAIT_MINUTES / 60}h and ${VERY_LONG_WAIT_MINUTES / 60}h guides are operational defaults, separate from triage time and the ED access target.`,
            references: [
              { value: LONG_WAIT_MINUTES / 60, label: `${LONG_WAIT_MINUTES / 60}h` },
              { value: VERY_LONG_WAIT_MINUTES / 60, label: `${VERY_LONG_WAIT_MINUTES / 60}h` },
            ],
          },
        ]}
        rows={waitingMovements.map(({ movement, waitMinutes }) => ({
          id: movement.id,
          name: resolveSubjectPatient(movement, { patients, referrals }).formalName,
          tone: movement.flaggedUrgent ? "warning" : undefined,
          context: `${movement.flaggedUrgent ? "Urgent · " : ""}${movement.acceptedUnitId ? "Ward accepted" : "No accepting ward"}`,
          values: { hours: waitMinutes / 60 },
          groups: [
            ...(movement.flaggedUrgent ? ["urgent"] : []),
            ...(movement.acceptedUnitId === undefined ? ["unplaced"] : []),
          ],
          detail: `Exact elapsed time: ${splitDuration(waitMinutes)}. A recorded ward acceptance does not establish arrival.`,
          href: movementHref(movement.id),
          linkLabel: "Open placement",
        }))}
      />
      <div className={pageStyles.pageGrid}>
        <nav className={pageStyles.departmentSwitcher} aria-label="Emergency department statistics">
          {comparison.map(({ department: each, figures }) => (
            <Link
              key={each.id}
              href={edStatisticsHref(each.id)}
              aria-current={each.id === department.id ? "page" : undefined}
              title={each.name}
              aria-label={`${each.name}, ${figures.onTheList} open placements`}
            >
              {each.siteCode}
              <span>{figures.onTheList}</span>
            </Link>
          ))}
        </nav>

        {/*
         * 🔴 **ADDED 2026-09-05: THE THREE FIGURES `Movement.originEdId` CAN ACTUALLY SUPPORT.**
         * `originEdId` is a required field on every movement, which is why these three attribute
         * cleanly to a single named department — the same test the comparisons page's own
         * `ED_COLUMNS` sets for itself. Nothing here is a bed measure: an emergency department has no
         * beds, no capacity and no length of stay in this model, and this section adds none of those.
         */}

        {/*
         * ⚠️ **ADDED 2026-09-06: BUILT, NOT RESTYLED.** Before this the page had never computed a
         * wait duration at all. `movement.openedAt` is required on every movement, so `now - openedAt`
         * is real for everybody counted in &quot;On the list&quot; above — this reuses that exact
         * population (`departmentMovements`) rather than filtering `movements` a second, independent
         * way. Every duration below goes through `splitDuration` (`ward-clock.ts`), never hand-rolled.
         */}
        <WardPanel title="Waiting now" testId="ward-statistics-ed-wait">
          <div className={styles.panelBody} role="group" aria-label="Current waiting content" tabIndex={0}>
            {onTheList === 0 ? (
              <p className={styles.body} data-testid="ward-stat-ed-wait-empty">
                Nobody from this department currently has an open movement, so there is no wait to plot or to name.
              </p>
            ) : (
              <>
                <h3 className={styles.subHeading}>Past {LONG_WAIT_MINUTES / 60} hours</h3>
                <p className={styles.body} data-testid="ward-stat-ed-over-24h">
                  {over24h} of the {onTheList} above {over24h === 1 ? "has" : "have"} been waiting more than{" "}
                  {LONG_WAIT_MINUTES / 60} hours ({OPERATIONAL_DEFAULT_LABEL}).
                </p>

                <h3 className={styles.subHeading}>Past {VERY_LONG_WAIT_MINUTES / 60} hours</h3>
                <p className={styles.body} data-testid="ward-stat-ed-over-48h">
                  {over48h} of the {onTheList} above {over48h === 1 ? "has" : "have"} been waiting more than{" "}
                  {VERY_LONG_WAIT_MINUTES / 60} hours ({OPERATIONAL_DEFAULT_LABEL}).
                </p>

                <h3 className={styles.subHeading}>Longest wait</h3>
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                <p className={styles.body} data-testid="ward-stat-ed-longest-wait">
                  {longestWait ? resolveSubjectPatient(longestWait.movement, { patients, referrals }).formalName : ""} —{" "}
                  {longestWait ? splitDuration(longestWait.waitMinutes) : ""} waiting.
                </p>

                <div
                  className={chartStyles.chartWrap}
                  data-ward-primitive="wait-chart"
                  data-testid="ward-stat-ed-wait-chart"
                >
                  <svg
                    className={chartStyles.chartSvg}
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    role="img"
                    aria-label={chartDescription}
                  >
                    <line
                      x1={0}
                      y1={CHART_AXIS_Y}
                      x2={CHART_WIDTH}
                      y2={CHART_AXIS_Y}
                      style={{ stroke: "var(--ward-divider)" }}
                      strokeWidth="1"
                    />
                    <line
                      data-testid="ward-stat-ed-wait-threshold-24h"
                      x1={threshold24hX}
                      y1={0}
                      x2={threshold24hX}
                      y2={CHART_AXIS_Y}
                      style={{ stroke: "var(--ward-warning)" }}
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <line
                      data-testid="ward-stat-ed-wait-threshold-48h"
                      x1={threshold48hX}
                      y1={0}
                      x2={threshold48hX}
                      y2={CHART_AXIS_Y}
                      style={{ stroke: "var(--ward-danger)" }}
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    {waitDots.map(({ movement, waitMinutes, x, y, tone }) => (
                      <circle
                        key={movement.id}
                        data-testid={`ward-stat-ed-wait-dot-${movement.id}`}
                        data-tone={tone}
                        cx={x}
                        cy={y}
                        r={CHART_DOT_RADIUS}
                        style={{ fill: waitDotColor(tone) }}
                      >
                        {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                        <title>{`${resolveSubjectPatient(movement, { patients, referrals }).formalName}: ${splitDuration(waitMinutes)} waiting`}</title>
                      </circle>
                    ))}
                  </svg>
                  {/*
                  ⚠️ **"CURRENTLY WAITING" UNTIL 2026-09-07, WHICH WAS FALSE FOR ANYONE ALREADY
                  COLLECTED.** This plots every OPEN movement whose `originEdId` is this department
                  — `!closure && stage !== "arrived"`. `MOVEMENT_STAGES` runs
                  `placement_requested → destination_review → accepted_awaiting_bed → pulled →
                  handover_ready → moving → arrived`, so `moving` is admitted: a patient collected
                  by transport and travelling to the ward. Two are seeded that way, so it is live.

                  **The COUNT is right and stays.** An open placement from this department is a real
                  operational population — work the department has started and not yet completed —
                  and the elapsed clock since the movement opened is the right measure of it. What
                  was wrong is only the word for it: somebody in an ambulance is not "waiting", and
                  is not in the department.

                  ⚠️ **NOT A MODEL CHANGE, AND IT DOES NOT NEED ONE.** `Movement.originEdId`'s own
                  doc says "Where the patient physically is", which stops being true at `moving` —
                  but that is a separate question about a field, and the sentence can be made true
                  without touching it. Fixing the wording is this screen's business; the field is
                  not.
                */}
                </div>

                {/*
                 * ⚠️ PHONE PASS, TASK 7. `v4.edWaitTable` releases `white-space: nowrap` on the last
                 * column at a 375px viewport so the whole table fits without needing to scroll at
                 * all — see that class's own comment in `statistics-v4.module.css` for why it lands
                 * there rather than in `statistics.module.css` (this task's edit scope does not
                 * include that file) and for the sticky-column approach it replaced after scrolling
                 * the running page showed the sticky cell hiding the column beside it. Composed
                 * alongside `chartStyles.dtable`, not instead of it: `chartStyles.dtable` still owns
                 * the sticky header, right-aligned figures and row-level flag colour this table
                 * already had.
                 */}
                <WardTable testId="ward-stat-ed-wait-table" className={`${chartStyles.dtable} ${v4.edWaitTable}`}>
                  <thead>
                    <tr>
                      <th scope="col">Movement</th>
                      <th scope="col" className={chartStyles.n}>
                        Elapsed wait
                      </th>
                      <th scope="col">Urgent</th>
                      <th scope="col">Ward status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingMovements.map(({ movement, waitMinutes }) => {
                      const level =
                        waitMinutes >= 2 * MINUTES_PER_DAY
                          ? "urgent"
                          : waitMinutes >= MINUTES_PER_DAY
                            ? "stalled"
                            : undefined;
                      return (
                        <tr key={movement.id} data-level={level} data-testid={`ward-stat-ed-wait-row-${movement.id}`}>
                          {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                          <th scope="row">{resolveSubjectPatient(movement, { patients, referrals }).formalName}</th>
                          <td className={chartStyles.n}>{splitDuration(waitMinutes)}</td>
                          <td>{movement.flaggedUrgent ? "Yes" : "No"}</td>
                          <td>{movement.acceptedUnitId !== undefined ? "Accepted" : "Awaiting a ward"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </WardTable>
              </>
            )}
          </div>
        </WardPanel>

        {/*
         * 🔴 **THE DRAWING'S BAND-BY-BAND TABLE, AND THE POINT OF IT IS THE EMPTY ROWS.** The drawing
         * is explicit and its reasoning is the design: *"They are still drawn, and each reads none, which
         * is a measured answer and not a missing figure"* — because *"a band that vanishes when it is
         * empty is a band a reader cannot trust when it is not."*
         *
         * ⚠️ **THESE FIVE PARTITION THE WAITING LIST. THE TWO FIGURES IN THE PANEL ABOVE DO NOT.**
         * `Past 24 hours` and `Past 48 hours` overlap by construction and must never be summed; these
         * five sum to everyone waiting. **Two figure sets with opposite arithmetic, one panel apart** —
         * which is the shape that once put *"Of 1 with a date written down, 1 met, 0 missed and 11
         * moved"* on a live ward page.
         */}
        <WardPanel title="Wait time, band by band" testId="ward-statistics-ed-bands">
          <div className={styles.panelBody} role="group" aria-label="Wait bands content" tabIndex={0}>
            <WardTable>
              <thead>
                <tr>
                  <th scope="col">Band</th>
                  <th scope="col">People waiting</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band) => (
                  <tr
                    key={band.label}
                    data-testid={`ward-statistics-ed-band-${band.label.replace(/\s+/gu, "-").toLowerCase()}`}
                  >
                    <th scope="row">{band.label}</th>
                    <td data-testid={`ward-statistics-ed-band-count-${band.label.replace(/\s+/gu, "-").toLowerCase()}`}>
                      <span className={pageStyles.bandValue}>
                        <span className={pageStyles.bandTrack} aria-hidden="true">
                          <span style={{ width: `${onTheList === 0 ? 0 : (band.count / onTheList) * 100}%` }} />
                        </span>
                        <span>{band.count === 0 ? "none" : band.count}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </WardTable>
          </div>
        </WardPanel>

        {/*
         * ⚠️ **DECLINES, NOT ACCEPTANCES.** Whether to publish an "accepted" figure beside these two is
         * not this task's call — the comparisons page's own governance already withholds a per-ward
         * acceptance/decline split as an owner decision, and this panel adds no new figure of that
         * shape. It states exactly the two decline counts the brief asks for and nothing else.
         */}
        <WardPanel title="Declines this department has recorded" testId="ward-statistics-ed-declines">
          <div className={styles.panelBody} role="group" aria-label="Department declines content" tabIndex={0}>
            <h3 className={styles.subHeading}>Declined for no free bed</h3>
            <p className={styles.body} data-testid="ward-stat-ed-declined-no-free-bed">
              {noFreeBedDeclineCount} {noFreeBedDeclineCount === 1 ? "decline names" : "declines name"} a ward that had
              no free bed.
            </p>

            <h3 className={styles.subHeading}>Declined for any other reason</h3>
            {/* Branching on the readout rather than on `notSuitableDeclineCount === undefined`: the two
              are equivalent, but only the readout narrows, and the alternative needed a dead `""`
              arm to satisfy the compiler for a case that cannot occur. */}
            {!declinesReadout.ok ? (
              <p className={styles.body} data-testid="ward-stat-ed-declined-not-suitable-unavailable">
                {declinesReadout.statement}
              </p>
            ) : (
              <p className={styles.body} data-testid="ward-stat-ed-declined-not-suitable">
                {notSuitableDeclineCount} {notSuitableDeclineCount === 1 ? "decline gave" : "declines gave"} a reason
                other than having no free bed.
              </p>
            )}
          </div>
        </WardPanel>

        {/*
         * 🔴 **THE DRAWING'S FINAL PANEL, AND ONE OF ITS FIVE SUB-SECTIONS IS DELIBERATELY NOT BUILT.**
         *
         * The approved drawing heads this *"About the figures on this page"* with five sub-headings. Four
         * are below. The fifth — *"What was reconciled against Command, and what changed"* — is omitted,
         * and this is a precedent-following decision rather than a new one.
         *
         * ⚠️ **THAT SUB-SECTION IS A NOTE ABOUT HOW THE DRAWING WAS MADE, NOT ABOUT THIS PAGE.** Its
         * content is the drawing's own sample world: *"This page stands where Command stands, at 10:42 on
         * Saturday 15 August"*, thirteen people waiting, `WF-031` moving to FSH Adult Secure. **None of
         * that is true of a screen that recomputes from live state on every render**, and reproducing it
         * would put a false sentence where a reader goes precisely BECAUSE they have stopped trusting the
         * figures above.
         *
         * 🔴 **AND THERE IS A RULING.** `delays-screen.tsx` met this exact paragraph and omitted it:
         * *"Reconciled to Command waits on §8.7's check-list mechanism (O-9), which no screen can reach
         * yet — `layout.tsx` passes an empty check array on every ward route — and D-40 forbids claiming
         * reconciliation from an empty one."* **The same holds here.** Recorded under §7.0(2): dropped
         * openly, not silently.
         *
         * ⚠️ **A SUBAGENT DRAFTING THIS SECTION CONCLUDED THAT NO SYSTEM CALLED COMMAND EXISTS AT ALL
         * AND PROPOSED PROSE SAYING SO, WITH A TEST PINNING IT.** It had grepped only
         * `statistics/`. **Command is `WARD_NAV`'s first entry** — `{ id: "command", href:
         * "/mockups/ward-flow", label: "Command" }` — and the word appears 19 times across the module.
         * 🔴 **A namespaced grep proves absence only inside the namespace, and the false sentence it
         * produced would have shipped on a clinical screen, asserted by a passing test.**
         */}
        {/*
         * 🔴 **TWO SECTIONS THE DRAWING ASKS FOR THAT THIS PROTOTYPE CANNOT SUPPORT — RENDERED AS
         * STATED ABSENCES RATHER THAN LEFT OUT. Register row D-4.**
         *
         * ⚠️ **AN EMPTY SECTION AND A MISSING SECTION ARE DIFFERENT ANSWERS, AND A READER CANNOT TELL
         * THEM APART.** Omitting these says nothing; drawing them at nought says something false. **So
         * they say the true thing: nothing has been drawn, and nothing is missing from the record.**
         *
         * 🔴 **THE SENTENCES NAME THE LIMIT, NEVER THE DEPARTMENT, AND NAME IT AS THE PROTOTYPE'S.**
         * *"Nothing this month"* and *"we cannot compute this month"* look identical to a coordinator and
         * mean opposite things. **And the real system will keep history — so a sentence that does not say
         * whose limit this is would survive into it still reading as true.**
         *
         * ⚠️ **THE DRAWING'S OWN REASON IS DELIBERATELY NOT REPRODUCED.** It explains that a thirty-day
         * line was drawn for the network and not per department, because drawing eight would mean
         * inventing eight more trends. **That is a fact about how the MOCKUP was made, and it implies a
         * network-wide trend exists that could be shown here.** 🔴 **None exists. There is no history for
         * any department, nor for the network.**
         */}

        <StatisticsDetailPanel title="Comparison across departments" testId="ward-stat-ed-comparison">
          <div className={styles.panelBody} role="group" aria-label="Department comparison content" tabIndex={0}>
            <WardTable>
              <thead>
                <tr>
                  <th scope="col">Department</th>
                  <th scope="col">Waiting now</th>
                  <th scope="col">Longest wait</th>
                  <th scope="col">Due times passed</th>
                  <th scope="col">Over 24 hours</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(({ department: each, figures, breached }) => (
                  <tr key={each.id} data-testid={`ward-stat-ed-comparison-row-${each.id}`}>
                    <th scope="row">
                      {each.name}
                      {each.id === department.id ? " — this page" : ""}
                    </th>
                    <td data-testid={`ward-stat-ed-comparison-waiting-${each.id}`}>{figures.onTheList}</td>
                    <td data-testid={`ward-stat-ed-comparison-longest-${each.id}`}>
                      {figures.longestWait ? splitDuration(figures.longestWait.waitMinutes) : "none waiting"}
                    </td>
                    <td data-testid={`ward-stat-ed-comparison-breached-${each.id}`}>{breached}</td>
                    <td data-testid={`ward-stat-ed-comparison-over24h-${each.id}`}>{figures.over24h}</td>
                  </tr>
                ))}
              </tbody>
            </WardTable>

            <LegalLimitsNotChecked variant="tag" />
          </div>
        </StatisticsDetailPanel>

        <WardPanel title="Every figure here is invented" testId="ward-statistics-ed-invented">
          <div className={styles.panelBody} role="group" aria-label="Invented department figures" tabIndex={0}>
            <p className={styles.body}>
              Every count and every wait above is invented. These invented figures are derived from this
              prototype&apos;s own invented movement records and have never been measured against a real department or a
              real patient. Nothing on this screen is a real clinical record.
            </p>
          </div>
        </WardPanel>

        <div data-testid="statistics-ed-limits-group"></div>
      </div>
    </StatisticsSectionFrame>
  );
}
