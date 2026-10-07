"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Network, Activity, Filter, X } from "lucide-react";

import { BarList, CardBody, Donut, HeroStat, Legend, Segmented, StatusGlyph, tableClasses } from "@/components/wf";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import {
  admissionStagePosition,
  refusedAndNothingPending,
  type AdmissionStagePosition,
} from "@/components/ward-management/statistics/statistics-derivations";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import { statisticsSectionById } from "@/components/ward-management/statistics/statistics-sections";
import { serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { HospitalCapacityMatrix } from "./hospital-capacity-matrix";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { axisMax } from "./statistics-axis";
import { occupiedBeds } from "./statistics-occupancy";
import styles from "./statistics-v6.module.css";

/** The five services the network reports, in the order the overview has always shown them. */
const OVERVIEW_SERVICES = [
  { id: "NMHS", name: "North Metro", service: "North Metro" },
  { id: "SMHS", name: "South Metro", service: "South Metro" },
  { id: "EMHS", name: "East Metro", service: "East Metro" },
  { id: "WACHS", name: "Country (WACHS)", service: "WACHS" },
  { id: "PRIV", name: "Private", service: "Private" },
] as const;

/** "no_specialling" reads "No specialling". */
const sentenceCase = (text: string) => {
  const spaced = text.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const wardsWord = (n: number) => (n === 1 ? "ward" : "wards");

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
  const section = statisticsSectionById("overview");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'overview' section");

  const live = useStatisticsLive();
  const { admissions, movements, bedReleases, leaveBeds, units } = live.state;
  const now = live.now;
  const service = useServiceScope();
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [stagesView, setStagesView] = useState<"chart" | "data">("chart");

  const stageTallies = admissionStageTallies(admissions);
  const declinesReadout = readDeclinesByReason(movements);
  const preparingCount = units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0);
  const openNow = units.reduce((sum, unit) => sum + openBedsNow(unit, bedReleases), 0);
  const refused = refusedAndNothingPending(movements, units, now);
  const capacity = networkCapacity(units, bedReleases);

  const occupancy = occupiedBeds(units, admissions, bedReleases, leaveBeds);
  const totalBeds = units.reduce((sum, unit) => sum + unit.beds, 0);
  const occupiedShare = totalBeds > 0 ? (occupancy.occupied / totalBeds) * 100 : 0;

  const unitRows = units.map((unit) => {
    const states = bedStates(unit, admissions, bedReleases, leaveBeds);
    const rate = unit.beds > 0 ? Math.round((states.occupied / unit.beds) * 100) : 0;
    return { unit, states, rate, service: siteByCode(unit.siteCode)?.service ?? "Other" };
  });
  const wardsOverLine = unitRows.filter((row) => row.rate >= BED_ALERT_THRESHOLD_PERCENT).length;
  const closedTotal = unitRows.reduce((sum, row) => sum + row.states.closed, 0);

  const services = OVERVIEW_SERVICES.map((entry) => {
    const rows = unitRows.filter((row) => row.service === entry.service);
    const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);
    const beds = sum((row) => row.unit.beds);
    const occupied = sum((row) => row.states.occupied);
    const ready = sum((row) => row.states.ready);
    const closed = sum((row) => row.states.closed);
    const sites = Array.from(
      new Set(rows.map((row) => shortSite(siteByCode(row.unit.siteCode)?.name ?? row.unit.siteCode))),
    );
    return {
      ...entry,
      beds,
      occupied,
      ready,
      pulled: sum((row) => row.states.pulled),
      closed,
      headroom: ready + closed,
      over: rows.filter((row) => row.rate >= BED_ALERT_THRESHOLD_PERCENT).length,
      share: beds > 0 ? occupied / beds : 0,
      hospitals: sites.length > 0 ? sites.join(", ") : "Regional units",
    };
  });

  return (
    <StatisticsPage
      section={section}
      navSection="overview"
      testId="ward-statistics-overview-screen"
      title={`${occupancy.occupied} of ${totalBeds} beds in use`}
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      stats={
        <>
          <HeroStat value={totalBeds} label="Inpatient beds" />
          <HeroStat value={occupancy.occupied} label={`${occupiedShare.toFixed(1)}% occupied`} />
          <HeroStat value={capacity.ready} label="Ready now" />
          <HeroStat value={preparingCount} label="Being made ready" />
          <HeroStat
            value={wardsOverLine}
            label={
              <span className={styles.flagged}>
                {wardsOverLine > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                {`Wards over ${BED_ALERT_THRESHOLD_PERCENT}%`}
              </span>
            }
          />
        </>
      }
    >
      {service === null ? null : (
        <p className={styles.notice} data-testid="ward-statistics-service-scope-sentence">
          {`Set to ${service}. This page is the whole network's own, so these figures already include ${service}.`}{" "}
          <Link href={serviceStatisticsHref(service)} data-testid="ward-statistics-service-scope-link">
            {`Open ${service} statistics`}
          </Link>
        </p>
      )}

      <StatCard
        icon={Network}
        title="Occupancy by health service"
        aside={
          <span className={styles.muted}>
            {`${BED_ALERT_THRESHOLD_PERCENT}% line`} · Select one to filter the table
          </span>
        }
      >
        <div className={styles.serviceGrid} data-testid="ward-statistics-overview-gauges">
          {services.map((entry) => {
            const pressed = serviceFilter === entry.service;
            return (
              <button
                key={entry.id}
                type="button"
                className={styles.serviceTile}
                aria-pressed={pressed}
                onClick={() => setServiceFilter(pressed ? null : entry.service)}
              >
                <span className={styles.serviceTop}>
                  <Donut value={entry.share} label={`${entry.name} occupancy`} />
                  <span className={styles.serviceText}>
                    <span className={styles.serviceName}>{entry.name}</span>
                    <span className={styles.serviceBeds}>
                      {entry.occupied}/{entry.beds} beds
                    </span>
                    <span className={styles.serviceOver}>
                      {entry.over === 0
                        ? `No ward over ${BED_ALERT_THRESHOLD_PERCENT}%`
                        : `${entry.over} ${wardsWord(entry.over)} over ${BED_ALERT_THRESHOLD_PERCENT}%`}
                    </span>
                  </span>
                </span>
                <span className={styles.serviceFigures}>
                  <span>
                    <b>{entry.ready}</b>
                    {BED_STATE_LABELS.ready}
                  </span>
                  <span>
                    <b>{entry.pulled}</b>
                    {BED_STATE_LABELS.pulled}
                  </span>
                  <span>
                    <b>{entry.closed}</b>
                    {BED_STATE_LABELS.closed}
                  </span>
                  <span>
                    <b>{entry.headroom}</b>
                    Headroom
                  </span>
                </span>
                <span className={styles.serviceSites}>{entry.hospitals}</span>
              </button>
            );
          })}
        </div>
      </StatCard>

      <div className={styles.gridMain}>
        <HospitalCapacityMatrix
          units={units}
          bedReleases={bedReleases}
          admissions={admissions}
          leaveBeds={leaveBeds}
          service={serviceFilter}
        />

        <div className={styles.stack}>
          <StatCard
            icon={Filter}
            title="Empty to ready"
            aside={<span className={styles.muted}>Feed vs ward</span>}
            data-testid="ward-statistics-overview-capacity-disclosure"
          >
            <CardBody className={styles.bodyStack} data-testid="ward-statistics-overview-capacity">
              <BarList
                label="Empty to ready, across the network"
                track
                labelWidth="9.5rem"
                max={Math.max(1, capacity.empty, capacity.allocatable, openNow)}
                rows={[
                  {
                    id: "empty",
                    label: "Physically empty",
                    value: capacity.empty,
                    display: <span data-testid="ward-statistics-overview-capacity-empty">{capacity.empty}</span>,
                  },
                  {
                    id: "allocatable",
                    label: "Allocatable",
                    value: capacity.allocatable,
                    display: (
                      <span data-testid="ward-statistics-overview-capacity-allocatable">{capacity.allocatable}</span>
                    ),
                  },
                  { id: "open", label: "Open for placement", value: openNow },
                ]}
              />
              <Legend
                className={styles.legendEnd}
                items={[
                  {
                    id: "ready",
                    fill: "ready",
                    label: (
                      <>
                        <span data-testid="ward-statistics-overview-capacity-ready">{capacity.ready}</span> ready
                      </>
                    ),
                  },
                  { id: "closed", fill: "closed", label: `${closedTotal} closed` },
                  { id: "pending", fill: "data-1", label: `${preparingCount} pending` },
                ]}
              />
            </CardBody>
          </StatCard>

          <StatCard
            icon={Activity}
            title="Admission stages"
            action={
              <Segmented
                size="sm"
                label="Admission stages view"
                value={stagesView}
                onChange={setStagesView}
                items={[
                  { id: "chart", label: "Chart" },
                  { id: "data", label: "Data" },
                ]}
              />
            }
            data-testid="statistics-overview-stages-chart"
          >
            {stagesView === "chart" ? (
              <CardBody>
                <BarList
                  label="Admissions by stage"
                  axis
                  max={axisMax(stageTallies.map((stage) => stage.count))}
                  labelWidth="10.5rem"
                  rows={stageTallies.map((stage) => ({
                    id: stage.position,
                    label: stage.label,
                    value: stage.count,
                  }))}
                />
              </CardBody>
            ) : (
              <div className={styles.tableWrap}>
                <table
                  className={`${tableClasses.table} ${styles.table}`}
                  data-testid="ward-statistics-overview-stage-table"
                >
                  <caption className={styles.srOnly}>Admissions by stage, synthetic</caption>
                  <thead>
                    <tr>
                      <th scope="col">Stage</th>
                      <th scope="col" className={styles.num}>
                        Admissions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageTallies.map((tally) => (
                      <tr key={tally.position}>
                        <th scope="row">{tally.label}</th>
                        <td className={styles.num} data-testid={`ward-statistics-overview-stage-${tally.position}`}>
                          {tally.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">All stages</th>
                      <td className={styles.num}>{admissions.length}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </StatCard>

          {/*
           * ⚠️ **A SENTENCE WAS DELETED FROM THIS PARAGRAPH ON 2026-09-01 AND MAY NOT COME BACK.** It told the
           * reader this page could not be reached from the statistics hub, and that the linking index was work
           * still to be done. It is described here rather than quoted back word for word, so the retired
           * wording exists nowhere in the tree and no scan can mistake this record for a relapse.
           *
           * It was TRUE the day it was written and FALSE within the same session, when the hub index landed:
           * `STATISTICS_SECTIONS` in `statistics-sections.ts` makes `STATISTICS_OVERVIEW_HREF` its first entry,
           * and the v6 hero track on every statistics page links it. So a reader who arrived here by that link
           * was being told the navigation they had just used does not exist.
           *
           * **There is no corrected wording, which is why this is a deletion and not a rewrite.** The absence the
           * sentence described no longer obtains, so the conclusion falls with the reason.
           * `tests/ward-statistics-sections.dom.test.tsx` asserts the old wording cannot return.
           */}
          <StatCard
            icon={X}
            title="Declines by reason"
            data-testid="ward-statistics-overview-declines"
            aside={
              declinesReadout.ok ? (
                <span className={styles.muted}>
                  {declinesReadout.value.totalCount} {declinesReadout.value.totalCount === 1 ? "decline" : "declines"}
                </span>
              ) : (
                <span className={styles.muted}>Unavailable</span>
              )
            }
          >
            <CardBody>
              {!declinesReadout.ok ? (
                <p className={styles.notice} data-testid="ward-statistics-overview-declines-unavailable">
                  {declinesReadout.statement}
                </p>
              ) : (
                <div data-testid="ward-statistics-overview-declines-table">
                  <p className={styles.srOnly} data-testid="ward-statistics-overview-declines-population">
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
                    {declinesReadout.value.movementCount === 1 ? "movement" : "movements"} this page examined, across{" "}
                    <span data-testid="ward-statistics-overview-declines-vocabulary-size">
                      {declinesReadout.value.vocabularySize}
                    </span>{" "}
                    reason categories.
                  </p>
                  <BarList
                    label="Declines by reason across the network"
                    axis
                    max={axisMax(declinesReadout.value.tallies.map((tally) => tally.count))}
                    labelWidth="10.5rem"
                    mean={
                      declinesReadout.value.vocabularySize > 0
                        ? declinesReadout.value.totalCount / declinesReadout.value.vocabularySize
                        : 0
                    }
                    rows={declinesReadout.value.tallies.map((tally) => ({
                      id: tally.reason,
                      label: sentenceCase(tally.reason),
                      value: tally.count,
                      display: (
                        <span data-testid={`ward-statistics-overview-decline-${tally.reason}`}>
                          {tally.count === 0 ? "none" : tally.count}
                        </span>
                      ),
                    }))}
                  />
                </div>
              )}
            </CardBody>
          </StatCard>

          <StatCard
            icon={Clock}
            title="Awaiting a decision"
            data-testid="ward-statistics-overview-worklist"
            aside={
              <span className={styles.muted}>
                of{" "}
                <span data-testid="ward-statistics-overview-refused-so-far-open-count">
                  {refused.openMovementCount}
                </span>{" "}
                open {refused.openMovementCount === 1 ? "movement" : "movements"}
              </span>
            }
          >
            <CardBody>
              <dl className={styles.tiles}>
                <div className={styles.tile} data-testid="ward-statistics-overview-refused-so-far-count">
                  <dt className={styles.tileLabel}>All refused</dt>
                  <dd className={styles.tileValue} data-testid="ward-statistics-overview-refused-so-far-value">
                    {refused.count}
                  </dd>
                </div>
                <div className={styles.tile} data-testid="ward-statistics-overview-preparing-count">
                  <dt className={styles.tileLabel}>
                    <StatusGlyph tone="neutral" size={9} />
                    Pending
                  </dt>
                  <dd className={styles.tileValue} data-testid="ward-statistics-overview-preparing-value">
                    {preparingCount}
                  </dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>
                    <StatusGlyph tone="warning" size={9} />
                    Escalated
                  </dt>
                  <dd className={styles.tileValue} data-testid="ward-statistics-overview-refused-so-far-escalated">
                    {refused.escalatedCount}
                  </dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>Placeable</dt>
                  <dd className={styles.tileValue}>{openNow}</dd>
                </div>
              </dl>
            </CardBody>
          </StatCard>
        </div>
      </div>
    </StatisticsPage>
  );
}

/** "Sir Charles Gairdner Hospital" reads "Sir Charles Gairdner" in a service's hospital list. */
function shortSite(name: string): string {
  return name.replace(/ (Memorial |General |Public )?(Hospital|Health Campus|Health Service)$/, "");
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
