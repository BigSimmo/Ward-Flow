"use client"; // Forked from src/components/ward-redesign/statistics-unit/statistics-unit-redesign.tsx (role view: nurse in charge).

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  BedDouble,
  Building2,
  CalendarClock,
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
  PhoneListRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  durMinutes,
  cx,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import { useCanOpenHref, useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import {
  cannotBeFormed,
  measured,
  figureText,
  isUnmeasured,
} from "@/components/ward-management/statistics/statistics-absence";
import { dischargeDateCoverage } from "@/components/ward-management/statistics/statistics-ward-discharge-dates";
import { readyNotYetGone, type ReadyNotYetGone } from "@/components/ward-management/statistics/statistics-ward-ready";
import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";
import {
  statisticsSectionById,
  STATISTICS_COMPARE_HREF,
  STATISTICS_WARDS_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
// D-91: the one unit finder, on the Summary page (Compare's chooser is gone).
import { STATISTICS_UNIT_FINDER_HREF } from "@/components/ward-redesign/statistics/statistics-view-switch";
import { unitHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { STAY_BANDS, stayBand, type Admission } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { MINUTES_PER_DAY, dayOf, splitDuration, formatSheetMoment } from "@/components/ward-management/ward-clock";
import { SMALL_NUMBER_NOT_SHOWN } from "@/components/ward-management/ward-access-scope";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";

import { countAxisMax } from "@/components/ward-management/statistics/statistics-axis";
import {
  BED_MAP_LABELS,
  StatisticsBedMap,
  StatisticsBedMapLegend,
  bedMapCells,
  type BedMap,
} from "@/components/ward-management/statistics/statistics-bed-map";
import {
  PhoneBody,
  PhoneList,
  PhonePinnedAction,
  phoneBodyStyles as phone,
} from "@/components/ward-management/statistics/statistics-phone-parts";
import { dateOf, fromToday, isPastDate, weekdayOf } from "@/components/ward-management/statistics/statistics-dates";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";
import { StatCard, StatisticsPage, useStatisticsLive } from "@/components/ward-management/statistics/statistics-hero";
import { HeroTool, UnitStepper } from "@/components/ward-management/statistics/statistics-hero-tools";
import { FlushRow, FlushStack } from "@/components/ward-management/statistics/statistics-layout";
import { occupancyPercent, occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  sumStatisticsCounts,
  type StatisticsCount,
  PeopleNotListed,
  withheldBar,
} from "@/components/ward-management/statistics/statistics-small-numbers";
import styles from "@/components/ward-management/statistics/statistics-v6.module.css";
import { ShowMoreRow } from "@/components/ward-redesign/parts/show-more-row";
import redesign from "@/components/ward-redesign/statistics-unit/statistics-unit.module.css";
import { CompactBedMap } from "@/components/ward-redesign/statistics-unit/statistics-unit-bed-map";
import { ChangeWard } from "@/components/ward-redesign/statistics-unit/statistics-unit-change-ward";
import ward from "@/components/ward-management/statistics/statistics-ward.module.css";
import beds from "./ward-phone-beds.module.css";

import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import type { WardDetailModel, ReadyView } from "@/components/ward-management/statistics/statistics-wards-index";

type WardSlots = { phone: ReactNode; bedMap: ReactNode; stay: ReactNode; roster: ReactNode };
const exact = exactStatisticsCount;
const positive = (count: StatisticsCount) => exact(count) !== 0;
const share = (numerator: StatisticsCount, denominator: StatisticsCount) => {
  const n = exact(numerator),
    d = exact(denominator);
  return n === null || d === null
    ? cannotBeFormed("not shown")
    : d === 0
      ? cannotBeFormed("no patients on this ward to divide by")
      : measured(Math.round((n / d) * 1000) / 10);
};
/** Preview only: a fork of `StatisticsWardScreen` with the compact bed map and the rebalanced columns. */
export function StatisticsUnitRedesign(props: { unitId: string; units?: Unit[]; admissions?: Admission[] }) {
  const control = useExecutiveStatisticsControl();
  const access = useEffectiveWardAccess();
  return control.executive || access.role === "executive" ? (
    <ExecutiveWardScreen unitId={props.unitId} />
  ) : (
    <OperationalWardScreen {...props} />
  );
}
function ExecutiveWardScreen({ unitId }: { unitId: string }) {
  const data = useExecutiveStatistics();
  const control = useExecutiveStatisticsControl();
  const item = data?.wards.find((ward) => ward.id === unitId);
  if (!data || !item) return <ExecutiveStatisticsUnavailable />;
  const unit = {
    id: item.id,
    name: item.name,
    siteCode: item.siteCode,
    beds: item.beds.total,
    cohort: item.cohort,
    lockedBeds: item.lockedBeds,
    authorised: item.authorised,
  };
  const ready =
    item.readyToLeave.state === "measured" && item.readyToLeave.total !== null
      ? {
          tallies: item.readyToLeave.byReason,
          total: item.readyToLeave.total,
          population: item.current,
          vocabularySize: item.readyToLeave.byReason.length,
          shareOfWard: share(item.readyToLeave.total, item.current),
        }
      : null;
  const population = sumStatisticsCounts([item.dischargeDates.withDate, item.dischargeDates.withoutDate]);
  const aggregate = { counts: item.bedMapCounts, unplacedRecords: item.unplacedBedMapRecords };
  const model: WardDetailModel = {
    unit,
    openUnits: data.wards.map((ward) => ({
      id: ward.id,
      name: ward.name,
      siteCode: ward.siteCode,
      beds: ward.beds.total,
      cohort: ward.cohort,
      lockedBeds: ward.lockedBeds,
      authorised: ward.authorised,
    })),
    site: data.catalogue.sites.find((site) => site.code === item.siteCode),
    statistics: item.statistics,
    capacity: { available: item.capacityReady },
    pendingPreparation: item.pendingPreparation,
    openBeds: item.openNow,
    emptyBeds: item.empty,
    allocatableBeds: item.allocatable,
    wardOccupancy: { occupied: item.beds.occupied, inUse: item.beds.inUse, pulled: item.beds.pulled },
    occupancyPct: item.beds.total > 0 ? Math.round((item.beds.inUse / item.beds.total) * 100) : 0,
    referrals: item.referrals,
    ready,
    blockedByReasonError: ready === null ? "Statistics are unavailable for this desk." : null,
    dischargeDates: {
      recorded: item.dischargeDates.withDate,
      notRecorded: item.dischargeDates.withoutDate,
      population,
      shareRecorded: share(item.dischargeDates.withDate, population),
    },
    dueByDay: item.dueByDay,
    dueThisWeek: item.dueThisWeek,
    oldestPulled: item.oldestPulledMinutes,
    now: data.network.asAt.now,
    dayZero: new Date(data.network.asAt.dayZero),
    canOpen: () => true,
    paused: control.paused,
    togglePause: control.togglePause,
    countsOnly: true,
  };
  return (
    <WardDetailView
      model={model}
      slots={{
        phone: (
          <PhoneBody testId="ward-statistics-ward-phone">
            <div className={phone.bedCard} data-testid="ward-statistics-ward-phone-beds">
              <StatisticsBedMap aggregate={aggregate} wardName={item.name} />
              <StatisticsBedMapLegend counts={aggregate.counts} />
            </div>
            <PeopleNotListed testId="ward-statistics-ward-phone-not-listed" />
          </PhoneBody>
        ),
        bedMap: (
          <>
            <StatisticsBedMapLegend counts={aggregate.counts} />
            <StatisticsBedMap aggregate={aggregate} wardName={item.name} />
          </>
        ),
        stay: (
          <StayCard
            bands={item.stayBands.map((band) => ({ band: { id: band.id, label: band.label }, count: band.count }))}
            unrecorded={item.unrecordedStay}
            averageStay={item.statistics.averageLengthOfStayDays}
            longStays={item.statistics.longStays}
          />
        ),
        roster: <PeopleNotListed testId="ward-statistics-ward-roster-not-listed" />,
      }}
    />
  );
}

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
function OperationalWardScreen({
  unitId,
  units: unitsOverride,
  admissions: admissionsOverride,
}: {
  unitId: string;
  units?: Unit[];
  admissions?: Admission[];
}) {
  const live = useStatisticsLive();
  const { countsOnly } = useStatisticsCounts();
  const { units: liveUnits, admissions: liveAdmissions, movements, bedReleases, leaveBeds } = live.state;
  const now = live.now;
  const { dayZero } = live.state;
  const units = unitsOverride ?? liveUnits;
  const admissions = admissionsOverride ?? liveAdmissions;
  const unit = useMemo(() => units.find((candidate) => candidate.id === unitId), [units, unitId]);
  // D-80: a ward desk is offered only the wards it may open, and no way to the others.
  const canOpen = useCanOpenHref();
  const openUnits = units.filter((each) => each.id === unitId || canOpen(wardStatisticsHref(each.id)));

  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  const site = useMemo(() => (unit ? siteByCode(unit.siteCode) : undefined), [unit]);
  const statistics = useMemo(() => (unit ? wardStatistics(unit.id, admissions, now) : null), [unit, admissions, now]);
  const capacity = useMemo(() => (unit ? unitCapacity(unit, bedReleases) : null), [unit, bedReleases]);
  const pendingPreparation = useMemo(
    () => (unit ? bedsPendingPreparation(unit.id, bedReleases) : 0),
    [unit, bedReleases],
  );
  const openBeds = useMemo(() => (unit ? openBedsNow(unit, bedReleases) : 0), [unit, bedReleases]);
  const bedMap = useMemo(
    () => (unit ? bedMapCells(unit, admissions, bedReleases, leaveBeds, now) : null),
    [unit, admissions, bedReleases, leaveBeds, now],
  );
  const wardOccupancy = useMemo(
    () => (unit ? occupiedBeds([unit], admissions, bedReleases, leaveBeds) : null),
    [unit, admissions, bedReleases, leaveBeds],
  );
  const occupancyPct = useMemo(() => (wardOccupancy ? occupancyPercent(wardOccupancy) : 0), [wardOccupancy]);
  const referrals = useMemo(() => (unit ? wardReferralTally(movements, unit.id) : null), [movements, unit]);
  const readyResult = useMemo(() => {
    if (!unit) return { ready: null as ReadyNotYetGone | null, blockedByReasonError: null as string | null };
    try {
      return { ready: readyNotYetGone(admissions, unit.id), blockedByReasonError: null };
    } catch (error) {
      return {
        ready: null,
        blockedByReasonError: error instanceof Error ? error.message : String(error),
      };
    }
  }, [admissions, unit]);
  const dischargeDates = useMemo(
    () =>
      unit
        ? dischargeDateCoverage(
            admissions.filter((admission) => admission.state !== "pulled"),
            unit.id,
          )
        : null,
    [admissions, unit],
  );
  const current = useMemo(
    () =>
      unit ? admissions.filter((admission) => admission.unitId === unit.id && admission.state !== "departed") : [],
    [admissions, unit],
  );
  const today = dayOf(now);
  const dueByDay = useMemo(
    () =>
      Array.from({ length: 7 }, (_, offset) => ({
        offset,
        count: current.filter(
          (admission) =>
            admission.state !== "pulled" &&
            admission.expectedDischargeAt !== null &&
            admission.expectedDischargeAt >= now &&
            dayOf(admission.expectedDischargeAt) === today + offset,
        ).length,
      })),
    [current, now, today],
  );
  const dueThisWeek = useMemo(() => dueByDay.reduce((sum, day) => sum + day.count, 0), [dueByDay]);
  const oldestPulled = useMemo(
    () =>
      current
        .filter((admission) => admission.state === "pulled" && admission.pulledAt !== null && admission.pulledAt <= now)
        .reduce<number | null>((oldest, admission) => {
          const waited = now - (admission.pulledAt ?? now);
          return oldest === null || waited > oldest ? waited : oldest;
        }, null),
    [current, now],
  );

  if (!unit || !statistics || !capacity || !bedMap || !wardOccupancy || !referrals || !dischargeDates) {
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
              <Link href={STATISTICS_UNIT_FINDER_HREF} data-testid="ward-statistics-ward-chooser-link">
                Choose a ward with Open a unit
              </Link>{" "}
              to reach one that does exist.
            </p>
          </CardBody>
        </StatCard>
      </StatisticsPage>
    );
  }

  return (
    <WardDetailView
      model={{
        unit,
        canOpen,
        openUnits,
        site,
        statistics,
        capacity,
        pendingPreparation,
        openBeds,
        emptyBeds: unit.empty.value,
        allocatableBeds: unit.allocatable.value,
        wardOccupancy,
        occupancyPct,
        referrals,
        ...readyResult,
        dischargeDates,
        dueByDay,
        dueThisWeek,
        oldestPulled,
        now,
        dayZero,
        paused: live.paused,
        togglePause: live.togglePause,
        countsOnly,
      }}
      slots={{
        phone: (
          <WardPhone unit={unit} map={bedMap} current={current} now={now} dayZero={dayZero} leaveBeds={leaveBeds} />
        ),
        // Final round (31 Oct 2026): the compact map carries its own legend, with the swatches of
        // its state fills (statistics-unit-bed-map.tsx), so the app's legend is not drawn above it.
        bedMap: <CompactBedMap map={bedMap} wardName={unit.name} />,
        stay: (
          <StayCard
            bands={STAY_BANDS.map((band) => ({
              band,
              count: current.filter((admission) => stayBand(admission, now)?.id === band.id).length,
            }))}
            unrecorded={current.filter((admission) => stayBand(admission, now) === null).length}
            averageStay={statistics.averageLengthOfStayDays}
            longStays={statistics.longStays}
          />
        ),
        roster: <Roster unit={unit} current={current} now={now} dayZero={dayZero} leaveBeds={leaveBeds} />,
      }}
    />
  );
}
function WardDetailView({ model, slots }: { model: WardDetailModel; slots: WardSlots }) {
  const {
    unit,
    openUnits,
    site,
    statistics,
    capacity,
    emptyBeds,
    allocatableBeds,
    wardOccupancy,
    occupancyPct,
    referrals,
    ready,
    blockedByReasonError,
    dischargeDates,
    dueByDay,
    dueThisWeek,
    oldestPulled,
    now,
    dayZero,
    paused,
    togglePause,
    countsOnly,
    canOpen,
  } = model;
  const section = statisticsSectionById("units")!;
  const isPhone = useIsPhone();
  const small = statisticsCountText;
  const parts = (counts: StatisticsCount[]) => counts.map((count) => small(count));
  const headlineTotal = ready === null ? statistics.readyToLeaveCannot : ready.total;
  const cohortLabel = unit.cohort === "Adult" ? (unit.lockedBeds > 0 ? "Adult secure" : "Adult open") : unit.cohort;
  const averageStay = statistics.averageLengthOfStayDays;

  // Executive desk: a count of people under the line is worded, and the parts of a breakdown whose
  // total is on screen are hidden together (`useStatisticsCounts`). Beds and bed states stay exact.
  const dueShown = parts(dueByDay.map((day) => day.count));
  const [datedShown = 0, undatedShown = 0] = parts([dischargeDates.recorded, dischargeDates.notRecorded]);
  const outcomes = statistics.dischargeDateOutcomes;
  const [metShown = 0, missedShown = 0] = parts([outcomes.met, outcomes.missed]);
  const movedShown = small(outcomes.moved);
  const excludedShown = small(statistics.emptyBedIncoherentCount);

  return (
    <StatisticsPage
      section={section}
      navSection="ward"
      slug={unit.id}
      testId="ward-statistics-ward-screen"
      title={unit.name}
      titleAction={
        openUnits.length > 1 ? (
          <span className={ward.titleTools}>
            <ChangeWard units={openUnits} currentId={unit.id} />
            <UnitStepper
              noun="ward"
              currentId={unit.id}
              items={openUnits.map((each) => ({ id: each.id, href: wardStatisticsHref(each.id), label: each.name }))}
            />
          </span>
        ) : undefined
      }
      tools={
        <>
          {canOpen(STATISTICS_WARDS_HREF) ? (
            <HeroTool
              href={STATISTICS_WARDS_HREF}
              icon={<ListOrdered size={14} aria-hidden="true" />}
              testId="ward-statistics-ward-all-wards"
            >
              All wards
            </HeroTool>
          ) : null}
          {canOpen(STATISTICS_COMPARE_HREF) ? (
            <HeroTool
              href={STATISTICS_COMPARE_HREF}
              icon={<Scale size={14} aria-hidden="true" />}
              testId="ward-statistics-ward-compare"
            >
              Compare
            </HeroTool>
          ) : null}
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
      paused={paused}
      onTogglePause={togglePause ?? undefined}
      exportFigures={{
        stem: unit.id,
        scope: unit.name,
        figures: () => [
          ["Beds", unit.beds],
          ["Occupied", wardOccupancy.occupied],
          ["In use (occupied or pulled)", wardOccupancy.inUse],
          ["Occupancy percent (occupied or pulled)", occupancyPct],
          ["Pulled, not arrived", wardOccupancy.pulled],
          ["Ready", capacity.available],
          ["Average stay, days", averageStay ?? "none"],
          ["Due out, 7 days", small(dueThisWeek)],
        ],
      }}
      phone={{
        eyebrow: site?.name ?? "Hospital not recorded",
        // The % sits in the sub line so the hero label never clips (audit stats-15).
        sub: `${cohortLabel} · ${occupancyPct}% of ${unit.beds} beds in use${averageStay === null ? "" : ` · average stay ${averageStay} days`}`,
        stats: (
          <>
            <HeroStat
              value={wardOccupancy.inUse}
              label="In use"
              tone={occupancyPct >= BED_ALERT_THRESHOLD_PERCENT ? "warning" : undefined}
            />
            <HeroStat value={capacity.available} label="Ready" />
            <HeroStat value={wardOccupancy.pulled} label="Pulled" />
          </>
        ),
      }}
      stats={
        <>
          {/* ROLE BRANCH (ward): the bed totals live here once (Josh, 30 Oct 2026). Beds now is gone: its
              Empty and Allocatable join the hero, Pending is the legend's "Being made ready", Open now
              (Ready less Being made ready) reads from those two, and the oldest pull is said on Pulled. Average stay and Due
              out are on their own cards, so the hero keeps five bed figures. */}
          <HeroStat value={wardOccupancy.inUse} label={`In use, ${occupancyPct}%`} />
          <HeroStat
            value={wardOccupancy.pulled}
            label={
              <span className={styles.flagged}>
                {wardOccupancy.pulled > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                {oldestPulled === null ? "Pulled, not arrived" : `Pulled, oldest ${durMinutes(oldestPulled)}`}
              </span>
            }
          />
          <HeroStat value={<span data-testid="ward-stat-capacity-ready">{capacity.available}</span>} label="Ready" />
          <HeroStat
            value={<span data-testid="ward-stat-capacity-allocatable">{allocatableBeds}</span>}
            label="Allocatable"
          />
          <HeroStat value={<span data-testid="ward-stat-capacity-empty">{emptyBeds}</span>} label="Empty" />
        </>
      }
    >
      {isPhone ? (
        slots.phone
      ) : (
        <>
          {/* ROLE BRANCH (ward): the bed map, length of stay and discharge barriers on the left; discharge
              planning, expected discharges and referrals on the right, so both columns are near one
              height and no card ends in blank space. */}
          <FlushRow layout="lead2" data-testid="ward-statistics-ward-measures">
            <FlushStack>
              <StatCard
                icon={LayoutGrid}
                title="Bed map"
                aside={`${unit.beds} beds`}
                id="ward-bed-map"
                data-testid="ward-statistics-ward-bed-map-card"
              >
                <CardBody className={styles.bodyStack}>{slots.bedMap}</CardBody>
              </StatCard>
              {slots.stay}
              <Barriers ready={ready} error={blockedByReasonError} headlineTotal={headlineTotal} />
            </FlushStack>

            <FlushStack>
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
                        {datedShown}
                      </dd>
                      <dt className={styles.figureLabel}>With a date</dt>
                    </div>
                    <div className={styles.figure}>
                      <dd className={styles.figureValue} data-testid="ward-stat-discharge-date-not-recorded">
                        {undatedShown}
                      </dd>
                      <dt className={styles.figureLabel}>
                        {positive(dischargeDates.notRecorded) ? <StatusGlyph tone="warning" size={9} /> : null}
                        No date
                      </dt>
                    </div>
                    <div className={styles.figure}>
                      <dd
                        className={styles.figureValue}
                        data-testid="ward-stat-discharge-date-share"
                        data-unmeasured={isUnmeasured(dischargeDates.shareRecorded) ? "" : undefined}
                      >
                        {typeof datedShown === "string" || typeof undatedShown === "string" ? (
                          // A share beside its total would give a hidden part away.
                          <>{SMALL_NUMBER_NOT_SHOWN}</>
                        ) : dischargeDates.shareRecorded.kind === "measured" ? (
                          <>
                            {figureText(dischargeDates.shareRecorded)}%
                            <small className={ward.figureSub}>Of {small(dischargeDates.population)} here</small>
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
                      {exact(outcomes.consideredCount) === 0 ? (
                        <>No resolved discharge dates.</>
                      ) : (
                        <>
                          Of {small(outcomes.consideredCount)} whose date can be judged, written down and the person has
                          since left, {said(metShown)} met and {said(missedShown)} missed.
                        </>
                      )}{" "}
                      {exact(outcomes.moved) === 0 ? (
                        <>No admission on this ward has had its discharge date revised.</>
                      ) : (
                        <>
                          Separately, {movedShown}{" "}
                          {movedShown === 1 ? "admission on this ward has" : "admissions on this ward have"} had a
                          discharge date revised at least once.
                        </>
                      )}
                    </SrOnly>
                    <div className={styles.tiles} aria-hidden="true">
                      <div className={styles.tile}>
                        <span className={styles.tileLabel}>Dates met</span>
                        <span className={styles.tileValue}>
                          {exact(outcomes.consideredCount) === 0
                            ? "none yet"
                            : `${metShown} of ${small(outcomes.consideredCount)}`}
                        </span>
                      </div>
                      <div className={styles.tile}>
                        <span className={styles.tileLabel}>Revised</span>
                        <span className={styles.tileValue}>{movedShown}</span>
                      </div>
                      <div className={styles.tile}>
                        <span className={styles.tileLabel}>Ready, not gone</span>
                        <span className={styles.tileValue}>{small(headlineTotal)}</span>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </StatCard>
              <StatCard icon={CalendarClock} title="Expected discharges" id="ward-discharges">
                <CardBody className={styles.bodyStack}>
                  <p className={ward.headFigure}>
                    <b>{small(dueThisWeek)}</b> due in the next 7 days
                  </p>
                  <ColumnChart
                    height={200}
                    label="Expected discharges by day, next 7 days"
                    columns={dueByDay.map((day) => ({
                      id: String(day.offset),
                      label: day.offset === 0 ? "Today" : weekdayOf(now + day.offset * MINUTES_PER_DAY, dayZero),
                      ...withheldBar(exact(day.count) ?? 0, dueShown[day.offset] ?? small(day.count)),
                    }))}
                  />
                </CardBody>
              </StatCard>
              <StatCard
                icon={Users}
                title="Referrals into ward"
                id="ward-referrals"
                data-testid="ward-statistics-ward-referrals-panel"
              >
                <CardBody className={styles.bodyStack}>
                  <section data-testid="ward-stat-referrals" aria-label="Referrals into this ward">
                    <dl className={styles.figures}>
                      <div className={styles.figure}>
                        <dd className={styles.figureValue} data-testid="ward-stat-referrals-asked">
                          {small(referrals.askedAndWaiting)}
                        </dd>
                        <dt className={styles.figureLabel}>Asking now</dt>
                      </div>
                      <div className={styles.figure}>
                        <dd className={styles.figureValue} data-testid="ward-stat-referrals-accepted">
                          {small(referrals.everAccepted)}
                        </dd>
                        <dt className={styles.figureLabel}>Accepted</dt>
                      </div>
                      <div className={styles.figure}>
                        <dd className={styles.figureValue} data-testid="ward-stat-referrals-declined">
                          {small(referrals.everDeclined)}
                        </dd>
                        <dt className={styles.figureLabel}>
                          <StatusGlyph tone="closed" size={9} />
                          Ever declined
                        </dt>
                      </div>
                    </dl>
                    <SrOnly>
                      Asking now counts referrals waiting on this ward right now. Accepted counts acceptances still
                      standing, including arrivals but not withdrawn acceptances. Ever declined counts recorded
                      declines. One movement can appear in both accepted and declined counts, so the three do not add
                      up.
                    </SrOnly>
                  </section>
                  {statistics.averageEmptyBedMinutes !== null || positive(statistics.emptyBedIncoherentCount) ? (
                    <div data-testid="ward-statistics-ward-admissions-discharges">
                      <h3 className={ward.subHead}>Pull to arrival</h3>
                      <div className={styles.tiles}>
                        <div className={styles.tile} data-testid="ward-stat-empty-bed-minutes">
                          <span className={styles.tileLabel}>Average</span>
                          {statistics.averageEmptyBedMinutes === null ? (
                            <span className={styles.tileValue}>
                              <span aria-hidden="true">none</span>
                              <SrOnly>
                                No bed on this ward has a usable pair of instants, a bed given away and a person
                                arriving, with the arrival not earlier than the pull, so there is no empty stretch to
                                average.
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
                          <span className={styles.tileValue}>{excludedShown}</span>
                          <SrOnly>
                            {excludedShown === 1 ? "admission on this ward records" : "admissions on this ward record"}{" "}
                            an arrival earlier than the bed was given away.
                            {positive(statistics.emptyBedIncoherentCount)
                              ? ` That cannot be true, so ${excludedShown === 1 ? "it is" : "they are"} excluded from the average and counted here instead.`
                              : ""}
                          </SrOnly>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardBody>
              </StatCard>
            </FlushStack>
          </FlushRow>

          {/* Role view (nurse in charge), D-80: the ward desk's counts grant lists nobody, so the roster card,
              which would only say so, is left out. Its counts are in the cards above. */}
          {countsOnly ? null : slots.roster}
        </>
      )}
    </StatisticsPage>
  );
}

/** The bed strip's legend order and words on the phone (v10 phone). */
const PHONE_BED_LEGEND: { kinds: BedMap["cells"][number]["kind"][]; label: string }[] = [
  { kinds: ["occupied", "leave"], label: BED_MAP_LABELS.occupied },
  { kinds: ["pulled"], label: "Pulled" },
  { kinds: ["closed"], label: BED_MAP_LABELS.closed },
  { kinds: ["prep"], label: "Making ready" },
  { kinds: ["ready"], label: BED_MAP_LABELS.ready },
];

/**
 * The phone bed grid's columns: ten at most, and where the beds divide evenly by 5 to 10, that
 * divisor, so no bed sits alone on a row (20 beds read 10 by 2, 24 read 8 by 3).
 */
function bedColumns(count: number): number {
  if (count <= 10) return Math.max(count, 1);
  for (let cols = 10; cols >= 5; cols -= 1) if (count % cols === 0) return cols;
  return 10;
}

/**
 * One ward on a phone (v10 phone): the beds as a strip of boxes grouped by state (the model has no
 * bed numbers), then the roster, the discharges due in seven days and the blocked discharges as
 * one list behind a segmented control, and "Open the ward" pinned at the foot.
 */
function WardPhone({
  unit,
  map,
  current,
  now,
  dayZero,
  leaveBeds,
}: {
  unit: Unit;
  map: BedMap;
  current: Admission[];
  now: number;
  dayZero: Date;
  leaveBeds: readonly { admissionId: string }[];
}) {
  const [tab, setTab] = useState<"roster" | "discharges" | "blockers">("roster");
  const { countsOnly } = useStatisticsCounts();
  const byStay = (a: Admission, b: Admission) => (stayDaysOf(b, now) ?? -1) - (stayDaysOf(a, now) ?? -1);
  const roster = [...current].sort(byStay);
  const discharges = current
    .filter(
      (admission) =>
        admission.state !== "pulled" &&
        admission.expectedDischargeAt !== null &&
        admission.expectedDischargeAt >= now &&
        dayOf(admission.expectedDischargeAt) < dayOf(now) + 7,
    )
    .sort((a, b) => (a.expectedDischargeAt ?? 0) - (b.expectedDischargeAt ?? 0));
  const blockers = current.filter((admission) => admission.blockReason !== null).sort(byStay);
  const shown = tab === "roster" ? roster : tab === "discharges" ? discharges : blockers;
  // Redesign (owner rule): a long list opens on its first rows, then "Show more".
  const [expanded, setExpanded] = useState(false);

  return (
    <PhoneBody testId="ward-statistics-ward-phone">
      <div className={phone.bedCard} data-testid="ward-statistics-ward-phone-beds">
        {/* Coordinator review (31 Oct 2026): an even grid, each state its own fill in the Capacity
            map's colours, and a legend with the same swatches. The phone drops the stay shading: five
            state fills are what a small grid can carry, and the roster below gives each stay in days. */}
        <ul
          className={beds.grid}
          style={{ "--bed-cols": bedColumns(map.cells.length) } as CSSProperties}
          aria-label={`${unit.name}, ${unit.beds} beds by state`}
        >
          {map.cells.map((cell, index) => {
            const stay = countsOnly ? null : cell.stayDays;
            const label =
              stay === null
                ? BED_MAP_LABELS[cell.kind]
                : `${BED_MAP_LABELS[cell.kind]}, ${stay} ${stay === 1 ? "day" : "days"}`;
            return <li key={index} className={beds.bed} data-kind={cell.kind} title={label} aria-label={label} />;
          })}
        </ul>
        <ul className={beds.legend} aria-label="Beds by state">
          {PHONE_BED_LEGEND.map((entry) => (
            <li key={entry.label}>
              <i className={beds.swatch} data-kind={entry.kinds[0]} aria-hidden="true" />
              {entry.label}
              <b>{entry.kinds.reduce((sum, kind) => sum + map.counts[kind], 0)}</b>
            </li>
          ))}
        </ul>
      </div>
      {countsOnly ? (
        // The three lists are one row per admission, and their tab counts only count those rows.
        <PeopleNotListed testId="ward-statistics-ward-phone-not-listed" />
      ) : (
        <>
          <Segmented<"roster" | "discharges" | "blockers">
            className={cx(phone.seg, phone.stickySeg, redesign.phoneSeg)}
            size="md"
            label="Ward list"
            value={tab}
            onChange={setTab}
            items={[
              { id: "roster", label: "Roster", count: roster.length },
              { id: "discharges", label: "Discharges", count: discharges.length },
              { id: "blockers", label: "Blockers", count: blockers.length },
            ]}
          />
          {shown.length === 0 ? (
            <p className={phone.note}>
              {tab === "roster"
                ? "No current admissions recorded"
                : tab === "discharges"
                  ? "Nobody has a discharge date in the next 7 days"
                  : "No current admission carries a blocker"}
            </p>
          ) : (
            <PhoneList
              label={
                tab === "roster" ? "Admission roster" : tab === "discharges" ? "Due out, 7 days" : "Discharges held up"
              }
            >
              {(expanded ? shown : shown.slice(0, ROSTER_FIRST_ROWS)).map((admission) => {
                const days = stayDaysOf(admission, now);
                const onLeave = leaveBeds.some((bed) => bed.admissionId === admission.id);
                const status = onLeave ? "On leave" : ADMISSION_STATE_LABELS[admission.state];
                return (
                  <PhoneListRow
                    key={admission.id}
                    as="li"
                    name={<span className={phone.mono}>{admission.id}</span>}
                    meta={`${tab === "blockers" && admission.blockReason ? admission.blockReason : status}${
                      admission.expectedDischargeAt !== null && isPastDate(admission.expectedDischargeAt, now)
                        ? " · past date"
                        : ""
                    }`}
                    value={
                      days === null ? (
                        "none"
                      ) : (
                        <>
                          {days} <small className={phone.unit}>d</small>
                        </>
                      )
                    }
                    time={
                      admission.expectedDischargeAt === null ? (
                        "no date"
                      ) : isPastDate(admission.expectedDischargeAt, now) ? (
                        <span className={phone.flagged}>
                          <StatusGlyph tone="warning" size={9} />
                          {dateOf(admission.expectedDischargeAt, dayZero)}
                        </span>
                      ) : (
                        dateOf(admission.expectedDischargeAt, dayZero)
                      )
                    }
                  />
                );
              })}
            </PhoneList>
          )}
          {shown.length > ROSTER_FIRST_ROWS ? (
            <ShowMoreRow expanded={expanded} onClick={() => setExpanded((open) => !open)}>
              {expanded ? "Show fewer" : `Show ${shown.length - ROSTER_FIRST_ROWS} more`}
            </ShowMoreRow>
          ) : null}
        </>
      )}
      <PhonePinnedAction icon={Building2} href={unitHref(unit.id)} testId="ward-statistics-ward-phone-open">
        Open the ward
      </PhonePinnedAction>
    </PhoneBody>
  );
}

/**
 * A count in a sentence. A part withheld only for its total (`SMALL_NUMBER_NOT_SHOWN`) reads "an
 * unstated number"; a worded one takes the plural, so the grammar never gives a 1 away.
 */
function said(shown: number | string, one?: string, many?: string): string {
  if (shown === SMALL_NUMBER_NOT_SHOWN) return many ? `an unstated number of ${many}` : "an unstated number";
  return many ? `${shown} ${shown === 1 ? one : many}` : String(shown);
}

/** Whole days since arrival, or null when the person has not arrived (or the record says later). */
function stayDaysOf(admission: Admission, now: number): number | null {
  if (admission.arrivedAt === null || admission.arrivedAt > now) return null;
  return Math.floor((now - admission.arrivedAt) / MINUTES_PER_DAY);
}

function StayCard({
  bands,
  unrecorded,
  averageStay,
  longStays,
}: {
  bands: { band: { id: string; label: string }; count: StatisticsCount }[];
  unrecorded: StatisticsCount;
  averageStay: number | null;
  longStays: StatisticsCount;
}) {
  const [view, setView] = useState<"chart" | "data">("chart");
  // The bands and the unrecorded add up to the ward's admissions, so they are hidden together.
  const parts = (counts: StatisticsCount[]) => counts.map((count) => statisticsCountText(count));
  const shown = parts([...bands.map((entry) => entry.count), unrecorded]);
  const shownOf = (index: number) => shown[index] ?? statisticsCountText(bands[index]?.count ?? unrecorded);
  const longShown = statisticsCountText(longStays);
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
            max={countAxisMax(bands.map((_, index) => shownOf(index)).filter((n) => typeof n === "number"))}
            labelWidth="9rem"
            rows={bands.map(({ band, count }, index) => ({
              id: band.id,
              label: band.label,
              ...withheldBar(exact(count) ?? 0, shownOf(index)),
              display: String(shownOf(index)),
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
                {bands.map(({ band, count }, index) => (
                  <tr key={band.id}>
                    <th scope="row">{band.label}</th>
                    <td className={exact(count) === 0 ? `${styles.num} ${styles.muted}` : styles.num}>
                      {shownOf(index)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.srOnly} data-testid="ward-stat-long-stays">
          {exact(longStays) === 0 ? (
            <>None. No admission on this ward has passed three months.</>
          ) : (
            <>
              {said(longShown, "admission on this ward has", "admissions on this ward have")} been here longer than
              three months.
            </>
          )}
        </p>
        {positive(unrecorded) ? (
          <p className={ward.note}>
            {said(shownOf(bands.length), "admission has", "admissions have")} no recorded stay
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
  ready: ReadyView | null;
  error: string | null;
  headlineTotal: StatisticsCount;
}) {
  const [show, setShow] = useState<"blocked" | "all">("blocked");
  // The reasons add up to the blocked total beside them, so they are hidden together.
  const small = statisticsCountText;
  const parts = (counts: StatisticsCount[]) => counts.map((count) => small(count));
  const tallyShown = parts(ready === null ? [] : ready.tallies.map((tally) => tally.count));
  const shownFor = (reason: string) => {
    const index = ready === null ? -1 : ready.tallies.findIndex((tally) => tally.reason === reason);
    return tallyShown[index] ?? small(ready?.tallies[index]?.count ?? 0);
  };
  const total = small(headlineTotal);
  const rows = ready === null ? [] : ready.tallies.filter((tally) => show === "all" || positive(tally.count));
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
            {exact(headlineTotal) === 0 ? (
              <>0. No admission on this ward that has not departed carries a blocker.</>
            ) : (
              <>
                {total} {total === 1 ? "admission" : "admissions"} on this ward that {total === 1 ? "has" : "have"} not
                departed {total === 1 ? "carries" : "carry"} a blocker.
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
            ) : typeof total === "string" || typeof small(ready.population) === "string" ? (
              // A share beside the ward's population would give the worded count away.
              <>
                <b>{total}</b> ready, not gone, share {SMALL_NUMBER_NOT_SHOWN}
              </>
            ) : ready.shareOfWard.kind === "measured" ? (
              <>
                <b>{small(headlineTotal)}</b> ready, not gone, <b>{figureText(ready.shareOfWard)}%</b> of the{" "}
                {said(small(ready.population), "patient", "patients")} here
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
                {said(small(ready.total), "discharge held up", "discharges held up")} on this ward, out of{" "}
                {said(small(ready.population), "admission", "admissions")} on this ward that have not departed.
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
                    max={countAxisMax(tallyShown.filter((count) => typeof count === "number"))}
                    labelWidth="12rem"
                    rows={rows.map((tally) => ({
                      id: tally.reason,
                      label: tally.reason.replaceAll("_", " "),
                      ...withheldBar(exact(tally.count) ?? 0, shownFor(tally.reason)),
                      display: String(shownFor(tally.reason)),
                    }))}
                  />
                </div>
              )}
              <ul className={styles.srOnly} data-testid="ward-stat-blocked-by-reason-list">
                {ready.tallies.map((tally) => (
                  <li key={tally.reason} data-testid={`ward-stat-blocked-by-reason-${tally.reason}`}>
                    {tally.reason}:{" "}
                    <span data-testid={`ward-stat-blocked-by-reason-${tally.reason}-count`}>
                      {shownFor(tally.reason)}
                    </span>
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

const ROSTER_FIRST_ROWS = 8;

const ADMISSION_STATE_LABELS: Record<Admission["state"], string> = {
  waitlisted: "On waiting list",
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
  // Redesign (owner rule): a long roster opens on its first rows, then "Show more".
  const [expanded, setExpanded] = useState(false);

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
  const visible = expanded ? shown : shown.slice(0, ROSTER_FIRST_ROWS);

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
    downloadCsv(`ward-flow-synthetic-${unit.id}-roster.csv`, lines, {
      asAt: formatSheetMoment(now, dayZero, { includeYearAndZone: true }),
      // Audit 24-7 (CT-15): say a search narrowed the rows, never the typed text itself.
      scope: `${unit.name}; matching roster rows; status filter: ${filter}${needle ? "; search applied" : ""}`,
    });
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
            {visible.map((row) => {
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
                      <span className={styles.flagged}>
                        {isPastDate(admission.expectedDischargeAt, now) ? (
                          <StatusGlyph tone="warning" size={9} />
                        ) : null}
                        {dateOf(admission.expectedDischargeAt, dayZero)}{" "}
                        <span className={styles.muted}>
                          {fromToday(admission.expectedDischargeAt, now)}
                          {isPastDate(admission.expectedDischargeAt, now) ? ", past date" : ""}
                        </span>
                      </span>
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
      {shown.length > ROSTER_FIRST_ROWS ? (
        <ShowMoreRow expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Show fewer" : `Show ${shown.length - ROSTER_FIRST_ROWS} more`}
        </ShowMoreRow>
      ) : null}
    </StatCard>
  );
}
