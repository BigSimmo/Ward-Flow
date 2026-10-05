"use client";

import { StatisticsInsightChart } from "./statistics-insight-chart";
import { StatisticsDetailPanel } from "./statistics-detail-panel";
import family from "./statistics-family.module.css";

import Link from "next/link";

import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { generateDemonstrationSeries } from "@/components/ward-management/statistics/statistics-demonstration";
import { DemonstrationChart } from "@/components/ward-management/statistics/statistics-demonstration-chart";
import {
  admissionStagePosition,
  refusedAndNothingPending,
  type AdmissionStagePosition,
} from "@/components/ward-management/statistics/statistics-derivations";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import { statisticsSectionById } from "@/components/ward-management/statistics/statistics-sections";
import { serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { BED_STATE_DETAILS, BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { StatewideAllocationHeadroom } from "./statewide-allocation-headroom";
import { HospitalCapacityMatrix } from "./hospital-capacity-matrix";

import styles from "./statistics-third-edition.module.css";

/**
 * ACROSS ALL SERVICES — the whole-of-prototype and Western Australia section.
 *
 * 🔴 **THIS PAGE WAS A DELIBERATE SKELETON UNTIL 2026-09-06, AND THE SENTENCE THAT SAID SO IS GONE
 * RATHER THAN REWRITTEN.** It read, in its own words, *"No whole-of-prototype figure has been
 * derived, so this page shows none — not a nought, and not a dash standing where a number will
 * go."* That was true the day it was written and false the moment this page gained real figures —
 * the same shape the retired reachability sentence below already took once on this exact file. It
 * is described here rather than quoted back word for word, so the retired wording exists nowhere
 * in the tree and no scan can mistake this record for a relapse.
 *
 * **The note is not simply deleted; its job moved to a test.** `tests/ward-statistics-overview-
 * parked.dom.test.tsx` used to be the tripwire that kept that sentence honest — it went red the
 * day a figure and the "no figure" claim disagreed. Its subject changed with this page: it now
 * proves every numeral rendered here is either recomputed independently from the same state this
 * screen reads, or sits inside the demonstration wrapper that is the one deliberate, labelled
 * exception (Task 1, `statistics-demonstration.ts`). A test whose subject changed is re-pointed,
 * not retired — deleting it with the sentence would have taken the guard with the wording.
 *
 * ⚠️ **EVERY FIGURE BELOW IS A GENUINE COUNT, NEVER AN AVERAGE.** `admissionStagePosition`,
 * `declinesByReason`, `bedsBeingPrepared`, `refusedAndNothingPending` and `unitCapacity`
 * (`statistics-derivations.ts` / `ward-derivations.ts`) all return counts, and a count of nought is
 * a true, measured answer on this page — never a placeholder for an absence. None of the five
 * derivations this page reads has a nullable-average shape, so there is structurally nowhere on
 * this page for a dash to stand in for a number nobody measured. Anything that genuinely cannot be
 * measured — an offer to a named patient, a duration between two instants the model does not keep
 * — is said in words instead, the same discipline the statistics home page already documents.
 *
 * ⚠️ **THE SECTION READS ITS OWN NAME AND DESCRIPTION FROM `statistics-sections.ts`**, the same
 * module the hub index reads. A heading typed in here would be a second copy of a fact that already
 * exists, and the day somebody renames the section on the hub this page would go on advertising the
 * old name with nothing failing.
 *
 * ⚠️ **ONLY ONE THING HERE IS INVENTED, AND IT IS LABELLED EVERYWHERE IT APPEARS.** The reducer
 * keeps only the current picture — no history of any past day survives a render — so the one trend
 * on this page is demonstration data from `generateDemonstrationSeries`, rendered exclusively
 * through `<DemonstrationChart>`. Nothing else on this page may read a `DemonstrationSeries`, and a
 * source scan holds that boundary rather than a convention (see that module's own header).
 */
export function StatisticsOverviewScreen() {
  usePrintableDisclosures();
  // `statisticsSectionById` returns `undefined` for an unknown id, so this cannot silently resolve
  // to a different section. The non-null assertion is avoided in favour of a thrown error: this id
  // is a literal in this file and in `statistics-sections.ts`, so a miss means the two have been
  // edited apart, and failing loudly at render is the only way that shows up at all.
  const section = statisticsSectionById("overview");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'overview' section");

  const { admissions, movements, bedReleases, leaveBeds, units, scenario } = useWardFlow();
  const now = useWardFlowClock();
  const service = useServiceScope();

  const stageTallies = admissionStageTallies(admissions);
  /*
   * ⚠️ **REPORTED IN PLACE, NOT THROWN.** `declinesByReason` throws when a movement carries a
   * decline reason outside `DECLINE_REASONS`, and that throw is right — a categorical breakdown
   * must not quietly shrink its own total. But this screen calls it during render, so on this page
   * the throw costs the reader the stage distribution, the capacity figures and the prose about
   * what this prototype cannot support, none of which depend on the decline vocabulary at all.
   * **One malformed field would blank a page whose other nine tenths are still true.**
   *
   * Ward Lead's ruling, 2026-09-07, applied identically at all three call sites. Bounded to this
   * class — a malformed value in a categorical breakdown that the rest of the screen is independent
   * of. See `statistics-decline-reporting.ts` for why it catches only this error and rethrows
   * everything else.
   */
  const declinesReadout = readDeclinesByReason(movements);
  /*
   * 🔴 **OWNER RULING, 2026-09-07: this figure counts beds the patient has already LEFT, not every
   * bed carrying the flag.** He was asked directly which of the two populations a screen should
   * name and chose the narrower one, because a bed with somebody still in it is not a bed anyone
   * can plan around tonight.
   *
   * ⚠️ **`bedsBeingPrepared` is NOT narrowed to match, and that is deliberate.** Its own doc comment
   * refuses the filter, on the ground that dropping such a record from the count would hide a real
   * invariant violation rather than fix it — "the flag is the fact, and it is counted... if the
   * invariant needs enforcing, it is enforced in the reducer, not concealed in a statistic." Both
   * things are therefore true at once: the SCREEN shows the population the owner ruled for, and the
   * wider derivation stays honest. `tests/ward-pending-preparation-populations.test.ts` asserts the
   * two agree, so a divergence goes red instead of disappearing between them.
   *
   * ⚠️ **The word is "made ready", not "cleaned".** The owner corrected that on 2026-09-07: cleaning
   * is one of `BED_PREPARATION_NOTES`' two entries, the other is maintenance or repair, and a bed
   * may carry the flag with no reason stated at all.
   */
  const preparingCount = units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0);
  /*
   * 🔴 **READY IS NOT THE NUMBER A COORDINATOR CAN ACT ON.** `PULL_PATIENT` refuses — *"a patient
   * cannot be pulled to a bed that is not open"* — when every free bed at a ward is being made
   * ready. Summed PER WARD through `openBedsNow`, never subtracted from the network total, because
   * the clamp is per ward: a ward with more pending beds than free ones must not borrow headroom
   * from another.
   */
  const openNow = units.reduce((sum, unit) => sum + openBedsNow(unit, bedReleases), 0);
  const refused = refusedAndNothingPending(movements, units, now);
  const capacity = networkCapacity(units, bedReleases);

  const healthServicesData = [
    {
      id: "NMHS",
      name: "North Metro (NMHS)",
      service: "North Metro",
      color: "var(--svc-north)",
    },
    {
      id: "SMHS",
      name: "South Metro (SMHS)",
      service: "South Metro",
      color: "var(--svc-south)",
    },
    {
      id: "EMHS",
      name: "East Metro (EMHS)",
      service: "East Metro",
      color: "var(--svc-east)",
    },
    {
      id: "WACHS",
      name: "Country Health (WACHS)",
      service: "WACHS",
      color: "var(--svc-wachs)",
    },
    {
      id: "PRIV",
      name: "Private",
      service: "Private",
      color: "var(--svc-private)",
    },
  ].map((hs) => {
    const hsUnits = units.filter((u) => siteByCode(u.siteCode)?.service === hs.service);
    const sites = Array.from(new Set(hsUnits.map((u) => siteByCode(u.siteCode)?.name ?? u.siteCode)));
    let beds = 0;
    let occupied = 0;
    let ready = 0;
    let pulled = 0;
    let closed = 0;
    // The ruled boxes (`ward-bed-states.ts`), summed over the service's units: Ready · Pulled ·
    // Closed · Occupied add up to its beds.
    for (const u of hsUnits) {
      const states = bedStates(u, admissions, bedReleases, leaveBeds);
      beds += u.beds;
      occupied += states.occupied;
      ready += states.ready;
      pulled += states.pulled;
      closed += states.closed;
    }
    const occPct = beds > 0 ? Math.round((occupied / beds) * 100) : 0;
    // No occupancy target until one has a source (Josh, 26 Sept 2026, question 14: the 85% target
    // line comes off). The 92% "Critical Load" line and "High Load / Balanced" words went earlier.
    const badgeTone = "var(--accent)";
    const badgeBg = "var(--accent-soft)";
    const badgeText = `${ready} ready`;
    const strokeColor = hs.color;

    const totalArc = 157.08;
    const frac = Math.min(Math.max(occPct / 100, 0), 1);
    const dashoffset = (totalArc * (1 - frac)).toFixed(1);
    const angle = Math.PI - frac * Math.PI;
    const hx = (70 + 50 * Math.cos(angle)).toFixed(1);
    const hy = (70 - 50 * Math.sin(angle)).toFixed(1);

    return {
      ...hs,
      hospitals: sites.length > 0 ? sites.join(" · ") : "Regional units",
      beds,
      occupied,
      ready,
      pulled,
      closed,
      occPct,
      badgeTone,
      badgeBg,
      badgeText,
      strokeColor,
      totalArc,
      dashoffset,
      hx,
      hy,
    };
  });

  // Baseline anchored to today's real admission volume so the invented walk starts somewhere
  // plausible; the walk itself is still a deterministic pseudo-random draw, never a measurement —
  // see `generateDemonstrationSeries`'s own header for why that matters and why it is seeded from
  // the scenario, the clock and this series' own label rather than from anything measured.
  const admissionsPerDayBaseline = Math.max(1, Math.round(admissions.length / 30));
  const admissionsTrend = generateDemonstrationSeries(
    scenario,
    now,
    {
      label: "Admissions started per day across the network",
      whatItWouldMeasure: "daily admissions across every ward over the last 30 days",
      whyItIsNotReal: "only current state is retained; no daily admission history exists",
    },
    { baseline: admissionsPerDayBaseline, volatility: Math.max(admissionsPerDayBaseline * 0.4, 1) },
  );

  return (
    <StatisticsSectionFrame
      section={section}
      subtitle=""
      testId="ward-statistics-overview-screen"
      design="third-edition"
    >
      {/*
       * ── SERVICE SCOPE SENTENCE (item 44, §2 rule S4 / §3 "Statistics") ─────────────────────────
       * Same rule as the statistics home page: this page is never scoped, and says so rather than
       * leaving a reader who has chosen a service elsewhere in the shell to wonder whether the
       * figures below just narrowed. See `statistics-screen.tsx`'s own comment on this sentence.
       */}
      {service === null ? null : (
        <p className={styles.body} data-testid="ward-statistics-service-scope-sentence">
          {`Set to ${service}. This page is the whole network's own, so these figures already include ${service}.`}{" "}
          <Link href={serviceStatisticsHref(service)} data-testid="ward-statistics-service-scope-link">
            {`Open ${service} statistics`}
          </Link>
        </p>
      )}

      {/* ══════════ STATEWIDE ALLOCATION HEADROOM ══════════ */}
      <StatewideAllocationHeadroom
        units={units}
        admissions={admissions}
        bedReleases={bedReleases}
        leaveBeds={leaveBeds}
        capacityReady={capacity.ready}
      />

      {/* ══════════ HEALTH SERVICE CAPACITY & UTILIZATION GAUGES ══════════ */}
      <section className={styles.chartCard} aria-labelledby="gaugesH">
        <div className={styles.chartHeader}>
          <h2 id="gaugesH" className={styles.chartTitle}>
            Occupancy by health service
          </h2>
          <span className={styles.chartCount}>{healthServicesData.length} health services</span>
        </div>
        <div className={styles.gaugeGrid} id="gaugeGrid" data-testid="ward-statistics-overview-gauges">
          {healthServicesData.map((s) => (
            <Link
              key={s.id}
              href={serviceStatisticsHref(s.service)}
              className={styles.gaugeCard}
              style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}
            >
              <div className={styles.gaugeCardHeader}>
                <div className={styles.gaugeTitle} style={{ color: s.color }}>
                  {s.name}
                </div>
                <span className={styles.gaugeBadge} style={{ background: s.badgeBg, color: s.badgeTone }}>
                  {s.badgeText}
                </span>
              </div>
              <div className={styles.gaugeHospitals}>{s.hospitals}</div>
              <div className={styles.gaugeRadialWrap}>
                <svg
                  className={styles.gaugeRadialSvg}
                  viewBox="0 0 140 82"
                  role="img"
                  aria-label={`${s.name}: ${s.occPct}% occupancy`}
                >
                  <path
                    d="M 20 70 A 50 50 0 0 1 120 70"
                    fill="none"
                    stroke="var(--sunk)"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  {/* The 85% target tick came off with the target (Josh, 26 Sept 2026, question 14). */}
                  {/* A red "92% surge" tick stood here with no source behind it (26 September 2026 sweep, A5). */}
                  <path
                    d="M 20 70 A 50 50 0 0 1 120 70"
                    fill="none"
                    stroke={s.strokeColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={s.totalArc.toFixed(1)}
                    strokeDashoffset={s.dashoffset}
                  />
                  <circle cx={s.hx} cy={s.hy} r="3.5" fill="var(--surface)" stroke={s.strokeColor} strokeWidth="2" />
                </svg>
                <div className={styles.gaugeRadialText}>
                  <div className={styles.gaugeRadialPct}>{s.occPct}%</div>
                  <div className={styles.gaugeRadialBeds}>
                    {s.occupied} / {s.beds} beds
                  </div>
                </div>
              </div>
              <div className={styles.gaugeFoot}>
                <span>
                  <strong>{s.ready}</strong> Ready
                </span>
                <span title={BED_STATE_DETAILS.pulled}>
                  <strong>{s.pulled}</strong> {BED_STATE_LABELS.pulled}
                </span>
                <span title={BED_STATE_DETAILS.closed}>
                  <strong>{s.closed}</strong> {BED_STATE_LABELS.closed}
                </span>
                <span title="Empty beds: ready plus closed">
                  <strong>{s.ready + s.closed}</strong> Headroom
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════ HOSPITAL & INPATIENT UNIT CAPACITY MATRIX ══════════ */}
      <HospitalCapacityMatrix units={units} bedReleases={bedReleases} admissions={admissions} leaveBeds={leaveBeds} />

      <StatisticsInsightChart
        title="Admission stages"
        variant="distribution"
        testId="statistics-overview-stages-chart"
        metrics={[
          {
            id: "count",
            label: "Admissions",
            unit: "admissions",
            note: "Current recorded admission states, including ended admissions. Each admission appears once.",
          },
        ]}
        rows={stageTallies.map((stage) => ({
          id: stage.position,
          name: stage.label,
          values: { count: stage.count },
          detail: "Admission states are separate from open ED movements and bed preparation records.",
        }))}
      />
      <div className={`${styles.overviewGrid} ${family.modules}`}>
        <div className={styles.overviewColumn}>
          <StatisticsDetailPanel
            title="Across all services"
            count={`${refused.openMovementCount} open movements`}
            testId="ward-statistics-overview-scope"
          >
            <div
              className={styles.panelBody}
              role="group"
              aria-label="What this section will hold content"
              tabIndex={0}
            >
              <span>Network-wide current state</span>
            </div>
          </StatisticsDetailPanel>

          <StatisticsDetailPanel
            title="Capacity across the network, right now"
            count={`${capacity.ready} ready`}
            testId="ward-statistics-overview-capacity"
          >
            <div
              className={styles.panelBody}
              role="group"
              aria-label="Capacity across the network content"
              tabIndex={0}
            >
              <dl className={styles.kv} data-testid="ward-statistics-overview-capacity-kv">
                <div className={styles.kvItem}>
                  <dt>Ready to admit into, across the network</dt>
                  <dd className={styles.kvValue} data-testid="ward-statistics-overview-capacity-ready">
                    {capacity.ready}
                  </dd>
                </div>
                <div className={styles.kvItem}>
                  <dt>Physically empty, per the feed</dt>
                  <dd className={styles.kvValue} data-testid="ward-statistics-overview-capacity-empty">
                    {capacity.empty}
                  </dd>
                </div>
                <div className={styles.kvItem}>
                  <dt>Confirmed allocatable by the ward</dt>
                  <dd className={styles.kvValue} data-testid="ward-statistics-overview-capacity-allocatable">
                    {capacity.allocatable}
                  </dd>
                </div>
              </dl>

              <details
                className={`${styles.reveal} source-print`}
                data-testid="ward-statistics-overview-capacity-disclosure"
              >
                <summary>What these three numbers do and do not mean</summary>
                <div className={styles.revealBody}>
                  <p>
                    &ldquo;Ready to admit into&rdquo; is the sum of the smaller of each unit&apos;s empty and
                    allocatable counts. It is an aggregate snapshot, not a target, a ranking or evidence that a bed was
                    offered to a person; nothing in this prototype records an offer at all.
                  </p>
                  <p>
                    &ldquo;Physically empty&rdquo; sums every bed the feed reports as empty. &ldquo;Confirmed
                    allocatable&rdquo; sums every bed a ward says it can allocate. All three totals include every unit
                    in the current network record.
                  </p>
                </div>
              </details>
            </div>
          </StatisticsDetailPanel>

          <StatisticsDetailPanel
            title="Where admissions sit in the bed lifecycle"
            count={`${admissions.length} admissions`}
            testId="ward-statistics-overview-stages"
          >
            <div className={styles.panelBody} role="group" aria-label="Admission bed lifecycle content" tabIndex={0}>
              {/* Interactive Bed Lifecycle Pipeline */}
              <WardTable className={styles.dtable} testId="ward-statistics-overview-stage-table">
                <thead>
                  <tr>
                    <th scope="col">Stage</th>
                    <th scope="col" className={styles.n}>
                      Admissions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stageTallies.map((tally) => (
                    <tr key={tally.position}>
                      <th scope="row">{tally.label}</th>
                      <td className={styles.n} data-testid={`ward-statistics-overview-stage-${tally.position}`}>
                        {tally.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">All stages</th>
                    <td className={styles.n}>{admissions.length}</td>
                  </tr>
                </tfoot>
              </WardTable>

              <DemonstrationChart
                series={admissionsTrend}
                testId="ward-statistics-overview-demo-trend"
                variant="overview"
              />
            </div>
          </StatisticsDetailPanel>
        </div>
        <div className={styles.overviewColumn}>
          <WardPanel
            title="Declines by reason across the network"
            count={declinesReadout.ok ? `${declinesReadout.value.totalCount} declines` : "Unavailable"}
            testId="ward-statistics-overview-declines"
          >
            <div className={styles.panelBody} role="group" aria-label="Network declines content" tabIndex={0}>
              {!declinesReadout.ok ? (
                /*
                 * ⚠️ The three figure-bearing blocks below are the only part of this panel that depends
                 * on the decline vocabulary. The prose that follows — who this count misses — stays true
                 * whether or not the breakdown can be computed, so it is deliberately outside this
                 * branch. Reporting in place means losing the figures, not the explanation.
                 */
                <p className={styles.body} data-testid="ward-statistics-overview-declines-unavailable">
                  {declinesReadout.statement}
                </p>
              ) : (
                <>
                  <p className={styles.body} data-testid="ward-statistics-overview-declines-population">
                    <span data-testid="ward-statistics-overview-declines-total">
                      {declinesReadout.value.totalCount}
                    </span>{" "}
                    {declinesReadout.value.totalCount === 1 ? "decline" : "declines"} on record, from{" "}
                    <span data-testid="ward-statistics-overview-declines-movements-with">
                      {declinesReadout.value.movementsWithDeclinesCount}
                    </span>{" "}
                    of the{" "}
                    <span data-testid="ward-statistics-overview-declines-movements">
                      {declinesReadout.value.movementCount}
                    </span>{" "}
                    {declinesReadout.value.movementCount === 1 ? "movement" : "movements"} this page examined.
                  </p>

                  <WardTable className={styles.dtable} testId="ward-statistics-overview-declines-table">
                    <thead>
                      <tr>
                        <th scope="col">Reason</th>
                        <th scope="col" className={styles.n}>
                          Declines
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {declinesReadout.value.tallies.map((tally) => (
                        <tr key={tally.reason}>
                          <th scope="row">{tally.reason.replace(/_/g, " ")}</th>
                          <td className={styles.n} data-testid={`ward-statistics-overview-decline-${tally.reason}`}>
                            {tally.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">All reasons</th>
                        <td className={styles.n}>{declinesReadout.value.totalCount}</td>
                      </tr>
                    </tfoot>
                  </WardTable>

                  <p className={styles.note}>
                    <span data-testid="ward-statistics-overview-declines-vocabulary-size">
                      {declinesReadout.value.vocabularySize}
                    </span>{" "}
                    recorded reason categories.
                  </p>
                </>
              )}

              <details
                className={`${styles.reveal} source-print`}
                data-testid="ward-statistics-overview-declines-scope"
              >
                <summary>Who this count misses</summary>
                <div className={styles.revealBody}>
                  <p>
                    Counts recorded ward refusals for people already inside an emergency department. Excludes referrals
                    turned away before the person has reached a department.
                  </p>
                  <p data-testid="ward-statistics-overview-precedent">
                    The home page publishes no ward-attributable decline measure. A referral names a ward only when that
                    ward accepts, while a movement decline names a ward for somebody already inside a department.
                    Selecting either source would define a different population, so this page does not make that choice.
                  </p>
                </div>
              </details>

              {/*
               * ⚠️ **A SENTENCE WAS DELETED FROM THIS PARAGRAPH ON 2026-09-01 AND MAY NOT COME BACK.** It told the
               * reader this page could not be reached from the statistics hub, and that the linking index was work
               * still to be done. It is described here rather than quoted back word for word, so the retired
               * wording exists nowhere in the tree and no scan can mistake this record for a relapse.
               *
               * It was TRUE the day it was written and FALSE within the same session, when the hub index landed: `STATISTICS_SECTIONS` in `statistics-sections.ts` makes `STATISTICS_OVERVIEW_HREF` its first
               * entry, and `statistics-screen.tsx` renders every entry as a `<Link>` inside its index `<nav>`. So a
               * reader who arrived here by clicking that link was being told the navigation they had just used does
               * not exist — on a page whose whole character is that it never says anything it cannot support.
               *
               * **There is no corrected wording, which is why this is a deletion and not a rewrite.** The absence the
               * sentence described no longer obtains, so the conclusion falls with the reason.
               * `tests/ward-statistics-sections.dom.test.tsx` asserts the old wording cannot return.
               *
               * ⚠️ **AND THE SHAPE IS NOT CONFINED TO THIS FILE.** A "not built yet" note is a claim with an expiry
               * date, and nothing connects it to the work that expires it. A note of that shape belongs beside a test
               * that goes red the day the gap closes — the pattern `tests/ward-community-index.dom.test.tsx` uses —
               * or it does not belong in rendered prose at all.
               */}

              {/*
               * ⚠️ **THIS NAMED NEITHER THE FIGURE NOR THE FIELDS UNTIL FIX ROUND 1**, and a sentence about
               * "one figure recorded in two places that mean different things" is true of almost any
               * codebase — which is what makes it worthless. The home page's own withheld figure names
               * both records and says exactly why one of them cannot answer the question; a page that
               * gestures at that standard instead of meeting it is claiming a rigour it is not applying.
               */}
            </div>
          </WardPanel>

          <WardPanel
            title="Referrals waiting on a decision, and beds pending"
            count={`${refused.count} refused, ${preparingCount === 0 ? "nothing pending" : `${preparingCount} pending`}`}
            testId="ward-statistics-overview-worklist"
          >
            <div className={styles.panelBody} role="group" aria-label="Referral and bed worklist content" tabIndex={0}>
              <p className={styles.body} data-testid="ward-statistics-overview-refused-so-far-count">
                <span data-testid="ward-statistics-overview-refused-so-far-value">{refused.count}</span> of{" "}
                <span data-testid="ward-statistics-overview-refused-so-far-open-count">
                  {refused.openMovementCount}
                </span>{" "}
                open {refused.openMovementCount === 1 ? "movement" : "movements"} network-wide have at least one
                ward&apos;s refusal on record and no ward currently deciding — every ward asked <em>so far</em> has
                refused.
              </p>

              <details
                className={`${styles.reveal} source-print`}
                data-testid="ward-statistics-overview-refused-so-far-disclosure"
              >
                <summary>What &ldquo;so far&rdquo; means</summary>
                <div className={styles.revealBody}>
                  <p>
                    No closure flag marks the network as exhausted. A decline removes that ward from the current list,
                    and the case can go to fresh wards. This is a worklist of who needs a decision today, not a count of
                    patients nobody would take.
                  </p>
                  <p>
                    A further{" "}
                    <span data-testid="ward-statistics-overview-refused-so-far-escalated">
                      {refused.escalatedCount}
                    </span>{" "}
                    open {refused.escalatedCount === 1 ? "movement carries" : "movements carry"} a recorded escalation
                    instead. This is a recorded opinion that the network was exhausted, not a derived fact. Escalations
                    are classified first, so the count above is a floor.
                  </p>
                </div>
              </details>

              <p className={styles.body} data-testid="ward-statistics-overview-preparing-count">
                <span data-testid="ward-statistics-overview-preparing-value">{preparingCount}</span>{" "}
                {preparingCount === 1 ? "bed is" : "beds are"} currently marked as Pending across the network —
                cleaning, maintenance or repair, or with no reason stated.{" "}
                <strong>
                  A patient cannot be pulled into a bed that is still Pending, so the network can act on {openNow} of
                  its {capacity.ready} Ready beds right now.
                </strong>
              </p>
            </div>
          </WardPanel>
          {/*
           * 🔴 **THE DRAWING'S SIXTH PANEL, AND THIS PAGE HAS BEEN SHIPPING WITHOUT IT.** Five panels are
           * built; the approved drawing has six. **The missing one is the page's own provenance** — and on a
           * statistics screen inside a prototype, that is the panel most worth having and the one most
           * likely to be screenshotted without it.
           *
           * ⚠️ **THE FIRST PARAGRAPH NAMES SEVEN FIGURES, SO IT IS A CLAIM ABOUT THE REST OF THE PAGE, NOT
           * A DISCLAIMER.** All seven were checked against what this component actually renders before the
           * sentence was reproduced — capacity, the four stage counts, the decline counts and reasons, the
           * movements examined, the worklist and its escalated count, the beds pending, and the thirty
           * daily points behind the chart (`DEFAULT_TREND_LENGTH = 30`, a real constant, not the drawing's
           * sample). 🔴 **A sentence listing a figure the page does not show would be false ABOUT THE
           * PAGE**, and its test reaches for each figure's own testid rather than for this panel's prose,
           * so dropping a panel elsewhere reddens this one.
           *
           * ⚠️ **THE DRAWING'S MIDDLE "What is real" PARAGRAPH IS DELIBERATELY NOT REPRODUCED, AND THAT IS
           * A §7.0(2) DIVERGENCE RATHER THAN AN OVERSIGHT.** It is built entirely from the mockup's own
           * sample world — health-service names, a ward count, and the Command screen's fixed day, clock
           * and shift. **This screen renders none of those**, so quoting it puts claims on the page about
           * things the page does not show, and rewriting it with live figures would be the paraphrase this
           * lane has already been bitten by. **Dropped openly; recorded for the owner to veto.**
           */}
          <StatisticsDetailPanel
            title="Data provenance and limits"
            count="Scope"
            testId="ward-statistics-overview-invented"
          >
            <div className={styles.panelBody} role="group" aria-label="Data provenance and limits content" tabIndex={0}>
              {/*
               * 🔴 **THE DRAWING'S WORDING FAILS AN OWNER RULING AND SO IS ADAPTED, NOT QUOTED.** The owner's
               * ruling of 2026-09-09 §2 requires each SENTENCE to carry its own provenance marker rather than
               * leaning on the heading above it — the drawing's *"None of it describes a real person or a real
               * day."* discloses nothing when read alone. ⚠️ **This lane's standing rule is to quote the drawing
               * verbatim; here the drawing and a ruling collide, and the ruling wins.** Recorded under §7.0(2).
               */}
              <p className={styles.body} data-testid="ward-statistics-overview-invented-figures">
                <strong>Every figure here is invented and describes no real person or day.</strong>
              </p>
              <details className={`${styles.reveal} source-print`}>
                <summary>Provenance and limits</summary>
                <div className={styles.revealBody}>
                  <p>
                    The invented figures cover network capacity, the four admission stages, declines, current movements,
                    the referral worklist, pending beds and the 30 chart points.
                  </p>
                  <p data-testid="ward-statistics-overview-invented-unknowns">
                    <strong>Not measured:</strong> referrals turned away before a person reaches a department, durations
                    between unrecorded instants, and offers to named patients. The prototype records no offer, so these
                    remain stated absences rather than invented figures.
                  </p>
                </div>
              </details>
            </div>
          </StatisticsDetailPanel>
        </div>
      </div>
    </StatisticsSectionFrame>
  );
}

const ADMISSION_STAGE_LABELS: Record<AdmissionStagePosition, string> = {
  "no-bed-yet": "Admitted, no bed given yet",
  "bed-given-not-arrived": "Bed given, not yet arrived",
  "in-the-bed": "In the bed",
  ended: "Admission has ended",
};

/**
 * One row per admission stage, always all four — the same "every member of a closed vocabulary gets
 * a row, including nought" discipline `declinesByReason` (`statistics-derivations.ts`) already
 * documents, applied here to a network-wide count of admissions in each. Routed through
 * `admissionStagePosition` rather than a second read of `Admission.state`, so a stage renamed or
 * added there fails `tsc` on THIS file rather than quietly leaving a row uncounted here.
 *
 * `ADMISSION_STAGE_LABELS` is typed `Record<AdmissionStagePosition, string>` rather than a hand-
 * written list of the four members: TypeScript requires every key of the union to be present, so a
 * fifth stage added to that type fails this file to compile rather than silently missing a row.
 */
function admissionStageTallies(
  admissions: Admission[],
): { position: AdmissionStagePosition; label: string; count: number }[] {
  const counts: Record<AdmissionStagePosition, number> = {
    "no-bed-yet": 0,
    "bed-given-not-arrived": 0,
    "in-the-bed": 0,
    ended: 0,
  };
  for (const admission of admissions) {
    counts[admissionStagePosition(admission)] += 1;
  }
  return (Object.keys(ADMISSION_STAGE_LABELS) as AdmissionStagePosition[]).map((position) => ({
    position,
    label: ADMISSION_STAGE_LABELS[position],
    count: counts[position],
  }));
}

/**
 * Ready, physically empty and confirmed-allocatable, summed across every unit in the network — the
 * whole-of-prototype capacity picture `unitCapacity` (`ward-derivations.ts`) makes possible per
 * unit. "Ready" here is exactly the owner's ruling of 2026-09-04: `min(allocatable, empty)`, never a
 * different number wearing the same word (see `statistics-screen.tsx`'s own note on that ruling).
 */
function networkCapacity(
  units: Unit[],
  bedReleases: BedRelease[],
): { ready: number; empty: number; allocatable: number } {
  let ready = 0;
  let empty = 0;
  let allocatable = 0;
  for (const unit of units) {
    ready += unitCapacity(unit, bedReleases).available;
    empty += unit.empty.value;
    allocatable += unit.allocatable.value;
  }
  return { ready, empty, allocatable };
}
