import { minuteOfDay, type Instant } from "./ward-clock";
import { ACT_NOW_SNOOZE_CAP_MINUTES, SHIFT_PATTERN } from "./ward-operational-defaults";

/**
 * Acknowledge, own and snooze for action-inbox rows (stream A, 9 Oct 2026).
 *
 * Pure helpers shared by the reducer (`ward-inbox-reducer.ts`), the Alerts screen and the Tasks
 * drawer. A snooze hides a row from the active list until its return time; it never resolves the
 * fact behind the row, and the row comes back by itself when the time passes.
 */

/** Why a row was snoozed. A closed list, so no typed text reaches the record or browser storage. */
export const SNOOZE_REASONS = [
  { id: "awaiting_call_back", label: "Awaiting call back" },
  { id: "waiting_on_ward", label: "Waiting on ward" },
  { id: "waiting_on_transport", label: "Waiting on transport" },
  { id: "reviewed_nothing_yet", label: "Reviewed, nothing to do yet" },
  { id: "handed_to_another_role", label: "Handed to another role" },
] as const;

export type InboxSnoozeReason = (typeof SNOOZE_REASONS)[number]["id"];

export function snoozeReasonLabel(reason: InboxSnoozeReason): string {
  return SNOOZE_REASONS.find((entry) => entry.id === reason)?.label ?? "Reason not recorded";
}

export function isSnoozeReason(value: unknown): value is InboxSnoozeReason {
  return typeof value === "string" && SNOOZE_REASONS.some((entry) => entry.id === value);
}

/**
 * One entry in a row's snooze history. Append-only, like `InboxCompletionEntry`: the latest entry
 * decides whether the row is snoozed now; nothing already written is edited or removed.
 */
export type InboxSnoozeEntry =
  | { at: Instant; by: string; kind: "snoozed"; until: Instant; reason: InboxSnoozeReason }
  | { at: Instant; by: string; kind: "returned" };

/** Who took ownership of a row and when. Append-only; the latest entry is the current owner. */
export type InboxOwnershipEntry = { at: Instant; by: string };

export type SnoozePresetId = "30m" | "1h" | "4h" | "shift-end";

export const SNOOZE_PRESETS: readonly { id: SnoozePresetId; label: string; minutes?: number }[] = [
  { id: "30m", label: "30m", minutes: 30 },
  { id: "1h", label: "1h", minutes: 60 },
  { id: "4h", label: "4h", minutes: 240 },
  { id: "shift-end", label: "End of shift" },
];

/** The next shift boundary (07:00, 15:00 or 23:00 by default) strictly after `now`. */
export function shiftEndAfter(now: Instant): Instant {
  const clock = minuteOfDay(now);
  const dayStart = now - clock;
  const starts = SHIFT_PATTERN.map((shift) => shift.startMinute).sort((a, b) => a - b);
  const next = starts.find((start) => start > clock);
  return next === undefined ? dayStart + 24 * 60 + starts[0]! : dayStart + next;
}

export function snoozeUntilFor(preset: SnoozePresetId, now: Instant): Instant {
  if (preset === "shift-end") return shiftEndAfter(now);
  const minutes = SNOOZE_PRESETS.find((entry) => entry.id === preset)?.minutes ?? 30;
  return now + minutes;
}

/** Whether a snooze to `until` is allowed: act-now rows may not be hidden past the cap. */
export function snoozeAllowed(until: Instant, now: Instant, actNow: boolean): boolean {
  if (until <= now) return false;
  return !actNow || until - now <= ACT_NOW_SNOOZE_CAP_MINUTES;
}

/** The snooze in force at `now`, or undefined when the row is on the active list. */
export function activeSnooze(
  entries: readonly InboxSnoozeEntry[] | undefined,
  now: Instant,
): Extract<InboxSnoozeEntry, { kind: "snoozed" }> | undefined {
  const latest = entries?.at(-1);
  if (!latest || latest.kind !== "snoozed") return undefined;
  return latest.until > now ? latest : undefined;
}

export function isInboxItemSnoozed(entries: readonly InboxSnoozeEntry[] | undefined, now: Instant): boolean {
  return activeSnooze(entries, now) !== undefined;
}

export function currentInboxOwner(
  entries: readonly InboxOwnershipEntry[] | undefined,
): InboxOwnershipEntry | undefined {
  return entries?.at(-1);
}

/** Splits rows into the active list and the snoozed list, keeping each list's own order. */
export function partitionSnoozed<T extends { id: string }>(
  items: readonly T[],
  snoozes: Readonly<Record<string, readonly InboxSnoozeEntry[]>> | undefined,
  now: Instant,
): { active: T[]; snoozed: T[] } {
  const active: T[] = [];
  const snoozed: T[] = [];
  for (const item of items) {
    (isInboxItemSnoozed(snoozes?.[item.id], now) ? snoozed : active).push(item);
  }
  return { active, snoozed };
}
