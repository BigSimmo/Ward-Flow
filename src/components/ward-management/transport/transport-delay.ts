import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { TRANSPORT_ACCEPT_DELAY_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { arrivalTimingIsLate } from "@/components/ward-management/ward-arrival-timing";

/**
 * Feature 25 (Josh, 9 Nov 2026): when a current transfer counts as Delayed on the transport list.
 *
 * - `past_eta`: past its expected arrival (the ward's ETA, else the time given at booking) by more
 *   than the existing late-arrival grace, and not arrived.
 * - `not_accepted`: booked more than `TRANSPORT_ACCEPT_DELAY_MINUTES` ago and still not accepted.
 *
 * Read from recorded times only. A job with neither time recorded is never called delayed.
 */
export type TransportDelay = "past_eta" | "not_accepted";

export const TRANSPORT_DELAY_LABEL: Record<TransportDelay, string> = {
  // D-221: "Past ETA" now names the neutral hour before late, so a late job says so.
  past_eta: "Late arrival",
  not_accepted: "Not accepted",
};

export function transportDelay(movement: Movement, now: Instant): TransportDelay | null {
  const job = movement.transport;
  if (!job || job.arrivedAt !== undefined || job.cancelledAt !== undefined || job.stoppedAt !== undefined) return null;
  if (movement.closure) return null;
  if (arrivalTimingIsLate(movement, now)) return "past_eta";
  if (job.acceptedAt === undefined && job.bookedAt !== undefined && now - job.bookedAt > TRANSPORT_ACCEPT_DELAY_MINUTES)
    return "not_accepted";
  return null;
}
