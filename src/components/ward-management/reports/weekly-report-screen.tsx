"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { BedDouble, Clock, Hospital, Printer, XCircle } from "lucide-react";

import {
  Button,
  Field,
  HeroStat,
  PhoneListRow,
  Segmented,
  Select,
  StatusGlyph,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatSheetMoment, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { OUT_OF_AREA_BANDS, TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import { VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { dateOf } from "../statistics/statistics-dates";
import { StatCard, StatisticsHero, useStatisticsLive } from "../statistics/statistics-hero";
import {
  PhoneBody,
  PhoneCard,
  PhoneFacts,
  PhoneGroup,
  PhoneList,
  PhonePinnedAction,
  phoneBodyStyles as phone,
} from "../statistics/statistics-phone-parts";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";
import type { ExecutiveReportingWeek } from "../statistics/executive-statistics-contract";
import {
  PeopleNotListed,
  ExecutiveStatisticsUnavailable,
  statisticsCountText as reportCount,
} from "../statistics/statistics-small-numbers";
import { PilotMeasuresSection, PilotMeasuresView } from "./pilot-measures-section";
import { reportWeek, weeklyOperationsReport, type WeeklyReport, type ReportWeek } from "./weekly-report";
import { useOwnUnits } from "./use-own-units";
import styles from "./reports.module.css";
import weekly from "./weekly-report.module.css";
import { originName } from "@/components/ward-management/ward-movement-origin";

/** The out of area bands, in the words the rest of the app uses for them. */
const OUT_OF_AREA_META = OUT_OF_AREA_BANDS.map((band) => TRAVEL_BAND_LABELS[band]).join(" or ");
/** The same bands in the few words a phone card's aside holds without clipping (audit stats-14). */
const OUT_OF_AREA_PHONE_META = "Far from home, or by air";

/** Offsets offered in the week picker: this week so far, the last full week, then seven before it. */
const WEEK_OFFSETS = [-1, 0, 1, 2, 3, 4, 5, 6, 7] as const;
const OCCUPIED_TIME_LABEL = "Recorded occupied bed time";
const OCCUPIED_TIME_DEFINITION =
  "Recorded occupied stay time divided by the current total bed count and counted time. Closed beds stay in the denominator; time pulled for arrival is excluded. Historical bed capacity and pull times are not reconstructed.";

function weekLabel(week: ReportWeek, dayZero: Date): string {
  const range = `${dateOf(week.start, dayZero)} to ${dateOf(week.end - 1, dayZero)}`;
  if (week.offset === -1) return `This week so far · ${range}`;
  if (week.offset === 0) return `Last full week · ${range}`;
  return range;
}

function ReasonList({ reasons, testId }: { reasons: { reason: string; count: number | string }[]; testId: string }) {
  if (reasons.length === 0) return null;
  return (
    <ul className={styles.reasons} data-testid={testId}>
      {reasons.map((entry) => (
        <li key={entry.reason}>
          <span>{entry.reason}</span>
          <span className={styles.num}>{entry.count}</span>
        </li>
      ))}
    </ul>
  );
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
      renderPilot={(isPhone) => <PilotMeasuresView measures={selected.pilot} isPhone={isPhone} />}
    />
  );
}

function OperationalWeeklyReport({ offset, setOffset }: WeekPicker) {
  const { state, now, paused, togglePause } = useStatisticsLive();
  const { movements, referrals, admissions, patients, bedReleases, leaveBeds, configuration, dayZero } = state;
  // Beds are the desk's own wards only (issue #628), so its occupancy is its stays over its beds.
  const units = useOwnUnits(state.units);

  const week = useMemo(() => reportWeek(offset, now, dayZero), [offset, now, dayZero]);
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
      renderPilot={(isPhone) => (
        <PilotMeasuresSection
          movements={movements}
          referrals={referrals}
          patients={patients}
          now={now}
          pullHoldMinutes={configuration.pullHoldMinutes}
          units={units}
          morningRollupConfirmations={state.morningRollupConfirmations}
          morningRollupDeadlineMinutes={configuration.morningRollupDeadlineMinutes}
          week={week}
          isPhone={isPhone}
        />
      )}
    />
  );
}

function WeeklyReportView({
  offset,
  setOffset,
  week,
  report,
  dayZero,
  now,
  paused,
  togglePause,
  admissionLabel,
  renderPilot,
  scopeLabel,
}: WeekPicker & {
  week: ReportWeek;
  report: WeeklyViewReport;
  dayZero: Date;
  now: Instant;
  paused: boolean;
  togglePause: (() => void) | null;
  admissionLabel?: (movementId: string) => string;
  renderPilot: (isPhone: boolean) => ReactNode;
  scopeLabel?: string;
}) {
  const pickerId = useId();
  const isPhone = useIsPhone();
  const longestWait =
    report.edWaits.longestMinutes !== null && report.edWaits.count !== 0
      ? splitDuration(report.edWaits.longestMinutes)
      : "—";

  // Whole hours ("24h") on every device, not "1d 0h" here and "24h" on the phone (UX audit 21 Oct 2026).
  const targetText = `over ${Math.round(report.edWaits.targetMinutes / 60)}h`;
  const occupancyText = report.occupancy.averagePercent === null ? "—" : `${report.occupancy.averagePercent}%`;
  const weekRange = `${dateOf(week.start, dayZero)} to ${dateOf(week.end - 1, dayZero)}`;
  const outputMoment = (at: Instant) => formatSheetMoment(at, dayZero, { includeYearAndZone: true });
  // Phone wording in whole hours ("24h"), as the v10 phone drawing reads.
  const longHoursLabel = `${Math.round(report.edWaits.targetMinutes / 60)}h`;
  const phoneTargetText = `over ${longHoursLabel}`;
  // A wait still open is counted to the end of the week shown, so the figure says when it stops.
  const waitedBy = `by ${dateOf(week.countedEnd - 1, dayZero)}`;
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
    delayedFrom === null
      ? null
      : delayedUnknown
        ? "Not enough history. No expected date held for this week."
        : `Latest expected date set ${dateOf(delayedFrom, dayZero)}. Each stay counts from when its date was set`;
  const delayedNote =
    delayedFromNote && delayedSkipped ? `${delayedFromNote}. ${delayedSkipped}` : (delayedFromNote ?? delayedSkipped);
  const delayedDays = delayedUnknown ? "Not known" : report.delayedDischarge.bedDays;
  const delayedPeople = delayedUnknown ? "Not known" : report.delayedDischarge.people;

  return (
    <div className={styles.page} data-testid="ward-weekly-report" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
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
          title="Weekly operations"
          phone={{
            sub: weekRange,
            stats: (
              <>
                <HeroStat value={report.edWaits.count} label={`New ED waits ${longHoursLabel}+`} />
                {/* Phone review F-26 and F-33: each figure names its unit and what it averages. */}
                <HeroStat value={report.outOfArea.bedDays} label="Out of area bed days" />
                <HeroStat value={occupancyText} label={OCCUPIED_TIME_LABEL} />
              </>
            ),
          }}
          titleAction={
            isPhone ? undefined : (
              <span data-print-hide>
                <Button
                  variant="light"
                  size="sm"
                  icon={Printer}
                  onClick={() => {
                    window.print();
                  }}
                  data-testid="ward-weekly-print"
                >
                  Print
                </Button>
              </span>
            )
          }
          stats={
            <>
              <HeroStat value={report.edWaits.count} label={`New ED waits ${targetText}`} />
              <HeroStat value={report.outOfArea.bedDays} label="Out of area bed days" />
              {/* "not enough history" is said in the label, never set as a big figure. */}
              <HeroStat
                value={delayedUnknown ? "—" : delayedDays}
                label={delayedUnknown ? "Delayed discharge days, not enough history yet" : "Delayed discharge days"}
              />
              <HeroStat value={occupancyText} label={OCCUPIED_TIME_LABEL} />
            </>
          }
          paused={paused}
          onTogglePause={togglePause ?? undefined}
        />

        {/* the phone already gives the week in the hero and under the week switch, so the
            exact period line is hidden on a phone screen and kept for desktop and every print. */}
        <p className={`${styles.disclosure} ${weekly.phoneScreenHidden}`} data-testid="ward-weekly-period">
          Period: {outputMoment(week.start)} (inclusive) to {outputMoment(week.end)} (exclusive).
          {week.countedEnd < week.end ? <> Counted to {outputMoment(week.countedEnd)} (exclusive).</> : null}
        </p>

        {isPhone ? (
          <PhoneBody testId="ward-weekly-phone">
            <Segmented<string>
              className={phone.seg}
              size="md"
              label="Week"
              value={String(offset)}
              onChange={(next) => setOffset(Number(next))}
              items={[
                { id: "0", label: "Last full week" },
                { id: "-1", label: "This week so far" },
              ]}
            />
            <p className={phone.note} data-testid="ward-weekly-range">
              {/* the hero sub already names the week, so this line says only when it was made. */}
              {week.countedEnd < week.end ? `Counted to ${outputMoment(week.countedEnd)} · ` : ""}
              Generated {outputMoment(now)}
            </p>
            <PhoneCard
              icon={Clock}
              // the aside "In the week it passed 24h" was cut off at 390px and repeats the title's
              // "first passing", so the title carries it alone.
              title={`ED waits first passing ${phoneTargetText}`}
            >
              <PhoneFacts
                flush
                facts={[
                  {
                    id: "people",
                    label: "Placement journeys",
                    value: report.edWaits.count,
                    testId: "ward-weekly-ed-count",
                  },
                  {
                    id: "longest",
                    label: "Longest",
                    value: longestWait,
                  },
                ]}
              />
            </PhoneCard>
            <PhoneCard icon={Hospital} title="Out of area" aside={OUT_OF_AREA_PHONE_META}>
              <PhoneFacts
                flush
                facts={[
                  { id: "days", label: "Bed days", value: report.outOfArea.bedDays, testId: "ward-weekly-ooa-days" },
                  { id: "people", label: "People", value: report.outOfArea.people },
                ]}
              />
            </PhoneCard>
            <PhoneCard icon={BedDouble} title="Delayed discharge" aside="Past the expected date">
              {delayedUnknown ? (
                <p className={phone.note} data-testid="ward-weekly-delayed-days">
                  Not enough history yet. No expected date was held for this week, so delayed discharge bed days and
                  people cannot be counted.
                </p>
              ) : (
                <PhoneFacts
                  flush
                  facts={[
                    {
                      id: "days",
                      label: "Bed days",
                      value: delayedDays,
                      testId: "ward-weekly-delayed-days",
                    },
                    { id: "people", label: "People", value: delayedPeople },
                  ]}
                />
              )}
              {delayedNote && !delayedUnknown ? (
                <p className={phone.note} data-testid="ward-weekly-delayed-history">
                  {delayedNote}
                </p>
              ) : null}
            </PhoneCard>
            {/* Josh, 30 Oct 2026: declines and overrides share one card, as on desktop. */}
            <PhoneCard icon={XCircle} title="Declines and overrides" aside="Placement and referral">
              <PhoneFacts
                flush
                facts={[
                  { id: "declined-placement", label: "Placement declines", value: report.declines.placement },
                  { id: "declined-referral", label: "Referral declines", value: report.declines.referral },
                  { id: "override-placement", label: "Placement overrides", value: report.overrides.placement },
                  { id: "override-referral", label: "Referral overrides", value: report.overrides.referral },
                ]}
              />
            </PhoneCard>
            <PhoneCard icon={BedDouble} title="Occupancy" aside={`${report.occupancy.beds} current total beds`}>
              <PhoneFacts
                flush
                facts={[
                  {
                    id: "average",
                    label: OCCUPIED_TIME_LABEL,
                    value: occupancyText,
                    testId: "ward-weekly-occupancy",
                  },
                  { id: "now", label: "In use now", value: report.occupancy.now.inUse },
                ]}
              />
              <p className={phone.note} data-testid="ward-weekly-occupancy-definition">
                {OCCUPIED_TIME_DEFINITION}
              </p>
            </PhoneCard>
            <PhoneGroup title={`Waits first passing ${phoneTargetText}`} aside={`${report.edWaits.count} in the week`}>
              {report.edWaits.rows === undefined ? (
                <PeopleNotListed />
              ) : report.edWaits.rows.length === 0 ? (
                <p className={phone.note}>No wait first passed {phoneTargetText} in this week.</p>
              ) : (
                <PhoneList label={`ED waits first passing ${phoneTargetText} in the week`}>
                  {report.edWaits.rows.map((row) => {
                    return (
                      <PhoneListRow
                        key={row.movement.id}
                        as="li"
                        name={admissionLabel?.(row.movement.id)}
                        meta={`${edShortName(edById(row.movement.originEdId)) || (originName(row.movement) ?? row.movement.originEdId)}${row.stillWaiting ? " · still waiting" : ""}`}
                        value={
                          <span className={phone.flagged}>
                            {/* One tone rule with the ED page: red at the long-wait line, amber before. */}
                            <StatusGlyph
                              tone={row.waitedMinutes >= VERY_LONG_WAIT_MINUTES ? "danger" : "warning"}
                              size={9}
                            />
                            {splitDuration(row.waitedMinutes)}
                          </span>
                        }
                        time={waitedBy}
                      />
                    );
                  })}
                </PhoneList>
              )}
            </PhoneGroup>
            {renderPilot(true)}
            <p className={styles.disclosure}>
              Counts only stays, movements and decisions held in this prototype. People who left before it started are
              not held, so earlier weeks read low.
            </p>
            <PhonePinnedAction icon={Printer} onClick={() => window.print()} testId="ward-weekly-print">
              Print the report
            </PhonePinnedAction>
          </PhoneBody>
        ) : (
          <>
            <div className={styles.controls}>
              <Field label="Week" id={pickerId} className={styles.picker}>
                <Select
                  value={String(offset)}
                  onChange={(event) => {
                    setOffset(Number(event.target.value));
                  }}
                  data-testid="ward-weekly-week"
                  data-print-hide
                >
                  {WEEK_OFFSETS.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {weekLabel(reportWeek(candidate, now, dayZero), dayZero)}
                    </option>
                  ))}
                </Select>
              </Field>
              {/* The picker already names the week on screen, so the line repeats it only on paper,
                  where the picker prints as an empty box (UX audit 21 Oct 2026). */}
              <p className={styles.stamp} data-testid="ward-weekly-range">
                <span className={styles.printOnlyInline}>Week: {weekLabel(week, dayZero)} · </span>
                Generated {outputMoment(now)}
              </p>
            </div>

            <div className={styles.grid3}>
              <StatCard title={`ED waits first passing ${targetText}`} icon={Clock}>
                <dl className={styles.figures}>
                  <div className={styles.figure}>
                    <dt>Placement journeys</dt>
                    <dd data-testid="ward-weekly-ed-count">{report.edWaits.count}</dd>
                  </div>
                  <div className={styles.figure}>
                    <dt>Longest wait</dt>
                    <dd>{longestWait}</dd>
                  </div>
                </dl>
                {/* Explanations sit under the figures, so the card titles are not cut (UX audit 21 Oct 2026). */}
                <p className={`${styles.disclosure} ${styles.cardFootNote}`}>
                  Counted in the week the wait passes the target (a default set in Settings)
                </p>
              </StatCard>
              <StatCard title="Out of area" icon={Hospital}>
                <dl className={styles.figures}>
                  <div className={styles.figure}>
                    <dt>Bed days</dt>
                    <dd data-testid="ward-weekly-ooa-days">{report.outOfArea.bedDays}</dd>
                  </div>
                  <div className={styles.figure}>
                    <dt>People</dt>
                    <dd>{report.outOfArea.people}</dd>
                  </div>
                </dl>
                <p className={`${styles.disclosure} ${styles.cardFootNote}`}>{OUT_OF_AREA_META}</p>
              </StatCard>
              <StatCard title="Delayed discharge" icon={BedDouble}>
                {delayedUnknown ? (
                  // with no expected date held for the week, a sentence instead of two "Not known" figures.
                  <p className={weekly.sentence} data-testid="ward-weekly-delayed-days">
                    Not enough history yet. No expected date was held for this week, so delayed discharge bed days and
                    people cannot be counted.
                  </p>
                ) : (
                  <dl className={styles.figures}>
                    <div className={styles.figure}>
                      <dt>Bed days</dt>
                      <dd data-testid="ward-weekly-delayed-days">{delayedDays}</dd>
                    </div>
                    <div className={styles.figure}>
                      <dt>People</dt>
                      <dd>{delayedPeople}</dd>
                    </div>
                  </dl>
                )}
                {delayedNote && !delayedUnknown ? (
                  <p
                    className={`${styles.disclosure} ${styles.cardFootNote}`}
                    data-testid="ward-weekly-delayed-history"
                  >
                    {delayedNote}
                  </p>
                ) : null}
                <p className={`${styles.disclosure} ${styles.cardFootNote}`}>
                  Current expected date, counted only from when it was set (earlier dates are not kept)
                </p>
              </StatCard>
            </div>

            <div className={weekly.grid2}>
              {/* declines and overrides share one card; an empty list is one line, not a card. */}
              <StatCard title="Declines and overrides" icon={XCircle} meta="Placement and referral">
                <div className={weekly.decisionBlocks}>
                  <section className={weekly.decisionBlock} aria-label="Declines">
                    <p className={weekly.decisionHead}>
                      <b>Declines</b>
                      <span className={styles.num}>
                        {report.declines.placement} placement · {report.declines.referral} referral
                      </span>
                    </p>
                    <ReasonList reasons={report.declines.byReason} testId="ward-weekly-declines" />
                  </section>
                  <section className={weekly.decisionBlock} aria-label="Overrides">
                    <p className={weekly.decisionHead}>
                      <b>Overrides</b>
                      <span className={styles.num}>
                        {report.overrides.placement} placement · {report.overrides.referral} referral
                      </span>
                    </p>
                    <ReasonList reasons={report.overrides.byReason} testId="ward-weekly-overrides" />
                  </section>
                </div>
              </StatCard>
              <StatCard title="Occupancy" icon={BedDouble} meta={`${report.occupancy.beds} current total beds`}>
                <dl className={styles.figures}>
                  <div className={styles.figure}>
                    <dt>{OCCUPIED_TIME_LABEL}</dt>
                    <dd data-testid="ward-weekly-occupancy">{occupancyText}</dd>
                    <dd className={styles.figureNote}>{report.occupancy.occupiedBedDays} occupied bed days</dd>
                  </div>
                  <div className={styles.figure}>
                    <dt>In use now</dt>
                    <dd>
                      {report.occupancy.now.inUse} of {report.occupancy.now.beds}
                    </dd>
                    <dd className={styles.figureNote}>{report.occupancy.now.pulled} pulled for arrival</dd>
                  </div>
                </dl>
                <p
                  className={`${styles.disclosure} ${styles.cardFootNote}`}
                  data-testid="ward-weekly-occupancy-definition"
                >
                  {OCCUPIED_TIME_DEFINITION}
                </p>
              </StatCard>
            </div>

            <StatCard
              title={`Waits first passing ${targetText}`}
              icon={Clock}
              meta={`${report.edWaits.count} in the week`}
            >
              {report.edWaits.rows === undefined ? (
                <PeopleNotListed />
              ) : report.edWaits.rows.length === 0 ? (
                <p className={styles.empty}>No wait first passed {targetText} in this week.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-weekly-ed-table">
                    <caption className={styles.srOnly}>
                      ED waits first passing {targetText} in the week, synthetic
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Admission</th>
                        <th scope="col">Emergency department</th>
                        <th scope="col">Opened</th>
                        <th scope="col" className={styles.num}>
                          Waited, {waitedBy}
                        </th>
                        <th scope="col">Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.edWaits.rows.map((row) => (
                        <tr key={row.movement.id}>
                          <th scope="row">{admissionLabel?.(row.movement.id)}</th>
                          <td>{originName(row.movement) ?? row.movement.originEdId}</td>
                          <td className={styles.time}>{outputMoment(row.movement.openedAt as Instant)}</td>
                          <td className={styles.num}>{splitDuration(row.waitedMinutes)}</td>
                          <td>{row.stillWaiting ? "Still waiting" : "Left the ED"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </StatCard>

            {renderPilot(false)}

            <p className={styles.disclosure}>
              Counts only stays, movements and decisions held in this prototype. People who left before it started are
              not held, so earlier weeks read low.
            </p>
          </>
        )}
        <WardPrototypeFooter testId="ward-weekly-footer" note="Synthetic data" />
      </main>
    </div>
  );
}
