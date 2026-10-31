"use client";
import { useId } from "react";
import { BarChart3, OctagonAlert } from "lucide-react";
import { Button, Card } from "@/components/wf";
import styles from "./discharge-flow-charts.module.css";

/**
 * The two charts (Discharges direction A, 9 Oct 2026): bed releases per day and held-up releases by
 * barrier. Both HIGHLIGHT: a click marks the matching people in the list and moves them to the top of
 * their group, it never hides anyone. Redesign (Josh, 30 Oct): both count bed releases, the list's own
 * rows, and say "Held up" for a release with a recorded blocker. The day chart can also draw its days
 * as rows, for the narrow column beside the list.
 */

export type DischargeDayKey = number | "past";

export type DischargeDay = {
  key: DischargeDayKey;
  /** Short column label: "Past", "Today", "Sat 10". */
  label: string;
  /** Full spoken name for the button: "Saturday 10 October". */
  name: string;
  expected: number;
  blocked: number;
  weekend: boolean;
};

export type DischargeBarrier = { id: string; label: string; count: number };

const GRID_LINES = 4;

export function DischargeDayChart({
  days,
  selected,
  onSelect,
  onClear,
  layout = "columns",
}: {
  days: DischargeDay[];
  selected: DischargeDayKey | null;
  onSelect: (key: DischargeDayKey) => void;
  onClear: () => void;
  /** "rows": one row a day, as the barrier panel draws its barriers, for the side column. */
  layout?: "columns" | "rows";
}) {
  const totals = days.map((day) => day.expected + day.blocked);
  const headingId = useId();
  const ahead = days.filter((day) => day.key !== "past");
  const mean = ahead.length ? ahead.reduce((sum, day) => sum + day.expected + day.blocked, 0) / ahead.length : 0;
  // Headroom above the tallest column leaves space for its value label.
  const step = Math.max(1, Math.ceil((Math.max(4, ...totals) * 1.15) / GRID_LINES));
  const top = step * GRID_LINES;
  const pct = (value: number) => `${(value / top) * 100}%`;
  const rowMax = Math.max(1, ...totals);
  const dayLabel = (day: DischargeDay, total: number) =>
    `${day.name}: ${total} due, ${day.expected} not held up${day.blocked ? `, ${day.blocked} held up` : ""}`;
  return (
    <Card className={styles.card} aria-labelledby={headingId} data-testid="ward-discharge-day-chart">
      <header className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          <BarChart3 size={16} aria-hidden="true" />
          Expected discharges per day
        </h2>
        <ul className={styles.legend} aria-label="Chart key">
          <li>
            <i className={`${styles.swatch} ${styles.swatchExpected}`} aria-hidden="true" />
            Due
          </li>
          <li>
            <i className={`${styles.swatch} ${styles.swatchBlocked}`} aria-hidden="true" />
            Held up
          </li>
          <li>
            <i className={`${styles.swatch} ${styles.swatchWeekend}`} aria-hidden="true" />
            Weekend
          </li>
          {layout === "columns" ? (
            <li>
              <i className={styles.meanKey} aria-hidden="true" />
              Mean <b>{mean.toFixed(1)}</b> a day
            </li>
          ) : null}
        </ul>
      </header>
      {layout === "rows" ? (
        <ul className={styles.bars} aria-label={`Bed releases, past dates and next ${ahead.length} days`}>
          {days.map((day, index) => {
            const total = totals[index] ?? 0;
            const pressed = selected === day.key;
            return (
              <li key={String(day.key)}>
                <button
                  type="button"
                  className={`${styles.barRow} ${styles.dayRow}`}
                  data-weekend={day.weekend || undefined}
                  aria-pressed={pressed}
                  aria-label={dayLabel(day, total)}
                  onClick={() => (pressed ? onClear() : onSelect(day.key))}
                >
                  <span className={styles.barLabel}>{day.label}</span>
                  <span className={`${styles.track} ${styles.dayTrack}`} aria-hidden="true">
                    {day.expected > 0 ? (
                      <span
                        className={styles.dayFillDue}
                        style={{ width: `${Math.max(2, (day.expected / rowMax) * 100)}%` }}
                      />
                    ) : null}
                    {day.blocked > 0 ? (
                      <span
                        className={styles.dayFillHeld}
                        style={{ width: `${Math.max(2, (day.blocked / rowMax) * 100)}%` }}
                      />
                    ) : null}
                  </span>
                  <b className={styles.barValue} aria-hidden="true">
                    {total}
                  </b>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.scroller}>
          <div
            className={styles.plot}
            role="group"
            aria-label={`Bed releases, past dates and next ${ahead.length} days`}
          >
            <div className={styles.grid} aria-hidden="true">
              {Array.from({ length: GRID_LINES }, (_, index) => {
                const value = step * (index + 1);
                return (
                  <span key={value} className={styles.gridLine} style={{ bottom: pct(value) }}>
                    <span className={styles.gridValue}>{value}</span>
                  </span>
                );
              })}
              <span className={styles.meanLine} style={{ bottom: pct(mean) }} />
            </div>
            {days.map((day, index) => {
              const total = totals[index] ?? 0;
              const pressed = selected === day.key;
              return (
                <button
                  key={String(day.key)}
                  type="button"
                  className={styles.day}
                  data-weekend={day.weekend || undefined}
                  data-past={day.key === "past" || undefined}
                  aria-pressed={pressed}
                  aria-label={dayLabel(day, total)}
                  onClick={() => (pressed ? onClear() : onSelect(day.key))}
                >
                  <span className={styles.stack} aria-hidden="true">
                    <span className={styles.total}>{total}</span>
                    {day.expected > 0 ? (
                      <span className={styles.barExpected} style={{ height: pct(day.expected) }} />
                    ) : null}
                    {day.blocked > 0 ? (
                      <span className={styles.barBlocked} style={{ height: pct(day.blocked) }} />
                    ) : null}
                  </span>
                  <span className={styles.dayLabel} aria-hidden="true">
                    {day.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <footer className={styles.foot}>
        <span>Choose a day to highlight its people in the list.</span>
        {selected !== null ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear day
          </Button>
        ) : null}
      </footer>
    </Card>
  );
}

export function DischargeBarrierBars({
  barriers,
  selected,
  onSelect,
  onClear,
  counts,
}: {
  barriers: DischargeBarrier[];
  selected: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  /** What the bars count: bed releases on Now, people (admission records) on History. */
  counts: "releases" | "people";
}) {
  const headingId = useId();
  const shown = barriers.filter((barrier) => barrier.count > 0);
  const total = shown.reduce((sum, barrier) => sum + barrier.count, 0);
  const max = Math.max(1, ...shown.map((barrier) => barrier.count));
  return (
    <Card className={styles.card} aria-labelledby={headingId} data-testid="ward-discharge-barrier-bars">
      <header className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          <OctagonAlert size={16} aria-hidden="true" />
          Held up by barrier
        </h2>
        {/* Redesign (Josh, 30 Oct): the same held-up releases the hero chip counts, so one figure. */}
        <span className={styles.count}>
          {total} {counts === "releases" ? (total === 1 ? "release" : "releases") : total === 1 ? "person" : "people"}
        </span>
      </header>
      {shown.length === 0 ? (
        <p className={styles.empty}>No release is held up.</p>
      ) : (
        <ul className={styles.bars}>
          {shown.map((barrier) => {
            const pressed = selected === barrier.id;
            return (
              <li key={barrier.id}>
                <button
                  type="button"
                  className={styles.barRow}
                  aria-pressed={pressed}
                  aria-label={`${barrier.label}: ${barrier.count} held up`}
                  onClick={() => (pressed ? onClear() : onSelect(barrier.id))}
                >
                  <span className={styles.barLabel}>{barrier.label}</span>
                  <span className={styles.track} aria-hidden="true">
                    <span
                      className={styles.fill}
                      style={{ width: `${Math.max(4, Math.round((barrier.count / max) * 100))}%` }}
                    />
                  </span>
                  <b className={styles.barValue} aria-hidden="true">
                    {barrier.count}
                  </b>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <footer className={styles.foot}>
        <span>Click a barrier to highlight its people.</span>
        {selected !== null ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </footer>
    </Card>
  );
}
