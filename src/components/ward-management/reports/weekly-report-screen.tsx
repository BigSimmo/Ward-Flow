"use client";

import { useId, useMemo, useState } from "react";
import { BedDouble, Clock, Hospital, Printer, ShieldAlert, XCircle } from "lucide-react";

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
import { dateOf } from "@/components/ward-management/statistics/statistics-dates";
import { StatCard, StatisticsHero, useStatisticsLive } from "@/components/ward-management/statistics/statistics-hero";
import { hoursText } from "@/components/ward-management/statistics/statistics-occupancy";
import {
  PhoneBody,
  PhoneCard,
  PhoneFacts,
  PhoneGroup,
  PhoneList,
  PhonePinnedAction,
  phoneBodyStyles as phone,
} from "@/components/ward-management/statistics/statistics-phone-parts";

import { reportWeek, weeklyOperationsReport, type ReasonCount, type ReportWeek } from "./weekly-report";
import styles from "./reports.module.css";

/** The out of area bands, in the words the rest of the app uses for them. */
const OUT_OF_AREA_META = OUT_OF_AREA_BANDS.map((band) => TRAVEL_BAND_LABELS[band]).join(" or ");
/** The same bands in the few words a phone card's aside holds without clipping (audit stats-14). */
const OUT_OF_AREA_PHONE_META = "Far from home, or by air";

