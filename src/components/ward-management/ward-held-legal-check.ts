import { requiresAuthorisedDestination } from "@/components/ward-management/ward-eligibility";
import type { Movement, Unit } from "@/components/ward-management/ward-model";

/**
 * LEGAL STATUS CHANGED AFTER A BED WAS HELD (Audit 2 E-03, Josh 20 Oct 2026). Acceptance and the
 * first pull check authorisation from the legal status at that moment. A later CHANGE_LEGAL_STATUS
 * can leave the held bed at a ward that is not set up for involuntary admissions.
 *
 * Josh's decision mirrors the gender rule (`heldUnitGenderRefusal`): the steps before collection
 * (the restore pull, handover ready, transport accepted, collected, and a no-transport arrival
 * from `pulled` or `handover_ready`) are refused until a person records a reason for this ward.
 * Once the patient is moving, arrival is never refused, so nobody is stranded in transit; the
 * existing "destination no longer lawful" inbox item stays the warning.
 *
 * The reason is recorded with the restore pull (`PULL_PATIENT` with an override reason), as an
 * `authorisation` override for this ward. Only one made at or after the latest legal status change
 * counts, so an override given for an earlier status does not carry over to a new one.
 */
export function heldUnitAuthorisationGap(movement: Movement, units: readonly Unit[]): Unit | undefined {
  if (movement.closure !== undefined || movement.acceptedUnitId === undefined) return undefined;
  if (!requiresAuthorisedDestination(movement.legalStatus)) return undefined;
  const unit = units.find((candidate) => candidate.id === movement.acceptedUnitId);
  return unit === undefined || unit.authorised ? undefined : unit;
}

/** An `authorisation` override for this ward recorded at or after the latest legal status change. */
export function authorisationReasonRecordedSinceLegalChange(movement: Movement, unitId: string): boolean {
  const lastChange = movement.statusChanges.reduce<number | undefined>(
    (latest, change) => (latest === undefined || change.at > latest ? change.at : latest),
    undefined,
  );
  return movement.overrides.some(
    (override) =>
      override.gate === "authorisation" &&
      override.unitIds.includes(unitId) &&
      (lastChange === undefined || override.at >= lastChange),
  );
}

/**
 * The refusal for a step before collection while the held ward is not authorised for the patient's
 * current legal status and no reason has been recorded since it changed, or `null`.
 */
export function heldUnitAuthorisationRefusal(state: { units: readonly Unit[] }, movement: Movement): string | null {
  const unit = heldUnitAuthorisationGap(movement, state.units);
  if (unit === undefined || authorisationReasonRecordedSinceLegalChange(movement, unit.id)) return null;
  return (
    `${unit.name} is not set up for involuntary admissions, and this patient's legal status is now ` +
    `${movement.legalStatus}. Step back and pull the bed again with a recorded reason, ` +
    `or release the bed, before the patient leaves`
  );
}
