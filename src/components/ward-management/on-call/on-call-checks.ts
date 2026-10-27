import { MINUTES_PER_DAY, dayOf, type Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";

import type { DirectoryEntry } from "./on-call-directory";

/** Days since the last check after which an entry reads "Not checked in over N days". */
export const CHECK_DUE_DAYS = 40;

/**
 * Closing-the-loop features (24 Oct 2026, package E): "On-call directory last checked".
 *
 * Each directory entry shows when it was last checked and by which desk, and a factual "Not checked
 * in over N days" note once the last check is older than `CHECK_DUE_DAYS` (the on-call directory's
 * own named constant). Anyone with the directory open can mark an entry as checked now, which records
 * the entry id, the time and the desk (`RECORD_DIRECTORY_CHECK`). The entries and their numbers stay
 * the synthetic mocks in `on-call-directory.ts`; a check records that someone looked, nothing more.
 * It never changes a number and nothing is re-ordered by it.
 */

/** One recorded check: the entry, when, and the desk. Never a person, never typed text. */
export type DirectoryCheckRecord = { entryId: string; at: Instant; by: WardFlowRole };

export type DirectoryCheckEvent = {
  type: "RECORD_DIRECTORY_CHECK";
  role: WardFlowRole;
  now: Instant;
  /** A `DirectoryEntry.id` from the synthetic directory. */
  entryId: string;
};

/** Directory entry ids are short slugs built from fixed words and site codes. */
const ENTRY_ID = /^[a-z0-9][a-z0-9:_-]{0,79}$/i;

export function isDirectoryEntryId(value: unknown): value is string {
  return typeof value === "string" && ENTRY_ID.test(value);
}

export function reduceDirectoryCheck(
  state: WardFlowState,
  event: DirectoryCheckEvent,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  if (!isDirectoryEntryId(event.entryId))
    return reject(state, event, "RECORD_DIRECTORY_CHECK entryId is not an entry id");
  const record: DirectoryCheckRecord = { entryId: event.entryId, at: event.now, by: event.role };
  // The latest check per entry is kept; the audit log holds each one.
  const others = (state.directoryChecks ?? []).filter((check) => check.entryId !== event.entryId);
  return { ...state, directoryChecks: [...others, record] };
}

/** The seeded synthetic check, before any recorded one: a day count and a desk from the entry. */
export type LastCheck = { at: Instant; by: WardFlowRole; daysAgo: number; recorded: boolean };

export function lastCheckOf(
  entry: Pick<DirectoryEntry, "id" | "checkedDaysAgo" | "checkedBy">,
  checks: readonly DirectoryCheckRecord[] | undefined,
  now: Instant,
): LastCheck {
  const recorded = checks?.find((check) => check.entryId === entry.id);
  if (recorded) {
    return { at: recorded.at, by: recorded.by, daysAgo: Math.max(0, dayOf(now) - dayOf(recorded.at)), recorded: true };
  }
  return {
    at: now - entry.checkedDaysAgo * MINUTES_PER_DAY,
    by: entry.checkedBy,
    daysAgo: entry.checkedDaysAgo,
    recorded: false,
  };
}

/** Over the directory's own threshold since the last check. */
export function checkIsDue(check: Pick<LastCheck, "daysAgo">): boolean {
  return check.daysAgo > CHECK_DUE_DAYS;
}

/** "Checked today by Bed coordinator", "Checked 12 days ago by Bed manager". */
export function lastCheckText(check: LastCheck): string {
  const when = check.daysAgo === 0 ? "today" : check.daysAgo === 1 ? "yesterday" : `${check.daysAgo} days ago`;
  return `Checked ${when} by ${WARD_FLOW_ROLE_LABELS[check.by]}`;
}

/** The factual note past the threshold, or nothing. */
export function notCheckedNote(check: LastCheck): string | undefined {
  return checkIsDue(check) ? `Not checked in over ${CHECK_DUE_DAYS} days` : undefined;
}

/**
 * The directory with each recorded check applied: `checkedDaysAgo` and `checkedBy` then describe the
 * latest check, so every count, filter and foot on the page reads the same figure. Order unchanged.
 */
export function withRecordedChecks(
  entries: readonly DirectoryEntry[],
  checks: readonly DirectoryCheckRecord[] | undefined,
  now: Instant,
): DirectoryEntry[] {
  if (!checks || checks.length === 0) return [...entries];
  return entries.map((entry) => {
    const check = lastCheckOf(entry, checks, now);
    return check.recorded ? { ...entry, checkedDaysAgo: check.daysAgo, checkedBy: check.by } : entry;
  });
}
