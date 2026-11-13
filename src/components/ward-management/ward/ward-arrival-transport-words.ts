import { ARRIVAL_MODE_LABELS, type Movement } from "@/components/ward-management/ward-model";
import { transportStatusLabel } from "@/components/ward-management/ward-derivations-transport";

/**
 * F-41 (A9-24): the "Coming in" card's transport words, read from the same transport record the
 * coordinator's page reads (`transportStatusLabel`), so a card never says "Transport not set" beside
 * a booked job, or "moving" when nothing is booked. Wording only; no rule changes here.
 */
type ArrivalTransportFacts = Pick<Movement, "arrivalDetails" | "transport" | "transportNeed" | "stage">;

function liveJob(movement: ArrivalTransportFacts) {
  return movement.transport !== undefined && movement.transport.cancelledAt === undefined
    ? movement.transport
    : undefined;
}

function recordedNotNeeded(movement: ArrivalTransportFacts): boolean {
  return (movement.transportNeed?.needed ?? movement.transport?.needed) === false && liveJob(movement) === undefined;
}

/** The tag beside the legal status: the recorded arrival mode, else the job's own state. */
export function arrivalTransportTag(movement: ArrivalTransportFacts): string {
  const mode = movement.arrivalDetails?.mode;
  if (mode) return ARRIVAL_MODE_LABELS[mode];
  const job = liveJob(movement);
  if (job) return `Transport: ${transportStatusLabel(job)}`;
  if (recordedNotNeeded(movement)) return "No transport needed";
  return "No transport booked yet";
}

/**
 * The corridor line once the pull timer, arrival and collection lines do not apply. The "moving"
 * sentence only while a booked journey is under way.
 */
export function arrivalTransportFallbackLine(movement: ArrivalTransportFacts): string {
  const job = liveJob(movement);
  if (job && (job.enRouteAt !== undefined || movement.stage === "moving")) {
    return "Transport moving according to state protocol";
  }
  if (job) return `Transport: ${transportStatusLabel(job)}`;
  if (recordedNotNeeded(movement)) return "No transport needed";
  return "No transport booked yet";
}
