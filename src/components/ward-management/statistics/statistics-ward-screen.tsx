"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import { generateDemonstrationSeries } from "@/components/ward-management/statistics/statistics-demonstration";
import { DemonstrationChart } from "@/components/ward-management/statistics/statistics-demonstration-chart";
import { figureText, isUnmeasured } from "@/components/ward-management/statistics/statistics-absence";
import { dischargeDateCoverage } from "@/components/ward-management/statistics/statistics-ward-discharge-dates";
import { readyNotYetGone, type ReadyNotYetGone } from "@/components/ward-management/statistics/statistics-ward-ready";
import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, splitDuration } from "@/components/ward-management/ward-clock";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { wardStatistics } from "@/components/ward-management/ward-statistics";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

import styles from "./statistics-sections.module.css";
import pageStyles from "./statistics-ward-third-edition.module.css";

/**
 * ONE WARD IN DETAIL — the per-ward statistics page, and it is a skeleton.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO.** Not a crash, and — worse — not an
 * empty shell that looks like a ward with no data. Those two are indistinguishable to a reader:
 * "this ward has nothing to show" and "there is no such ward" would render identically, and the
 * first is a statement about a real ward the reader would then believe. This screen never falls
 * back to a different unit, and it says which id it could not resolve.
 *
 * ⚠️ **THE SAME PAGE CARRIES THE DISCLAIMER IN BOTH STATES.** A reader who lands here from a stale
 * link sees the not-found state first, and it is still a page of this prototype — so it still says
 * the figures are invented and that nothing enforces the coordinator framing. An error state that
 * quietly drops the governance chrome is the one page most likely to be screenshotted.
 *
 * ⚠️ **NO FIGURE, AND NO SHAPE WHERE ONE WOULD GO.** The ward's name and its hospital are identity,
 * not measurement: they cannot drift against a figure because they are not figures. Bed counts,
 * occupancy, availability and length of stay are deliberately absent — this page shows none of
 * them, rather than showing them as noughts, and it says so in a sentence.
 *
 * **The unit comes from the provider's live `units`**, never from `unitById()`, which is what
 * `tests/ward-flow-single-source.test.ts` requires of every screen: a surface resolving a unit from
 * the frozen fixture describes the ward as it was seeded rather than as it is.
 */
