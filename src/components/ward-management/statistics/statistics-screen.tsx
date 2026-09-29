"use client";

import { useState } from "react";
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
import type { Admission } from "@/components/ward-management/ward-admissions";
import { calendarDateOf, dayOf, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { BedRelease, Movement, Referral } from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";

import styles from "./statistics.module.css";
import pageStyles from "./statistics-landing-third-edition.module.css";
import sectionStyles from "./statistics-sections.module.css";

/**
 * THE COORDINATOR STATISTICS SCREEN — how the system is performing, and what is happening to
 * patients, kept apart because they are two different questions asked by two different people.
 *
 * ⚠️ **THIS PAGE IS ALSO THE HUB.** Above the figures it indexes the statistics sections, reading
 * every label, description and href from `statistics-sections.ts` and typing none of them here.
 * Before that index existed the section pages were reachable only by knowing their addresses. The
 * index adds navigation and nothing else: no count, no badge, no number of any kind — see the block
 * comment on it below for why a self-counting index would be unsafe on this particular page.
 *
 * ⚠️ **THIS IS THE SURFACE WHERE A WRONG NUMBER WOULD BE BELIEVED HARDEST AND QUESTIONED LEAST.**
 * Everywhere else in this prototype a figure sits beside the record it came from, and a reader who
 * doubts it can look. Here the figures ARE the page. A number that is merely plausible is worse
 * than a blank, because nobody re-checks a number that renders. So:
 *
 *   1. **Every figure on this page is computed from provider state on every render**, by
 *      `statistics-derivations.ts`. Nothing is stored, cached, seeded as a display value, or
 *      carried in this file's own state.
 *   2. **A count of zero renders AS A ZERO.** "No bed is being prepared" and "bed preparation
 *      cannot be timed" are completely different statements and this page never blurs them: a
 *      measured count keeps its own element and its own wording whatever its value, and an
 *      unmeasurable figure never renders a numeral at all. That distinction is in the markup, not
 *      only in the prose — see the `measuredCount` / `absence` treatments below.
 *   3. **An empty state says WHY, mechanically.** "Not yet collected" would be useless and would
 *      invite somebody to fill the gap later with a plausible number. Each absence below names the
 *      field, says what the record actually holds, and says where the fix would have to be made.
 *
 * ⚠️ **THE TWO SECTIONS ARE NOT A LAYOUT CHOICE.** The owner named the two audiences separately: a
 * policy maker, a state government or a ward coordinator asks *how is the system performing*; a
 * clinician asks *what is happening to patients*. Four equivalent tiles in a row would answer
 * neither question, because the reader would not know which of them was theirs. Each section says
 * whose question it answers, in its own words, above its figures.
 *
 * ⚠️ **NOTHING HERE IS A TARGET, A THRESHOLD OR A RANKING.** No figure changes colour with its
 * value, no ward is compared with another, and no number is called good or bad. A benchmark
 * invented on this page would carry more authority than one invented anywhere else in the
 * prototype.
 *
 * ⚠️ **ONE STATISTIC THE OWNER ASKED FOR IS DELIBERATELY ABSENT: declines per ward.** It is not
 * omitted because it does not matter — it is the headline system question — and it is not omitted
 * because the data is missing. It is omitted because the model holds declines in two different
 * places that mean two different things, and only one of them can name a ward:
 * `ReferralAddressing` records a decline against a destination KIND plus its bed criteria (`sex`,
 * `secureBedNeeded`, `involuntaryBedNeeded`); its only unit field is `acceptedUnitId`, set solely
 * when a ward ACCEPTS, so an acceptance names a ward and a decline cannot — while
 * `Movement.declines` records `{ unitId, at, reason }` for a patient already inside a department.
 * (The clause here and on the page read "carries no unit at all" until 2026-09-01. It was false —
 * `acceptedUnitId` is on the record — and the conclusion it supported was right, which is the
 * combination nothing catches: a wrong stated reason with every test green.) Choosing between
 * them decides what the published number MEANS, and that is the product owner's decision rather
 * than an implementer's. It is handed back rather than guessed.
 *
 * ⚠️ **AND THE PAGE SAYS SO, which this comment alone did not.** Until 2026-09-01 the refusal was
 * argued only here and there was simply nothing on screen where the owner's first-named statistic
 * should be. That silence was the one asymmetry a reader could not detect: `Movement.declines` is
 * seeded non-empty, so a coordinator who knows this prototype records declines and finds no decline
 * figure cannot tell "withheld pending a ruling" from "not recorded" from "nobody declined". The
 * `ward-statistics-declines` block below is that sentence. Saying it invents no number, which is
 * exactly why it is safe to say and unsafe to leave out.
 *
 * The four optional props exist only so a test can render populations the seed cannot produce.
 * They fall back to live state, following `CommunityScreen`'s own shape and its reasoning: a ROUTE
 * must never pass any of them, because a route that did would pin this screen to a fixture and
 * quietly override the live world.
 *
 * ⚠️ **`units` AND `now` ARE READ FROM LIVE STATE ONLY, AND ARE DELIBERATELY NOT PROPS.** Neither
 * changes any figure on this page. `handoverSnapshot` requires both for its own other sections;
 * the count this page takes from it is scoped by `isOpen` — which reads `closure` and `stage` and
 * no clock — and decided by two array lengths. Adding a seam nothing behind it can move would
 * suggest to a later reader that the figure moves with the clock, which is the sort of wrong
 * impression this page exists to avoid.
 */

/**
 * "{weekday d Month}" — build plan `2026-09-17-build-plan-screens.md` §3 "Reports (32)". Written by
 * hand from `Date` parts rather than a single `toLocaleDateString` call with all three options at
 * once: `en-AU` inserts a comma between the weekday and the day ("Thursday, 17 September") that the
 * plan's own format string does not carry, and the caption already supplies its own comma after this
 * whole fragment ("…, midnight to midnight, across all wards").
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
  /*
   * ⚠️ **REPORTED IN PLACE, NOT THROWN.** `declinesByReason` throws on a decline reason outside
   * `DECLINE_REASONS`, which is right — a categorical breakdown must never quietly shrink its own
   * total. But this page calls it during render alongside arrivals, the referral-to-bed join, beds
   * being prepared, refusals with nothing pending and blocked discharges. **A throw here costs the
   * reader every one of those, none of which depends on the decline vocabulary.**
   *
   * Ward Lead's ruling, 2026-09-07, applied identically at all three call sites. Bounded to this
   * class — a malformed value in a categorical breakdown the rest of the screen is independent of.
   */
  const declinesReadout = readDeclinesByReason(sourceMovements);
  const blocked = blockedDischargesByReason(sourceAdmissions);

  const totalBeds = units.reduce((sum, u) => sum + u.beds, 0);
  const hospitalsCount = new Set(units.map((u) => u.siteCode)).size;
  const occupiedBeds = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).occupied, 0);
  const occupiedPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const availableNow = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).available, 0);
  const pendingPreparation = units.reduce((sum, u) => sum + bedsPendingPreparation(u.id, sourceBedReleases), 0);
  const availablePct = totalBeds > 0 ? Math.round((availableNow / totalBeds) * 100) : 0;
  const waitingCount = refused.openMovementCount;
  const heldBeds = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).held, 0);
  const blockedBeds = units.reduce((sum, u) => sum + unitCapacity(u, sourceBedReleases).blocked, 0);
  const heldPct = totalBeds > 0 ? Math.round((heldBeds / totalBeds) * 100) : 0;
  const blockedPct = totalBeds > 0 ? Math.round((blockedBeds / totalBeds) * 100) : 0;
  /*
   * ⚠️ **CALENDAR-DAY BOUND, NOT STATE-BOUND — build plan §1 "reports defect", owner answer 32.**
   * This used to count every `"occupied"` or `"pulled"` admission and every `"departed"` one, with
   * no day bound at all: a person admitted three weeks ago and still on the ward counted as an
   * "admission today" forever, and the figure never fell as the demo clock advanced. `"today"` on
   * this label now means what it says — the arrival or departure fell on the SAME CALENDAR DAY as
   * `now`, per `dayOf` (`ward-clock.ts`), which is the rolling-day convention reports use (owner
   * answer 32) rather than `releaseBand`'s rolling-24-hours convention. `state` is deliberately not
   * read here any more: a person admitted and discharged on the same calendar day counts in BOTH
   * figures, which is correct — they are two independent events, not two mutually exclusive states.
   * A `"pulled"` admission has no `arrivedAt` yet (bed given, nobody has arrived) and so is correctly
   * excluded until it does.
   */
  const admissionsCount = sourceAdmissions.filter(
    (a) => a.arrivedAt !== null && dayOf(a.arrivedAt) === dayOf(now),
  ).length;
  const dischargesCount = sourceAdmissions.filter((a) => a.leftAt !== null && dayOf(a.leftAt) === dayOf(now)).length;
  const reportDayCaption = `${formatReportDay(now, dayZero)}, midnight to midnight, across all wards`;

  const [highlightedSegment, setHighlightedSegment] = useState<string | null>(null);
  const occPrecise = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
  const pendingPreparationPct = totalBeds > 0 ? Math.round((pendingPreparation / totalBeds) * 100) : 0;

  usePrintableDisclosures();

  return (
    <div
      className={`${styles.screen} ${pageStyles.screen}`}
      data-testid="ward-statistics-screen"
      data-ward-design="third-edition"
    >
      <main id="main-content" className={`${styles.main} ${pageStyles.main}`}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Statistics</h1>
        </header>

        <StatisticsNav currentSection="hub" />

        {/*
         * ── SERVICE SCOPE SENTENCE (item 44, §2 rule S4 / §3 "Statistics") ───────────────────────
         *
         * This page is never scoped by the Service selector — it is the whole network's own page,
         * exactly like the bed board and the ward page (S4). While a service IS chosen elsewhere in
         * the shell, this says so and says the figures below already include it, rather than staying
         * silent and letting a reader wonder whether "Admissions today" above just got narrower.
         * `serviceStatisticsHref` (`shell/ward-facade.ts`) is the one existing route that DOES narrow
         * to a service, so the link is the one place on this page a reader who wants that can go.
         */}
        {service === null ? null : (
          <p className={styles.notice} data-testid="ward-statistics-service-scope-sentence">
            {`Set to ${service}. This page is the whole network's own, so these figures already include ${service}.`}{" "}
            <Link href={serviceStatisticsHref(service)} data-testid="ward-statistics-service-scope-link">
              {`Open ${service} statistics`}
            </Link>
          </p>
        )}

        {/* ══════════ REPORTING PERIOD STRIP ══════════ */}
        <div
          className={`${pageStyles.statsNavStrip} ${pageStyles.reportingPeriodBar ?? ""}`}
          style={{ justifyContent: "space-between" }}
        >
          <div
            className={`${pageStyles.timeWindowTrack} ${pageStyles.segTrack}`}
            role="group"
            aria-label="Reporting period"
            data-testid="ward-statistics-reporting-period"
          >
            <span
              className={`${pageStyles.segBtn} ${sectionStyles.segBtn ?? ""} ${pageStyles.active}`}
              id="btn-range-today"
              style={{ minHeight: "44px" }}
            >
              Current state
            </span>
            <span style={{ fontSize: "var(--t-1)", color: "var(--muted)", alignSelf: "center", padding: "0 0.5rem" }}>
              7-day and 30-day history is not recorded.
            </span>
          </div>
          <span className={pageStyles.reportingBadge}>No target recorded</span>
        </div>

        {/* ══════════ BED STATE WATERFALL ══════════ */}
        <div className={pageStyles.waterfallCard}>
          <div className={pageStyles.waterfallHeader}>
            <h3>Bed State Distribution</h3>
            <span
              className={pageStyles.mono}
              style={{ fontSize: "var(--t-0)", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}
            >
              {totalBeds} Total Beds
            </span>
          </div>
          <p className={pageStyles.lede} style={{ fontSize: "var(--t-1)" }}>
            Current bed state across {units.length} inpatient wards.
          </p>
          <div className={pageStyles.waterfallBar}>
            <div
              style={{ width: `${occupiedPct}%`, background: "var(--accent)" }}
              className={`${pageStyles.wfSegment} ${highlightedSegment === "occupied" ? pageStyles.wfSegmentHighlighted : highlightedSegment ? pageStyles.wfSegmentDimmed : ""}`}
              title={`Occupied: ${occupiedBeds} beds (${occPrecise.toFixed(1)}%)`}
              onMouseEnter={() => setHighlightedSegment("occupied")}
              onMouseLeave={() => setHighlightedSegment(null)}
            >
              {occupiedPct >= 18
                ? `${occupiedBeds} Occupied (${occPrecise.toFixed(1)}%)`
                : occupiedPct >= 10
                  ? `${occupiedBeds} Occ`
                  : occupiedPct >= 5
                    ? `${occupiedBeds}`
                    : null}
            </div>
            <div
              style={{ width: `${availablePct}%`, background: "var(--good)" }}
              className={`${pageStyles.wfSegment} ${highlightedSegment === "ready" ? pageStyles.wfSegmentHighlighted : highlightedSegment ? pageStyles.wfSegmentDimmed : ""}`}
              title={`Ready to admit: ${availableNow} beds (${availablePct}%)`}
              onMouseEnter={() => setHighlightedSegment("ready")}
              onMouseLeave={() => setHighlightedSegment(null)}
            >
              {availablePct >= 18
                ? `${availableNow} Ready (${availablePct}%)`
                : availablePct >= 10
                  ? `${availableNow} Ready`
                  : availablePct >= 5
                    ? `${availableNow}`
                    : null}
            </div>
            {pendingPreparation > 0 ? (
              <div
                style={{ width: `${pendingPreparationPct}%`, background: "var(--warn)" }}
                className={`${pageStyles.wfSegment} ${highlightedSegment === "pending" ? pageStyles.wfSegmentHighlighted : highlightedSegment ? pageStyles.wfSegmentDimmed : ""}`}
                title={`Pending preparation: ${pendingPreparation} beds (${pendingPreparationPct}%)`}
                onMouseEnter={() => setHighlightedSegment("pending")}
                onMouseLeave={() => setHighlightedSegment(null)}
              >
                {pendingPreparationPct >= 18
                  ? `${pendingPreparation} Pending (${pendingPreparationPct}%)`
                  : pendingPreparationPct >= 10
                    ? `${pendingPreparation} Pend`
                    : pendingPreparationPct >= 5
                      ? `${pendingPreparation}`
                      : null}
              </div>
            ) : null}
          </div>
          <div className={pageStyles.wfLegend}>
            <div
              className={`${pageStyles.wfLegendItem} ${highlightedSegment === "occupied" ? pageStyles.wfLegendItemHighlighted : highlightedSegment ? pageStyles.wfLegendItemDimmed : ""}`}
              onMouseEnter={() => setHighlightedSegment("occupied")}
              onMouseLeave={() => setHighlightedSegment(null)}
            >
              <span className={pageStyles.wfColorBox} style={{ background: "var(--accent)" }} />
              <span>Occupied</span>
              <strong style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                {occupiedBeds} ({occPrecise.toFixed(1)}%)
              </strong>
            </div>
            <div
              className={`${pageStyles.wfLegendItem} ${highlightedSegment === "ready" ? pageStyles.wfLegendItemHighlighted : highlightedSegment ? pageStyles.wfLegendItemDimmed : ""}`}
              onMouseEnter={() => setHighlightedSegment("ready")}
              onMouseLeave={() => setHighlightedSegment(null)}
            >
              <span className={pageStyles.wfColorBox} style={{ background: "var(--good)" }} />
              <span>Ready to Admit</span>
              <strong style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                {availableNow} ({availablePct}%)
              </strong>
            </div>
            {pendingPreparation > 0 ? (
              <div
                className={`${pageStyles.wfLegendItem} ${highlightedSegment === "pending" ? pageStyles.wfLegendItemHighlighted : highlightedSegment ? pageStyles.wfLegendItemDimmed : ""}`}
                onMouseEnter={() => setHighlightedSegment("pending")}
                onMouseLeave={() => setHighlightedSegment(null)}
              >
                <span className={pageStyles.wfColorBox} style={{ background: "var(--warn)" }} />
                <span>Pending Prep</span>
                <strong style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                  {pendingPreparation} ({pendingPreparationPct}%)
                </strong>
              </div>
            ) : null}
            <div
              className={`${pageStyles.wfLegendItem} ${highlightedSegment === "blocked" ? pageStyles.wfLegendItemHighlighted : highlightedSegment ? pageStyles.wfLegendItemDimmed : ""}`}
              onMouseEnter={() => setHighlightedSegment("blocked")}
              onMouseLeave={() => setHighlightedSegment(null)}
            >
              <span className={pageStyles.wfColorBox} style={{ background: "var(--danger)" }} />
              <span>Out of Service</span>
              <strong style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                Not recorded
              </strong>
            </div>
          </div>
        </div>

        {/* ── Audience 1 ─────────────────────────────────────────────────────────────────── */}
        <div className={pageStyles.landingRegions}>
          <WardPanel title="Across all services" testId="ward-statistics-system">
            <div className={pageStyles.landingBody}>
              <div className={pageStyles.acrossContext}>
                {/* The access claim and the fact that nothing enforces it, at the top and before any figure.
                    The sentence is shared with the four section pages; the reason it reads the way it does —
                    including why it no longer names figures specifically — is in `statistics-disclaimers.tsx`. */}
                <details className={`${pageStyles.disclosure} source-print`}>
                  <summary>Coordinator view — no role check or access restriction is enforced here</summary>
                  <p className={styles.notice} data-testid="ward-statistics-access">
                    <CoordinatorAccessDisclaimer />
                  </p>
                </details>
              </div>
              <dl className={pageStyles.metricBand} aria-label="Across all services headline figures">
                <div>
                  <dt>Total beds</dt>
                  <dd>{totalBeds}</dd>
                  <dd className={pageStyles.metricCaption}>
                    {units.length} wards across {hospitalsCount} hospitals
                  </dd>
                </div>
                <div>
                  <dt>Occupied</dt>
                  <dd>{occupiedBeds}</dd>
                  <dd className={pageStyles.metricCaption}>{occupiedPct}% of all beds</dd>
                </div>
                <div>
                  <dt>Ready</dt>
                  <dd>{availableNow}</dd>
                  <dd className={pageStyles.metricCaption}>
                    {availablePct}% of all beds, the ready count
                    {pendingPreparation > 0 ? ` (${pendingPreparation} still being made ready)` : null}
                  </dd>
                </div>
                <div data-tone={waitingCount > 0 ? "warn" : undefined}>
                  <dt>Waiting for a bed</dt>
                  <dd>{waitingCount}</dd>
                  <dd className={pageStyles.metricCaption}>open movements awaiting placement</dd>
                </div>
                <div>
                  <dt>Admissions today</dt>
                  <dd data-testid="ward-statistics-admissions-today-count">{admissionsCount}</dd>
                  <dd className={pageStyles.metricCaption} data-testid="ward-statistics-admissions-today-caption">
                    {reportDayCaption}
                  </dd>
                </div>
                <div>
                  <dt>Discharges today</dt>
                  <dd data-testid="ward-statistics-discharges-today-count">{dischargesCount}</dd>
                  <dd className={pageStyles.metricCaption} data-testid="ward-statistics-discharges-today-caption">
                    {reportDayCaption}
                  </dd>
                </div>
              </dl>
              <div className={pageStyles.acrossIndex}>
                {/*
                 * ── THE HUB INDEX ───────────────────────────────────────────────────────────────────
                 *
                 * ⚠️ **EVERY WORD OF EVERY ENTRY COMES FROM `STATISTICS_SECTIONS`, AND NONE OF IT IS TYPED
                 * HERE.** A section name written into this file is a second copy of a fact the section list
                 * already holds, and the failure it produces is silent: the hub promises "Across all
                 * services" and the page it opens is headed something else, with nothing red anywhere.
                 * `tests/ward-statistics.dom.test.tsx` compares the rendered entries against the module as
                 * whole lists, so a section added to the module and not to this page fails here rather than
                 * being quietly missed.
                 *
                 * ⚠️ **NO COUNT, NO BADGE, NO NUMBER OF ANY KIND.** Not "3 sections", not a per-section item
                 * count. This page's whole safety property is that it withholds figures it cannot support
                 * and says so; an index that counted itself would invite a reader to take every number on
                 * the page as measured. The index is navigation and nothing else.
                 *
                 * ⚠️ **THE HREF IS RENDERED EXACTLY AS THE MODULE GIVES IT, FRAGMENT AND ALL.** One of the
                 * three sections is served by two dynamic per-unit routes and so has no page of its own; the
                 * module points it at the unit chooser on the comparisons page via a fragment. Dropping that
                 * fragment lands the reader at the top of a page that opens with two sections about why no
                 * comparison exists, with the list they wanted below the fold — a defect fix round 1 found in
                 * four other places. Nothing here rewrites, trims or rebuilds an href.
                 *
                 * ⚠️ **THE FIGURES BELOW DO NOT MOVE.** The index sits above them; it does not replace them
                 * and no figure is migrated into a section page. That is a content migration and it is out
                 * of scope by a recorded ruling.
                 */}
                <nav
                  className={`${styles.index} ${sectionStyles.domainChooser} ${pageStyles.domainChooser ?? ""} domainChooser`}
                  aria-labelledby="ward-statistics-index-heading"
                  data-testid="ward-statistics-index"
                >
                  <h2 id="ward-statistics-index-heading" className={styles.indexHeading}>
                    Where to look
                  </h2>
                  {/* Written so it stays true whatever the section list becomes: it names no section, no
                    position and no destination, and says only what an entry does. A sentence naming "the
                    third one" would be wrong the day a fourth is added, and nothing would fail. */}
                  <p className={styles.indexIntro}>Choose a section for its current measures and definitions.</p>
                  <ul
                    className={`${styles.indexList} ${sectionStyles.sectionCards} ${pageStyles.sectionCards ?? ""} sectionCards`}
                  >
                    {STATISTICS_SECTIONS.map((section) => (
                      <li key={section.id} className={styles.indexItem}>
                        <Link
                          href={section.href}
                          className={styles.indexLink}
                          data-testid={`ward-statistics-index-entry-${section.id}`}
                        >
                          <span className={styles.indexLabel}>{section.label}</span>
                          <span className={styles.indexDescription}>{section.description}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
              <details className={`${pageStyles.measurementDetails} source-print`}>
                <summary>Bed measurements and what cannot be counted</summary>
                <div className={styles.panelBody}>
                  <p className={styles.sectionAudience} data-testid="ward-statistics-system-audience">
                    Network and ward measures. No person-level measure is shown here.
                  </p>

                  <article className={styles.figure} data-testid="ward-statistics-bed-readiness">
                    {/*
                  ⚠️ **TWO OWNER RULINGS MEET HERE, AND THE LATER ONE WINS. 2026-09-07.**

                  **2026-09-04:** "Ready" names ONE number — the beds a coordinator can put somebody
                  in, `min(allocatable, empty)`. This figure counts beds nobody can be put in yet,
                  close to the opposite, so it must not wear a near-identical phrase. That is why this
                  block said "cleaned" for three days.

                  **2026-09-07:** the owner corrected the substitute. *"It is not just being cleaned…
                  it can be many things and it comes under the bed state of Pending."* And the model
                  agrees: `bedsBeingPrepared()` filters on `release.preparing` ALONE, so its population
                  is every bed being made ready for any reason — `BED_PREPARATION_NOTES` holds
                  "Being cleaned" AND "Awaiting maintenance or repair", and `ward-model.ts:1097`
                  records that `preparing: true` with a null note "remains legal and means 'being made
                  ready, reason not stated'". Three states; "cleaned" named one.

                  ⚠️ **It was true only by fixture accident.** The seed holds exactly one
                  `preparing: true` record (`WR-008`, `ward-movements.ts:1242`) and its note happens to
                  say "Being cleaned". A single maintenance record, or any runtime `SET_BED_PREPARATION`
                  with no note, made the sentence false with every gate still green.

                  ✅ **THE WORD IS "PENDING", AND IT IS THE OWNER'S — ASKED AND ANSWERED 2026-09-07.**
                  This block previously argued for "made ready" OVER "Pending" and recorded that choice
                  here instead of putting it to him. **The error was recording it, not the word.** A
                  wording the owner did not choose, selected over the word he DID use, on the heading an
                  earlier ruling was about, is a question — an adversarial review said so and was right.
                  Asked; he answered "use Pending"; every rendered site now says it.

                  **It settles the 2026-09-04 collision concern outright rather than working around
                  it.** That ruling fixed "Ready" as the one word for `min(allocatable, empty)` and
                  warned this near-opposite figure off anything close to it. "Pending" is not close to
                  it — which "made ready" always slightly was.

                  ⚠️ **Directional, and it understates the work:** a bed awaiting maintenance read as a
                  bed awaiting a clean is a shorter, more routine job, so a coordinator plans around it
                  returning sooner than it will. That is why all three states are still named in the
                  body beneath the one-word heading.

                  ⚠️ **NOT closed by this:** the word is now consistent across these four statistics
                  screens and the wider tree is not — `flow-diagram`, `bed-map`, `ed-screen` and
                  `hub-screen` say "still being made ready"; `ward-standing-strip` says "pending".
                  Other sessions' files. Recorded rather than swept.
                */}
                    <h3 className={styles.figureHeading}>Beds pending</h3>

                    <p className={styles.measuredCount} data-testid="ward-statistics-preparing-count">
                      <span className={styles.measuredValue}>{preparingCount}</span>{" "}
                      {preparingCount === 1 ? "bed is" : "beds are"} currently marked as Pending — cleaning, maintenance
                      or repair, or with no reason stated.
                    </p>
                    {/*
                     * ⚠️ THE WORD "EXPECTED" WAS HERE UNTIL 2026-09-01 AND IT INVERTED A CAPACITY FACT.
                     * `expected` is a member of `BED_RELEASE_STATES` meaning the discharge has not happened
                     * yet, so "N expected beds are being made ready" told a coordinator the bed was NOT yet
                     * available when it already is — preparation only ever begins after `RELEASE_BED`. The
                     * count was right and the word was wrong, which is the same defect class as a wrong
                     * number and harder to catch: a wrong count invites a second look and confident prose
                     * does not. The wording now matches `ward-screen.tsx`'s own.
                     */}
                    {/*
                     * ⚠️ "THESE BEDS ARE ALREADY FREE" WAS STATED FLAT HERE UNTIL 2026-09-01, AND IT IS
                     * NOT A GUARANTEE THE MODEL MAKES. `SET_BED_PREPARATION` checks the acting ward and
                     * the chosen note and never the release's stage, so nothing in the reducer stops a
                     * caller flagging a discharge that has not happened yet. Today the claim holds because
                     * of who calls it, not because of what the reducer allows — which is the same capacity
                     * inversion as the "expected bed" defect above, arriving from the other direction.
                     */}
                    <p className={styles.figureNote}>
                      Nought means no bed is marked Pending. This count reads the flag as recorded; the model does not
                      enforce that the occupant has already left.
                    </p>

                    {/*
                     * EMPTY STATE 1, and it says why mechanically rather than saying "not yet collected".
                     *
                     * ⚠️ THIS SAID "NOTHING MARKS THE MOMENT PREPARATION STARTED" UNTIL 2026-09-01 AND THAT
                     * WAS FALSE. `SET_BED_PREPARATION` writes `confirmedAt: event.now` on the same object it
                     * writes `preparing` to, so an instant IS stamped. The refusal survives on a stronger
                     * reason: `confirmedAt` is ONE shared provenance field, and `CONFIRM_BED_RELEASE`,
                     * `BLOCK_BED_RELEASE`, `CLEAR_BED_RELEASE_BLOCK`, `RELEASE_BED` and the preparation
                     * event itself all overwrite it — so the start is destroyed by the act that ends it,
                     * and a start and an end can never both exist on the record at once.
                     *
                     * ⚠️ FIELD NAMES CAME OFF THIS PARAGRAPH ON 2026-09-06, ON THE OWNER'S RULING, AND THEY
                     * LIVE HERE SO THE CLAIM STAYS CHECKABLE BY THE READER WHO NEEDS THEM:
                     *
                     *     the yes/no readiness flag        BedRelease.preparing
                     *     the ONE shared provenance field   BedRelease.confirmedAt
                     *
                     * A coordinator needs to know WHICH RECORD cannot answer and why; a developer needs the
                     * identifier. Those are different readers, and the screen was serving only the second.
                     */}
                    <p className={styles.absence} data-testid="ward-statistics-readiness-timing-absent">
                      <strong>Pending duration is unavailable.</strong> Bed readiness has a yes/no flag and one shared
                      timestamp that later release actions overwrite, so no start-and-end pair can be measured.
                    </p>
                  </article>

                  {/*
                   * ⚠️ THE OWNER CALLED THIS THE MOST POLITICALLY SENSITIVE FIGURE IN THE SET, AND IT IS
                   * THE ONE THIS PAGE MUST NOT APPROXIMATE.
                   *
                   * There is no `offered` field anywhere in the model — no instant, no boolean, nothing
                   * recording that a ward offered a bed or withheld one. The nearest signal is a DERIVED
                   * ward-side readiness gap computed by `unitCapacity` (`ward-derivations.ts`) out of two
                   * aggregate counts, `Unit.empty` and `Unit.allocatable`. It is a fact about a ward's own
                   * readiness across all its beds; it names no bed and no request, and it cannot, because
                   * neither appears in the arithmetic.
                   *
                   * ⚠️ **THE DERIVED FIGURE IS NOT RENDERED BESIDE THIS EXPLANATION, AND THE ARITHMETIC IS
                   * NOT SHOWN HERE EITHER.** A number sitting under this heading is read as this heading's
                   * figure however the paragraph beneath it is worded — that is the proxy-with-a-disclaimer
                   * shape, and it is exactly what would be quoted outside the room it was computed in. The
                   * formula has the same problem one step removed: a reader carries it away with the wrong
                   * name attached to it. Its audience is the owner deciding whether to add a field, not a
                   * clinician skimming a page whose whole context asserts "these are the numbers", so it
                   * travels in the task report under its own name instead of on this page.
                   */}
                  <article className={styles.figure} data-testid="ward-statistics-not-offered">
                    <h3 className={styles.figureHeading}>Empty beds that were not offered</h3>

                    <p className={styles.absence} data-testid="ward-statistics-not-offered-absent">
                      <strong>No offer measure is available.</strong> The record holds aggregate empty and allocatable
                      counts, with no bed-level or request-level offer event. No readiness-gap proxy is shown.
                    </p>
                  </article>
                </div>
              </details>
            </div>
          </WardPanel>
          <WardPanel title="Flow over time" testId="ward-statistics-patients">
            <div className={pageStyles.landingBody}>
              {/* Daily history is not recorded (Josh, 25 Sept 2026): until 25 Sept this section drew a
                  14-day admissions and discharges chart from a typed series, with only today real. */}
              <div
                className={pageStyles.summarySection}
                aria-label="Statewide Patient Flow Over Time"
                data-testid="ward-statistics-flow-history"
              >
                <div className={pageStyles.summaryHeader}>
                  <h3>Statewide Patient Flow Over Time</h3>
                  <span className={pageStyles.count}>Not recorded</span>
                </div>
                <div className={pageStyles.summaryIntro}>
                  <p>
                    Daily admissions and discharges before today are not recorded in Ward Flow, so no trend is shown.
                    Today so far: {admissionsCount} admissions and {dischargesCount} discharges.
                  </p>
                </div>
              </div>

              <section className={pageStyles.rangeSummary} aria-labelledby="ward-statistics-range-title">
                <p className={pageStyles.rangeEyebrow}>Recorded pull-to-arrival range</p>
                <h3 id="ward-statistics-range-title">Time from a bed being given away to arrival</h3>
                {arrivals.averageMinutes === null ? (
                  <div className={pageStyles.rangeUnavailable}>
                    <strong>Not available</strong>
                    <span>No usable pair of pull and arrival instants is recorded.</span>
                  </div>
                ) : (
                  <dl className={pageStyles.rangeGraphic} aria-label="Recorded pull-to-arrival range">
                    <div>
                      <dt>Shortest</dt>
                      <dd>{arrivals.shortestMinutes === null ? "—" : splitDuration(arrivals.shortestMinutes)}</dd>
                    </div>
                    <div className={pageStyles.rangeAverage}>
                      <dt>Average</dt>
                      <dd>{splitDuration(arrivals.averageMinutes)}</dd>
                    </div>
                    <div>
                      <dt>Longest</dt>
                      <dd>{arrivals.longestMinutes === null ? "—" : splitDuration(arrivals.longestMinutes)}</dd>
                    </div>
                  </dl>
                )}
                {arrivals.measuredCount > 1 &&
                arrivals.shortestMinutes !== null &&
                arrivals.longestMinutes !== null &&
                arrivals.shortestMinutes === arrivals.longestMinutes ? (
                  <p className={pageStyles.noSpread}>No recorded spread: every usable gap has the same duration.</p>
                ) : null}
                <ul className={pageStyles.rangeFacts} aria-label="Range population and exclusions">
                  <li>{arrivals.measuredCount} usable admission records</li>
                  <li>{arrivals.endedCount} measured admissions have ended</li>
                  <li>{arrivals.awaitingArrivalCount} arrival gaps are still running</li>
                  <li>{arrivals.incoherentCount} impossible chronology records excluded</li>
                </ul>
              </section>
              <details className={`${pageStyles.measurementDetails} ${pageStyles.flowDetails} source-print`}>
                <summary>How this range is measured and what it excludes</summary>
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
                      /*
                       * NOT an empty state of the "cannot be measured" kind, and worded so it can never be
                       * read as one. The measurement is possible; this population simply has nothing in it
                       * yet. An average of nothing is absent, never nought — a mean of 0m would say every
                       * person arrived the instant their bed was given away.
                       */
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
                          {arrivals.measuredCount === 1 ? "admission" : "admissions"} whose two instants are both
                          present and in the right order.
                        </p>

                        {/*
                         * The range sits beside the average deliberately. These are synthetic instants and
                         * a seeded population can carry the same gap for everybody — in which case the
                         * shortest and the longest are the average, and a reader can see for themselves
                         * that there is no spread. An average shown alone would look measured.
                         */}
                        {/* Each end carries its OWN testid rather than sitting inside one sentence: an
                        adversarial check swapped shortest and longest and nothing failed, because the
                        assertion looked for both strings anywhere in the paragraph. The seeded world
                        has no spread, so the swap would not show in the app either. */}
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

                        {/*
                         * ⚠️ **THE CAUSE, ON THE PAGE — because until 2026-09-01 it lived only in the
                         * comment above and no reader of the page could reach it.** The paragraph above
                         * explains the DISPLAY CHOICE ("the range is shown on purpose") and stops there,
                         * which showed the reader the symptom and withheld the reason for it. Every other
                         * gap on this page names its cause and says whose change would fix it; this was
                         * the only figure that did not, and it is the figure most likely to be quoted,
                         * because it is the only one that renders a confident-looking headline number.
                         *
                         * ⚠️ **CONDITIONAL ON THE TWO ENDS BEING EQUAL, and that is the whole point.** An
                         * unconditional sentence would pass every test in the world this fixture happens
                         * to be in today and would become a lie the moment somebody gives the instants
                         * real variety — sitting there being false with nothing to catch it. Written this
                         * way it disappears on its own, which is the same self-invalidating property the
                         * referral-to-bed paragraph already has.
                         *
                         * The null checks are not decoration: this branch cannot reach here with a null
                         * end (a non-null average implies at least one measured gap), but `null === null`
                         * is true, so an equality test alone would render this against an empty
                         * population if the guard above ever changed shape.
                         *
                         * ⚠️ **`measuredCount > 1` IS PART OF THE CONDITION, NOT AN OPTIMISATION.** With
                         * exactly one measured admission the two ends meet TRIVIALLY — one gap is its own
                         * shortest and its own longest — and there is no constancy to report at all. The
                         * paragraph below talks about every measured gap agreeing with every other; said
                         * over a population of one that is not a hedge that reads oddly, it is a claim
                         * about agreement where there is nothing to agree with. The seeded world cannot
                         * reach this (it carries hundreds), but this screen is generic and its callers
                         * are not, so the case is real.
                         *
                         * ⚠️ **AND THE COPY CLAIMS ONLY WHAT THE CONDITION ENTAILS.** An earlier draft
                         * stated as settled fact that the fixture derives one instant from the other by a
                         * fixed offset. That is true of today's seed — and the page cannot know it. All
                         * this branch observes is that the ends coincide; independently generated gaps
                         * that happened to agree would satisfy it identically. Asserting the mechanism
                         * from the symptom would have been the very defect this paragraph exists to close,
                         * moved out of a number and into a cause. So the offset is offered below as the
                         * explanation the shape points at, explicitly not as a finding — while still
                         * saying plainly that the figure must not be read as a measurement of a service.
                         */}
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

                    {/*
                     * The excluded-and-counted half of the chronology guard, and it must be VISIBLE or the
                     * exclusion is as invisible as the clamp it replaces. Ward Lead's ruling, 2026-09-01:
                     * a clamp "does not make a bad number safe, it makes it invisible". Rendering the count
                     * rather than silently dropping the record is what keeps that true on the page.
                     */}
                    <p className={styles.measuredCount} data-testid="ward-statistics-arrival-incoherent">
                      <span className={styles.measuredValue}>{arrivals.incoherentCount}</span>{" "}
                      {arrivals.incoherentCount === 1 ? "admission has" : "admissions have"} arrival before bed pull and
                      {arrivals.incoherentCount === 1 ? " is" : " are"} excluded, never treated as zero.
                    </p>
                  </article>
                </div>
              </details>
            </div>
          </WardPanel>
          <WardPanel title="Where the pressure is" testId="ward-statistics-pressure">
            <div className={`${styles.panelBody} ${pageStyles.landingBody}`}>
              {/*
               * ⚠️ THE HEADING SAYS "SO FAR" AND EVERY OTHER SPELLING OF THIS FIGURE MUST SAY IT TOO —
               * the blurb, the notes, the testid, this comment.
               *
               * The test that settles the name is mechanical rather than a matter of taste: **if the
               * missing exhaustion marker were added tomorrow, would this number change?** It would —
               * it would become a strict subset. A figure whose value moves when the model gains the
               * concept its name implies is not measuring the thing its name says. And the misleading
               * reading is the ORDINARY case here, not the rare one: nothing closes a movement, a
               * fresh referral can follow a decline immediately, and `PARALLEL_REFERRAL_CAP` is small.
               *
               * ⚠️ **A CAVEAT UNDER A WRONG NAME IS THE SHAPE THIS PAGE REJECTED FOR THE FIGURE
               * ABOVE.** "So far" costs a reader nothing and keeps everything, so the qualifier is in
               * the name rather than in a note under it; the note explains WHY the qualifier is there,
               * which is what makes a reader carry it with them when they repeat the number.
               *
               * ⚠️ **THE NOTE BELOW CLAIMED A DISTRIBUTION NOTHING MEASURES, UNTIL 2026-09-01.** It said "MOST of
               * what is counted here has been put to that many out of the whole network". The counted population is
               * whatever `handoverSnapshot` classifies as declined-by-all — at least one decline and nothing
               * pending — which a movement carrying a SINGLE decline satisfies. Nothing in that derivation, and
               * nothing on this page, records how many wards a counted movement was put to, so "most" was an
               * assertion about a distribution no line of source can witness. The cap bounds the figure from above
               * and says nothing whatever about the mode, so the note now says "at most", which is what the cap
               * earns. `statistics-derivations.ts` carried the same soft claim in its own words and was corrected
               * with it.
               */}
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

                <details className={`${pageStyles.measurementDetails} source-print`}>
                  <summary>Method and limits</summary>
                  <div className={styles.panelBody}>
                    <p className={styles.figureNote} data-testid="ward-statistics-refused-so-far-why-so-far">
                      <strong>&ldquo;So far&rdquo; is the limit of the record.</strong> There is no exhausted-network
                      marker. At most{" "}
                      <span data-testid="ward-statistics-refused-so-far-cap">{configuration.parallelReferralCap}</span>{" "}
                      wards can be deciding together, but the lifetime number asked is not recorded. This is a current
                      worklist, not a count of people no ward would take.
                    </p>
                  </div>
                </details>

                <p className={styles.measuredCount} data-testid="ward-statistics-refused-so-far-escalated">
                  <span className={styles.measuredValue}>{refused.escalatedCount}</span> open{" "}
                  {refused.escalatedCount === 1 ? "movement carries" : "movements carry"} a recorded escalation instead.
                  Escalations are classified first, so this is a floor. An escalation records an opinion, not a derived
                  finding that the network was exhausted.
                </p>
              </article>

              {/*
               * ⚠️ THIS COUNTS `Admission.blockReason`, NOT `Movement.blocker` — a deferral commit named
               * the wrong field, and this figure exists because that was corrected rather than repeated.
               * `Movement.blocker` is free prose about a referral struggling to find a placement;
               * `blockReason` is a closed enum about a bed that will not yet let its occupant go, and the
               * two are unrelated facts that happen to share a nearby name. See
               * `statistics-derivations.ts` for the full argument, including why `BedRelease.blocker` — a
               * second field carrying the same vocabulary — is deliberately not merged in here: it has no
               * `admissionId` to join back to a specific admission without risking a double count.
               *
               * ⚠️ THE ROWS ARE GENERATED FROM `BED_RELEASE_BLOCKERS` AND NOT ONE WORD OF THAT LIST IS
               * TYPED HERE, for the same reason declines-by-reason above does not type out its own list.
               *
               * ⚠️ SCOPED TO ADMISSIONS STILL ON THE WARD. A departed admission is no longer being held
               * from leaving whatever `blockReason` still says — the same scoping `wardStatistics`
               * applies to `readyToLeaveCannot`, reused here rather than re-argued.
               */}
              <article className={styles.figure} data-testid="ward-statistics-blocked-discharges-by-reason">
                <h3 className={styles.figureHeading}>Blocked discharges by blocker</h3>
                {/*
                 * ⚠️ **BLOCKER, NOT REASON, AND THE HEADING WAS ALREADY RIGHT.** This blurb opened
                 * "counted against the REASON recorded for it" while its own next sentence, and the
                 * heading above it, both said blocker — two nouns for one thing, three lines apart.
                 *
                 * The model settles it and there is no judgement in it: these values come from
                 * `BED_RELEASE_BLOCKERS`, and the sibling figure's come from `DECLINE_REASONS`. So
                 * "Declines by reason" and "Blocked discharges by blocker" are each already using
                 * their own vocabulary's noun, and the odd word out was here. Corrected 2026-09-06
                 * toward the model rather than toward the neighbouring heading, which is what makes
                 * the two headings differ on purpose instead of by accident.
                 */}
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

                {/*
                 * ⚠️ A NOUGHT IS RENDERED, AND THAT IS NOT A BREACH OF "NULL IS NEVER ZERO" — the same
                 * exemption declines-by-reason documents above: this is a genuine count, and count-based
                 * figures render `0` as a true answer rather than an absence.
                 */}
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
          <WardPanel title="Emergency departments" testId="ward-statistics-emergency-departments">
            <div className={`${styles.panelBody} ${pageStyles.landingBody}`}>
              {/*
               * ⚠️ THE STATISTIC THE OWNER NAMED FIRST, AND THE REASON IT IS NOT HERE — ON THE PAGE,
               * because a reader of the page will never open this file.
               *
               * Until 2026-09-01 the argument lived only in this component's doc comment and there was
               * simply NOTHING on screen where the figure should be. That silence is the one asymmetry
               * a reader cannot detect: `Movement.declines` IS seeded non-empty, so a coordinator who
               * knows this prototype records declines and sees no decline figure cannot tell
               * "withheld pending a ruling" from "not recorded" from "nobody declined". This page's
               * whole safety property is that an absence explains itself; it did that twice and skipped
               * it on the item that mattered most.
               *
               * Saying so invents no number, which is why it is safe to say and unsafe to omit.
               */}
              <article className={styles.figure} data-testid="ward-statistics-declines">
                <h3 className={styles.figureHeading}>Declines per ward</h3>

                <p className={styles.absence} data-testid="ward-statistics-declines-withheld">
                  <strong>No ward-attributable decline measure.</strong> Referral and movement declines describe
                  different populations, so no per-ward number is shown.
                </p>
                <details className={`${pageStyles.measurementDetails} source-print`}>
                  <summary>Why no number is shown</summary>
                  <div className={styles.panelBody}>
                    <p className={styles.figureNote}>
                      A referral names a ward only when that ward accepts; referral declines do not name a ward.
                      Movement declines name a ward for people already inside an emergency department. Choosing either
                      source would define a different measure.
                    </p>
                  </div>
                </details>
              </article>

              {/*
               * ⚠️ THE ROWS ARE GENERATED FROM THE MODEL'S OWN REASON LIST AND NOT ONE WORD OF THAT
               * LIST IS TYPED HERE — not as a label map, not in the prose, not in a test literal.
               *
               * A hand-written table checked by a hand-written test proves only that one author was
               * consistent with themselves, and this project has already been bitten tonight: a brief
               * written against a pre-merge tree named a member that a rename had since replaced, and
               * a table copied from it would have been wrong with everything green. There is also no
               * label map here on purpose. `DECLINE_REASON_LABELS` (`ward-referrals.ts`) is keyed by
               * `REFERRAL_DECLINE_REASONS`, a DIFFERENT and shorter list about a different act, so
               * using it here would label a value from one vocabulary out of the other's map; and a
               * new map written here would be a second copy of the vocabulary, free to drift. The
               * member is displayed as the model spells it, exactly as the ward screen's own decline
               * picker does.
               *
               * ⚠️ **THIS COUNTS MOVEMENT DECLINES AND NOTHING ELSE.** No figure on this page is a
               * distribution over `REFERRAL_DECLINE_REASONS`: which of those a referral can even be
               * given depends on which screen is doing the declining, so its shape would be a fact
               * about the software rather than about the service, and a reader would take members that
               * one surface cannot offer for members that never happen.
               */}
              <article className={styles.figure} data-testid="ward-statistics-declines-by-reason">
                <h3 className={styles.figureHeading}>Declines by reason</h3>
                <p className={styles.figureBlurb}>
                  Movement declines grouped by the ward&apos;s recorded reason. Front-door referral declines are
                  excluded.
                </p>

                {!declinesReadout.ok ? (
                  /*
                   * ⚠️ **THE HUB, WHERE THIS MATTERS MOST OF THE THREE.** This page renders arrivals,
                   * the referral-to-bed join, beds being prepared, refusals with nothing pending and
                   * blocked discharges — every one of them independent of the decline vocabulary.
                   * Throwing here would take all of them away because one field in one movement is
                   * outside a fixed list. The paragraphs after this branch explain the figure and stay
                   * true either way, so they sit outside it.
                   */
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

                    {/*
                     * ⚠️ **A NOUGHT IS RENDERED, AND THAT IS NOT A BREACH OF "NULL IS NEVER ZERO".** That
                     * rule is about an AVERAGE: a ward with no discharges has no average length of stay,
                     * and a nought there would assert every discharge was instantaneous.
                     * `ward-statistics.ts` documents the exemption in its own words — count-based figures
                     * are genuine counts, so nought is a true and correct answer when there is no data.
                     * A decline count is a genuine count.
                     *
                     * ⚠️ **AND THE RULE IS "EVERY MEMBER OF A SMALL CLOSED VOCABULARY", NOT "EVERY EMPTY
                     * CATEGORY".** Seven rows a reader can count is a table. Seventy rows of which
                     * sixty-three are nought is a page nobody reads, and burying the seven that happened
                     * is its own way of hiding them. A longer vocabulary needs a different answer, decided
                     * then — not inherited from here.
                     */}
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
          </WardPanel>
          <div id={STATISTICS_COMMUNITY_CHOOSER_ID} className={pageStyles.communityRegion}>
            <WardPanel title="Community teams" testId="ward-statistics-community-chooser">
              <div className={`${styles.panelBody} ${pageStyles.landingBody}`}>
                <p className={styles.absence} data-testid="ward-statistics-community-landing-absence">
                  No network-wide community total. Each team&apos;s current caseload is measured on its own page.
                </p>
                <h3 className={styles.figureHeading}>Choose a community team</h3>
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
            </WardPanel>
          </div>
          <WardPanel title="Referrals for a bed" testId="ward-statistics-referrals-for-bed">
            <div className={`${styles.panelBody} ${pageStyles.landingBody}`}>
              <article className={styles.figure} data-testid="ward-statistics-referral-to-bed">
                <h3 className={styles.figureHeading}>From a referral being raised to a bed being taken</h3>

                {/*
                 * EMPTY STATE 2, and the one paragraph on this page that has been rewritten twice for
                 * the same underlying mistake: it kept explaining the refusal by describing the FIXTURE.
                 *
                 * ⚠️ **A SENTENCE ABOUT WHAT THE SEED CONTAINS IS A PIN THAT FALSIFIES ITSELF SILENTLY.**
                 * This paragraph asserted, at various points, that the matching records were not the
                 * same person, that their ids collided by accident, that the front door had been
                 * numbered separately, and that arrivals preceded referrals by weeks. Every one was
                 * checked against the fixture, was wrong or became wrong, and left the refusal — which
                 * was correct throughout — standing on a false account of the data. Nothing went red
                 * for any of them, because a fixture is not a contract and no test watches prose.
                 *
                 * ⚠️ **SO THIS PARAGRAPH NOW DESCRIBES WHAT THE DERIVATION CAN AND CANNOT ESTABLISH,
                 * AND NOTHING ELSE.** No count, no id shape, no provenance, no magnitude, no date. That
                 * sentence is true whether the join finds many pairs or none, and it stays true across
                 * the next fixture change. Quantities belong to the elements below, which recompute on
                 * every render — rendered, never written.
                 *
                 * ⚠️ FIELD NAMES CAME OFF THIS PARAGRAPH ON 2026-09-06, ON THE OWNER'S RULING, AND THEY
                 * LIVE HERE SO THE CLAIM STAYS CHECKABLE BY THE READER WHO NEEDS THEM:
                 *
                 *     the admission's pointer at its referral   Admission.referralId
                 *
                 * The claim above turns on that pointer being nullable and on a match being exact, and
                 * both are properties of the field rather than of the fixture — which is the whole point
                 * of the paragraph. `statistics-claims-register.ts` pins them to `ward-model.ts`.
                 *
                 * 🔴 **AND THAT SCOPE NOTE WAS TRUE OF THE COMMENT AND FALSE OF THE SENTENCE, UNTIL
                 *
                 * 🔴 CORRECTED 2026-09-11, AND THIS COMMENT HAS NOW DECAYED A THIRD TIME - which is exactly
                 * what its own first two corrections warned about, so it is annotated in the pattern this file
                 * already uses rather than rewritten.
                 *
                 *     what the block below states          what is true at 2026-09-11
                 *     0 of 267 carry a null referralId     257 of 267 ARE null, and that is the INTENDED state
                 *     257 of 267 ids match no referral     10 non-null ids, ALL resolving, ZERO dangling
                 *
                 * ⚠️ Both dated measurements are INVERTED, not merely out of date. Repaired at a6e5208b85.
                 * ✅ THE GOVERNING RULE ABOVE IS UNAFFECTED, AND IS WHY THE RENDERED TEXT DID NOT DECAY WITH
                 * THE COMMENT: the rendered paragraph states only what the derivation can and cannot establish -
                 * no count, no id shape, no provenance, no magnitude, no date.
                 * 🔴 The comment stated counts and has gone wrong three times. The sentence stated none and
                 * has not gone wrong once. That contrast is the whole lesson of this file.
                 * 2026-09-06.** The paragraph read "nothing at all is an ordinary state HERE" — a claim
                 * about this data, not about the type — and the measurement is that **NO admission is
                 * in that state: 0 of 267 carry a null `referralId`.** The seed writes
                 * `RF-${suffix}` for every generated admission, so the branch has no producer at all.
                 * A reader on the page cannot see this comment; they see "ordinary", and 267 of 267 is
                 * not ordinary, it is universal. The sentence now says what the register evidences —
                 * that the POINTER is nullable — and claims nothing about how often.
                 *
                 * ⚠️ **THE PROJECT ALREADY HAD THIS RULE AND IT WAS NOT APPLIED TO THIS FIELD.**
                 * `tests/ward-admissions-seed.test.ts` requires `tentativeDiagnosis` to be null on some
                 * seeded people and not all, in terms: a fixture where everybody carried a value would
                 * leave "the branch a reader is most likely to see wrong" with no seeded case. Three
                 * hundred lines away, on the sibling field, `referralId` has no such guard.
                 *
                 * ⚠️ **A SECOND MEASURED FACT THIS PAGE DOES NOT STATE, reported rather than fixed:
                 * 257 of the 267 ids match no referral on record** — they are shaped `RF-RPHS-01`,
                 * a different family from the seeded `RF-001`…`RF-010`. The figures below are all
                 * true and a reader can compute it, but nothing says the join essentially fails.
                 * Whether the seed should carry real nulls and matching ids is a fixture decision.
                 */}
                <p className={styles.absence} data-testid="ward-statistics-referral-join-absent">
                  <strong>No referral-to-bed duration is published.</strong> An exact referral link does not establish
                  that the referral started the wait that ended with this admission. The counts below report coherent
                  linked records without turning them into a duration.
                </p>

                <p className={styles.measuredCount} data-testid="ward-statistics-join-count">
                  {/* Its own testid so a test can assert EQUALITY rather than `toContain` on the whole
                    sentence. An adversarial check found the old containment assertion passed by luck:
                    the substituted value was `267`, which happens to contain no "0" — `260`, `100` or
                    `30` would all have slipped through. */}
                  <span className={styles.measuredValue} data-testid="ward-statistics-join-coherent-count">
                    {join.chronologicallyCoherentCount}
                  </span>{" "}
                  of <span data-testid="ward-statistics-join-matched-count">{join.joinedCount}</span> matched{" "}
                  {join.joinedCount === 1 ? "pair" : "pairs"} could carry a duration at all — that is, the person
                  arrived no earlier than the referral was raised.
                </p>
                <p className={styles.measuredCount} data-testid="ward-statistics-join-population">
                  Matched from <span data-testid="ward-statistics-join-with-id-count">{join.withReferralIdCount}</span>{" "}
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
        </div>

        {/* ── Audience 2 ─────────────────────────────────────────────────────────────────── */}

        {/*
         * ── Choose a health service ─────────────────────────────────────────────────────────
         *
         * The fourth hub entry (`STATISTICS_SECTIONS`, id "service") points here rather than at a
         * page of its own, for the same reason the third entry points at a chooser on the
         * comparisons page: `HEALTH_SERVICES` is five members and the per-service detail route is
         * dynamic, so a route serving every service needs a way in that names all five, and this is
         * the page whose own audience already spans every service in the network.
         *
         * ⚠️ **THE ANCHOR SITS ON THIS PAGE, NOT A SUB-ROUTE.** The ward/ED chooser lives on the
         * comparisons page because that page's whole subject is the set of units; a health service
         * is not a unit, so it is not filed there. `STATISTICS_SERVICE_CHOOSER_HREF` is a fragment
         * on `STATISTICS_HOME_HREF` itself for that reason, which is also why it is the one section
         * href in this list that does not sit under a sub-path of the hub.
         */}
        <div id={STATISTICS_SERVICE_CHOOSER_ID}>
          <WardPanel title="Choose a health service" testId="ward-statistics-service-chooser">
            <div className={styles.panelBody}>
              <p className={styles.figureNote} data-testid="ward-statistics-service-chooser-rationale">
                Select a health service for its capacity, referral flow and distance measures. All services are listed
                in recorded order, without ranking.
              </p>
              <ul className={styles.indexList} data-testid="ward-statistics-service-list">
                {wardServiceOrder.map((service) => (
                  <li key={service} className={styles.indexItem}>
                    <Link
                      href={serviceStatisticsHref(service)}
                      className={styles.indexLink}
                      data-testid={`ward-statistics-service-link-${service}`}
                    >
                      <span className={styles.indexLabel}>{service}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </WardPanel>
        </div>

        {/*
          The fifth chooser. Community teams get one for the same reason health services do — one
          route serves every team, so the way in is a choice rather than an index.

          ⚠️ **THIS LINKS AT THE STATISTICS PAGE, NOT AT THE OPERATIONAL TEAM PAGE.** Both exist and
          they answer different questions: `/community/[teamId]` is the team's own working screen
          with the people on it, and the statistics page carries the counts and the cross-team
          comparison. The statistics page links onward to the operational one, so a reader who
          wanted names is one click away rather than in the wrong place.
        */}

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
