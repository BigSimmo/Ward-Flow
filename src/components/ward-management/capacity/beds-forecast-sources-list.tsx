// src/components/ward-management/capacity/beds-forecast-sources-list.tsx
//
// "Where beds are coming from" under the bed forecast. Presentation only: every line comes from
// `bedsForecastSources` (`beds-forecast-sources.ts`) and repeats what a ward recorded, with the
// role that said it and when. Wards are listed by name; nothing here ranks or recommends one.
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import type { BedsForecastSources, ForecastSourceEntry, ForecastSourceWindow } from "./beds-forecast-sources";
import styles from "./beds-forecast.module.css";

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

function windowRange(window: ForecastSourceWindow, now: Instant): string | null {
  if (window.id === "overdue") return null;
  if (window.id === "this_shift") return `to ${formatInstantWithDay(window.until, now)}`;
  return `${formatInstantWithDay(window.from ?? now, now)} to ${formatInstantWithDay(window.until, now)}`;
}

function windowBreakdown(window: ForecastSourceWindow): string {
  const parts = [`${window.confirmed} confirmed`, `${window.expected} expected`, `${window.heldUp} held up`];
  if (window.datedNotFlagged > 0) parts.push(`${window.datedNotFlagged} dated, not flagged`);
  if (window.bookedIn > 0) parts.push(count(window.bookedIn, "admission booked in", "admissions booked in"));
  return parts.join(" · ");
}

function entryText(entry: ForecastSourceEntry, inOverdueGroup: boolean, now: Instant): string {
  const parts = [formatInstantWithDay(entry.expectedAt, now)];
  if (entry.planDate) parts.push("Current discharge plan");
  parts.push(entry.state === "confirmed" ? "Confirmed" : "Expected");
  if (entry.blocker !== null) parts.push(`Held up: ${entry.blocker}`);
  if (entry.waitingOn !== null) parts.push(entry.waitingOn);
  if (entry.preparing) parts.push("Bed being made ready");
  if (entry.overdue && !inOverdueGroup) parts.push("Past the time given");
  return parts.join(" · ");
}

function planDateText(plan: NonNullable<ForecastSourceEntry["planDate"]>, now: Instant): string {
  if (plan.recordedBy !== null) {
    return `plan date set by ${plan.recordedBy}${plan.recordedAt === null ? " (time not recorded)" : `, ${formatInstantWithDay(plan.recordedAt, now)}`}`;
  }
  return plan.recordedAt === null
    ? "plan date update details not recorded"
    : `plan date recorded ${formatInstantWithDay(plan.recordedAt, now)} (role not recorded)`;
}