export function StatisticsWardScreen({
  unitId,
  units: unitsOverride,
  admissions: admissionsOverride,
}: {
  unitId: string;
  units?: Unit[];
  admissions?: Admission[];
}) {
  const { units: liveUnits, admissions: liveAdmissions, movements, bedReleases, scenario } = useWardFlow();
  const now = useWardFlowClock();
  usePrintableDisclosures();
  const units = unitsOverride ?? liveUnits;
  const admissions = admissionsOverride ?? liveAdmissions;
  const unit = units.find((candidate) => candidate.id === unitId);

  const [activeTab, setActiveTab] = useState<string>("all");
  const [d4Notice, setD4Notice] = useState<string | null>(null);
  const [politeNotice, setPoliteNotice] = useState<string | null>(null);
  const [bedSearchQuery, setBedSearchQuery] = useState<string>("");

  const triggerD4 = useCallback((actionName?: string) => {
    const msg = actionName ? `${actionName}: Not wired in this prototype.` : "Not wired in this prototype.";
    setD4Notice(msg);
    setPoliteNotice(msg);
  }, []);

  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  if (!unit) {
    return (
      <StatisticsSectionFrame
        section={section}
        title="Ward not found"
        subtitle="The address names a ward this prototype does not have."
        testId="ward-statistics-ward-screen"
        design="third-edition"
      >
        <div className={styles.notFoundBlock}>
          {/* No heading here, and NOT a WardPanel: that primitive requires a title and the frame's
              own `<h1>` already reads "Ward not found". The frame's own `<h1>` already reads "Ward not found"; a second
              heading saying the same thing in different words was the near-duplicate fix round 1
              picked up, and the warning paragraph below is the content. */}
          <p className={styles.notFoundBody} data-testid="ward-statistics-ward-unresolved">
            No ward in this prototype has the id <span className={styles.unresolvedId}>{unitId}</span>. It may have been
            renamed or removed, or the id in the address may be wrong. This page never falls back to a different ward,
            because a page showing the wrong ward under the right heading is worse than a page showing nothing.
          </p>
          <p className={styles.body}>
            <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ward-chooser-link">
              Choose a ward from the comparisons page
            </Link>{" "}
            to reach one that does exist.
          </p>
        </div>
      </StatisticsSectionFrame>
    );
  }

  const site = siteByCode(unit.siteCode);
  const statistics = wardStatistics(unit.id, admissions, now);

  /**
   * Ruling R-B-09: "Ready" is the one word for `min(allocatable, empty)`, computed here by
   * `unitCapacity` — the SAME function the five-state bed grid uses — rather than re-derived. This
   * page previously showed none of the three; see the module doc comment above `unitCapacity`
   * (`ward-derivations.ts`) for why `available` (Ready), `empty` and `allocatable` are shown
   * together rather than Ready alone: a reader who can see both inputs can check the arithmetic
   * instead of taking the word for it. `capacity.potential` is deliberately never read here — its
   * own doc comment marks it dead beyond a handful of offline test callers and warns against
   * repurposing it as a live figure.
   */
  const capacity = unitCapacity(unit, bedReleases);
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  /*
   * 🔴 **THE NUMBER A COORDINATOR CAN ACT ON, AND IT IS NOT THE READY FIGURE.** `PULL_PATIENT`
   * refuses outright — *"a patient cannot be pulled to a bed that is not open"* — when every free
   * bed is being made ready. So Ready and pullable are two different numbers, and this screen said
   * only the larger one until 2026-09-07.
   *
   * ⚠️ **CALLED, NOT RECOMPUTED.** The first version of this line wrote `Math.max(0, capacity.available
   * - pendingPreparation)` inline — a second copy of a clinical calculation, which is exactly what
   * drifts. `openBedsNow` is the one the reducer itself gates the pull on.
   */
  const openBeds = openBedsNow(unit, bedReleases);

  /*
   * 🔴 **REFERRALS INTO THIS WARD — owner-ruled 2026-09-12, answered to me DIRECTLY: *"Yes do it"*.**
   * The channel is stated because a relayed ruling and a first-hand one read identically once written
   * into a file, and this lane has already shipped one commit that blurred them.
   *
   * ⚠️ **CALLED, NEVER RECOMPUTED — and this derivation is the reason that rule exists here.** It
   * shipped with six passing tests and **zero production callers**: correct, covered and unreachable,
   * which is a shape this repository has recorded under its own name. Inlining three `.filter()` calls
   * on this page would have left it that way while looking like the feature had been built.
   *
   * 🔴 **`movements`, NOT `admissions`.** They are different populations and this page reads
   * both. An admission exists once somebody is in a bed here; a referral is the asking, and most of
   * these three never become an admission on this ward at all.
   */
  const referrals = wardReferralTally(movements, unit.id);

  /**
   * ⚠️ **A DELIBERATE GUARD, NOT A WORKAROUND FOR A TEST FIXTURE.** `blockedDischargesByReason`
   * throws if any admission's `blockReason` is not a member of `BED_RELEASE_BLOCKERS` — a real
   * seed admission can never carry an invalid value, because `Admission.blockReason` is typed
   * `BedReleaseBlocker | null` everywhere it is authored, but this page's whole discipline is
   * failing conservatively rather than guessing. A single malformed field should not take the
   * entire ward page down with it — the identity panel and the flow statistics above it are still
   * true even if this one breakdown cannot be computed — so the failure is caught and named rather
   * than left to crash the render.
   *
   * 🔴 **AND THE CALL IS NOW ONE, NOT TWO — WHICH IS THE REPAIR, NOT THE HEADING ABOVE IT.**
   *
   * Until now the headline count came from `statistics.readyToLeaveCannot` and the table beneath it
   * from `blockedDischargesByReason`, **two independently maintained filters over one population**:
   * `state !== "departed"` on one side, `admissionStagePosition(...) === "ended"` on the other.
   * Today they select the same records. Nothing makes them. `readyNotYetGone` reads the headline,
   * the denominator and the rows off a single pass, so they cannot disagree — see that module's own
   * header for the edit that would have broken the old arrangement with every gate green.
   */
  let ready: ReadyNotYetGone | null = null;
  let blockedByReasonError: string | null = null;
  try {
    ready = readyNotYetGone(admissions, unit.id);
  } catch (error) {
    blockedByReasonError = error instanceof Error ? error.message : String(error);
  }

  /**
   * ⚠️ **THE FALLBACK IS NOT A SECOND SOURCE, AND THE DIFFERENCE MATTERS.** `blockedDischargesByReason`
   * throws by design on a `blockReason` outside the vocabulary, and a pre-existing ruling on this
   * screen says one malformed field must not take the whole ward page down — the identity panel and
   * the flow figures above are still true. **When the table cannot be computed there is no table for
   * the headline to contradict**, so falling back to `readyToLeaveCannot` there restores nothing of
   * the two-place problem: the moment a table exists, both numbers come from it.
   */
  const headlineTotal = ready === null ? statistics.readyToLeaveCannot : ready.total;

  /**
   * ⚠️ **A SECOND PANEL WITH A "SHARE OF THE WARD" DENOMINATOR, AND THE TWO MUST NOT DISAGREE.**
   * `readyNotYetGone` takes its population from `blockedDischargesByReason`'s single pass; this one
   * filters the same way in its own module. 🔴 **Two derivations, one population, and nothing in the
   * type system ties them** — so `tests/ward-statistics-ward-shares-agree.dom.test.tsx` reads BOTH
   * denominators out of the rendered page and requires them to match. A screen showing "3 of 12" in
   * one panel and "of 11" in the next is the shape this family exists to prevent.
   */
  const dischargeDates = dischargeDateCoverage(admissions, unit.id);

  /**
   * 🔴 **DEMONSTRATION ONLY, THROUGH TASK 1'S WRAPPER — NEVER RENDERED AS MEASURED.**
   * `WardFlowState` keeps no history, so a 30-day occupancy/readiness trend cannot be a real
   * derivation; see `statistics-demonstration.ts`'s own header for why the wrapper exists and what
   * it stops. Both series are seeded from `scenario`, `now` and the series' own label, so they are
   * stable for a given ward and clock, and independent of each other despite sharing both. The
   * baseline for each is this ward's OWN current figure (from `capacity` above) rather than an
   * arbitrary number, so the OLDEST point on the walk is anchored to something real about this
   * ward, even though every other point on it is invented.
   *
   * ⚠️ **This said "the most recent point" until 2026-09-07, and it was the wrong end.** `walk()`
   * seeds `value` from the baseline and pushes from `daysAgo = count - 1` down to `0`, so the
   * baseline is where the walk STARTS — thirty clamped random steps ago. The most recent point,
   * which is the one a reader's eye lands on and the one nearest today's real figure, is anchored
   * to nothing. The overview screen's equivalent comment says "starts somewhere plausible", which
   * is correct; this one had it backwards.
   */
  const occupancySeries = generateDemonstrationSeries(
    scenario,
    now,
    {
      label: `${unit.name} — occupied beds`,
      whatItWouldMeasure: "daily occupied beds on this ward over the last 30 days",
      whyItIsNotReal: "only the current ward state is retained; no daily history exists",
    },
    { baseline: capacity.occupied, volatility: 1, minValue: 0, maxValue: unit.beds },
  );
  const readySeries = generateDemonstrationSeries(
    scenario,
    now,
    {
      label: `${unit.name} — beds ready to admit`,
      whatItWouldMeasure: "daily ready beds on this ward over the last 30 days",
      whyItIsNotReal: "only the current ward state is retained; no daily history exists",
    },
    { baseline: capacity.available, volatility: 1, minValue: 0, maxValue: unit.beds },
  );

  const bedMatrixList = (() => {
    const occupiedCount = capacity.occupied;
    const availableCount = capacity.available;
    const pendingCount = pendingPreparation;
    const list = [];
    const wardAdms = admissions.filter((a) => a.unitId === unit.id && a.state !== "departed");

    for (let i = 1; i <= unit.beds; i++) {
      const bedName = `Bed ${i < 10 ? `0${i}` : i}`;
      // Rows come from this ward's admission records. Until 25 Sept 2026 each row carried a made-up
      // "P-18x" person, beds beyond the records got typed stays and plans, and stays were divided by
      // 86,400 although Ward Flow's clock counts minutes.
      if (i <= wardAdms.length) {
        const adm = wardAdms[i - 1];
        const stayDays = adm.arrivedAt === null ? 0 : Math.max(1, Math.round((now - adm.arrivedAt) / MINUTES_PER_DAY));
        list.push({
          bed: bedName,
          state: "Occupied",
          pt: `${adm.id} (${adm.sex === "Female" ? "F" : adm.sex === "Male" ? "M" : adm.sex.toLowerCase()})`,
          admitted: adm.arrivedAt === null ? "Not arrived yet" : `${stayDays}d ago`,
          days: stayDays,
          target: adm.expectedDischargeAt === null ? "No discharge date set" : "Discharge date set",
        });
      } else if (i <= occupiedCount) {
        list.push({
          bed: bedName,
          state: "Occupied",
          pt: "Not recorded",
          admitted: "Not recorded",
          days: 0,
          target: "Not recorded",
        });
      } else if (i <= occupiedCount + availableCount) {
        list.push({
          bed: bedName,
          state: "Available",
          pt: "-",
          admitted: "-",
          days: 0,
          target: "Ready to admit",
        });
      } else if (i <= occupiedCount + availableCount + pendingCount) {
        list.push({
          bed: bedName,
          state: "Pending",
          pt: "-",
          admitted: "-",
          days: 0,
          target: "Being made ready",
        });
      } else {
        list.push({
          bed: bedName,
          state: "Out of Service",
          pt: "-",
          admitted: "-",
          days: 0,
          target: "Reason not recorded",
        });
      }
    }
    return list;
  })();

  const filteredBedMatrix = (() => {
    if (!bedSearchQuery.trim()) return bedMatrixList;
    const q = bedSearchQuery.toLowerCase().trim();
    return bedMatrixList.filter(
      (b) =>
        b.bed.toLowerCase().includes(q) ||
        b.state.toLowerCase().includes(q) ||
        b.pt.toLowerCase().includes(q) ||
        b.target.toLowerCase().includes(q),
    );
  })();

  const TABS = [
    { id: "all", label: "All Sections", badge: "All" },
    { id: "occ", label: "Beds & Occupancy", badge: `${capacity.occupied}/${unit.beds}` },
    {
      id: "los",
      label: "Length of Stay",
      badge:
        statistics.averageLengthOfStayDays === null
          ? "Not recorded"
          : `${statistics.averageLengthOfStayDays.toFixed(0)}d`,
    },
    { id: "flow", label: "Admissions & Discharges", badge: "7d Flow" },
    { id: "ready", label: "Discharge Readiness", badge: `${headlineTotal} delayed` },
    { id: "longStay", label: "Long Stays", badge: `${statistics.longStays}` },
  ] as const;

  return (
    <StatisticsSectionFrame
      section={section}
      title={unit.name}
      subtitle="Current capacity, flow and discharge measures for this ward, with record limits stated in place."
      testId="ward-statistics-ward-screen"
      design="third-edition"
    >
      {politeNotice ? (
        <div className={pageStyles.srOnly} role="status" aria-live="polite">
          {politeNotice}
        </div>
      ) : null}

      {d4Notice ? (
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
      ) : null}

      <nav className={pageStyles.sovereignTabs} aria-label="Ward Statistics Navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${pageStyles.sovereignTab}${activeTab === tab.id ? ` ${pageStyles.activeTab}` : ""}`}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            <span>{tab.label}</span>
            <span className={pageStyles.tabBadge}>{tab.badge}</span>
          </button>
        ))}
      </nav>

      <div className={pageStyles.pageGrid} data-active-tab={activeTab}>
        <WardPanel
          title={unit.name}
          count={`${unit.beds} beds`}
          testId="ward-statistics-ward-identity"
          dataTabSection="common"
        >
          <div className={styles.panelBody} role="group" aria-label="Ward identity content" tabIndex={0}>
            <p className={styles.body} data-testid="ward-statistics-ward-site">
              {/* A ward whose site code resolves to nothing is described as exactly that, rather than
                being given a plausible hospital. The same conservative failure `ward-index.tsx` holds
                to: the page says it cannot place the ward, and still shows you the ward. */}
              {site
                ? `${unit.name} is recorded at ${site.name}.`
                : `${unit.name} carries a site code this prototype has no site for, so it cannot be placed at a hospital here.`}
            </p>
            <p className={styles.note}>
              {unit.cohort} ward · {unit.beds} beds ·{" "}
              {unit.lockedBeds === 0
                ? "no designated locked beds"
                : `${unit.lockedBeds} designated locked ${unit.lockedBeds === 1 ? "bed" : "beds"}`}
              {site ? ` · ${site.service}` : ""}.
            </p>
          </div>
        </WardPanel>

        <WardPanel title="Beds now" testId="ward-statistics-ward-beds-now" dataTabSection="occ">
          <div
            className={`${styles.panelBody} ${pageStyles.bedBody}`}
            role="group"
            aria-label="Beds now content"
            tabIndex={0}
          >
            <dl className={pageStyles.capacityBand} aria-label="Current bed figures">
              <div>
                <dt>Beds on the ward</dt>
                <dd>{unit.beds}</dd>
              </div>
              <div>
                <dt>Occupied</dt>
                <dd>{capacity.occupied}</dd>
              </div>
              <div>
                <dt>Ready</dt>
                <dd>{capacity.available}</dd>
              </div>
              <div>
                <dt>Open now</dt>
                <dd>{openBeds}</dd>
              </div>
            </dl>

            <WardTable className={pageStyles.bedTable} wrapperClassName={pageStyles.bedTableWrap}>
              <caption className={pageStyles.srOnly}>
                Empty, allocatable, ready, open and pending bed figures for this ward.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Bed figure</th>
                  <th scope="col">Beds</th>
                  <th scope="col">Recorded meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Empty</th>
                  <td>{unit.empty.value}</td>
                  <td>Physically empty</td>
                </tr>
                <tr>
                  <th scope="row">Allocatable</th>
                  <td>{unit.allocatable.value}</td>
                  <td>Confirmed allocatable by the ward</td>
                </tr>
                <tr>
                  <th scope="row">Ready</th>
                  <td>{capacity.available}</td>
                  <td>Smaller of empty and allocatable</td>
                </tr>
                <tr>
                  <th scope="row">Open now</th>
                  <td>{openBeds}</td>
                  <td>Ready and not marked Pending</td>
                </tr>
                <tr>
                  <th scope="row">Pending</th>
                  <td>{pendingPreparation}</td>
                  <td>Marked for cleaning, maintenance or repair, or with no reason stated</td>
                </tr>
              </tbody>
            </WardTable>

            <div className={pageStyles.tableTools}>
              <label htmlFor="bedMatrixSearch" className={pageStyles.srOnly}>
                Search beds by patient, status, or number
              </label>
              <input
                id="bedMatrixSearch"
                type="search"
                className={pageStyles.tableSearch}
                placeholder="Search bed, status, or patient ID..."
                value={bedSearchQuery}
                onChange={(e) => setBedSearchQuery(e.target.value)}
                aria-label="Filter bed status matrix"
              />
              <span className={styles.note} style={{ fontSize: "12px" }}>
                Showing {filteredBedMatrix.length} of {bedMatrixList.length} beds
              </span>
            </div>
            <div className={pageStyles.tableWrap}>
              <table className={pageStyles.dataTable}>
                <caption className={pageStyles.srOnly}>Operational bed inventory and current allocation status</caption>
                <thead>
                  <tr>
                    <th scope="col">Bed</th>
                    <th scope="col">Status</th>
                    <th scope="col">Patient</th>
                    <th scope="col">Admitted</th>
                    <th scope="col" className={pageStyles.n}>
                      Length of stay
                    </th>
                    <th scope="col">Discharge Target</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBedMatrix.map((b) => {
                    let chipClass = pageStyles.chipMark;
                    if (b.state === "Occupied") chipClass = pageStyles.chipOccupied;
                    else if (b.state === "Available") chipClass = pageStyles.chipReady;
                    else if (b.state === "Out of Service") chipClass = pageStyles.chipAlert;

                    return (
                      <tr key={b.bed}>
                        <td>
                          <strong>{b.bed}</strong>
                        </td>
                        <td>
                          <span className={`${pageStyles.chip} ${chipClass}`}>{b.state}</span>
                        </td>
                        <td>
                          <strong>{b.pt}</strong>
                        </td>
                        <td>{b.admitted}</td>
                        <td className={pageStyles.n}>{b.days > 0 ? `${b.days} d` : "-"}</td>
                        <td>{b.target}</td>
                        <td>
                          <button
                            type="button"
                            className={pageStyles.d4Btn}
                            onClick={() => triggerD4(`Bed details for ${b.bed}`)}
                            aria-label={`Details for ${b.bed}`}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <details className={`${pageStyles.measureDetails} source-print`}>
              <summary>How these bed figures are measured</summary>
              <div className={pageStyles.measureDetailsBody}>
                <h3 className={styles.subHeading}>Empty</h3>
                <p className={styles.body} data-testid="ward-stat-capacity-empty">
                  {unit.empty.value} {unit.empty.value === 1 ? "bed is" : "beds are"} physically empty on this ward
                  right now, whether or not the ward has confirmed it can allocate them.
                </p>

                <h3 className={styles.subHeading}>Allocatable</h3>
                <p className={styles.body} data-testid="ward-stat-capacity-allocatable">
                  {unit.allocatable.value === 0 ? (
                    <>{unit.name} has no free bed right now — none of its beds are confirmed allocatable.</>
                  ) : (
                    <>
                      {unit.allocatable.value} {unit.allocatable.value === 1 ? "bed" : "beds"} this ward has confirmed
                      it can allocate to a new patient.
                    </>
                  )}
                </p>

                {/*
                 * Ruling R-B-09: "Ready" is the one word for `min(allocatable, empty)`, computed above by
                 * `unitCapacity` — never re-derived here. Both inputs sit beside it above so a reader can
                 * check the arithmetic rather than take the word for it — never "available now", "you can
                 * fill today", or "no bed free" (retired wording; "no free bed" above is a different,
                 * correct claim about `allocatable` alone).
                 */}
                <h3 className={styles.subHeading}>Ready</h3>
                <p className={styles.body} data-testid="ward-stat-capacity-ready">
                  {capacity.available} {capacity.available === 1 ? "bed is" : "beds are"} ready to admit a new patient
                  right now — the smaller of the {unit.empty.value}{" "}
                  {unit.empty.value === 1 ? "bed that is" : "beds that are"} physically empty and the{" "}
                  {unit.allocatable.value} the ward has confirmed allocatable.
                </p>
                {/*
                 * ⚠️ **THE READY FIGURE ABOVE DELIBERATELY SUBTRACTS NOTHING FOR THIS, AND MUST NOT START.**
                 * The owner ruled (2026-09-01) that a bed being made ready blocks the pull but must not drop
                 * the ward's figure, so the number does not lurch as cleaning starts and stops. What was
                 * missing was this sentence beside it, not an adjustment to it.
                 *
                 * **Population is the owner's ruling of 2026-09-07: beds the patient has already left.**
                 * `bedsPendingPreparation` filters `state === "discharged" && preparing`, so a bed still
                 * occupied and flagged is not counted here — it is not a bed anyone can plan around tonight.
                 *
                 * ⚠️ **"marked as" is load-bearing and is not a hedge to tidy away.** The reducer does not
                 * constrain which releases may carry the flag, so this is a claim about the RECORD. "N beds
                 * are being made ready" would be a claim about the world, and the model cannot support it.
                 */}
                {/*
            ⚠️ **THE "but" CLAUSE RENDERS ONLY WHEN THE CONSTRAINT IS ACTUALLY BITING.** With nothing
            pending it read "0 of this ward's empty beds are marked as being made ready … but a
            patient cannot be pulled into a bed that is still being made ready" — a warning about a
            constraint that is not operating, on 22 of the 23 wards. Not false, which is why it
            survived; but a caution the reader meets every time and which never applies is one they
            learn to skip, and it is still there on the ward where it matters.

            Condition compares the two figures rather than `pendingPreparation > 0`, for the reason
            given on the service screen: `openBedsNow` floors at nought, so the counts can coincide
            while beds are pending.
          */}
                <p className={styles.body} data-testid="ward-stat-capacity-pending-preparation">
                  {pendingPreparation} of this ward&apos;s empty {pendingPreparation === 1 ? "bed is" : "beds are"}{" "}
                  marked as Pending — cleaning, maintenance or repair, or with no reason stated.{" "}
                  {pendingPreparation === 1 ? "It is" : "They are"} counted in the figure above rather than held back
                  from it
                  {openBeds < capacity.available ? (
                    <strong>
                      , but a patient cannot be pulled into a bed that is still Pending, so the number available to act
                      on right now is {openBeds}.
                    </strong>
                  ) : (
                    "."
                  )}
                </p>
              </div>
            </details>
          </div>
        </WardPanel>

        <WardPanel title="Occupancy over the window" testId="ward-statistics-ward-occupancy" dataTabSection="occ">
          <div
            className={`${styles.panelBody} ${pageStyles.trendStack}`}
            role="group"
            aria-label="Occupancy over the window content"
            tabIndex={0}
          >
            <p className={styles.note} data-testid="ward-stat-trends-disclaimer">
              Neither trend below is recorded — both charts below are demonstration data, not a measurement of this
              ward. This prototype keeps only the ward&apos;s current state, never a day-by-day history, so neither
              trend was ever recorded — see each chart&apos;s own caption for what it stands in for.
            </p>
            <DemonstrationChart series={occupancySeries} testId="ward-stat-occupancy-trend" />
            <DemonstrationChart series={readySeries} testId="ward-stat-ready-trend" />
          </div>
        </WardPanel>

        <div className={pageStyles.measureColumns} data-testid="ward-statistics-ward-measures">
          <div className={pageStyles.measureColumn}>
            <WardPanel title="Length of stay" testId="ward-statistics-ward-length-of-stay" dataTabSection="los">
              <div className={styles.panelBody} role="group" aria-label="Length of stay content" tabIndex={0}>
                <h3 className={styles.subHeading}>Average length of stay</h3>
                <p className={styles.body} data-testid="ward-stat-length-of-stay">
                  {statistics.averageLengthOfStayDays === null ? (
                    <>No admission on this ward has arrived yet, so there is no stay to measure.</>
                  ) : (
                    <>
                      {statistics.averageLengthOfStayDays} {statistics.averageLengthOfStayDays === 1 ? "day" : "days"},
                      averaged over every admission on this ward that has arrived.
                    </>
                  )}
                </p>

                <p className={styles.note} data-testid="ward-stat-los-bands-not-shown">
                  Stays grouped by length are not shown. The average above is this page&apos;s only length-of-stay
                  figure.
                </p>
              </div>
            </WardPanel>
            <WardPanel
              title="Admissions and discharges"
              testId="ward-statistics-ward-admissions-discharges"
              dataTabSection="flow"
            >
              <div
                className={styles.panelBody}
                role="group"
                aria-label="Admissions and discharges content"
                tabIndex={0}
              >
                <p className={styles.note} data-testid="ward-stat-flow-history-not-recorded">
                  Day-by-day admissions and discharges are not recorded in Ward Flow, so the last 7 days are not shown.
                </p>

                <h3 className={styles.subHeading}>Average time a bed stood empty</h3>
                {/*
                 * ⚠️ **`splitDuration`, THE ESTATE'S FORMATTER — this page printed "300 minutes" until
                 * 2026-09-06 while the statistics home page printed "5h 00m" for the SAME value.** One
                 * number in two dresses, on the pair of screens a coordinator moves between. The home
                 * page's format wins because it is the one every other duration in this feature uses.
                 */}
                <p className={styles.body} data-testid="ward-stat-empty-bed-minutes">
                  {statistics.averageEmptyBedMinutes === null ? (
                    <>
                      No bed on this ward has a usable pair of instants — a bed given away and a person arriving, with
                      the arrival not earlier than the pull — so there is no empty stretch to average.
                    </>
                  ) : (
                    <>
                      {splitDuration(statistics.averageEmptyBedMinutes)} between a bed being given away and the person
                      arriving.
                    </>
                  )}
                </p>

                {/*
            🔴 **AN EXCLUSION NOBODY CAN SEE IS THE CLAMP THAT WAS REMOVED, WEARING A DIFFERENT
            NAME.** Until 2026-09-07 an admission whose arrival preceded its own bed allocation was
            dropped from this ward's average with NOTHING on screen — no figure, no sentence. Ward
            Lead's ruling of 2026-09-01 is that a clamp "does not make a bad number safe, it makes it
            invisible", and the statistics home page has rendered exactly this count since, in its
            own words: the exclusion "must be VISIBLE or the exclusion is as invisible as the clamp
            it replaces".

            The hub honoured it; this page — the surface a coordinator opens about a NAMED ward — did
            not, and looked compliant because the clamp really had been removed. Same paragraph as
            the hub's, deliberately: one wording for one fact across the two screens a coordinator
            moves between.
          */}
                <p className={styles.body} data-testid="ward-stat-empty-bed-incoherent">
                  <strong>{statistics.emptyBedIncoherentCount}</strong>{" "}
                  {statistics.emptyBedIncoherentCount === 1
                    ? "admission on this ward records"
                    : "admissions on this ward record"}{" "}
                  an arrival earlier than the bed was given away.
                  {statistics.emptyBedIncoherentCount > 0 ? (
                    <>
                      {" "}
                      That cannot be true, so {statistics.emptyBedIncoherentCount === 1 ? "it is" : "they are"} excluded
                      from the average and counted here instead.
                    </>
                  ) : null}
                </p>

                {statistics.emptyBedMinutesShortest !== null &&
                statistics.emptyBedMinutesLongest !== null &&
                statistics.emptyBedMinutesShortest === statistics.emptyBedMinutesLongest ? (
                  <p className={styles.body} data-testid="ward-stat-empty-bed-uniform">
                    <strong>
                      Every measured gap on this ward is that same length, so the average describes no variation.
                    </strong>
                  </p>
                ) : null}

                <h3 className={styles.subHeading}>Average wait after being accepted</h3>
                <div data-testid="ward-stat-waitlist-wait">
                  <p className={styles.body}>
                    This measure cannot be formed. The admission record carries no instant marking when a person joined
                    the waiting list.
                  </p>
                  <details className={`${pageStyles.measureDetails} source-print`}>
                    <summary>Why this measure cannot be formed</summary>
                    <p className={styles.body}>
                      The instants the record does carry are not all of one kind: some are about the bed, some are about
                      the discharge plan, and at least one is about the person rather than about the bed. They are
                      deliberately not listed here because this page does not own that record shape. The nearest
                      equivalent elsewhere in this prototype measures from the moment a referral was raised, which this
                      derivation cannot see, because it is given admissions only, by design. Supporting this figure
                      would require a new recorded instant or a different derivation input.
                    </p>
                  </details>
                </div>
              </div>
            </WardPanel>
          </div>
          <div className={pageStyles.measureColumn}>
            <WardPanel
              title="Discharge planning"
              testId="ward-statistics-ward-discharge-planning"
              dataTabSection="ready"
            >
              <div className={styles.panelBody} role="group" aria-label="Discharge planning content" tabIndex={0}>
                {/*
                 * 🔴 **THE DRAWING'S "DISCHARGE PLANNING" FACTS, AND THEY GO ABOVE THE OUTCOMES BECAUSE
                 * THEY ARE THE SIMPLER QUESTION.** How many people here have a date written down at all is
                 * what a coordinator opens this panel for; whether past dates were met is a different and
                 * narrower question, over a different population, and the comment below says so at length.
                 *
                 * ⚠️ **THESE TWO ARE A PARTITION AND THE THREE BELOW ARE NOT.** `recorded + notRecorded`
                 * equals the ward exactly; `met`/`missed`/`moved` overlap and must never be summed. **Two
                 * neighbouring figure sets with opposite arithmetic, three lines apart** — which is why the
                 * partition is asserted by a test rather than left for a reader to infer from the layout.
                 *
                 * 🔴 **THE DRAWING'S FOURTH FACT IS DELIBERATELY ABSENT.** It reads *"Where a discharge went
                 * — not tracked here"*, and that was measured FALSE: `Admission.leavingDestination` is
                 * declared, carries eight members and the seed populates it on every departure. **Not
                 * reproduced, and not silently corrected either** — recorded under §7.0(2), and the panel it
                 * would make possible is deliberately not built.
                 *
                 * ⚠️ **The month-scoped table the drawing puts beneath this is NOT here and is a hand-back
                 * (D-4):** the prototype persists no history and the network holds five departed admissions.
                 */}
                <h3 className={styles.subHeading}>Discharge planning</h3>
                <dl
                  className={`${styles.body} ${pageStyles.metricFacts}`}
                  data-testid="ward-stat-discharge-date-coverage"
                >
                  <div>
                    <dt>Patients with a discharge date recorded</dt>
                    <dd data-testid="ward-stat-discharge-date-recorded">{dischargeDates.recorded}</dd>
                  </div>
                  <div>
                    <dt>Patients without one</dt>
                    <dd data-testid="ward-stat-discharge-date-not-recorded">{dischargeDates.notRecorded}</dd>
                  </div>
                  <div className={pageStyles.shareFact}>
                    <dt>Share of the ward with a date</dt>
                    <dd
                      data-testid="ward-stat-discharge-date-share"
                      data-unmeasured={isUnmeasured(dischargeDates.shareRecorded) ? "" : undefined}
                    >
                      {dischargeDates.shareRecorded.kind === "measured" ? (
                        <>
                          {figureText(dischargeDates.shareRecorded)}% of the {dischargeDates.population}{" "}
                          {dischargeDates.population === 1 ? "patient" : "patients"} on this ward who{" "}
                          {dischargeDates.population === 1 ? "has" : "have"} not departed
                        </>
                      ) : (
                        <>No share can be stated: {figureText(dischargeDates.shareRecorded)}.</>
                      )}
                    </dd>
                  </div>
                </dl>

                <h3 className={styles.subHeading}>Discharge dates</h3>
                {/*
                 * 🔴 **TWO POPULATIONS, AND UNTIL 2026-09-06 THIS SENTENCE PRESENTED THEM AS ONE.** It read
                 * "Of 1 with a date written down, 1 met, 0 missed and 11 moved" on a live ward page. Eleven
                 * of one. Every number was correct — that is what made it dangerous — and the derivation
                 * had already written the rule down, in `ward-statistics.ts`:
                 *
                 * > `met`/`missed`/`moved` are therefore NOT a three-way partition of the same population
                 * > and must never be summed to `consideredCount`.
                 *
                 * `moved` is counted over EVERY admission on this ward. `met` and `missed` only over the
                 * ones with a date whose person has since left. So the two cannot share a denominator, and
                 * they now get a sentence each rather than a clause each.
                 *
                 * ⚠️ **THE EMPTY BRANCH WAS SAYING SOMETHING FALSE, NOT MERELY SOMETHING VAGUE.** It fires
                 * on `consideredCount === 0` — no outcome RESOLVED — and it claimed no discharge date had
                 * been written down. On a ward where every admission carries a planned date and nobody has
                 * left yet, that is untrue, and it is the reading a coordinator acts on: it says the
                 * planning has not happened.
                 *
                 * ⚠️ **AND IT DROPPED `moved` ENTIRELY.** A ward with no resolved outcome and eight revised
                 * dates published neither figure. An unresolved outcome is not a reason to withhold a
                 * measure that IS resolved, so the revision count now stands on its own in both branches.
                 *
                 * `tests/ward-statistics-discharge-date-populations.dom.test.tsx` holds all three as
                 * properties rather than wordings — reword this freely, it stays green.
                 */}
                <p className={styles.body} data-testid="ward-stat-discharge-outcomes">
                  {statistics.dischargeDateOutcomes.consideredCount === 0 ? (
                    <>
                      No discharge date on this ward can be judged yet: judging one needs a date written down and the
                      person to have since left, and no admission here has both.
                    </>
                  ) : (
                    <>
                      Of {statistics.dischargeDateOutcomes.consideredCount} whose date can be judged — written down, and
                      the person has since left — {statistics.dischargeDateOutcomes.met} met and{" "}
                      {statistics.dischargeDateOutcomes.missed} missed.
                    </>
                  )}{" "}
                  {statistics.dischargeDateOutcomes.moved === 0 ? (
                    <>No admission on this ward has had its discharge date revised.</>
                  ) : (
                    <>
                      Separately, {statistics.dischargeDateOutcomes.moved}{" "}
                      {statistics.dischargeDateOutcomes.moved === 1
                        ? "admission on this ward has"
                        : "admissions on this ward have"}{" "}
                      had a discharge date revised at least once.
                    </>
                  )}
                </p>
              </div>
            </WardPanel>
            <WardPanel
              title="Clinically ready, not yet gone"
              testId="ward-statistics-ward-ready"
              dataTabSection="ready"
            >
              <div className={styles.panelBody} role="group" aria-label="Clinically ready content" tabIndex={0}>
                {/*
                 * 🔴 **THE DRAWING'S SECTION, AND ITS NAME IS LOAD-BEARING.** "Clinically ready, not yet
                 * gone" says whose readiness this is: a PATIENT ready to leave, not a BED ready to fill.
                 * The two senses of "ready" live on this very screen — the capacity panel above uses the
                 * bed sense — and the reason list beneath settles which one this is, since every entry
                 * describes something the discharge is waiting on.
                 */}
                <section data-testid="ward-stat-ready-section">
                  <div className={pageStyles.readyKpiBand}>
                    <p className={`${styles.body} ${pageStyles.readyHeadline}`} data-testid="ward-stat-ready-blocked">
                      <span className={pageStyles.kpiLabel}>Clinically ready, not yet gone</span>
                      {/*
                       * 🔴 **NOUGHT MEANS NO BLOCKER WAS RECORDED, NOT THAT NOBODY IS BLOCKED.**
                       * `readyToLeaveCannot` counts live admissions where `blockReason !== null`
                       * (`ward-statistics.ts:113`), and `Admission.blockReason` is `BedReleaseBlocker | null`
                       * (`ward-admissions.ts:485`) — **two states, not three.** So `null` cannot separate
                       * *"nothing is holding this discharge up"* from *"nobody wrote one down"*, and the
                       * empty state said the first.
                       *
                       * ⚠️ **THE RECORD ITSELF ALREADY REFUSES THIS COLLAPSE ELSEWHERE.**
                       * `Admission.followUp` is deliberately three-state, and its own comment gives the
                       * reason: *"a boolean here would collapse 'nobody arranged anything' into 'nobody wrote
                       * it down'."* Same record, same trap, opposite treatment.
                       *
                       * ⚠️ **And the else-branch three lines down was ALREADY CORRECT** — *"each with a blocker
                       * recorded against it"* says exactly what is known. **The asymmetry sat inside one
                       * paragraph**, which is why nothing looked wrong: the half that is read when there IS
                       * something to report was honest, and the half read when there is not was a claim about
                       * the ward rather than about the record.
                       */}
                      {headlineTotal === 0 ? (
                        <>
                          <strong className={pageStyles.kpiValue}>0</strong>
                          <span>No admission on this ward that has not departed carries a blocker.</span>
                        </>
                      ) : (
                        <>
                          <strong className={pageStyles.kpiValue}>{headlineTotal}</strong>
                          <span>
                            {headlineTotal === 1 ? "admission" : "admissions"} on this ward that{" "}
                            {headlineTotal === 1 ? "has" : "have"} not departed{" "}
                            {headlineTotal === 1 ? "carries" : "carry"} a blocker.
                          </span>
                        </>
                      )}
                    </p>

                    {/*
                     * 🔴 **THE SHARE, AND WHY IT IS A FIGURE RATHER THAN A NUMBER.** A ward with nobody on it
                     * has no denominator — `0 of 0` is undefined — while a ward with patients and no blockers
                     * has a share and it is a true nought. **Rendering both as "0%" would destroy exactly the
                     * distinction this family exists to keep**, so the derivation returns a `StatisticsFigure`
                     * and the unmeasured case says what it is instead of showing a number.
                     */}
                    <p
                      className={`${styles.body} ${pageStyles.readyShare}`}
                      data-testid="ward-stat-ready-share"
                      data-unmeasured={ready !== null && isUnmeasured(ready.shareOfWard) ? "" : undefined}
                    >
                      <span className={pageStyles.kpiLabel}>Share of the ward</span>
                      {ready === null ? (
                        <span>
                          The share of the ward could not be worked out, for the same reason the breakdown below could
                          not.
                        </span>
                      ) : ready.shareOfWard.kind === "measured" ? (
                        <>
                          <strong className={pageStyles.kpiValue}>{figureText(ready.shareOfWard)}%</strong>
                          <span>
                            of the {ready.population} {ready.population === 1 ? "patient" : "patients"} on this ward who{" "}
                            {ready.population === 1 ? "has" : "have"} not departed.
                          </span>
                        </>
                      ) : (
                        <span>No share can be stated: {figureText(ready.shareOfWard)}.</span>
                      )}
                    </p>
                  </div>

                  {/*
                   * ⚠️ **THE RECORDED REASONS, AND THEY ARE THE MODEL'S EIGHT, NOT THE DRAWING'S THREE.**
                   * The drawing's example data names *"Funding or plan decision pending"* — a concept
                   * `BED_RELEASE_BLOCKERS` refuses on a recorded decision ("Guardianship and financial
                   * arrangements stay excluded ... Adding any further entry remains a recorded product
                   * decision, never an implementer's convenience"). 🔴 **Widening that list to match a
                   * drawing is exactly the convenience the comment forbids**, so the difference is handed
                   * back rather than coded around.
                   *
                   * Rows are generated from the tally the derivation returns, never typed out here: the row
                   * set IS the vocabulary, so a row can neither be missing nor invented.
                   */}
                  {ready === null ? (
                    <p className={styles.note} data-testid="ward-stat-blocked-by-reason-error">
                      The blocker breakdown could not be computed for this ward: {blockedByReasonError}
                    </p>
                  ) : (
                    <>
                      <p
                        className={`${styles.body} ${pageStyles.readyPopulation}`}
                        data-testid="ward-stat-blocked-by-reason-population"
                      >
                        {ready.total} {ready.total === 1 ? "blocked discharge" : "blocked discharges"} on this ward, out
                        of {ready.population} {ready.population === 1 ? "admission" : "admissions"} on this ward that
                        have not departed.
                      </p>
                      <ul
                        className={`${styles.body} ${pageStyles.reasonTable}`}
                        data-testid="ward-stat-blocked-by-reason-list"
                      >
                        {ready.tallies.map((tally) => (
                          <li key={tally.reason} data-testid={`ward-stat-blocked-by-reason-${tally.reason}`}>
                            {tally.reason}:{" "}
                            <span data-testid={`ward-stat-blocked-by-reason-${tally.reason}-count`}>{tally.count}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className={styles.note}>Clinically ready: description, not a target.</p>
                </section>

                <p className={styles.note} data-testid="ward-stat-delayed-people-not-shown">
                  A list of the people delayed, with their barriers and review times, is not recorded in Ward Flow. The
                  counts by reason above are what the records hold.
                </p>
              </div>
            </WardPanel>
            <WardPanel
              title="Referrals into this ward"
              testId="ward-statistics-ward-referrals-panel"
              dataTabSection="flow"
            >
              <div className={styles.panelBody} role="group" aria-label="Ward referrals content" tabIndex={0}>
                {/*
                 * 🔴 **THREE FIGURES THAT MUST NEVER BE ADDED UP, AND THE APPROVED DRAWING ADDS THEM UP.**
                 * Its band is *Received · Accepted · Declined · Still open · Accepted share*, with **Received
                 * defined as the other three summed**. Both halves of that are unbuildable here, for two
                 * independent reasons, and only one of them is the no-history limit:
                 *
                 *     they mix tenses   `referredUnitIds` is LIVE — emptied by ACCEPT_IN_PRINCIPLE and by
                 *                       WITHDRAW_REFERRAL. `acceptedUnitId` and `declines[]` are CUMULATIVE
                 *                       and survive arrival, closure and discharge. One current figure and
                 *                       two lifetime ones; summing them adds different periods together.
                 *     they can overlap  DECLINE removes a unit from the live list and locks it out of
                 *                       nothing, so one ward can decline a movement and later accept it.
                 *                       The same movement then lands in two of these counts.
                 *
                 * ⚠️ **SO THERE IS NO TOTAL AND NO SHARE HERE, AND THAT IS THE DESIGN.** The derivation
                 * refuses to publish either; **a screen can put the defect back by summing them in JSX**, which
                 * is why `tests/ward-statistics-ward-referrals-section.dom.test.tsx` asserts the total's
                 * absence against the RENDERED page rather than trusting the derivation's own test.
                 *
                 * 🔴 **THE OVERLAP SENTENCE IS ON THE PAGE, NOT ONLY IN A DOC COMMENT.** A reader who
                 * adds two of these together is not being careless — nothing on screen tells them not to
                 * unless it is written here, and the family has already shipped *"Of 1 with a date written
                 * down, 1 met, 0 missed and 11 moved"* on a live ward page for exactly this reason.
                 *
                 * ⚠️ **THE MONTH-SCOPED VERSION THE DRAWING PUTS BESIDE THIS IS NOT HERE (D-4).** The
                 * prototype persists no history, so a "this month" figure would be true by construction and
                 * almost entirely nought — and a reader cannot tell that from a quiet ward.
                 */}
                {/*
                 * The testid sits on a SECTION wrapping heading, figures AND the overlap sentence — not on
                 * the `dl` alone. The first draft put it on the `dl`, so the test asserting the page warns
                 * about the overlap read only the three rows and could never see the warning. A guard whose
                 * subject excludes the thing it is guarding cannot pass however correct the page is.
                 */}
                <section data-testid="ward-stat-referrals">
                  <h3 className={styles.subHeading}>Referrals into this ward</h3>
                  <dl className={styles.body}>
                    <div>
                      <dt>Referrals asking this ward right now</dt>
                      <dd data-testid="ward-stat-referrals-asked">{referrals.askedAndWaiting}</dd>
                    </div>
                    <div>
                      <dt>Ever accepted by this ward</dt>
                      <dd data-testid="ward-stat-referrals-accepted">{referrals.everAccepted}</dd>
                    </div>
                    <div>
                      <dt>Ever declined by this ward</dt>
                      <dd data-testid="ward-stat-referrals-declined">{referrals.everDeclined}</dd>
                    </div>
                  </dl>
                  <p className={styles.note}>
                    One ward can decline a movement and later accept the same movement; counts may overlap.
                  </p>
                </section>
              </div>
            </WardPanel>
            <WardPanel title="Long stays" testId="ward-statistics-ward-long-stays" dataTabSection="longStay">
              <div className={styles.panelBody} role="group" aria-label="Long stays content" tabIndex={0}>
                <h3 className={styles.subHeading}>Long stays</h3>
                <p className={styles.body} data-testid="ward-stat-long-stays">
                  {statistics.longStays === 0 ? (
                    <>None. No admission on this ward has passed three months.</>
                  ) : (
                    <>
                      {statistics.longStays}{" "}
                      {statistics.longStays === 1 ? "admission on this ward has" : "admissions on this ward have"} been
                      here longer than three months.
                    </>
                  )}
                </p>
              </div>
            </WardPanel>
          </div>
        </div>

        <WardPanel title="Data provenance and limits" testId="ward-statistics-ward-governance" dataTabSection="common">
          <div
            className={styles.panelBody}
            role="group"
            aria-label="Ward data provenance and limits content"
            tabIndex={0}
          >
            <p className={styles.body}>
              <strong>Another ward:</strong>{" "}
              <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ward-chooser-link">
                Choose a different ward from the comparisons page
              </Link>{" "}
              to see the same measures for another.
            </p>

            <p className={styles.note}>
              Every figure here is invented and computed from this prototype&apos;s own state as the page renders.
            </p>
            <p className={styles.note}>
              <strong>Unsupported measures</strong>: a measure the record cannot support says so in words rather than
              showing a nought, because a nought that was never measured reads exactly like a nought that was.
            </p>
          </div>
        </WardPanel>
      </div>
    </StatisticsSectionFrame>
  );
}
