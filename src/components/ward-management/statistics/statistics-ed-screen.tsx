"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const TABS = [
  { id: "queue", label: "Live Status & Queue" },
  { id: "distribution", label: "Wait Time Distribution" },
  { id: "weat", label: "30-Day WEAT Trend" },
  { id: "comparison", label: "Cross-ED Comparison" },
] as const;
type TabId = (typeof TABS)[number]["id"];

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import { edWaitBands, edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import {
  statisticsSectionById,
  type StatisticsSection,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { MINUTES_PER_DAY, clockState, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Movement, EmergencyDepartment, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";

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
  movements?: Movement[];
}) {
  const { movements: liveMovements, configuration, patients, referrals } = useWardFlow();
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

  return (
    <StatisticsEdScreenInner
      section={section}
      department={department}
      movements={movements}
      configuration={configuration}
      patients={patients}
      referrals={referrals}
      now={now}
    />
  );
}

function useSafeRouter(): { push: (path: string) => void } | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

function StatisticsEdScreenInner({
  section,
  department,
  movements,
  configuration,
  patients,
  referrals,
  now,
}: {
  section: StatisticsSection;
  department: EmergencyDepartment;
  movements: Movement[];
  configuration: WardFlowState["configuration"];
  patients: Patient[];
  referrals: Referral[];
  now: number;
}) {
  const router = useSafeRouter();
  const accessTargetMinutes = configuration.edAccessTargetMinutes;
  const accessTargetText =
    accessTargetMinutes % 60 === 0
      ? `${accessTargetMinutes / 60} hour${accessTargetMinutes === 60 ? "" : "s"}`
      : `${accessTargetMinutes} minutes`;
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

  const [activeTab, setActiveTab] = useState<TabId>("queue");
  const [timeWindow, setTimeWindow] = useState<"today" | "7d" | "30d">("today");
  const [d4Notice, setD4Notice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = useCallback((msg: string = "Not wired in this prototype.") => {
    setToastMessage(msg);
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  const triggerD4 = useCallback((feature: string) => {
    setD4Notice(`Reporting window '${feature}' selected: note that this prototype does not persist historical logs, showing live data.`);
    setTimeout(() => setD4Notice(null), 5000);
  }, []);

  const filteredWaitingMovements = !searchQuery.trim()
    ? waitingMovements
    : waitingMovements.filter((entry) => {
        const pt = resolveSubjectPatient(entry.movement, { patients, referrals });
        return (
          pt.formalName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
          pt.umrn.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
          entry.movement.id.toLowerCase().includes(searchQuery.toLowerCase().trim())
        );
      });

  return (
    <StatisticsSectionFrame
      section={section}
      title={department.name}
      subtitle="Current placement waits and outcomes for this emergency department, with record limits stated in place."
      testId="ward-statistics-ed-screen"
      design="third-edition"
    >
      <div className={pageStyles.pageGrid}>
        {/* Sovereign ED Header Bar: Dropdown + Time Window */}
        <div className={pageStyles.edHeaderBar}>
          <div className={pageStyles.edSelectWrap}>
            <label htmlFor="ed-select" style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
              Emergency Department:
            </label>
            <select
              id="ed-select"
              className={pageStyles.edSelect}
              value={department.id}
              onChange={(e) => {
                router?.push(`/mockups/ward-flow/statistics/ed/${encodeURIComponent(e.target.value)}`);
              }}
              aria-label="Switch emergency department"
            >
              {allEmergencyDepartments().map((d) => {
                const f = edWaitFigures(movements, d.id, now);
                return (
                  <option key={d.id} value={d.id}>
                    {d.name} ({f.onTheList} waiting)
                  </option>
                );
              })}
            </select>
            <span className={pageStyles.chip} style={{ fontSize: "12px", fontWeight: 600 }}>
              {site?.name ?? department.siteCode} &middot; {onTheList} on list
            </span>
          </div>

          <div className={pageStyles.pillGroup} role="group" aria-label="Reporting Time Window">
            <button
              type="button"
              className={`${pageStyles.pillBtn} ${timeWindow === "today" ? pageStyles.pillActive : ""}`}
              onClick={() => setTimeWindow("today")}
              aria-pressed={timeWindow === "today"}
            >
              Today (Live)
            </button>
            <button
              type="button"
              className={`${pageStyles.pillBtn} ${timeWindow === "7d" ? pageStyles.pillActive : ""}`}
              onClick={() => {
                setTimeWindow("7d");
                triggerD4("7-day window");
              }}
              aria-pressed={timeWindow === "7d"}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`${pageStyles.pillBtn} ${timeWindow === "30d" ? pageStyles.pillActive : ""}`}
              onClick={() => {
                setTimeWindow("30d");
                triggerD4("30-day window");
              }}
              aria-pressed={timeWindow === "30d"}
            >
              30 Days
            </button>
          </div>
        </div>

        {d4Notice && (
          <div className={pageStyles.d4NoticeBanner} role="status">
            <span>{d4Notice}</span>
            <button
              type="button"
              className={pageStyles.d4NoticeDismiss}
              onClick={() => setD4Notice(null)}
              aria-label="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        )}

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

        {/* Sovereign Tabs Bar */}
        <nav className={pageStyles.sovereignTabs} aria-label="ED Statistics Navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${pageStyles.tabBtn} ${activeTab === tab.id ? pageStyles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ══════════ TAB 1: LIVE STATUS & QUEUE ══════════ */}
        <div className={activeTab === "queue" ? pageStyles.tabPaneActive : pageStyles.tabPane}>
          <WardPanel
            title={department.name}
            count={`${onTheList} open ${onTheList === 1 ? "placement" : "placements"}`}
            testId="ward-statistics-ed-identity"
          >
            <div
              className={styles.panelBody}
              role="group"
              aria-label="Emergency department identity content"
              tabIndex={0}
            >
              <p className={styles.body} data-testid="ward-statistics-ed-site">
                {site
                  ? `${department.name} is recorded at ${site.name}.`
                  : `${department.name} carries a site code this prototype has no site for, so it cannot be placed at a hospital here.`}
              </p>
              <p className={styles.note}>
                The department name and hospital are network identities, not performance measures.
              </p>
            </div>
            <dl className={pageStyles.kpiBand}>
              <div>
                <dt>Open placements</dt>
                <dd>{onTheList}</dd>
                <dd className={pageStyles.kpiCaption}>from this department</dd>
              </div>
              <div>
                <dt>Longest elapsed</dt>
                <dd>{longestWait ? splitDuration(longestWait.waitMinutes) : "none"}</dd>
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                <dd className={pageStyles.kpiCaption}>
                  {longestWait ? resolveSubjectPatient(longestWait.movement, { patients, referrals }).formalName : "no open placement"}
                </dd>
              </div>
              <div>
                <dt>Marked urgent</dt>
                <dd>{urgent}</dd>
                <dd className={pageStyles.kpiCaption}>of the {onTheList} open placements</dd>
              </div>
              <div>
                <dt>Over 24 hours</dt>
                <dd>{over24h}</dd>
                <dd className={pageStyles.kpiCaption}>elapsed since opening</dd>
              </div>
              <div>
                <dt>No ward yet</dt>
                <dd>{unplaced}</dd>
                <dd className={pageStyles.kpiCaption}>no accepting ward recorded</dd>
              </div>
            </dl>
          </WardPanel>

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
                    {over24h} of the {onTheList} above {over24h === 1 ? "has" : "have"} been waiting more than {LONG_WAIT_MINUTES / 60} hours ({OPERATIONAL_DEFAULT_LABEL}).
                  </p>

                  <h3 className={styles.subHeading}>Past {VERY_LONG_WAIT_MINUTES / 60} hours</h3>
                  <p className={styles.body} data-testid="ward-stat-ed-over-48h">
                    {over48h} of the {onTheList} above {over48h === 1 ? "has" : "have"} been waiting more than {VERY_LONG_WAIT_MINUTES / 60} hours ({OPERATIONAL_DEFAULT_LABEL}).
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
                          <title>{`${resolveSubjectPatient(movement, { patients, referrals }).formalName}: ${splitDuration(waitMinutes)} waiting`}</title>
                        </circle>
                      ))}
                    </svg>
                  </div>

                  <div className={pageStyles.tableFilterBar}>
                    <input
                      type="search"
                      className={pageStyles.tableSearch}
                      placeholder="Filter waiting patients by name or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Filter waiting patients"
                    />
                    <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                      {filteredWaitingMovements.length} of {waitingMovements.length} waiting
                    </span>
                  </div>

                  <WardTable testId="ward-stat-ed-wait-table" className={`${chartStyles.dtable} ${v4.edWaitTable}`}>
                    <thead>
                      <tr>
                        <th scope="col">Movement</th>
                        <th scope="col" className={chartStyles.n}>
                          Elapsed wait
                        </th>
                        <th scope="col">Urgent</th>
                        <th scope="col">Ward status</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWaitingMovements.map(({ movement, waitMinutes }) => {
                        const level =
                          waitMinutes >= 2 * MINUTES_PER_DAY
                            ? "urgent"
                            : waitMinutes >= MINUTES_PER_DAY
                              ? "stalled"
                              : undefined;
                        const pt = resolveSubjectPatient(movement, { patients, referrals });
                        return (
                          <tr key={movement.id} data-level={level} data-testid={`ward-stat-ed-wait-row-${movement.id}`}>
                            <th scope="row">
                              <div>{pt.formalName}</div>
                              <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 400 }}>{pt.umrn}</div>
                            </th>
                            <td className={chartStyles.n}>{splitDuration(waitMinutes)}</td>
                            <td>
                              {movement.flaggedUrgent ? (
                                <span className={pageStyles.chip} style={{ background: "var(--danger-soft)", color: "var(--danger)", fontWeight: 600 }}>
                                  Urgent
                                </span>
                              ) : (
                                "No"
                              )}
                            </td>
                            <td>{movement.acceptedUnitId !== undefined ? "Accepted" : "Awaiting a ward"}</td>
                            <td>
                              <button
                                type="button"
                                className={pageStyles.d4Btn}
                                onClick={() => triggerToast(`Viewing clinical journey for ${pt.formalName}`)}
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </WardTable>
                </>
              )}
            </div>
          </WardPanel>
        </div>

        {/* ══════════ TAB 2: WAIT TIME DISTRIBUTION ══════════ */}
        <div className={activeTab === "distribution" ? pageStyles.tabPaneActive : pageStyles.tabPane}>
          <WardPanel
            title="Urgency category wait times & benchmarks"
            count="Australasian Triage Scale"
            testId="ward-statistics-ed-urgency"
          >
            <div className={styles.panelBody} role="group" aria-label="Urgency category wait times content" tabIndex={0}>
              <p className={styles.notBuilt} data-testid="ward-statistics-ed-urgency-not-recorded">
                Urgency category wait times against benchmark: not recorded in Ward Flow. This prototype does not track
                which Australasian Triage Scale category a movement was assigned or how long each category waited.
              </p>
            </div>
          </WardPanel>

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

          <WardPanel
            title="24-hour arrivals vs dispositions curve"
            count="Hourly pattern"
            testId="ward-statistics-ed-diurnal"
          >
            <div className={styles.panelBody} role="group" aria-label="Hourly arrival pattern content" tabIndex={0}>
              <p className={styles.notBuilt} data-testid="ward-statistics-ed-diurnal-not-recorded">
                Hourly arrival pattern: not recorded in Ward Flow. This prototype keeps no history of when movements
                opened or closed across the day, only the current state of each one.
              </p>
            </div>
          </WardPanel>
        </div>

        {/* ══════════ TAB 3: 30-DAY WEAT TREND ══════════ */}
        <div className={activeTab === "weat" ? pageStyles.tabPaneActive : pageStyles.tabPane}>
          <WardPanel
            title="30-day WEAT performance"
            count="Western Australia Emergency Access Target"
            testId="ward-statistics-ed-weat"
          >
            <dl className={pageStyles.kpiBand}>
              <div>
                <dt>30-Day Mean WEAT</dt>
                <dd>Not recorded</dd>
              </div>
              <div>
                <dt>Target Met Days</dt>
                <dd>Not recorded</dd>
              </div>
              <div>
                <dt>30-Day Presentations</dt>
                <dd>Not recorded</dd>
                <dd className={pageStyles.kpiCaption}>Mental health triage</dd>
              </div>
              <div>
                <dt>Median ED Length of Stay</dt>
                <dd>Not recorded</dd>
                <dd className={pageStyles.kpiCaption}>Access target as configured: {accessTargetText}</dd>
              </div>
            </dl>

            <div className={styles.panelBody} role="group" aria-label="WEAT history content" tabIndex={0}>
              <p className={styles.notBuilt} data-testid="ward-statistics-ed-weat-not-recorded">
                30-day WEAT performance history: not recorded in Ward Flow. This prototype keeps no history at all — only
                the current state of each movement — so no day-by-day or trend figure can be formed from it.
              </p>
            </div>
          </WardPanel>

          <WardPanel title="Wait time over the last 30 days" testId="ward-stat-ed-trend">
            <div className={styles.panelBody} role="group" aria-label="Thirty day wait trend content" tabIndex={0}>
              <p className={styles.notBuilt} data-testid="ward-stat-ed-trend-not-built">
                <strong>Nothing is missing from the record; this prototype stores no history.</strong> Nothing has been
                drawn.
              </p>
            </div>
          </WardPanel>

          <WardPanel title="Where they went, last 7 days" testId="ward-stat-ed-destinations">
            <div className={styles.panelBody} role="group" aria-label="Recent destinations content" tabIndex={0}>
              <p className={styles.notBuilt} data-testid="ward-stat-ed-destinations-not-built">
                <strong>Nothing is missing from the record; this prototype stores no history.</strong> Nothing has been
                drawn.
              </p>
            </div>
          </WardPanel>
        </div>

        {/* ══════════ TAB 4: CROSS-ED COMPARISON ══════════ */}
        <div className={activeTab === "comparison" ? pageStyles.tabPaneActive : pageStyles.tabPane}>
          <WardPanel title="Comparison across departments" testId="ward-stat-ed-comparison">
            <div className={styles.panelBody} role="group" aria-label="Department comparison content" tabIndex={0}>
              <p className={styles.note} data-testid="ward-stat-ed-comparison-scope">
                Every department in scope is shown, including the ones with nobody waiting. A none in this table is a
                measured answer and not a missing figure.
              </p>

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

              <p className={styles.note}>
                Due times passed counts only an overdue transport or transfer order. Neither an examination form nor a detention
                form carries a due-by time in this model at all, so this column can never report a missed Mental Health
                Act deadline — only a transport or transfer order that has run past when it was due.
              </p>
              <LegalLimitsNotChecked />

              <p className={styles.notBuilt} data-testid="ward-stat-ed-comparison-not-built">
                <strong>Three comparison measures are unavailable</strong>, and none stands as a nought or a dash.{" "}
                <em>Accepted, 7 days</em> and <em>Out of area, 7 days</em> both need a rolling seven-day window, and this
                prototype keeps no history at all — only the current state of each movement — so neither can be formed
                from anything it stores. <em>Median wait</em> needs a minimum sample size below which it is suppressed,
                and the one such threshold this prototype has was ruled by the owner for a different measure. No threshold
                is applied here.
              </p>
            </div>
          </WardPanel>
        </div>

        {/* ══════════ FOOTER: DECLINES & METHODOLOGY ══════════ */}
        <WardPanel title="Declines this department has recorded" testId="ward-statistics-ed-declines">
          <div className={styles.panelBody} role="group" aria-label="Department declines content" tabIndex={0}>
            <h3 className={styles.subHeading}>Declined for no free bed</h3>
            <p className={styles.body} data-testid="ward-stat-ed-declined-no-free-bed">
              {noFreeBedDeclineCount} {noFreeBedDeclineCount === 1 ? "decline names" : "declines name"} a ward that had
              no free bed.
            </p>

            <h3 className={styles.subHeading}>Declined for any other reason</h3>
            {!declinesReadout.ok ? (
              <p className={styles.body} data-testid="ward-stat-ed-declined-not-suitable-unavailable">
                {declinesReadout.statement} This figure is a subtraction from that total, so it cannot be stated on its
                own — the count above is not affected, because it reads the reason directly rather than through the
                list.
              </p>
            ) : (
              <p className={styles.body} data-testid="ward-stat-ed-declined-not-suitable">
                {notSuitableDeclineCount} {notSuitableDeclineCount === 1 ? "decline gave" : "declines gave"} a reason
                other than having no free bed — a mix of clinical mismatch, staffing and administrative reasons, and one
                that is itself about capacity. They are listed by name in the breakdown on the statistics home page.
              </p>
            )}
          </div>
        </WardPanel>

        <WardPanel title="Methodology, Scope & Governance Limits" testId="ward-statistics-ed-governance">
          <details className={`${pageStyles.measurementDetails} source-print`} open>
            <summary style={{ fontWeight: 600, color: "var(--ink)", padding: "0.5rem 0.75rem", cursor: "pointer" }}>
              Clinical scope, limitations, and governance statements
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginTop: "0.5rem" }}>
              <WardPanel title="What can be measured about this department" testId="ward-statistics-ed-measures">
                <details className={`${pageStyles.measurementDetails} source-print`}>
                  <summary>Read how the headline figures are counted</summary>
                  <div
                    className={styles.panelBody}
                    role="group"
                    aria-label="Department measurement scope content"
                    tabIndex={0}
                  >
                    <h3 className={styles.subHeading}>On the list</h3>
                    <p className={styles.body} data-testid="ward-stat-ed-on-the-list">
                      {onTheList} — everyone with an open movement whose origin is this department right now.
                    </p>

                    <h3 className={styles.subHeading}>Marked urgent</h3>
                    <p className={styles.body} data-testid="ward-stat-ed-urgent">
                      {urgent} of the {onTheList} above {urgent === 1 ? "is" : "are"} flagged urgent.
                    </p>

                    <h3 className={styles.subHeading}>No ward yet</h3>
                    <p className={styles.body} data-testid="ward-stat-ed-unplaced">
                      {unplaced} of the {onTheList} above {unplaced === 1 ? "has" : "have"} no ward that has accepted them
                      yet.
                    </p>
                  </div>
                </details>
              </WardPanel>

              <WardPanel title="Measures the record cannot support" testId="ward-statistics-ed-not-built">
                <div
                  className={styles.panelBody}
                  role="group"
                  aria-label="Unmeasured department statistics content"
                  tabIndex={0}
                >
                  <p className={styles.notBuilt} data-testid="ward-statistics-ed-not-built-body">
                    <strong>
                      The figures above are the only ones this page shows — nothing else here is a nought, and nothing stands
                      as a dash where a further number would go.
                    </strong>{" "}
                    Which of the rest are a derivation away and which the record cannot support at all are different answers,
                    and this page keeps them apart rather than calling everything absent.
                  </p>

                  <p className={styles.body} data-testid="ward-statistics-ed-attributable">
                    <strong>Nothing is stored on a department itself.</strong> A department record holds an id, a site code, a
                    name and a pointer to the Western Australian service register, and no figure could ever sit on it. Two
                    other records name one, and they are where a department&apos;s figures would come from. A movement says
                    which department a person is physically in — always, never missing — alongside when their movement opened,
                    what stage it has reached and every ward decline against it. And a referral addressed to this
                    department&apos;s psychiatry service names the department on its destination. The referral&apos;s own
                    clocks are weaker than they look: the moment it was raised is always recorded, but the moment it was
                    triaged is optional, so a referral may carry no triage instant at all — and where both exist the triage
                    can precede the referral, because somebody can be in a department for hours before psychiatry is called.
                    So how many people this department is currently waiting on is derivable from the movement side, and is
                    shown above; how long each has been waiting draws on that same required field, and the wait chart below is
                    built from exactly that subtraction.
                  </p>

                  <p className={styles.body} data-testid="ward-statistics-ed-unrecordable">
                    <strong>
                      How busy the department is, though, is not a derivation away — the model has no field for it.
                    </strong>{" "}
                    Every record above describes somebody mental health has been told about. Emergency department medical
                    staff are not users of this system: their request arrives verbally, and psychiatry then raise the
                    referral. So attendances this service was never told about are outside the model entirely, and no figure
                    on this page could count them.
                  </p>

                  <p className={styles.body} data-testid="ward-statistics-ed-near-miss">
                    <strong>And one figure would be easy to publish and wrong.</strong> A movement can close with an outcome
                    meaning it did not proceed, which looks like a count of people who left without a bed and is not one: it
                    records a movement that ended without admission, typically because an examination found admission was not
                    needed. Publishing it under that heading would rename a clinical outcome as a failure of flow. Whether
                    anything here should be counted as leaving without a bed is a question for the owner, and until it is
                    answered this page shows no such figure — deliberately, and never as a nought.
                  </p>

                  <p className={styles.body} data-testid="ward-statistics-ed-left-before-seen-absent">
                    <strong>
                      &quot;Left before being seen&quot; is a different claim again, and this model has no field for it at
                      all.
                    </strong>{" "}
                    That phrase names a person who leaves an emergency department before anyone examines them — a safety
                    event, not a throughput number, and a different thing from the closure outcome above. Nothing on a
                    movement, a referral or any other record here says whether that happened. This page does not show it, does
                    not approximate it from a nearby field under that name, and does not count it as a nought: a wrong figure
                    claiming to measure a safety event would be worse than showing none.
                  </p>

                  <p className={styles.body} data-testid="ward-statistics-ed-legs-not-built">
                    <strong>
                      The individual legs of a journey — referral raised, ward acceptance, bed pulled, arrival — are not
                      broken out here either.
                    </strong>{" "}
                    Each leg needs a clock at both ends, and for the earliest two legs each clock is optional on the type: a
                    movement can be raised, referred and accepted while either instant is still unset. A table built across
                    clocks that may be missing would have to say, leg by leg, whether both ends are even on record, rather
                    than quietly reading an absent one as no time at all.
                  </p>

                  <p className={styles.body}>
                    <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ed-chooser-link">
                      Choose another ward or emergency department
                    </Link>
                  </p>
                </div>
              </WardPanel>

              <WardPanel title="Data provenance and limits" testId="ward-statistics-ed-about">
                <div
                  className={styles.panelBody}
                  role="group"
                  aria-label="Department data provenance and limits content"
                  tabIndex={0}
                >
                  <h3 className={styles.subHeading}>Every figure here is invented</h3>
                  <p className={styles.body} data-testid="ward-statistics-ed-about-invented">
                    Every count and every wait above is invented, derived from this prototype&apos;s own invented movement
                    records — who is on this department&apos;s list, when each movement opened, whether a ward has accepted
                    them, and every decline recorded against them. These invented figures have never been measured against a
                    real department or a real patient. Nothing on this screen is real, and no identifier above belongs to
                    anybody.
                  </p>

                  <h3 className={styles.subHeading}>What is real</h3>
                  <p className={styles.body} data-testid="ward-statistics-ed-about-real">
                    The department named at the top of this page is a real Western Australian emergency department, and so is
                    the health service it belongs to. Both are read from this prototype&apos;s own site list, and this page
                    cannot show a department that is not on it. Neither is a measurement, so unlike every figure above,
                    neither can be wrong in the way a count can be wrong.
                  </p>

                  <h3 className={styles.subHeading}>A department is not a ward</h3>
                  <p className={styles.body} data-testid="ward-statistics-ed-about-not-a-ward">
                    This screen only ever describes people standing in a department: how many, how long, and where they went
                    next. It never shows a bed count, an occupancy figure or a length of stay for a department, because a
                    department has none of its own. Those belong to Capacity and to the ward screens.
                  </p>

                  <h3 className={styles.subHeading}>What a nought means, and what a stated absence means</h3>
                  <p className={styles.body} data-testid="ward-statistics-ed-about-nought">
                    A nought here is a measured answer: nobody flagged urgent, nobody without a ward, nobody past twenty-four
                    hours — every movement was checked and none matched. A stated absence is a different thing, and this page
                    carries one: where the count of declines for any reason other than no free bed cannot be formed, this page
                    says so in words instead of showing a number. The two are never the same thing, and neither is ever left
                    blank.
                  </p>
                  <p className={styles.body} data-testid="ward-statistics-ed-about-zero">
                    Every zero on this page is a real, measured zero unless the words beside it say the figure could not be
                    taken. None of them means not tracked.
                  </p>
                </div>
              </WardPanel>
            </div>
          </details>
        </WardPanel>
        {toastMessage && (
          <div className={pageStyles.actionToast} role="status" aria-live="polite">
            {toastMessage}
          </div>
        )}
      </div>
    </StatisticsSectionFrame>
  );
}


