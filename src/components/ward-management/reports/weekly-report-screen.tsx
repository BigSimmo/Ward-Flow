"use client";

import { useId, useMemo, useState } from "react";
import { BedDouble, Clock, Hospital, Printer, ShieldAlert, XCircle } from "lucide-react";

import { Button, Field, HeroStat, Select, tableClasses } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatSheetMoment, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { OUT_OF_AREA_BANDS, TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import { edById } from "@/components/ward-management/ward-sites";
import { dateOf } from "@/components/ward-management/statistics/statistics-dates";
import { StatCard, StatisticsHero, useStatisticsLive } from "@/components/ward-management/statistics/statistics-hero";
import { hoursText } from "@/components/ward-management/statistics/statistics-occupancy";

import { reportWeek, weeklyOperationsReport, type ReasonCount, type ReportWeek } from "./weekly-report";
import styles from "./reports.module.css";

/** The out of area bands, in the words the rest of the app uses for them. */
const OUT_OF_AREA_META = OUT_OF_AREA_BANDS.map((band) => TRAVEL_BAND_LABELS[band]).join(" or ");

/** Offsets offered in the week picker: this week so far, the last full week, then six before it. */
const WEEK_OFFSETS = [-1, 0, 1, 2, 3, 4, 5, 6, 7] as const;

function weekLabel(week: ReportWeek, dayZero: Date): string {
  const range = `${dateOf(week.start, dayZero)} to ${dateOf(week.end - 1, dayZero)}`;
  if (week.offset === -1) return `This week so far · ${range}`;
  if (week.offset === 0) return `Last full week · ${range}`;
  return range;
}

function ReasonList({ reasons, testId }: { reasons: ReasonCount[]; testId: string }) {
  if (reasons.length === 0) return <p className={styles.empty}>None recorded</p>;
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
  const { state, now, paused, togglePause } = useStatisticsLive();
  const { movements, referrals, admissions, units, bedReleases, leaveBeds, configuration, dayZero } = state;
  const pickerId = useId();
  const patientOf = usePatientOf();
  const [offset, setOffset] = useState<number>(0);

  const week = useMemo(() => reportWeek(offset, now, dayZero), [offset, now, dayZero]);
  const report = useMemo(
    () =>
      weeklyOperationsReport(
        {
          movements,
          referrals,
          admissions,
          units,
          bedReleases,
          leaveBeds,
          edAccessTargetMinutes: configuration.edAccessTargetMinutes,
          now,
        },
        week,
      ),
    [movements, referrals, admissions, units, bedReleases, leaveBeds, configuration.edAccessTargetMinutes, now, week],
  );

  const targetText = `over ${hoursText(Math.round(report.edWaits.targetMinutes / 60))}`;
  const occupancyText = report.occupancy.averagePercent === null ? "—" : `${report.occupancy.averagePercent}%`;

  return (
    <div className={styles.page} data-testid="ward-weekly-report" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <StatisticsHero
          section="weekly"
          eyebrow={<>Weekly report · synthetic demo data</>}
          title="Weekly operations"
          titleAction={
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
          }
          stats={
            <>
              <HeroStat value={report.edWaits.count} label={`ED waits ${targetText}`} />
              <HeroStat value={report.outOfArea.bedDays} label="Out of area bed days" />
              <HeroStat value={report.delayedDischarge.bedDays} label="Delayed discharge days" />
              <HeroStat value={occupancyText} label="Average occupancy" />
            </>
          }
          paused={paused}
          onTogglePause={togglePause}
        />

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
          <p className={styles.stamp} data-testid="ward-weekly-range">
            {weekLabel(week, dayZero)} · generated {formatSheetMoment(now, dayZero)}
          </p>
        </div>

        <div className={styles.grid3}>
          <StatCard title={`ED waits ${targetText}`} icon={Clock} meta="Target is a default set in Settings">
            <dl className={styles.figures}>
              <div className={styles.figure}>
                <dt>People</dt>
                <dd data-testid="ward-weekly-ed-count">{report.edWaits.count}</dd>
              </div>
              <div className={styles.figure}>
                <dt>Longest wait</dt>
                <dd>{report.edWaits.count > 0 ? splitDuration(report.edWaits.longestMinutes) : "—"}</dd>
              </div>
            </dl>
          </StatCard>
          <StatCard title="Out of area" icon={Hospital} meta={OUT_OF_AREA_META}>
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
          </StatCard>
          <StatCard
            title="Delayed discharge"
            icon={BedDouble}
            meta="Current expected date applied to the week (not a dated plan history)"
          >
            <dl className={styles.figures}>
              <div className={styles.figure}>
                <dt>Bed days</dt>
                <dd data-testid="ward-weekly-delayed-days">{report.delayedDischarge.bedDays}</dd>
              </div>
              <div className={styles.figure}>
                <dt>People</dt>
                <dd>{report.delayedDischarge.people}</dd>
              </div>
            </dl>
          </StatCard>
        </div>

        <div className={styles.grid3}>
          <StatCard
            title="Declines"
            icon={XCircle}
            meta={`${report.declines.placement} placement · ${report.declines.referral} referral`}
          >
            <ReasonList reasons={report.declines.byReason} testId="ward-weekly-declines" />
          </StatCard>
          <StatCard
            title="Overrides"
            icon={ShieldAlert}
            meta={`${report.overrides.placement} placement · ${report.overrides.referral} referral`}
          >
            <ReasonList reasons={report.overrides.byReason} testId="ward-weekly-overrides" />
          </StatCard>
          <StatCard title="Occupancy" icon={BedDouble} meta={`${report.occupancy.beds} beds`}>
            <dl className={styles.figures}>
              <div className={styles.figure}>
                <dt>Average in week</dt>
                <dd data-testid="ward-weekly-occupancy">{occupancyText}</dd>
                <small>{report.occupancy.occupiedBedDays} occupied bed days</small>
              </div>
              <div className={styles.figure}>
                <dt>Occupied now</dt>
                <dd>
                  {report.occupancy.now.occupied} of {report.occupancy.now.beds}
                </dd>
                <small>{report.occupancy.now.pulled} held for arrival</small>
              </div>
            </dl>
          </StatCard>
        </div>

        <StatCard title={`Who waited ${targetText}`} icon={Clock} meta={`${report.edWaits.rows.length} in the week`}>
          {report.edWaits.rows.length === 0 ? (
            <p className={styles.empty}>Nobody waited {targetText}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-weekly-ed-table">
                <caption className={styles.srOnly}>ED waits {targetText} in the week, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Emergency department</th>
                    <th scope="col">Opened</th>
                    <th scope="col" className={styles.num}>
                      Waited
                    </th>
                    <th scope="col">Now</th>
                  </tr>
                </thead>
                <tbody>
                  {report.edWaits.rows.map((row) => (
                    <tr key={row.movement.id}>
                      <th scope="row">{patientOf(row.movement).displayName}</th>
                      <td>{edById(row.movement.originEdId)?.name ?? row.movement.originEdId}</td>
                      <td className={styles.time}>{formatSheetMoment(row.movement.openedAt as Instant, dayZero)}</td>
                      <td className={styles.num}>{splitDuration(row.waitedMinutes)}</td>
                      <td>{row.stillWaiting ? "Still waiting" : "Left the ED"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StatCard>

        <p className={styles.disclosure}>Counts only stays, movements and decisions held in this prototype.</p>
        <WardPrototypeFooter testId="ward-weekly-footer" note="Synthetic data" />
      </main>
    </div>
  );
}
