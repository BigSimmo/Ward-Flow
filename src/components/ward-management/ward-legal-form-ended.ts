import type { Movement } from "@/components/ward-management/ward-model";

/**
 * What every output says once a person records a legal form as ended (M17, D-125, 10 Nov 2026):
 * the TV wall, downtime pack and printed handover read the same words, never the old typed end.
 * Kept at the ward root so those screens share it without importing each other.
 */
export const FORM_RECORDED_ENDED = "Recorded as ended";

/** A person recorded this form as ended (revoked, discharged and so on). */
export function formRecordedEnded(movement: Pick<Movement, "legalForm">): boolean {
  return movement.legalForm?.endedBy !== undefined;
}
