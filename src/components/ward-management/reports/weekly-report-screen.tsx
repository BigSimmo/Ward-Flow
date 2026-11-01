"use client";

import { useId, useMemo, useState } from "react";
import { CalendarDays, Printer } from "lucide-react";

import { Button, HeroStat, SrOnly, buttonClass, cx, useIsPhone } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatSheetMoment, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { originName } from "@/components/ward-management/ward-movement-origin";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { ShortLabel } from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";
import { WeeklyBody } from "@/components/ward-management/statistics/redesign/statistics-redesign-weekly";
import { dateOf } from "../statistics/statistics-dates";
import { StatisticsHero, useStatisticsLive } from "../statistics/statistics-hero";

import { OUT_OF_AREA_BANDS, TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";
import type { ExecutiveReportingWeek } from "../statistics/executive-statistics-contract";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText as reportCount,
} from "../statistics/statistics-small-numbers";

import { useOperationalPilot, usePilotFigures, type WeeklyPilot } from "./pilot-measures-section";
import { reportWeek, weeklyOperationsReport, type WeeklyReport, type ReportWeek } from "./weekly-report";
import { useOwnUnits } from "./use-own-units";
import styles from "./reports.module.css";
import weekly from "./weekly-report.module.css";

const WAITING_HREF = "/ward-flow/waiting";

/** The out of area bands, in the words the rest of the app uses for them. */
const OUT_OF_AREA_META = OUT_OF_AREA_BANDS.map((band) => TRAVEL_BAND_LABELS[band]).join(" or ");

/** Offsets offered in the week picker: this week so far, the last full week, then seven before it. */
const WEEK_OFFSETS = [-1, 0, 1, 2, 3, 4, 5, 6, 7] as const;
const OCCUPIED_TIME_LABEL = "Recorded occupied bed time";
const OCCUPIED_TIME_DEFINITION =
  "Recorded occupied stay time divided by the current total bed count and counted time. Closed beds stay in the denominator; time pulled for arrival is excluded. Historical bed capacity and pull times are not reconstructed.";

/** "19 to 25 Oct", or "28 Sep to 4 Oct" across a month: the band button's short week. */
function shortRange(week: ReportWeek, dayZero: Date): string {
  const [, startDay, startMonth] = dateOf(week.start, dayZero).split(" ");
  const [, endDay, endMonth] = dateOf(week.end - 1, dayZero).split(" ");
  return startMonth === endMonth
    ? `${startDay} to ${endDay} ${endMonth}`
    : `${startDay} ${startMonth} to ${endDay} ${endMonth}`;
}

function shortWeekLabel(week: ReportWeek, dayZero: Date): string {
  const range = shortRange(week, dayZero);
  if (week.offset === -1) return `This week so far · ${range}`;
  if (week.offset === 0) return `Last full week · ${range}`;
  return range;
}

function weekLabel(week: ReportWeek, dayZero: Date): string {
  const range = `${dateOf(week.start, dayZero)} to ${dateOf(week.end - 1, dayZero)}`;
  if (week.offset === -1) return `This week so far · ${range}`;
  if (week.offset === 0) return `Last full week · ${range}`;
  return range;
}

/**
 * WEEKLY OPERATIONS REPORT — one chosen week (default the last full week), printable. Every figure
 * is derived from the live synthetic world by `weeklyOperationsReport`; nothing is stored.
 */
export function WeeklyReportScreen() {
  const access = useEffectiveWardAccess();
  const controls = useExecutiveStatisticsControl();
  const [offset, setOffset] = useState<number>(0);
  return controls.executive || access.role === "executive" ? (
    <ExecutiveWeeklyReport offset={offset} setOffset={setOffset} />
  ) : (
    <OperationalWeeklyReport offset={offset} setOffset={setOffset} />
  );
}

type WeekPicker = { offset: number; setOffset: (offset: number) => void };
type WeeklyViewReport = {
  edWaits: Omit<WeeklyReport["edWaits"], "count" | "rows" | "longestMinutes"> & {
    count: number | string;
    rows?: WeeklyReport["edWaits"]["rows"];
    longestMinutes: number | null;
  };
  outOfArea: Omit<WeeklyReport["outOfArea"], "people"> & { people: number | string };
  delayedDischarge: Omit<WeeklyReport["delayedDischarge"], "people" | "unmeasuredStays"> & {
    people: number | string;
    unmeasuredStays: number | string;
  };
  declines: {
    placement: number | string;
    referral: number | string;
    byReason: { reason: string; count: number | string }[];
  };
  overrides: {
    placement: number | string;
    referral: number | string;
    byReason: { reason: string; count: number | string }[];
  };
  occupancy: WeeklyReport["occupancy"];
};