/** Offsets offered in the week picker: this week so far, the last full week, then seven before it. */
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
  const { movements, referrals, admissions, patients, units, bedReleases, leaveBeds, configuration, dayZero } = state;
  const pickerId = useId();
  const [offset, setOffset] = useState<number>(0);
  const isPhone = useIsPhone();

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

  const targetText = `over ${hoursText(Math.round(report.edWaits.targetMinutes / 60))}`;
  const occupancyText = report.occupancy.averagePercent === null ? "—" : `${report.occupancy.averagePercent}%`;
  const weekRange = `${dateOf(week.start, dayZero)} to ${dateOf(week.end - 1, dayZero)}`;
  // Phone wording in whole hours ("24h"), as the v10 phone drawing reads.
  const longHoursLabel = `${Math.round(report.edWaits.targetMinutes / 60)}h`;
  const phoneTargetText = `over ${longHoursLabel}`;
  // A wait still open is counted to the end of the week shown, so the figure says when it stops.
  const waitedBy = `by ${dateOf(week.countedEnd - 1, dayZero)}`;
  // Statistics names a person by AD- admission number only, never a name, UMRN or WF- id (D-39).
  // A wait that has not led to an admission says so; the live page still shows who it is.
  const admissionLabel = (movementId: string) =>
    admissions.find((admission) => admission.movementId === movementId)?.id ?? "Not yet admitted";
  // Expected dates set after the week began leave the week only partly measured (audit stats-11).
  const delayedFrom = report.delayedDischarge.recordedFrom;
  const delayedUnknown = delayedFrom !== null && delayedFrom >= week.countedEnd;
  const delayedUnmeasured = report.delayedDischarge.unmeasuredStays;
  const delayedSkipped =
    !delayedUnknown && delayedUnmeasured > 0
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
          eyebrow={isPhone ? "Statistics · Weekly report" : <>Weekly report · synthetic demo data</>}
          title="Weekly operations"
          phone={{
            sub: weekRange,
            stats: (
              <>
                <HeroStat value={report.edWaits.count} label={`New ED waits ${longHoursLabel}+`} />
                {/* Phone review F-26 and F-33: each figure names its unit and what it averages. */}
                <HeroStat value={report.outOfArea.bedDays} label="Out of area bed days" />
                <HeroStat
                  value={occupancyText}
                  label={offset === 0 ? "Average in use, last full week" : "Average in use, this week so far"}
                />
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
              <HeroStat value={delayedDays} label="Delayed discharge days" />
              <HeroStat value={occupancyText} label="Average occupancy" />
            </>
          }
          paused={paused}
          onTogglePause={togglePause}
        />

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
              {weekLabel(week, dayZero)} · generated {formatSheetMoment(now, dayZero)}
            </p>
            <PhoneCard
              icon={Clock}
              title={`ED waits first passing ${phoneTargetText}`}
              aside={`In the week it passed ${longHoursLabel}`}
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
                    value: report.edWaits.count > 0 ? splitDuration(report.edWaits.longestMinutes) : "—",
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
              {delayedNote ? (
                <p className={phone.note} data-testid="ward-weekly-delayed-history">
                  {delayedNote}
                </p>
              ) : null}
            </PhoneCard>
            <PhoneCard icon={XCircle} title="Declines" aside="Placement and referral">
              <PhoneFacts
                flush
                facts={[
                  { id: "placement", label: "Placement", value: report.declines.placement },
                  { id: "referral", label: "Referral", value: report.declines.referral },
                ]}
              />
            </PhoneCard>
            <PhoneCard icon={ShieldAlert} title="Overrides" aside="Placement and referral">
              <PhoneFacts
                flush
                facts={[
                  { id: "placement", label: "Placement", value: report.overrides.placement },
                  { id: "referral", label: "Referral", value: report.overrides.referral },
                ]}
              />
            </PhoneCard>
            <PhoneCard icon={BedDouble} title="Beds in use" aside={`${report.occupancy.beds} beds`}>
              <PhoneFacts
                flush
                facts={[
                  { id: "average", label: "Average in week", value: occupancyText, testId: "ward-weekly-occupancy" },
                  { id: "now", label: "In use now", value: report.occupancy.now.inUse },
                ]}
              />
            </PhoneCard>
            <PhoneGroup
              title={`Waits first passing ${phoneTargetText}`}
              aside={`${report.edWaits.rows.length} in the week`}
            >
              {report.edWaits.rows.length === 0 ? (
                <p className={phone.note}>No wait first passed {phoneTargetText} in this week.</p>
              ) : (
                <PhoneList label={`ED waits first passing ${phoneTargetText} in the week`}>
                  {report.edWaits.rows.map((row) => {
                    return (
                      <PhoneListRow
                        key={row.movement.id}
                        as="li"
                        name={admissionLabel(row.movement.id)}
                        meta={`${edShortName(edById(row.movement.originEdId)) || row.movement.originEdId}${row.stillWaiting ? " · still waiting" : ""}`}
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
              <p className={styles.stamp} data-testid="ward-weekly-range">
                {weekLabel(week, dayZero)} · generated {formatSheetMoment(now, dayZero)}
              </p>
            </div>

            <div className={styles.grid3}>
              <StatCard
                title={`ED waits first passing ${targetText}`}
                icon={Clock}
                meta="Counted in the week the wait passes the target (a default set in Settings)"
              >
                <dl className={styles.figures}>
                  <div className={styles.figure}>
                    <dt>Placement journeys</dt>
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
                meta="Current expected date, counted only from when it was set (earlier dates are not kept)"
              >
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
                {delayedNote ? (
                  <p className={styles.disclosure} data-testid="ward-weekly-delayed-history">
                    {delayedNote}
                  </p>
                ) : null}
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
                    <dd className={styles.figureNote}>{report.occupancy.occupiedBedDays} occupied bed days</dd>
                  </div>
                  <div className={styles.figure}>
                    <dt>In use now</dt>
                    <dd>
                      {report.occupancy.now.inUse} of {report.occupancy.now.beds}
                    </dd>
                    <dd className={styles.figureNote}>{report.occupancy.now.pulled} held for arrival</dd>
                  </div>
                </dl>
              </StatCard>
            </div>

            <StatCard
              title={`Waits first passing ${targetText}`}
              icon={Clock}
              meta={`${report.edWaits.rows.length} in the week`}
            >
              {report.edWaits.rows.length === 0 ? (
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
                          <th scope="row">{admissionLabel(row.movement.id)}</th>
                          <td>{edById(row.movement.originEdId)?.name ?? row.movement.originEdId}</td>
                          <td className={styles.time}>
                            {formatSheetMoment(row.movement.openedAt as Instant, dayZero)}
                          </td>
                          <td className={styles.num}>{splitDuration(row.waitedMinutes)}</td>
                          <td>{row.stillWaiting ? "Still waiting" : "Left the ED"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </StatCard>

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
