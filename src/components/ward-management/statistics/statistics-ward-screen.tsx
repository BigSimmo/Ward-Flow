"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  CalendarClock,
  ChevronDown,
  Clock,
  Download,
  FileText,
  LayoutGrid,
  ListOrdered,
  Scale,
  Search,
  Users,
} from "lucide-react";

import {
  BarList,
  Button,
  CardBody,
  ColumnChart,
  HeroStat,
  Icon,
  Menu,
  Segmented,
  SrOnly,
  StackBar,
  StatusGlyph,
  TextInput,
  buttonClass,
  durMinutes,
  tableClasses,
} from "@/components/wf";
import { figureText, isUnmeasured } from "@/components/ward-management/statistics/statistics-absence";
import { dischargeDateCoverage } from "@/components/ward-management/statistics/statistics-ward-discharge-dates";
import { readyNotYetGone, type ReadyNotYetGone } from "@/components/ward-management/statistics/statistics-ward-ready";
import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";
import {
  statisticsSectionById,
  STATISTICS_COMPARE_HREF,
  STATISTICS_UNIT_CHOOSER_HREF,
  STATISTICS_WARDS_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { STAY_BANDS, stayBand, type Admission } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { MINUTES_PER_DAY, dayOf, splitDuration } from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";

import { countAxisMax } from "./statistics-axis";
import { StatisticsBedMap, StatisticsBedMapLegend, bedMapCells } from "./statistics-bed-map";
import { dateOf, fromToday, weekdayOf } from "./statistics-dates";
import { csvCell } from "./statistics-csv";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { HeroTool, UnitStepper } from "./statistics-hero-tools";
import { FlushRow, FlushStack, Follow } from "./statistics-layout";
import { useOptionalRouter } from "./statistics-nav";
import { occupiedBeds } from "./statistics-occupancy";
import styles from "./statistics-v6.module.css";
import ward from "./statistics-ward.module.css";

/**
 * ONE WARD IN DETAIL — the per-ward statistics page.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO.** Not a crash, and — worse — not an
 * empty shell that looks like a ward with no data: "this ward has nothing to show" and "there is no
 * such ward" would render identically. This screen never falls back to a different unit, and it
 * says which id it could not resolve.
 *
 * ⚠️ **AN UNMEASURABLE AVERAGE IS LEFT OFF THE PAGE, NEVER SHOWN AS A NOUGHT.** Counts are counts
 * and show their noughts; an average with nothing to average is absent.
 *
 * **Each figure is drawn once for the eye and said once in words.** The tiles and bar lists are
 * hidden from assistive technology and a sentence beside them carries the same figure, so a
 * screen reader hears "2 admissions on this ward carry a blocker" rather than a bare "2".
 *
 * **The unit comes from the provider's live `units`**, never from `unitById()`, which is what
 * `tests/ward-flow-single-source.test.ts` requires of every screen.
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
  const live = useStatisticsLive();
  const { units: liveUnits, admissions: liveAdmissions, movements, bedReleases, leaveBeds } = live.state;
  const now = live.now;
  const { dayZero } = useWardFlow();
  const units = unitsOverride ?? liveUnits;
  const admissions = admissionsOverride ?? liveAdmissions;
  const unit = units.find((candidate) => candidate.id === unitId);

  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  if (!unit) {
    return (
      <StatisticsPage
        section={section}
        navSection="ward"
        testId="ward-statistics-ward-screen"
        title="Ward not found"
        eyebrowLabel="Ward statistics"
        now={now}
        paused={live.paused}
        onTogglePause={live.togglePause}
      >
        <StatCard icon={BedDouble} title="No such ward">
          <CardBody className={styles.bodyStack}>
            <p data-testid="ward-statistics-ward-unresolved">
              No ward in this prototype has the id <code className={ward.unresolvedId}>{unitId}</code>. It may have been
              renamed or removed, or the id in the address may be wrong. This page never falls back to a different ward,
              because a page showing the wrong ward under the right heading is worse than a page showing nothing.
            </p>
            <p>
              <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ward-chooser-link">
                Choose a ward from the comparisons page
              </Link>{" "}
              to reach one that does exist.
            </p>
          </CardBody>
        </StatCard>
      </StatisticsPage>
    );
  }

  const site = siteByCode(unit.siteCode);
  const statistics = wardStatistics(unit.id, admissions, now);
  const capacity = unitCapacity(unit, bedReleases);
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const openBeds = openBedsNow(unit, bedReleases);
  const states = bedStates(unit, admissions, bedReleases, leaveBeds);
  const bedMap = bedMapCells(unit, admissions, bedReleases, leaveBeds, now);
  const wardOccupancy = occupiedBeds([unit], admissions, bedReleases, leaveBeds);
  const occupancyPct = unit.beds > 0 ? Math.round((wardOccupancy.occupied / unit.beds) * 100) : 0;
  const referrals = wardReferralTally(movements, unit.id);

  let ready: ReadyNotYetGone | null = null;
  let blockedByReasonError: string | null = null;
  try {
    ready = readyNotYetGone(admissions, unit.id);
  } catch (error) {
    blockedByReasonError = error instanceof Error ? error.message : String(error);
  }
  const headlineTotal = ready === null ? statistics.readyToLeaveCannot : ready.total;

  // Someone a bed has been pulled for is not on the ward yet, so is not one of its patients.
  const dischargeDates = dischargeDateCoverage(
    admissions.filter((admission) => admission.state !== "pulled"),
    unit.id,
  );

  const current = admissions.filter((admission) => admission.unitId === unit.id && admission.state !== "departed");
  const today = dayOf(now);
  const dueByDay = Array.from({ length: 7 }, (_, offset) => ({
    offset,
    count: current.filter(
      (admission) =>
        admission.state !== "pulled" &&
        admission.expectedDischargeAt !== null &&
        admission.expectedDischargeAt >= now &&
        dayOf(admission.expectedDischargeAt) === today + offset,
    ).length,
  }));
  const dueThisWeek = dueByDay.reduce((sum, day) => sum + day.count, 0);

  const oldestPulled = current
    .filter((admission) => admission.state === "pulled" && admission.pulledAt !== null && admission.pulledAt <= now)
    .reduce<number | null>((oldest, admission) => {
      const waited = now - (admission.pulledAt ?? now);
      return oldest === null || waited > oldest ? waited : oldest;
    }, null);

  const cohortLabel = unit.cohort === "Adult" ? (unit.lockedBeds > 0 ? "Adult secure" : "Adult open") : unit.cohort;
  const averageStay = statistics.averageLengthOfStayDays;

  return (
    <StatisticsPage
      section={section}
      navSection="ward"
      slug={unit.id}
      testId="ward-statistics-ward-screen"
      title={unit.name}
      titleAction={
        <span className={ward.titleTools}>
          <ChangeWard units={units} currentId={unit.id} />
          <UnitStepper
            noun="ward"
            currentId={unit.id}
            items={units.map((each) => ({ id: each.id, href: wardStatisticsHref(each.id), label: each.name }))}
          />
        </span>
      }
      tools={
        <>
          <HeroTool
            href={STATISTICS_WARDS_HREF}
            icon={<ListOrdered size={14} aria-hidden="true" />}
            testId="ward-statistics-ward-all-wards"
          >
            All wards
          </HeroTool>
          <HeroTool
            href={STATISTICS_COMPARE_HREF}
            icon={<Scale size={14} aria-hidden="true" />}
            testId="ward-statistics-ward-compare"
          >
            Compare
          </HeroTool>
        </>
      }
      eyebrowLabel="Ward statistics"
      eyebrowDetail={
        <span data-testid="ward-statistics-ward-identity">
          <span data-testid="ward-statistics-ward-site">{site?.name ?? "Hospital not recorded"}</span>
          {` · ${cohortLabel}`}
        </span>
      }
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      stats={
        <>
          <HeroStat value={unit.beds} label="Beds" />
          <HeroStat value={wardOccupancy.occupied} label={`${occupancyPct}% occupied`} />
          <HeroStat
            value={wardOccupancy.pulled}
            label={
              <span className={styles.flagged}>
                {wardOccupancy.pulled > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                Pulled, not arrived
              </span>
            }
          />
          <HeroStat value={<span data-testid="ward-stat-capacity-ready">{capacity.available}</span>} label="Ready" />
          {averageStay === null ? null : <HeroStat value={`${averageStay}d`} label="Average stay" />}
          <HeroStat value={dueThisWeek} label="Due out, 7 days" />
        </>
      }
    >
      {/* Direction A: the bed map and its two charts beside the bed figures. Each column's last card
          (or the chart row) takes the spare height, so both columns end on the same line. */}
      <FlushRow layout="lead2" data-testid="ward-statistics-ward-measures">
        <FlushStack>
          <StatCard
            icon={LayoutGrid}
            title="Bed map"
            aside={`${unit.beds} beds`}
            id="ward-bed-map"
            data-testid="ward-statistics-ward-bed-map-card"
          >
            <CardBody className={styles.bodyStack}>
              <StatisticsBedMapLegend counts={bedMap.counts} />
              <StatisticsBedMap map={bedMap} wardName={unit.name} />
            </CardBody>
          </StatCard>
          <FlushRow layout="halves" className={ward.chartRow}>
            <StayCard current={current} now={now} averageStay={averageStay} longStays={statistics.longStays} />
            <StatCard icon={CalendarClock} title="Expected discharges" id="ward-discharges">
              <CardBody className={styles.bodyStack}>
                <p className={ward.headFigure}>Next 7 days</p>
                <ColumnChart
                  label="Expected discharges by day, next 7 days"
                  columns={dueByDay.map((day) => ({
                    id: String(day.offset),
                    label: day.offset === 0 ? "Today" : weekdayOf(now + day.offset * MINUTES_PER_DAY, dayZero),
                    value: day.count,
                  }))}
                />
              </CardBody>
            </StatCard>
          </FlushRow>
        </FlushStack>

        <FlushStack>
          <StatCard
            icon={BedDouble}
            title="Beds now"
            aside={`${unit.beds} beds`}
            id="ward-beds"
            data-testid="ward-statistics-ward-beds-now"
          >
            <CardBody className={styles.bodyStack}>
              <div>
                <StackBar
                  label={`${unit.name} beds by state`}
                  segments={[
                    { id: "ready", label: BED_STATE_LABELS.ready, value: states.ready, fill: "ready" },
                    { id: "pulled", label: BED_STATE_LABELS.pulled, value: states.pulled, hatch: true },
                    { id: "closed", label: BED_STATE_LABELS.closed, value: states.closed, fill: "closed" },
                    { id: "occupied", label: BED_STATE_LABELS.occupied, value: states.occupied, fill: "data-1" },
                  ]}
                />
                <p className={ward.stateLine} aria-hidden="true">
                  <span>{states.ready} ready</span>
                  <span>{states.pulled} pulled</span>
                  <span>{states.closed} closed</span>
                  <span className={ward.stateLineEnd}>
                    {states.occupied} occupied{states.onLeave > 0 ? `, ${states.onLeave} on leave` : ""}
                  </span>
                </p>
              </div>
              <dl className={styles.tiles} aria-label="Current bed figures">
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>Empty</dt>
                  <dd className={styles.tileValue} data-testid="ward-stat-capacity-empty">
                    {unit.empty.value}
                  </dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>Allocatable</dt>
                  <dd className={styles.tileValue} data-testid="ward-stat-capacity-allocatable">
                    {unit.allocatable.value}
                    {unit.allocatable.value === 0 && <small>no free bed</small>}
                  </dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>Open now</dt>
                  <dd className={styles.tileValue}>{openBeds}</dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>Pending</dt>
                  <dd className={styles.tileValue} data-testid="ward-stat-capacity-pending-preparation">
                    {pendingPreparation}
                  </dd>
                </div>
              </dl>
              {oldestPulled === null ? null : (
                <p className={ward.factLine}>
                  <span className={styles.flagged}>
                    <StatusGlyph tone="warning" size={9} />
                    Oldest pulled bed
                  </span>
                  <span>
                    <b>{durMinutes(oldestPulled)}</b> not arrived
                  </span>
                </p>
              )}
            </CardBody>
          </StatCard>

          <StatCard
            icon={FileText}
            title="Discharge planning"
            aside="Not departed"
            id="ward-planning"
            data-testid="ward-statistics-ward-discharge-planning"
          >
            <CardBody className={styles.bodyStack}>
              <dl className={styles.figures} data-testid="ward-stat-discharge-date-coverage">
                <div className={styles.figure}>
                  <dd className={styles.figureValue} data-testid="ward-stat-discharge-date-recorded">
                    {dischargeDates.recorded}
                  </dd>
                  <dt className={styles.figureLabel}>With a date</dt>
                </div>
                <div className={styles.figure}>
                  <dd className={styles.figureValue} data-testid="ward-stat-discharge-date-not-recorded">
                    {dischargeDates.notRecorded}
                  </dd>
                  <dt className={styles.figureLabel}>
                    {dischargeDates.notRecorded > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                    No date
                  </dt>
                </div>
                <div className={styles.figure}>
                  <dd
                    className={styles.figureValue}
                    data-testid="ward-stat-discharge-date-share"
                    data-unmeasured={isUnmeasured(dischargeDates.shareRecorded) ? "" : undefined}
                  >
                    {dischargeDates.shareRecorded.kind === "measured" ? (
                      <>
                        {figureText(dischargeDates.shareRecorded)}%
                        <small className={ward.figureSub}>Of {dischargeDates.population} here</small>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">none</span>
                        <SrOnly>{`No share can be stated, ${figureText(dischargeDates.shareRecorded)}.`}</SrOnly>
                      </>
                    )}
                  </dd>
                  <dt className={styles.figureLabel}>Share with a date</dt>
                </div>
              </dl>
              <div data-testid="ward-stat-discharge-outcomes">
                <SrOnly>
                  {statistics.dischargeDateOutcomes.consideredCount === 0 ? (
                    <>No resolved discharge dates.</>
                  ) : (
                    <>
                      Of {statistics.dischargeDateOutcomes.consideredCount} whose date can be judged, written down and
                      the person has since left, {statistics.dischargeDateOutcomes.met} met and{" "}
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
                </SrOnly>
                <div className={styles.tiles} aria-hidden="true">
                  <div className={styles.tile}>
                    <span className={styles.tileLabel}>Dates met</span>
                    <span className={styles.tileValue}>
                      {statistics.dischargeDateOutcomes.consideredCount === 0
                        ? "none yet"
                        : `${statistics.dischargeDateOutcomes.met} of ${statistics.dischargeDateOutcomes.consideredCount}`}
                    </span>
                  </div>
                  <div className={styles.tile}>
                    <span className={styles.tileLabel}>Revised</span>
                    <span className={styles.tileValue}>{statistics.dischargeDateOutcomes.moved}</span>
                  </div>
                  <div className={styles.tile}>
                    <span className={styles.tileLabel}>Ready, not gone</span>
                    <span className={styles.tileValue}>{headlineTotal}</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </StatCard>
        </FlushStack>
      </FlushRow>

      <FlushRow layout="halves">
        <StatCard
          icon={Users}
          title="Referrals into ward"
          aside="Ever, this ward"
          id="ward-referrals"
          data-testid="ward-statistics-ward-referrals-panel"
        >
          <CardBody className={styles.bodyStack}>
            <section data-testid="ward-stat-referrals" aria-label="Referrals into this ward">
              <dl className={styles.figures}>
                <div className={styles.figure}>
                  <dd className={styles.figureValue} data-testid="ward-stat-referrals-asked">
                    {referrals.askedAndWaiting}
                  </dd>
                  <dt className={styles.figureLabel}>Asking now</dt>
                </div>
                <div className={styles.figure}>
                  <dd className={styles.figureValue} data-testid="ward-stat-referrals-accepted">
                    {referrals.everAccepted}
                  </dd>
                  <dt className={styles.figureLabel}>Ever accepted</dt>
                </div>
                <div className={styles.figure}>
                  <dd className={styles.figureValue} data-testid="ward-stat-referrals-declined">
                    {referrals.everDeclined}
                  </dd>
                  <dt className={styles.figureLabel}>
                    <StatusGlyph tone="closed" size={9} />
                    Ever declined
                  </dt>
                </div>
              </dl>
              <SrOnly>
                Asking now counts referrals waiting on this ward right now. Ever accepted and ever declined count every
                referral since records began, and one movement can appear in both, so the three do not add up.
              </SrOnly>
            </section>
            {statistics.averageEmptyBedMinutes !== null || statistics.emptyBedIncoherentCount > 0 ? (
              <div data-testid="ward-statistics-ward-admissions-discharges">
                <h3 className={ward.subHead}>Pull to arrival</h3>
                <div className={styles.tiles}>
                  <div className={styles.tile} data-testid="ward-stat-empty-bed-minutes">
                    <span className={styles.tileLabel}>Average</span>
                    {statistics.averageEmptyBedMinutes === null ? (
                      <span className={styles.tileValue}>
                        <span aria-hidden="true">none</span>
                        <SrOnly>
                          No bed on this ward has a usable pair of instants, a bed given away and a person arriving,
                          with the arrival not earlier than the pull, so there is no empty stretch to average.
                        </SrOnly>
                      </span>
                    ) : (
                      <span className={styles.tileValue}>{splitDuration(statistics.averageEmptyBedMinutes)}</span>
                    )}
                  </div>
                  <div className={styles.tile}>
                    <span className={styles.tileLabel}>Shortest</span>
                    <span className={styles.tileValue} data-testid="ward-stat-empty-bed-shortest">
                      {statistics.emptyBedMinutesShortest === null
                        ? "none"
                        : splitDuration(statistics.emptyBedMinutesShortest)}
                    </span>
                  </div>
                  <div className={styles.tile}>
                    <span className={styles.tileLabel}>Longest</span>
                    <span className={styles.tileValue} data-testid="ward-stat-empty-bed-longest">
                      {statistics.emptyBedMinutesLongest === null
                        ? "none"
                        : splitDuration(statistics.emptyBedMinutesLongest)}
                    </span>
                  </div>
                  <div className={styles.tile} data-testid="ward-stat-empty-bed-incoherent">
                    <span className={styles.tileLabel}>Excluded</span>
                    <span className={styles.tileValue}>{statistics.emptyBedIncoherentCount}</span>
                    <SrOnly>
                      {statistics.emptyBedIncoherentCount === 1
                        ? "admission on this ward records"
                        : "admissions on this ward record"}{" "}
                      an arrival earlier than the bed was given away.
                      {statistics.emptyBedIncoherentCount > 0
                        ? ` That cannot be true, so ${statistics.emptyBedIncoherentCount === 1 ? "it is" : "they are"} excluded from the average and counted here instead.`
                        : ""}
                    </SrOnly>
                  </div>
                </div>
              </div>
            ) : null}
          </CardBody>
        </StatCard>
        <Follow className={ward.followShort}>
          <Barriers ready={ready} error={blockedByReasonError} headlineTotal={headlineTotal} />
        </Follow>
      </FlushRow>

      <Roster unit={unit} current={current} now={now} dayZero={dayZero} leaveBeds={leaveBeds} />
    </StatisticsPage>
  );
}

/** Whole days since arrival, or null when the person has not arrived (or the record says later). */
function stayDaysOf(admission: Admission, now: number): number | null {
  if (admission.arrivedAt === null || admission.arrivedAt > now) return null;
  return Math.floor((now - admission.arrivedAt) / MINUTES_PER_DAY);
}

function ChangeWard({ units, currentId }: { units: Unit[]; currentId: string }) {
  const router = useOptionalRouter();
  return (
    <Menu
      label="Change ward"
      items={units.map((candidate) => ({
        id: candidate.id,
        label: candidate.name,
        meta: candidate.siteCode,
        disabled: candidate.id === currentId,
        onSelect: () => {
          const href = wardStatisticsHref(candidate.id);
          if (router) router.push(href);
          else window.location.assign(href);
        },
      }))}
      trigger={(props) => (
        <button {...props} type="button" className={buttonClass({ variant: "onHero", size: "sm" })}>
          Change ward
          <Icon icon={ChevronDown} size={14} />
        </button>
      )}
    />
  );
}

function StayCard({
  current,
  now,
  averageStay,
  longStays,
}: {
  current: Admission[];
  now: number;
  averageStay: number | null;
  longStays: number;
}) {
  const bands = STAY_BANDS.map((band) => ({
    band,
    count: current.filter((admission) => stayBand(admission, now)?.id === band.id).length,
  }));
  const unrecorded = current.filter((admission) => stayBand(admission, now) === null).length;
  const [view, setView] = useState<"chart" | "data">("chart");
  return (
    <StatCard
      icon={Clock}
      title="Length of stay"
      action={
        <Segmented
          label="Length of stay view"
          value={view}
          onChange={setView}
          items={[
            { id: "chart", label: "Chart" },
            { id: "data", label: "Data" },
          ]}
        />
      }
      id="ward-stay"
      data-testid="statistics-ward-stays-chart"
    >
      <CardBody className={styles.bodyStack}>
        {averageStay === null ? null : (
          <p className={ward.headFigure}>
            Average{" "}
            <b data-testid="ward-stat-length-of-stay">
              {averageStay} {averageStay === 1 ? "day" : "days"}
            </b>
          </p>
        )}
        {view === "chart" ? (
          <BarList
            label="Current admissions by stay band"
            axis
            max={countAxisMax(bands.map((entry) => entry.count))}
            labelWidth="9rem"
            rows={bands.map(({ band, count }) => ({
              id: band.id,
              label: band.label,
              value: count,
              display: String(count),
            }))}
          />
        ) : (
          <div
            className={styles.tableWrap}
            tabIndex={0}
            role="region"
            aria-label="Admission stay bands, scrollable table"
          >
            <table className={`${tableClasses.table} ${styles.table}`}>
              <caption className={styles.srOnly}>Current admissions by stay band</caption>
              <thead>
                <tr>
                  <th scope="col">Stay band</th>
                  <th scope="col" className={styles.num}>
                    Admissions
                  </th>
                </tr>
              </thead>
              <tbody>
                {bands.map(({ band, count }) => (
                  <tr key={band.id}>
                    <th scope="row">{band.label}</th>
                    <td className={count === 0 ? `${styles.num} ${styles.muted}` : styles.num}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.srOnly} data-testid="ward-stat-long-stays">
          {longStays === 0 ? (
            <>None. No admission on this ward has passed three months.</>
          ) : (
            <>
              {longStays} {longStays === 1 ? "admission on this ward has" : "admissions on this ward have"} been here
              longer than three months.
            </>
          )}
        </p>
        {unrecorded > 0 ? (
          <p className={ward.note}>
            {unrecorded} {unrecorded === 1 ? "admission has" : "admissions have"} no recorded stay
          </p>
        ) : null}
      </CardBody>
    </StatCard>
  );
}

function Barriers({
  ready,
  error,
  headlineTotal,
}: {
  ready: ReadyNotYetGone | null;
  error: string | null;
  headlineTotal: number;
}) {
  const [show, setShow] = useState<"blocked" | "all">("blocked");
  const rows = ready === null ? [] : ready.tallies.filter((tally) => show === "all" || tally.count > 0);
  return (
    <StatCard
      icon={ListOrdered}
      title="Discharge barriers"
      id="ward-barriers"
      action={
        ready === null ? null : (
          <Segmented
            label="Discharge barriers shown"
            value={show}
            onChange={setShow}
            items={[
              { id: "blocked", label: "With blockers" },
              { id: "all", label: `All ${ready.vocabularySize}` },
            ]}
          />
        )
      }
    >
      <CardBody className={styles.bodyStack}>
        <section
          className={ward.barriers}
          data-testid="ward-stat-ready-section"
          aria-label="Clinically ready, not yet gone"
        >
          <p className={styles.srOnly} data-testid="ward-stat-ready-blocked">
            <span>Clinically ready, not yet gone</span>{" "}
            {headlineTotal === 0 ? (
              <>0. No admission on this ward that has not departed carries a blocker.</>
            ) : (
              <>
                {headlineTotal} {headlineTotal === 1 ? "admission" : "admissions"} on this ward that{" "}
                {headlineTotal === 1 ? "has" : "have"} not departed {headlineTotal === 1 ? "carries" : "carry"} a
                blocker.
              </>
            )}
          </p>
          <p
            className={ward.readyShare}
            data-testid="ward-stat-ready-share"
            data-unmeasured={ready !== null && isUnmeasured(ready.shareOfWard) ? "" : undefined}
          >
            {ready === null ? (
              <span>Share of the ward unavailable</span>
            ) : ready.shareOfWard.kind === "measured" ? (
              <>
                <b>{headlineTotal}</b> ready, not gone, <b>{figureText(ready.shareOfWard)}%</b> of the{" "}
                {ready.population} {ready.population === 1 ? "patient" : "patients"} here
              </>
            ) : (
              <span>No share can be stated, {figureText(ready.shareOfWard)}</span>
            )}
          </p>
          {ready === null ? (
            <p className={ward.note} data-testid="ward-stat-blocked-by-reason-error">
              The blocker breakdown could not be computed for this ward: {error}
            </p>
          ) : (
            <>
              <p className={styles.srOnly} data-testid="ward-stat-blocked-by-reason-population">
                {ready.total} {ready.total === 1 ? "blocked discharge" : "blocked discharges"} on this ward, out of{" "}
                {ready.population} {ready.population === 1 ? "admission" : "admissions"} on this ward that have not
                departed.
              </p>
              {rows.length === 0 ? (
                <p className={ward.note} aria-hidden="true">
                  No recorded blockers
                </p>
              ) : (
                <div aria-hidden="true">
                  <BarList
                    label="Discharge barriers"
                    axis
                    max={countAxisMax(ready.tallies.map((tally) => tally.count))}
                    labelWidth="12rem"
                    rows={rows.map((tally) => ({
                      id: tally.reason,
                      label: tally.reason.replaceAll("_", " "),
                      value: tally.count,
                      display: String(tally.count),
                    }))}
                  />
                </div>
              )}
              <ul className={styles.srOnly} data-testid="ward-stat-blocked-by-reason-list">
                {ready.tallies.map((tally) => (
                  <li key={tally.reason} data-testid={`ward-stat-blocked-by-reason-${tally.reason}`}>
                    {tally.reason}:{" "}
                    <span data-testid={`ward-stat-blocked-by-reason-${tally.reason}-count`}>{tally.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </CardBody>
    </StatCard>
  );
}

type RosterFilter = "all" | "no-date" | "long" | "blocked" | "pulled";

const ADMISSION_STATE_LABELS: Record<Admission["state"], string> = {
  waitlisted: "Waitlisted",
  pulled: "Pulled",
  occupied: "In bed",
  departed: "Departed",
};

const SEX_MARK: Record<string, string> = {
  Female: "F",
  Male: "M",
  "Another term": "Another",
  "Not recorded": "Not recorded",
};

function Roster({
  unit,
  current,
  now,
  dayZero,
  leaveBeds,
}: {
  unit: Unit;
  current: Admission[];
  now: number;
  dayZero: Date;
  leaveBeds: readonly { admissionId: string }[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");

  // The admission model records a ward, not a numbered bed: each row is a recorded admission.
  const rows = current.map((admission) => {
    const onLeave = leaveBeds.some((bed) => bed.admissionId === admission.id);
    const days = stayDaysOf(admission, now);
    return {
      admission,
      status: onLeave ? "On leave" : ADMISSION_STATE_LABELS[admission.state],
      sex: SEX_MARK[admission.sex] ?? admission.sex.toLowerCase(),
      days,
      long: stayBand(admission, now)?.id === "over-3-months",
    };
  });
  const maxDays = Math.max(1, ...rows.map((row) => row.days ?? 0));
  const counts: Record<RosterFilter, number> = {
    all: rows.length,
    "no-date": rows.filter((row) => row.admission.expectedDischargeAt === null).length,
    long: rows.filter((row) => row.long).length,
    blocked: rows.filter((row) => row.admission.blockReason !== null).length,
    pulled: rows.filter((row) => row.admission.state === "pulled").length,
  };
  const needle = query.trim().toLowerCase();
  const shown = rows.filter((row) => {
    if (filter === "no-date" && row.admission.expectedDischargeAt !== null) return false;
    if (filter === "long" && !row.long) return false;
    if (filter === "blocked" && row.admission.blockReason === null) return false;
    if (filter === "pulled" && row.admission.state !== "pulled") return false;
    if (!needle) return true;
    return `${row.admission.id} ${row.status} ${row.admission.blockReason ?? ""}`.toLowerCase().includes(needle);
  });

  function exportCsv() {
    const lines = [
      ["Synthetic admission", "Sex", "Status", "Days in bed", "Expected discharge set", "Blocker", "Date revisions"],
      ...shown.map((row) => [
        row.admission.id,
        row.sex,
        row.status,
        row.days ?? "",
        row.admission.expectedDischargeAt === null ? "No" : "Yes",
        row.admission.blockReason ?? "",
        row.admission.dischargeDateMoves,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ward-flow-synthetic-${unit.id}-roster.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <StatCard
      icon={Users}
      title="Admission roster"
      aside="Bed numbers not recorded"
      data-testid="ward-statistics-ward-roster"
    >
      <div className={styles.toolbar}>
        <TextInput
          type="search"
          icon={Search}
          boxClassName={styles.search}
          aria-label="Filter recorded admission roster"
          placeholder="Search by ID or status"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Segmented
          label="Roster filter"
          value={filter}
          onChange={setFilter}
          items={[
            { id: "all", label: "All", count: counts.all },
            { id: "no-date", label: "No date", count: counts["no-date"] },
            { id: "long", label: "Over 3 months", count: counts.long },
            { id: "blocked", label: "Blocked", count: counts.blocked },
            { id: "pulled", label: "Pulled", count: counts.pulled },
          ]}
        />
        <span className={styles.toolbarEnd}>
          <b>{shown.length}</b> of {rows.length}
        </span>
        <Button size="sm" variant="ghost" icon={Download} onClick={exportCsv} disabled={shown.length === 0}>
          CSV
        </Button>
      </div>
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Admission roster, scrollable table">
        <table className={`${tableClasses.table} ${styles.table}`}>
          <caption className={styles.srOnly}>
            Recorded admission roster; numbered bed assignments are not recorded
          </caption>
          <thead>
            <tr>
              <th scope="col">Admission</th>
              <th scope="col">Status</th>
              <th scope="col">Admitted</th>
              <th scope="col" className={styles.num}>
                Length of stay
              </th>
              <th scope="col">Discharge target</th>
              <th scope="col">Blocker</th>
              <th scope="col" className={styles.num}>
                Revised
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.muted}>
                  {rows.length === 0 ? "No current admissions recorded" : "No admissions match this search"}
                </td>
              </tr>
            ) : null}
            {shown.map((row) => {
              const { admission } = row;
              return (
                <tr key={admission.id}>
                  <th scope="row">
                    <span className={ward.admissionId}>{admission.id}</span>{" "}
                    <span className={styles.code}>{row.sex}</span>
                  </th>
                  <td>
                    <span className={ward.status}>
                      {admission.state === "pulled" ? <StatusGlyph tone="warning" size={9} /> : null}
                      {row.status === "On leave" ? <StatusGlyph tone="info" size={9} /> : null}
                      {row.status}
                    </span>
                  </td>
                  <td className={admission.arrivedAt === null ? styles.muted : undefined}>
                    {admission.arrivedAt === null ? "Not arrived" : dateOf(admission.arrivedAt, dayZero)}
                  </td>
                  <td className={styles.num}>
                    <span className={styles.occBar}>
                      <span className={styles.occTrack} aria-hidden="true">
                        {row.days === null ? null : (
                          <span className={styles.occFill} style={{ width: `${(row.days / maxDays) * 100}%` }} />
                        )}
                      </span>
                      <span className={row.days === null ? `${styles.occValue} ${styles.muted}` : styles.occValue}>
                        {row.days === null ? "none" : `${row.days}d`}
                      </span>
                    </span>
                  </td>
                  <td>
                    {admission.expectedDischargeAt === null ? (
                      <span className={styles.flagged}>
                        <StatusGlyph tone="warning" size={9} />
                        <span aria-hidden="true">No date</span>
                        <SrOnly>No discharge date set</SrOnly>
                      </span>
                    ) : (
                      <>
                        {dateOf(admission.expectedDischargeAt, dayZero)}{" "}
                        <span className={styles.muted}>{fromToday(admission.expectedDischargeAt, now)}</span>
                      </>
                    )}
                  </td>
                  <td className={admission.blockReason === null ? styles.muted : undefined}>
                    {admission.blockReason ?? "none"}
                  </td>
                  <td className={admission.dischargeDateMoves === 0 ? `${styles.num} ${styles.muted}` : styles.num}>
                    {admission.dischargeDateMoves}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </StatCard>
  );
}
