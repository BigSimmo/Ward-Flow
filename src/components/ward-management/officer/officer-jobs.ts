import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Notice } from "@/components/ward-management/ward-model";

/**
 * THE JOBS AN OFFICER'S PHONE SCREEN SHOWS, and the predicate its governance sentence describes:
 * transport booked, not yet arrived, movement not closed. Shared by the officer screen and the
 * Switch workstation drawer's Transport jobs count.
 */
export function isOfficerJob(movement: Movement): boolean {
  return (
    movement.transport !== undefined && movement.transport.arrivedAt === undefined && movement.closure === undefined
  );
}

/** How far back the officer screen lists cancellation notices (minutes). */
export const OFFICER_CANCELLATION_WINDOW = 12 * 60;

/**
 * Owner ruling 2026-10-13 22:13 AWST (PR #279): a withdrawal that cancels a booked job closes the
 * movement, so the job leaves `isOfficerJob`. The officer must still see why it went: these are the
 * officer-addressed cancellation notices from the last twelve hours, newest first.
 */
export function officerCancellationNotices(notices: readonly Notice[], now: Instant): Notice[] {
  return notices
    .filter(
      (notice) =>
        notice.kind === "transport_cancelled_officer" &&
        notice.to.role === "officer" &&
        notice.raisedAt <= now &&
        now - notice.raisedAt <= OFFICER_CANCELLATION_WINDOW,
    )
    .sort((a, b) => b.raisedAt - a.raisedAt);
}
