// Fit-to-travel and arrival gap checks, kept apart from the transport checks so the ward home can
// ask them without loading the whole transport module (phone size limit).
import type { Movement, TransportExceptionGap } from "@/components/ward-management/ward-model";

export type FitToTravelClearance = Pick<NonNullable<Movement["medicalClearance"]>, "cleared"> | undefined;

export function fitToTravelGaps(clearance: FitToTravelClearance): TransportExceptionGap[] {
  if (clearance === undefined) return ["fit_to_travel_missing"];
  // D-205: assessed and not cleared says so, not that the fact is missing.
  return clearance.cleared === true ? [] : ["fit_to_travel_not_cleared"];
}

/**
 * Audit r1 item 4: a journey with no transport leg (nobody collected the patient) is never asked
 * fit to travel at Collected, so arrival asks instead. A warning with a recorded reason, never a block.
 */
export function arrivalGaps(movement: Pick<Movement, "transport" | "medicalClearance">): TransportExceptionGap[] {
  if (movement.transport?.collectedAt !== undefined) return [];
  return fitToTravelGaps(movement.medicalClearance);
}
