// Pure handover scope rules: the scope's name, which open movements belong to a scope, urgency for
// the "outside this filter" footer, patient resolution and the sign-off dispatch. Split out of
// handover-page.tsx to keep that file under the line cap; handover-page.tsx re-exports the public ones.
import { type Dispatch } from "react";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { type Instant, isClockBreached } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { accessIsWholeNetwork, type WardAccess } from "@/components/ward-management/ward-role-access";
import { canDispatch } from "@/components/ward-management/ward-role-permissions";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { Patient } from "@/components/ward-management/ward-patients";
import { type Movement, type Referral, type Unit } from "@/components/ward-management/ward-model";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { edById } from "@/components/ward-management/ward-sites";
import { movementBelongsToService } from "@/components/ward-management/ward-service-scope";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { referralForMovement } from "@/components/ward-management/ward-derivations";
import { type HandoverScope } from "./handover-scope";

export function allRecordsScopeLabel(access: WardAccess): string {
  return accessIsWholeNetwork(access) ? "Whole network" : "All records you can access";
}

/** THE SCOPE'S NAME */
export function handoverScopeLabel(
  scope: HandoverScope,
  units: Unit[],
  allRecordsLabel = "Whole network",
): string | undefined {
  switch (scope.kind) {
    case "network":
      return allRecordsLabel;
    case "service":
      return scope.id;
    case "ward":
      return units.find((unit) => unit.id === scope.id)?.name;
    case "ed":
      return edById(scope.id)?.name;
    case "team": {
      const team = communityTeamById(scope.id);
      return team === null ? undefined : team.name;
    }
  }
}

function movementTouchesUnit(movement: Movement, unitId: string): boolean {
  return movement.acceptedUnitId === unitId || movement.referredUnitIds.includes(unitId);
}

/** WHETHER AN OPEN MOVEMENT BELONGS TO THIS SCOPE */
export function movementInHandoverScope(
  movement: Movement,
  scope: HandoverScope,
  units: Unit[],
  referrals: Referral[],
): boolean {
  switch (scope.kind) {
    case "network":
      return true;
    case "ed":
      return movement.originEdId === scope.id;
    case "ward":
      return movementTouchesUnit(movement, scope.id);
    case "service":
      return movementBelongsToService(movement, scope.id, units);
    case "team": {
      const team = communityTeamById(scope.id);
      if (team === null) return false;
      const referral = referralForMovement(movement, referrals);
      if (referral === undefined) return false;
      return referral.destinations.some(
        (addressed) => addressed.destination.kind === "community_team" && addressed.destination.teamName === team.name,
      );
    }
  }
}

/**
 * Shift handover sign-off. The engine stores role and time only. This helper dispatches first
 * and returns a record only when that call is allowed and does not throw — never a claim that
 * the sheet was signed before the reducer accepted it, and never a claim that anyone was notified.
 */
export function recordHandoverSignOff(
  dispatch: Dispatch<WardFlowEvent>,
  now: Instant,
  role: WardFlowRole = "coordinator",
): { role: WardFlowRole; at: Instant } | null {
  if (!canDispatch(role, "RECORD_HANDOVER_SIGN_OFF")) return null;
  try {
    dispatch({ type: "RECORD_HANDOVER_SIGN_OFF", role, now });
  } catch {
    return null;
  }
  return { role, at: now };
}

/** URGENT, FOR THE PURPOSE OF THE "OUTSIDE THIS FILTER" FOOTER */
export function movementIsUrgent(movement: Movement, now: Instant): boolean {
  if (movement.flaggedUrgent) return true;
  const dueAt = movement.legalForm?.dueAt;
  return dueAt !== undefined && isClockBreached(dueAt, now);
}

/** THE WHOLE OF CONDITION 3, AS ONE FUNCTION */
export function urgentMovementsOutsideScope(
  openMovements: Movement[],
  scope: HandoverScope,
  units: Unit[],
  referrals: Referral[],
  now: Instant,
): Movement[] {
  return openMovements.filter(
    (movement) => !movementInHandoverScope(movement, scope, units, referrals) && movementIsUrgent(movement, now),
  );
}

/**
 * The patient a handover row names, read only from the model's own links.
 *
 * A typed-in table of 35 names and record numbers keyed by movement id used to win over the
 * record here. None of its rows matched: 16 put another patient's name on the movement and the
 * rest invented a person the model does not hold (25 September 2026 audit, A1). A movement linked
 * to nobody now says so, in the resolver's own words.
 */
export function resolveMovementPatient(
  movement: Movement,
  patients: Patient[],
  referrals: Referral[],
): { name: string; umrn: string; patientId?: string } {
  const info = resolveSubjectPatient(movement, { patients, referrals });
  return {
    name: info.formalName,
    umrn: info.umrn,
    patientId: info.patient?.id,
  };
}

/**
 * The same resolver as `resolveMovementPatient` above, for a row keyed by an admission (a bed
 * release) rather than a movement — same A1 discipline: read only from the model's own link
 * (`Admission.patientId`/`referralId`), never a typed name table. Added for the Stranded Delayed
 * Egress table, which until 25 September 2026 named six patients nobody in this model holds, each
 * under a real seeded UMRN that belongs to someone else entirely (audit finding, same date).
 */
export function resolveAdmissionPatient(
  admission: Admission | undefined,
  patients: Patient[],
  referrals: Referral[],
): { name: string; umrn: string } {
  const info = resolveSubjectPatient(admission, { patients, referrals });
  return {
    name: info.formalName,
    umrn: info.umrn,
  };
}
