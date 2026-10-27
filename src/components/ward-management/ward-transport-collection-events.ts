import type { Instant } from "./ward-clock";
import type { TransportExceptionInput } from "./ward-flow-events";
import type { WardFlowRole } from "./ward-flow-roles";

/*
 * Transport collection and late CAD events. They live beside `ward-flow-events.ts` so the event
 * union stays under its line cap.
 */

export type PatientCollectedEvent = {
  type: "PATIENT_COLLECTED";
  role: WardFlowRole;
  now: Instant;
  movementId: string;
  /** Audit fix (13 Oct 2026): collected with a check open (no Form 4A, no clearance), and why. */
  exception?: TransportExceptionInput;
  /**
   * Form friction audit #236 (Josh, 27 Oct 2026): the crew checked the name, UMRN and date of
   * birth with the sending team. A one-tap confirmation, never a gate: absent collects as before.
   */
  identityChecked?: true;
};

/**
 * Form friction audit (Josh, 27 Oct 2026): a dispatched job booked with "CAD to follow" gets its
 * CAD number later, read off the provider's call. Typed, never derived, and the same placeholder
 * rule as `BOOK_TRANSPORT` (HAZ-03). Only a live job with no number yet.
 */
export type RecordTransportCadEvent = {
  type: "RECORD_TRANSPORT_CAD";
  role: WardFlowRole;
  now: Instant;
  movementId: string;
  cadNumber: string;
  /** Same claim as `BOOK_TRANSPORT.actingUnitId`: a ward names itself as the sending ward. */
  actingUnitId?: string;
};