function executiveReport(report: ExecutiveReportingWeek["report"]): WeeklyViewReport {
  const paired = (value: ExecutiveReportingWeek["report"]["declines"]) => ({
    placement: reportCount(value.placement),
    referral: reportCount(value.referral),
    byReason: value.byReason.map((entry) => ({ reason: entry.reason, count: reportCount(entry.count) })),
  });
  return {
    ...report,
    edWaits: { ...report.edWaits, count: reportCount(report.edWaits.count) },
    outOfArea: { ...report.outOfArea, people: reportCount(report.outOfArea.people) },
    delayedDischarge: {
      ...report.delayedDischarge,
      people: reportCount(report.delayedDischarge.people),
      unmeasuredStays: reportCount(report.delayedDischarge.unmeasuredStays),
    },
    declines: paired(report.declines),
    overrides: paired(report.overrides),
  };
}

function ExecutiveWeeklyReport({ offset, setOffset }: WeekPicker) {
  const data = useExecutiveStatistics();
  const controls = useExecutiveStatisticsControl();
  const selected = data?.weeks.find((entry) => entry.week.offset === offset);
  if (!data || !selected)
    return (
      <main id="main-content" className={styles.main} data-testid="ward-weekly-unavailable">
        <h1>Weekly operations</h1>
        <ExecutiveStatisticsUnavailable />
      </main>
    );
  return (
    <WeeklyReportView
      offset={offset}
      setOffset={setOffset}
      week={selected.week}
      report={executiveReport(selected.report)}
      dayZero={new Date(data.network.asAt.dayZero)}
      now={data.network.asAt.now}
      paused={controls.paused}
      togglePause={controls.togglePause}
      scopeLabel={data.network.scope.kind === "statewide" ? "Statewide" : data.network.scope.service}
      pilot={selected.pilot}
    />
  );
}

function OperationalWeeklyReport({ offset, setOffset }: WeekPicker) {
  const { state, now, paused, togglePause } = useStatisticsLive();
  const { movements, referrals, admissions, patients, bedReleases, leaveBeds, configuration, dayZero } = state;
  // Beds are the desk's own wards only (issue #628), so its occupancy is its stays over its beds.
  const units = useOwnUnits(state.units);

  const week = useMemo(() => reportWeek(offset, now, dayZero), [offset, now, dayZero]);
  const pilot = useOperationalPilot(
    {
      movements,
      referrals,
      patients,
      now,
      pullHoldMinutes: configuration.pullHoldMinutes,
      units,
      morningRollupConfirmations: state.morningRollupConfirmations,
      morningRollupDeadlineMinutes: configuration.morningRollupDeadlineMinutes,
    },
    week,
  );
  const report = useMemo(
    () =>
      weeklyOperationsReport(
        {
          movements,
          referrals,
          admissions,
          patients,
          units,
          bedReleases,
          leaveBeds,
          edAccessTargetMinutes: configuration.edAccessTargetMinutes,
          now,
        },
        week,
      ),
    [
      movements,
      referrals,
      admissions,
      patients,
      units,
      bedReleases,
      leaveBeds,
      configuration.edAccessTargetMinutes,
      now,
      week,
    ],
  );

  return (
    <WeeklyReportView
      offset={offset}
      setOffset={setOffset}
      week={week}
      report={report}
      dayZero={dayZero}
      now={now}
      paused={paused}
      togglePause={togglePause}
      admissionLabel={(movementId) =>
        admissions.find((admission) => admission.movementId === movementId)?.id ?? "Not yet admitted"
      }
      pilot={pilot}
    />
  );
}

