// Item 5, delayed discharge reasons (owner ruling, Josh, 9 Nov 2026, recorded on
// `DELAYED_DISCHARGE_REASONS` in `ward-admissions.ts`): a stay recorded "clinically ready since" a
// day, with the one reason it has not ended. Pure derivations, plus the two discharge-reason event
// shapes (moved out of `ward-flow-events.ts` to keep it under its line cap).
import {
  DELAYED_DISCHARGE_REASON_SHORT,
  DELAYED_DISCHARGE_REASONS,
  type Admission,
  type DelayedDischargeReason,
  type DischargeBarrier,
} from "./ward-admissions";
import { daysBetween, MINUTES_PER_DAY, perthDateLabel, type Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";

/** The long-stay hold-up, and (item 5, Josh, 9 Nov 2026) clinically ready since a day and why not gone. */
export type DischargeReasonEvent =
  | {
      type: "SET_DISCHARGE_BARRIER";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      admissionId: string;
      barrier: DischargeBarrier | "None" | null;
    }
  | {
      /** null clears both the day and the reason. */
      type: "SET_CLINICALLY_READY";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      admissionId: string;
      ready: { since: Instant; reason: DelayedDischargeReason } | null;
    };

/** One stay's current record: since when, why not gone, and whole days delayed so far. */
export type ClinicallyReadyLine = { since: Instant; reason: DelayedDischargeReason; days: number };

/** The stay's clinically ready record, or null when none is recorded (or it is half recorded). */
export function clinicallyReadyOf(
  admission: Pick<Admission, "clinicallyReadySince" | "delayedDischargeReason">,
  now: Instant,
): ClinicallyReadyLine | null {
  const since = admission.clinicallyReadySince;
  const reason = admission.delayedDischargeReason;
  if (typeof since !== "number" || !Number.isFinite(since) || !reason) return null;
  return { since, reason, days: Math.max(0, daysBetween(since, now)) };
}

/** "Ready since 4 Nov · Housing · 5 days"; without a calendar, "Ready 5 days · Housing". */
export function clinicallyReadyText(line: ClinicallyReadyLine, dayZero: Date | null): string {
  const days = `${line.days} ${line.days === 1 ? "day" : "days"}`;
  const reason = DELAYED_DISCHARGE_REASON_SHORT[line.reason];
  if (dayZero === null) return `Ready ${days} · ${reason}`;
  return `Ready since ${perthDateLabel(line.since, dayZero, { day: "numeric", month: "short" })} · ${reason} · ${days}`;
}

export type DelayedReasonRow = { reason: DelayedDischargeReason; bedDays: number; stays: number };
export type DelayedBedDaysTable = { rows: DelayedReasonRow[]; bedDays: number; stays: number };
export type DelayedBedDaysByReason = {
  network: DelayedBedDaysTable;
  wards: (DelayedBedDaysTable & { unitId: string })[];
};

/** Bed days to one decimal, as the weekly report writes them. */
function bedDaysOf(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_DAY) * 10) / 10;
}

function table(
  minutesByReason: Map<DelayedDischargeReason, number>,
  staysByReason: Map<DelayedDischargeReason, number>,
) {
  const rows = DELAYED_DISCHARGE_REASONS.map((reason) => ({
    reason,
    bedDays: bedDaysOf(minutesByReason.get(reason) ?? 0),
    stays: staysByReason.get(reason) ?? 0,
  }));
  return {
    rows,
    // The total is the sum of the rows as shown, so the table always adds up.
    bedDays: Math.round(rows.reduce((sum, row) => sum + row.bedDays * 10, 0)) / 10,
    stays: rows.reduce((sum, row) => sum + row.stays, 0),
  };
}

/**
 * Delayed bed days by reason over `[from, to)`, per ward and across the network of `unitIds`.
 *
 * A stay's delay runs from its ready-since day (or its arrival, if later) to when it left, or to
 * `to` while it is still on the ward. The whole delay is counted under the reason recorded now:
 * earlier reasons are not kept. A stay with no ready-since date, or one cleared, counts nothing.
 * `to` should not be later than now, so time not yet lived is never counted.
 */
export function delayedBedDaysByReason(
  admissions: readonly Admission[],
  unitIds: readonly string[],
  period: { from: Instant; to: Instant },
): DelayedBedDaysByReason {
  const minutes = new Map<string, Map<DelayedDischargeReason, number>>();
  const stays = new Map<string, Map<DelayedDischargeReason, number>>();
  for (const unitId of unitIds) {
    minutes.set(unitId, new Map());
    stays.set(unitId, new Map());
  }
  for (const admission of admissions) {
    const unitMinutes = minutes.get(admission.unitId);
    const unitStays = stays.get(admission.unitId);
    const ready = clinicallyReadyOf(admission, period.to);
    if (!unitMinutes || !unitStays || !ready || admission.arrivedAt === null) continue;
    const start = Math.max(ready.since, admission.arrivedAt);
    const end =
      admission.state === "departed" ? (admission.leftAt ?? start) : admission.state === "occupied" ? period.to : start;
    const overlap = Math.max(0, Math.min(end, period.to) - Math.max(start, period.from));
    if (overlap <= 0) continue;
    unitMinutes.set(ready.reason, (unitMinutes.get(ready.reason) ?? 0) + overlap);
    unitStays.set(ready.reason, (unitStays.get(ready.reason) ?? 0) + 1);
  }
  const networkMinutes = new Map<DelayedDischargeReason, number>();
  const networkStays = new Map<DelayedDischargeReason, number>();
  for (const unitId of unitIds) {
    for (const [reason, value] of minutes.get(unitId) ?? []) {
      networkMinutes.set(reason, (networkMinutes.get(reason) ?? 0) + value);
    }
    for (const [reason, value] of stays.get(unitId) ?? []) {
      networkStays.set(reason, (networkStays.get(reason) ?? 0) + value);
    }
  }
  return {
    network: table(networkMinutes, networkStays),
    wards: unitIds.map((unitId) => ({
      unitId,
      ...table(minutes.get(unitId) ?? new Map(), stays.get(unitId) ?? new Map()),
    })),
  };
}
