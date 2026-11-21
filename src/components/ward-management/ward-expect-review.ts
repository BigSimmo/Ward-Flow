/**
 * The automatic plan-review flag for a person still waiting to arrive on a ward (D-275, Josh,
 * 21 Nov 2026; signed values `expectFlagVoluntary` 48 hours and `expectFlagInvoluntary` 7 days).
 *
 * Before D-275 the flag existed only when a person pressed Raise expectation review flag. Now an
 * open movement whose person has not arrived shows the flag by itself once it has waited the signed
 * time: voluntary 48 hours, not voluntary 7 days (the named rule `isNotVoluntary`, D-186 item 4, so
 * a person with no status recorded gets the shorter 48 hour wait, as the hand-raised flag always has).
 * The wait counts from the movement's start, or from the last time someone cleared the flag, so a
 * reviewed plan is flagged again only after another full wait.
 *
 * The flag never moves, frees or closes anything. Clearing it (`CLEAR_EXPECT_FLAG`) is the record
 * that someone reviewed the plan; it stays a person's confirmed action, never automatic.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";
import {
  EXPECT_FLAG_INVOLUNTARY_MINUTES,
  EXPECT_FLAG_VOLUNTARY_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

export type ExpectReviewKind = "voluntary_48h" | "involuntary_7d";

/** A plan-review flag showing now: raised by a person (`automatic: false`) or by the wait. */
export type ExpectReview = {
  kind: ExpectReviewKind;
  /** When the flag began: the person's raise, or the moment the signed wait ran out. */
  since: Instant;
  automatic: boolean;
};

type ExpectReviewMovement = Pick<
  Movement,
  "openedAt" | "legalStatus" | "stage" | "closure" | "transport" | "expectFlag" | "expectFlagHistory"
>;

/** The signed wait for each kind, in minutes. */
function expectReviewWaitMinutes(kind: ExpectReviewKind): number {
  return kind === "involuntary_7d" ? EXPECT_FLAG_INVOLUNTARY_MINUTES : EXPECT_FLAG_VOLUNTARY_MINUTES;
}

function hasArrivedOrEnded(movement: ExpectReviewMovement): boolean {
  return movement.closure !== undefined || movement.stage === "arrived" || movement.transport?.arrivedAt !== undefined;
}

/** The latest time anyone cleared this movement's flag, if ever. */
function lastClearedAt(movement: ExpectReviewMovement): Instant | undefined {
  const times = [movement.expectFlag, ...(movement.expectFlagHistory ?? [])]
    .map((flag) => flag?.clearedAt)
    .filter((at): at is Instant => at !== undefined && Number.isFinite(at));
  return times.length === 0 ? undefined : Math.max(...times);
}

/** The flag showing on this movement now, or null. A person's open flag shows until cleared. */
export function expectReviewDue(movement: ExpectReviewMovement, now: Instant): ExpectReview | null {
  const recorded = movement.expectFlag;
  if (recorded && recorded.clearedAt === undefined) {
    return { kind: recorded.kind, since: recorded.raisedAt, automatic: recorded.automatic === true };
  }
  if (!Number.isFinite(now) || !Number.isFinite(movement.openedAt) || hasArrivedOrEnded(movement)) return null;
  const kind: ExpectReviewKind = isNotVoluntary(movement.legalStatus) ? "involuntary_7d" : "voluntary_48h";
  const cleared = lastClearedAt(movement);
  const start = cleared === undefined ? movement.openedAt : Math.max(movement.openedAt, cleared);
  const dueAt = start + expectReviewWaitMinutes(kind);
  return now >= dueAt ? { kind, since: dueAt, automatic: true } : null;
}

/** "48 hours", "7 days": the signed wait in words, read from the value itself. Hours below 3 days. */
export function expectReviewWaitWords(kind: ExpectReviewKind): string {
  const minutes = expectReviewWaitMinutes(kind);
  const day = 24 * 60;
  if (minutes % day === 0 && minutes >= 3 * day) {
    const days = minutes / day;
    return days === 1 ? "1 day" : `${days} days`;
  }
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/** The tag every screen shows for the flag. */
export function expectReviewTag(review: ExpectReview): string {
  return review.automatic
    ? `Review plan: not arrived after ${expectReviewWaitWords(review.kind)}`
    : "Review plan: flagged by staff";
}
