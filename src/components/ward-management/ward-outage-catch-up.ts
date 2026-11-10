import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { CapacityFigure } from "@/components/ward-management/ward-model-vocabulary";
import {
  lastPackPrintedAt,
  type DowntimePackPrintRecord,
} from "@/components/ward-management/reports/downtime-pack-prints";

/**
 * CATCH-UP AFTER AN OUTAGE (Batch 4 item 25, Josh's approved plan, 10 Nov 2026,
 * D-135). A coordinator records "We were down from __ to __" (`RECORD_OUTAGE_WINDOW`).
 * Until a ward confirms its beds again with the existing "Beds still correct" confirmation
 * (`CONFIRM_CAPACITY`, by the ward itself, at or after the outage ended), that ward is not caught up
 * and every one of its beds reads as not confirmed since the outage.
 *
 * 🔒 **NOTHING GUESSED.** Both times are typed by the coordinator; the event carries no default and
 * the reducer refuses a missing time. Nothing is read from the device, the uptime monitor or the
 * browser's own online record, and nothing is carried over from before the outage: a confirmation
 * made before the outage ended does not count.
 *
 * 🔒 **IT RECORDS ONLY.** Recording an outage changes no bed figure, no confirmation and no stay.
 */

export type OutageWindowRecord = {
  id: string;
  /** When Ward Flow went down, as the coordinator typed it. */
  from: Instant;
  /** When it came back, as the coordinator typed it. */
  to: Instant;
  recordedAt: Instant;
  by: WardFlowRole;
};

export type OutageWindowEvent = {
  type: "RECORD_OUTAGE_WINDOW";
  role: WardFlowRole;
  /** The board clock. Typed `number`, as other event types beside their records. */
  now: number;
  /** Typed by the coordinator. Never pre-filled. */
  from: number;
  /** Typed by the coordinator. Never pre-filled. */
  to: number;
};

type OutageState = { outageWindows?: OutageWindowRecord[] };

const isTime = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);

/** The reducer half. Refuses a missing or non-whole time, an end not after the start, and an end still to come. */
export function reduceOutageWindow<S extends OutageState>(
  state: S,
  event: OutageWindowEvent,
  reject: (state: S, reason: string) => S,
  accept: () => void,
): S {
  if (!isTime(event.from) || !isTime(event.to))
    return reject(state, `${event.type} needs both times typed, from and to`);
  if (event.to <= event.from) return reject(state, "The time Ward Flow came back must be after the time it went down");
  if (event.to > event.now) return reject(state, "The time Ward Flow came back cannot be later than now");
  const records = state.outageWindows ?? [];
  if (records.some((record) => record.from === event.from && record.to === event.to))
    return reject(state, "That outage is already recorded");
  accept();
  const sequence = records.reduce((max, row) => Math.max(max, Number(/^OUT-(\d+)$/u.exec(row.id)?.[1] ?? 0)), 0);
  const record: OutageWindowRecord = {
    id: `OUT-${sequence + 1}`,
    from: event.from,
    to: event.to,
    recordedAt: event.now,
    by: event.role,
  };
  return { ...state, outageWindows: [...records, record] };
}

/**
 * The outage a ward catches up from: the recorded one that ended last, at or before now. `null`
 * when none is recorded, so no ward is ever asked to catch up from a guessed outage.
 */
export function latestOutage(
  records: readonly OutageWindowRecord[] | undefined,
  now: Instant,
): OutageWindowRecord | null {
  let latest: OutageWindowRecord | null = null;
  for (const record of records ?? [])
    if (record.to <= now && (latest === null || record.to > latest.to)) latest = record;
  return latest;
}

type CatchUpUnit = { id: string; beds: number; allocatable: CapacityFigure };

/**
 * When the ward itself last confirmed its beds ("Beds still correct"), or `null`. A figure confirmed
 * by the bed manager or the coordinator is not the ward's confirmation. A figure recorded before
 * `confirmedBy` existed was the ward's own (`CapacityFigure.confirmedBy`).
 */
function wardOwnConfirmationAt(unit: CatchUpUnit): Instant | null {
  const figure = unit.allocatable;
  if (figure.source !== "ward" || (figure.confirmedBy ?? "ward") !== "ward") return null;
  return figure.confirmedAt;
}

/** True when the ward confirmed its beds at or after the outage ended. A confirm before the end does not count. */
export function wardCaughtUp(unit: CatchUpUnit, outage: OutageWindowRecord | null): boolean {
  if (outage === null) return true;
  const at = wardOwnConfirmationAt(unit);
  return at !== null && at >= outage.to;
}

/**
 * The beds (numbered 1 to the ward's bed count) not confirmed since the outage: every bed until the
 * ward confirms, then none. Empty when no outage is recorded.
 */
export function bedsNotConfirmedSinceOutage(unit: CatchUpUnit, outage: OutageWindowRecord | null): number[] {
  if (wardCaughtUp(unit, outage)) return [];
  return Array.from({ length: Math.max(0, unit.beds) }, (_, index) => index + 1);
}

/** True when this one bed has not been confirmed since the outage. */
export function bedNotConfirmedSinceOutage(
  unit: CatchUpUnit,
  bedNumber: number,
  outage: OutageWindowRecord | null,
): boolean {
  return Number.isInteger(bedNumber) && bedNumber >= 1 && bedNumber <= unit.beds && !wardCaughtUp(unit, outage);
}

export type WardCatchUp = {
  unitId: string;
  caughtUp: boolean;
  outage: OutageWindowRecord;
  /** The ward's own last confirmation, or `null`. Shown as recorded, never judged. */
  confirmedAt: Instant | null;
  /** The ward's last pack print at or before the outage ended, or `null` if none was recorded. */
  lastPackPrintedAt: Instant | null;
};

/**
 * What a ward's catch-up prompt reads from: the outage, whether the ward has caught up, and when
 * its last downtime pack was printed (item 24). `null` when no outage is recorded.
 */
export function wardCatchUp(
  unit: CatchUpUnit,
  state: { outageWindows?: readonly OutageWindowRecord[]; downtimePackPrints?: readonly DowntimePackPrintRecord[] },
  now: Instant,
): WardCatchUp | null {
  const outage = latestOutage(state.outageWindows, now);
  if (outage === null) return null;
  return {
    unitId: unit.id,
    caughtUp: wardCaughtUp(unit, outage),
    outage,
    confirmedAt: wardOwnConfirmationAt(unit),
    lastPackPrintedAt: lastPackPrintedAt(state.downtimePackPrints, unit.id, outage.to),
  };
}

/** The wards not yet caught up after the latest outage, in the order given. Empty when none is recorded. */
export function wardsNotCaughtUp(
  units: readonly CatchUpUnit[],
  records: readonly OutageWindowRecord[] | undefined,
  now: Instant,
): string[] {
  const outage = latestOutage(records, now);
  if (outage === null) return [];
  return units.filter((unit) => !wardCaughtUp(unit, outage)).map((unit) => unit.id);
}