export function BedsForecastSourcesList({ sources, now }: { sources: BedsForecastSources; now: Instant }) {
  const upcoming = sources.windows.filter((window) => window.id !== "overdue");
  const total = upcoming.reduce((sum, window) => sum + window.total, 0);
  const overdue = sources.windows.find((window) => window.id === "overdue")?.total ?? 0;
  const flaggingWards = new Set(
    upcoming.flatMap((window) => window.wards.filter((ward) => ward.entries.length > 0).map((ward) => ward.unitId)),
  ).size;
  const shift = sources.shiftName.toLowerCase();
  const shiftStart = formatInstantWithDay(sources.shiftStart, now);
  const windows = sources.windows.filter((window) => window.id !== "overdue" || window.wards.length > 0);

  return (
    <details className={styles.sources} data-testid="ward-capacity-beds-forecast-sources">
      <summary className={styles.sourcesSummary}>
        <span className={styles.sourcesTitle}>Where beds are coming from</span>
        <span className={styles.sourcesCount} data-testid="ward-capacity-beds-forecast-sources-total">
          {count(total, "discharge", "discharges")} from {count(flaggingWards, "ward", "wards")}
          {overdue > 0 ? ` · ${overdue} overdue` : ""}
        </span>
      </summary>
      <div
        className={styles.sourcesBody}
        role="region"
        aria-label="Where beds are coming from, by ward"
        // Scrolls inside the panel, so it must take keyboard focus.
        tabIndex={0}
      >
        <p className={styles.caption}>
          {`What each ward has recorded for the next ${sources.hours} hours, with who said it and when. Not a prediction.`}
        </p>
        <p
          className={sources.notUpdatedThisShift > 0 ? styles.sourcesStale : styles.caption}
          data-testid="ward-capacity-beds-forecast-sources-updates"
        >
          {sources.notUpdatedThisShift > 0
            ? `${sources.notUpdatedThisShift} of ${count(sources.openWards, "ward has", "wards have")} not updated since the ${shift} began at ${shiftStart}. Their entries may be out of date.`
            : `Every open ward has updated since the ${shift} began at ${shiftStart}.`}
        </p>
        {windows.map((window) => (
          <SourceWindow key={window.id} window={window} now={now} />
        ))}
        {sources.quietWards.length > 0 ? (
          <p className={styles.sourcesNote} data-testid="ward-capacity-beds-forecast-sources-quiet">
            <span className={styles.sourcesNoteLead}>{`Nothing flagged in the next ${sources.hours} hours: `}</span>
            {sources.quietWards
              .map((ward) => (ward.updatedThisShift ? ward.name : `${ward.name} (no update this shift)`))
              .join(", ")}
            .
          </p>
        ) : null}
        {sources.closedWards.length > 0 ? (
          <p className={styles.sourcesNote} data-testid="ward-capacity-beds-forecast-sources-closed">
            <span className={styles.sourcesNoteLead}>Closed, not counted: </span>
            {sources.closedWards
              .map(
                (ward) =>
                  `${ward.name} (${ward.line}${
                    ward.reopenExpectedAt === null
                      ? ""
                      : `, reopening expected ${formatInstantWithDay(ward.reopenExpectedAt, now)}`
                  })`,
              )
              .join(", ")}
            .
          </p>
        ) : null}
        {sources.laterFlagged > 0 ? (
          <p className={styles.caption}>
            {`${count(sources.laterFlagged, "more discharge", "more discharges")} flagged for after the next ${sources.hours} hours.`}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function SourceWindow({ window, now }: { window: ForecastSourceWindow; now: Instant }) {
  const range = windowRange(window, now);
  const headingId = `beds-forecast-sources-${window.id}`;
  return (
    <section
      className={styles.sourceWindow}
      aria-labelledby={headingId}
      data-testid={`ward-capacity-beds-forecast-sources-${window.id}`}
    >
      <h4 id={headingId} className={styles.sourceWindowTitle}>
        <span>{window.label}</span> {range ? <span className={styles.sourceWindowRange}>{range}</span> : null}{" "}
        <span className={styles.sourceWindowTotal}>{count(window.total, "discharge", "discharges")}</span>
      </h4>
      <p className={styles.caption}>{windowBreakdown(window)}</p>
      {window.wards.length === 0 ? (
        <p className={styles.caption}>No ward has flagged a discharge for this window.</p>
      ) : (
        <ul className={styles.sourceWards}>
          {window.wards.map((ward) => (
            <li key={ward.unitId} className={styles.sourceWard}>
              <div className={styles.sourceWardRow}>
                <span className={styles.sourceWardName}>
                  <SpelledCodes text={ward.name} />
                </span>
                {ward.entries.length > 0 ? <span className={styles.sourceWardCount}>{ward.entries.length}</span> : null}
              </div>
              {ward.updatedThisShift ? null : (
                <p className={styles.sourcesStale}>
                  No update this shift · last {formatInstantWithDay(ward.lastUpdateAt, now)}
                </p>
              )}
              <ul className={styles.sourceEntries}>
                {ward.entries.map((entry) => (
                  <li key={entry.releaseId}>
                    {entryText(entry, window.id === "overdue", now)}
                    <span className={styles.sourceSaid}>
                      {" "}
                      {entry.planDate
                        ? `· ${planDateText(entry.planDate, now)} · release last reported by `
                        : "· said by "}
                      {entry.saidBy}, {formatInstantWithDay(entry.saidAt, now)}
                    </span>
                  </li>
                ))}
                {ward.datedNotFlagged > 0 ? (
                  <li className={styles.sourceEntryNote}>
                    {count(ward.datedNotFlagged, "occupied bed has", "occupied beds have")} a planned discharge date but
                    no discharge flagged
                  </li>
                ) : null}
                {ward.bookedIn > 0 ? (
                  <li className={styles.sourceEntryNote}>
                    {count(ward.bookedIn, "planned admission", "planned admissions")} booked in
                  </li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
