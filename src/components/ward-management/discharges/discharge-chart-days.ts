import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { matchesHighlight, perthDay, recordStatus } from "./discharge-board-model";
import type { DischargeDay } from "./discharge-flow-charts";

/** Days the chart covers after today; the column before them gathers every date already passed. */
const CHART_DAYS_AHEAD = 14;

/**
 * The discharge board's day chart, moved out of discharge-board.tsx (PR #1583) to keep that file
 * under its line cap. Now counts open bed releases; History counts open admission records.
 */
export function dischargeChartDays({
  now,
  dayZero,
  nowView,
  units,
  openReleases,
  openScopedRecords,
}: {
  now: Instant;
  dayZero: Date;
  nowView: boolean;
  units: readonly Unit[];
  openReleases: readonly BedRelease[];
  openScopedRecords: readonly DischargeRecord[];
}): DischargeDay[] {
  const today = dayOf(now);
  const chartDays: DischargeDay[] = [
    {
      key: "past",
      // DC5 (Josh, 3 Nov 2026): the expected dates already gone by read "Overdue", not "Passed".
      label: "Overdue",
      name: "Overdue, expected date already passed",
      expected: 0,
      blocked: 0,
      weekend: false,
    },
    ...Array.from({ length: CHART_DAYS_AHEAD }, (_, index): DischargeDay => {
      const noon = (today + index) * MINUTES_PER_DAY + 12 * 60;
      const weekday = perthDay(noon, dayZero, { weekday: "short" });
      return {
        key: index,
        label: index === 0 ? "Today" : `${weekday} ${perthDay(noon, dayZero, { day: "numeric" })}`,
        name: perthDay(noon, dayZero, { weekday: "long", day: "numeric", month: "long" }),
        expected: 0,
        blocked: 0,
        weekend: weekday === "Sat" || weekday === "Sun",
      };
    }),
  ];
  const dayOfChart = (at: number | null) =>
    chartDays.find((candidate) => matchesHighlight({ kind: "day", day: candidate.key }, at, null, now));
  if (nowView) {
    // Now: every open bed release in scope by its expected day, as Capacity's forecast counts
    // recorded discharges; the red part is the held-up ones, as the list says. Closed wards are left
    // out, as Capacity's forecast leaves them out (Josh, 30 Oct 2026), so the two pages agree.
    const closedUnitIds = new Set(units.filter((unit) => unit.isClosed).map((unit) => unit.id));
    for (const release of openReleases) {
      if (closedUnitIds.has(release.unitId)) continue;
      const day = dayOfChart(release.expectedAt);
      if (!day) continue;
      if (release.blocker !== null) day.blocked += 1;
      else day.expected += 1;
    }
  } else {
    for (const record of openScopedRecords) {
      const day = dayOfChart(record.expectedDischargeAt);
      if (!day) continue;
      if (recordStatus(record) === "blocked") day.blocked += 1;
      else day.expected += 1;
    }
  }
  return chartDays;
}
