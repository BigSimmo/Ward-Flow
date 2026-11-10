import { formatInstantWithDay, type Instant } from "../ward-clock";
import { byServiceThenName } from "../ward-derivations-shortlist";
import type { Unit } from "../ward-model";
import { activeClosedBeds } from "../ward-ready-beds";

/**
 * Item 6 (10 Nov 2026), bed closures with a review time: a ward closing one bed can say when to look
 * at it again, so a bed never stays closed by accident. The time only prompts. Reopening always
 * needs a person, and a review time changes no bed figure (Ready counts the closed mark either way).
 */
export type ClosedBedMark = NonNullable<Unit["closedBeds"]>[number];

/** The review time has come on a bed still closed. A prompt for a person, never a reopening. */
export function bedReviewDue(mark: ClosedBedMark, now: Instant): boolean {
  return mark.reopenedAt === undefined && mark.reviewAt !== undefined && now >= mark.reviewAt;
}

/** "Review 14:00" or "Review overdue" on a closed bed; `null` when no review time was chosen. */
export function bedReviewLine(mark: ClosedBedMark, now: Instant): string | null {
  if (mark.reviewAt === undefined || mark.reopenedAt !== undefined) return null;
  return bedReviewDue(mark, now) ? "Review overdue" : `Review ${formatInstantWithDay(mark.reviewAt, now)}`;
}

export type ClosedBedPastReview = { unit: Unit; mark: ClosedBedMark };

/**
 * Every bed still closed whose review time has passed, wards in the one neutral order (service,
 * then name), beds by number. Nothing is ranked by how late the review is.
 */
export function closedBedsPastReview(units: readonly Unit[], now: Instant): ClosedBedPastReview[] {
  return [...units].sort(byServiceThenName).flatMap((unit) =>
    activeClosedBeds(unit)
      .filter((mark) => bedReviewDue(mark, now))
      .sort((a, b) => a.bedNumber - b.bedNumber)
      .map((mark) => ({ unit, mark })),
  );
}