function WeeklyReportView({
  offset,
  setOffset,
  week,
  report,
  pilot,
  dayZero,
  now,
  paused,
  togglePause,
  admissionLabel,
  scopeLabel,
}: WeekPicker & {
  week: ReportWeek;
  report: WeeklyViewReport;
  pilot: WeeklyPilot;
  dayZero: Date;
  now: Instant;
  paused: boolean;
  togglePause: (() => void) | null;
  admissionLabel?: (movementId: string) => string;
  scopeLabel?: string;
}) {
  const pickerId = useId();
  const isPhone = useIsPhone();
  const figures = usePilotFigures(pilot);
  const rows = report.edWaits.rows;
  // The phone names each ED by its short name (stats-14); the desktop keeps the full name.
  const edLabel = (movement: NonNullable<typeof rows>[number]["movement"]) => {
    const full = originName(movement) ?? movement.originEdId;
    return isPhone ? edShortName(edById(movement.originEdId)) || full : full;
  };
  const longestRow = rows?.reduce<(typeof rows)[number] | undefined>(
    (best, row) => (best && best.waitedMinutes >= row.waitedMinutes ? best : row),
    undefined,
  );
  const longestWait =
    report.edWaits.longestMinutes !== null && report.edWaits.count !== 0
      ? splitDuration(report.edWaits.longestMinutes)
      : "—";

  // Whole hours ("24h") on every device, not "1d 0h" here and "24h" on the phone (UX audit 21 Oct 2026).
  const hoursText = `${Math.round(report.edWaits.targetMinutes / 60)}h`;
  const occupancyText = report.occupancy.averagePercent === null ? "—" : `${report.occupancy.averagePercent}%`;
  const weekRange = `${dateOf(week.start, dayZero)} to ${dateOf(week.end - 1, dayZero)}`;
  const outputMoment = (at: Instant) => formatSheetMoment(at, dayZero, { includeYearAndZone: true });
  // Expected dates set after the week began leave the week only partly measured (audit stats-11).
  const delayedFrom = report.delayedDischarge.recordedFrom;
  const delayedUnknown = delayedFrom !== null && delayedFrom >= week.countedEnd;
  const delayedUnmeasured = report.delayedDischarge.unmeasuredStays;
  const delayedSkipped =
    !delayedUnknown && delayedUnmeasured !== 0
      ? `${delayedUnmeasured} ${delayedUnmeasured === 1 ? "stay" : "stays"} not counted: ${
          delayedUnmeasured === 1 ? "its date was" : "their dates were"
        } changed after this week.`
      : null;
  const delayedFromNote =
    delayedFrom === null || delayedUnknown
      ? null
      : `Latest expected date set ${dateOf(delayedFrom, dayZero)}. Each stay counts from when its date was set`;
  const delayedNote =
    delayedFromNote && delayedSkipped ? `${delayedFromNote}. ${delayedSkipped}` : (delayedFromNote ?? delayedSkipped);
  const print = () => {
    window.print();
  };

  // The title states the week's main fact, as on Capacity and Waiting; with no published time, the page name.
  const arrivalTitle = figures.arrival.minutes === null ? null : figures.arrival.typical;
  const title = arrivalTitle ? (
    <>
      <SrOnly>Weekly operations, </SrOnly>
      {arrivalTitle} from referral to arrival
    </>
  ) : (
    "Weekly operations"
  );

  const picker = (
    <label className={cx(buttonClass({ variant: "onHero", size: "sm" }), weekly.weekPick)} data-print-hide>
      <CalendarDays size={14} aria-hidden="true" />
      <span aria-hidden="true">{shortWeekLabel(week, dayZero)}</span>
      <span className="sr-only" id={pickerId}>
        Week
      </span>
      <select
        aria-labelledby={pickerId}
        value={String(offset)}
        onChange={(event) => {
          setOffset(Number(event.target.value));
        }}
        data-testid="ward-weekly-week"
      >
        {WEEK_OFFSETS.map((candidate) => (
          <option key={candidate} value={candidate}>
            {weekLabel(reportWeek(candidate, now, dayZero), dayZero)}
          </option>
        ))}
      </select>
    </label>
  );

  const printLines = (
    <div className={weekly.printLines}>
      {/* the exact period and the stamp print on every copy; on screen the band names the week. */}
      <p className={styles.disclosure} data-testid="ward-weekly-period">
        Period: {outputMoment(week.start)} (inclusive) to {outputMoment(week.end)} (exclusive).
        {week.countedEnd < week.end ? <> Counted to {outputMoment(week.countedEnd)} (exclusive).</> : null}
      </p>
      <p className={styles.stamp} data-testid="ward-weekly-range">
        {/* the phone's hero names the week, so its line says only when the report was made. */}
        {isPhone ? null : <>Week: {weekLabel(week, dayZero)} · </>}
        {week.countedEnd < week.end ? `Counted to ${outputMoment(week.countedEnd)} · ` : ""}
        Generated {outputMoment(now)}
      </p>
    </div>
  );

  return (
    <div className={styles.page} data-testid="ward-weekly-report" data-ward-design="v6">
      <main id="main-content" className={styles.main} data-testid={isPhone ? "ward-weekly-phone" : undefined}>
        <StatisticsHero
          section="weekly"
          now={now}
          eyebrow={
            isPhone ? (
              `Statistics · Weekly report${scopeLabel ? ` · ${scopeLabel}` : ""}`
            ) : (
              <>Weekly report · synthetic demo data{scopeLabel ? ` · ${scopeLabel}` : ""}</>
            )
          }
          title={title}
          titleAction={null}
          tools={
            isPhone ? undefined : (
              <>
                {picker}
                <span data-print-hide>
                  <Button variant="onHero" size="sm" icon={Printer} onClick={print} data-testid="ward-weekly-print">
                    Print
                  </Button>
                </span>
              </>
            )
          }
          phone={{
            title: arrivalTitle ? `${arrivalTitle} referral to arrival` : "Weekly operations",
            sub: arrivalTitle
              ? `Typical · ${figures.arrival.arrivals} ${figures.arrival.arrivals === 1 ? "arrival" : "arrivals"} · ${weekRange}`
              : weekRange,
            stats: (
              <>
                <HeroStat
                  value={report.edWaits.count}
                  label={<ShortLabel short={`${hoursText}+ waits`} full={`New ED waits ${hoursText}+`} />}
                  tone={report.edWaits.count === 0 ? undefined : "danger"}
                />
                {/* Phone review F-26 and F-33: each figure names its unit and what it averages. */}
                <HeroStat
                  value={report.outOfArea.bedDays}
                  label={<ShortLabel short="Out-of-area days" full="Out of area bed days" />}
                />
                <HeroStat value={occupancyText} label="Occupied bed time" />
              </>
            ),
          }}
          stats={
            <>
              <HeroStat
                value={report.edWaits.count}
                label={`New ED waits over ${hoursText}`}
                tone={report.edWaits.count === 0 ? undefined : "danger"}
              />
              <HeroStat value={report.outOfArea.bedDays} label="Out of area bed days" />
              {/* "not enough history" is said in the label, never set as a big figure. */}
              <HeroStat
                value={delayedUnknown ? "—" : report.delayedDischarge.bedDays}
                label={delayedUnknown ? "Delayed discharge days, not enough history yet" : "Delayed discharge days"}
              />
              <HeroStat value={occupancyText} label={OCCUPIED_TIME_LABEL} />
            </>
          }
          paused={paused}
          onTogglePause={togglePause ?? undefined}
        />
        <WeeklyBody
          isPhone={isPhone}
          pilot={figures}
          targetText={hoursText}
          edWaits={{
            count: report.edWaits.count,
            longest: longestWait,
            longestEd: longestRow ? edLabel(longestRow.movement) : undefined,
            waitedTo: `Waited to ${dateOf(week.countedEnd - 1, dayZero)}`,
            rows: rows?.map((row) => ({
              id: row.movement.id,
              admission: admissionLabel?.(row.movement.id),
              ed: edLabel(row.movement) ?? "Emergency department",
              opened: formatSheetMoment(row.movement.openedAt as Instant, dayZero),
              waited: splitDuration(row.waitedMinutes),
              veryLong: row.waitedMinutes >= VERY_LONG_WAIT_MINUTES,
              stillWaiting: row.stillWaiting,
            })),
          }}
          outOfArea={{ bedDays: report.outOfArea.bedDays, people: report.outOfArea.people, meta: OUT_OF_AREA_META }}
          delayed={{
            bedDays: report.delayedDischarge.bedDays,
            people: report.delayedDischarge.people,
            unknown: delayedUnknown,
            note: delayedNote,
          }}
          occupancy={{
            percent: occupancyText,
            value: report.occupancy.averagePercent,
            inUse: report.occupancy.now.inUse,
            beds: report.occupancy.now.beds,
            bedDays: report.occupancy.occupiedBedDays,
            definition: OCCUPIED_TIME_DEFINITION,
          }}
          declines={report.declines}
          overrides={report.overrides}
          waitingHref={WAITING_HREF}
          week={{ value: String(offset), onChange: (next) => setOffset(Number(next)) }}
          onPrint={print}
          printLines={printLines}
        />
        <WardPrototypeFooter testId="ward-weekly-footer" note="Synthetic data" />
      </main>
    </div>
  );
}
