import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { currentShiftStartInstant, shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/**
 * Feature 10 (Josh, 9 Nov 2026): "Staff needed". A ward, the bed coordinator or the site bed manager
 * logs that a ward needs more staff to meet its current patient demand, for this shift or the next.
 * Every desk sees the open request; the coordinator or bed manager closes it once staff are arranged
 * (or cannot be), and the ward may withdraw its own.
 *
 * 🔒 **IT RECORDS ONLY.** Nothing here orders staff, books an agency or sends a message. A request
 * never changes a bed count, an eligibility answer or any clinical rule.
 *
 * 🔒 **NO TYPED TEXT.** A request holds a ward id, a chosen shift, a count, chosen reasons, times and
 * roles. Never a person and never free text.
 */

export const STAFF_REQUEST_SHIFTS = ["this_shift", "next_shift"] as const;
export type StaffRequestShift = (typeof STAFF_REQUEST_SHIFTS)[number];
/** Extra staff asked for. 4 reads "4 or more". */
export const STAFF_REQUEST_COUNTS = [1, 2, 3, 4] as const;
export type StaffRequestCount = (typeof STAFF_REQUEST_COUNTS)[number];
export const STAFF_REQUEST_REASONS = [
  "constant_observation",
  "high_acuity",
  "admissions_expected",
  "staff_short",
  "other",
] as const;
export type StaffRequestReason = (typeof STAFF_REQUEST_REASONS)[number];
export const STAFF_REQUEST_OUTCOMES = ["arranged", "withdrawn", "not_available"] as const;
type StaffRequestOutcome = (typeof STAFF_REQUEST_OUTCOMES)[number];

export const STAFF_REQUEST_SHIFT_LABELS: Record<StaffRequestShift, string> = {
  this_shift: "This shift",
  next_shift: "Next shift",
};
export const STAFF_REQUEST_REASON_LABELS: Record<StaffRequestReason, string> = {
  constant_observation: "Constant observation",
  high_acuity: "High acuity",
  admissions_expected: "Admissions expected",
  staff_short: "Staff short (leave or vacancy)",
  other: "Other",
};
export const staffCountLabel = (count: number) => (count >= 4 ? "4 or more" : String(count));

/** One request. `updatedAt` is set when the same ward and shift asked again before it closed. */
export type StaffRequestRecord = {
  id: string;
  unitId: string;
  /** Start of the shift the staff are for, so "this shift" stays true after the shift changes. */
  shiftStartAt: Instant;
  count: StaffRequestCount;
  reasons: StaffRequestReason[];
  requestedAt: Instant;
  requestedBy: WardFlowRole;
  updatedAt?: Instant;
  closedAt?: Instant;
  closedBy?: WardFlowRole;
  outcome?: StaffRequestOutcome;
};

export type StaffRequestEvent =
  | {
      type: "REQUEST_WARD_STAFF";
      role: WardFlowRole;
      /** The board clock. Typed `number`, as other event types beside their records, so the re-anchor guard reads records only. */
      now: number;
      unitId: string;
      /** Claim, not proof, as `SET_BED_CLOSED`: required of a ward desk, which asks for itself only. */
      actingUnitId?: string;
      shift: StaffRequestShift;
      /**
       * The start of the shift the desk chose, read on its own clock when it pressed save. The
       * shared server stamps its own `now`, so without this a "This shift" pressed at 14:59 and
       * saved at 15:00 would land on the 15:00 shift. The reducer keeps it only when it is the
       * chosen shift's start within `STAFF_REQUEST_SHIFT_TOLERANCE_MINUTES` of `now`.
       */
      shiftStartAt?: number;
      count: StaffRequestCount;
      reasons: StaffRequestReason[];
    }
  | {
      type: "CLOSE_WARD_STAFF_REQUEST";
      role: WardFlowRole;
      now: number;
      requestId: string;
      /** The request's ward, so the shared server keeps the close inside the desk's wards. */
      unitId: string;
      actingUnitId?: string;
      outcome: StaffRequestOutcome;
    };

type Reject = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

/** When the shift a request is for ends. */
const staffRequestEndsAt = (record: Pick<StaffRequestRecord, "shiftStartAt">) => shiftEndInstant(record.shiftStartAt);

const isOpen = (record: StaffRequestRecord, now: Instant) =>
  record.outcome === undefined && now < staffRequestEndsAt(record);

/** Requests not closed whose shift has not ended, oldest first. For any screen (Handover, pins, alerts). */
export function openStaffRequests(
  state: { staffRequests?: readonly StaffRequestRecord[] },
  now: Instant,
): StaffRequestRecord[] {
  return (state.staffRequests ?? [])
    .filter((record) => isOpen(record, now))
    .sort((a, b) => a.shiftStartAt - b.shiftStartAt || a.requestedAt - b.requestedAt);
}

/** The open request for one ward, the earliest shift first. */
export function openStaffRequestFor(
  records: readonly StaffRequestRecord[] | undefined,
  unitId: string,
  now: Instant,
): StaffRequestRecord | undefined {
  return openStaffRequests({ staffRequests: records }, now)
    .filter((record) => record.unitId === unitId)
    .sort((a, b) => a.shiftStartAt - b.shiftStartAt)[0];
}

/** "this shift" or "next shift", read against now. */
export function staffRequestShiftWord(record: Pick<StaffRequestRecord, "shiftStartAt">, now: Instant): string {
  return record.shiftStartAt <= now ? "this shift" : "next shift";
}

/** "Staff requested 10:44 · 2 · this shift". */
export function staffRequestTagText(record: StaffRequestRecord, now: Instant): string {
  return `Staff requested ${formatInstantWithDay(record.updatedAt ?? record.requestedAt, now)} · ${record.count >= 4 ? "4+" : record.count} · ${staffRequestShiftWord(record, now)}`;
}

/** The start of the shift a "This shift" or "Next shift" choice names at `now`. */
export function staffRequestShiftStart(shift: StaffRequestShift, now: Instant): Instant {
  return shift === "this_shift" ? currentShiftStartInstant(now) : shiftEndInstant(now);
}

/** How long a save may take to reach the shared board and still keep the shift the desk chose. */
export const STAFF_REQUEST_SHIFT_TOLERANCE_MINUTES = 5;

/**
 * The shift the request is for: the desk's own `shiftStartAt` when it is what the chosen word
 * meant at some moment within the tolerance before `now`, otherwise the shift read at `now`.
 * Shifts are hours long, so checking both ends of the window covers every moment in it.
 */
function chosenShiftStart(event: Extract<StaffRequestEvent, { type: "REQUEST_WARD_STAFF" }>): Instant {
  const atNow = staffRequestShiftStart(event.shift, event.now);
  const chosen = event.shiftStartAt;
  if (typeof chosen !== "number" || !Number.isFinite(chosen)) return atNow;
  const pressedAt = event.now - STAFF_REQUEST_SHIFT_TOLERANCE_MINUTES;
  return chosen === atNow || chosen === staffRequestShiftStart(event.shift, pressedAt) ? chosen : atNow;
}

export function reduceStaffRequest(state: WardFlowState, event: StaffRequestEvent, reject: Reject): WardFlowState {
  const records = state.staffRequests ?? [];
  if (event.role === "ward" && event.actingUnitId !== event.unitId)
    return reject(state, event, `${event.type} by a ward names its own ward only`);
  if (event.type === "REQUEST_WARD_STAFF") {
    if (!state.units.some((unit) => unit.id === event.unitId))
      return reject(state, event, `no unit found for id ${event.unitId}`);
    if (!STAFF_REQUEST_SHIFTS.includes(event.shift))
      return reject(state, event, "REQUEST_WARD_STAFF shift must be this shift or next shift");
    if (!STAFF_REQUEST_COUNTS.includes(event.count))
      return reject(state, event, "REQUEST_WARD_STAFF count must be 1, 2, 3 or 4 or more");
    const reasons = Array.isArray(event.reasons) ? event.reasons : [];
    if (
      reasons.length === 0 ||
      new Set(reasons).size !== reasons.length ||
      !reasons.every((reason) => STAFF_REQUEST_REASONS.includes(reason))
    )
      return reject(state, event, "REQUEST_WARD_STAFF needs one or more reasons chosen from the list");
    const shiftStartAt = chosenShiftStart(event);
    // D-158: a "This shift" pressed just before the shift ends, and saved just after, would
    // otherwise keep the ended shift — accepted, immediately not open, and unable to be closed.
    // "Next shift" across the same boundary stays valid and is kept.
    if (event.shift === "this_shift" && event.now >= staffRequestEndsAt({ shiftStartAt }))
      return reject(state, event, "This shift has already ended. Choose this shift or next shift again");
    const ordered = STAFF_REQUEST_REASONS.filter((reason) => reasons.includes(reason));
    // One open request per ward per shift: asking again updates it rather than adding a second.
    const existing = records.find(
      (record) => record.unitId === event.unitId && record.shiftStartAt === shiftStartAt && isOpen(record, event.now),
    );
    if (existing) {
      const updated: StaffRequestRecord = { ...existing, count: event.count, reasons: ordered, updatedAt: event.now };
      return { ...state, staffRequests: records.map((record) => (record === existing ? updated : record)) };
    }
    const record: StaffRequestRecord = {
      id: `SR-${records.reduce((max, row) => Math.max(max, Number(/^SR-(\d+)$/u.exec(row.id)?.[1] ?? 0)), 0) + 1}`,
      unitId: event.unitId,
      shiftStartAt,
      count: event.count,
      reasons: ordered,
      requestedAt: event.now,
      requestedBy: event.role,
    };
    return { ...state, staffRequests: [...records, record] };
  }
  const record = records.find((candidate) => candidate.id === event.requestId);
  if (!record || record.unitId !== event.unitId)
    return reject(state, event, "There is no staff request on this ward to close");
  if (!isOpen(record, event.now)) return reject(state, event, "This staff request is already closed");
  if (!STAFF_REQUEST_OUTCOMES.includes(event.outcome))
    return reject(state, event, "CLOSE_WARD_STAFF_REQUEST outcome must be chosen from the list");
  // The ward may take back its own request; arranging staff is the coordinator's or bed manager's.
  if (event.role === "ward" && event.outcome !== "withdrawn")
    return reject(state, event, "A ward may withdraw its staff request; the coordinator records the outcome");
  const closed: StaffRequestRecord = { ...record, closedAt: event.now, closedBy: event.role, outcome: event.outcome };
  return { ...state, staffRequests: records.map((candidate) => (candidate === record ? closed : candidate)) };
}
