import type { Instant } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement, Referral, TurnaroundPriority, Unit } from "./ward-model";
import type { EligibilityVerdict } from "./ward-eligibility";
import { unitHasLockedBeds } from "./ward-bed-designation";
import { admissionCriteriaEligibility } from "./ward-discharge-records";
import { dischargeCriteriaStatus } from "./ward-discharge-criteria";
import { resolveWardFeatureFlags, serverWardFeatureFlags, wardEnvironment } from "./ward-feature-flags";

type CldState = Pick<WardFlowState, "admissions" | "patients" | "movements">;
type TurnaroundState = CldState & Pick<WardFlowState, "bedReleases">;

/** Staging may wait for capacity; every receiving clinical/legal capability must already fit. */
export function turnaroundEligibilityAllows(verdict: EligibilityVerdict, unit: Unit): boolean {
  return verdict.gates.every(
    (gate) =>
      gate.pass ||
      gate.gate === "allocatable_bed" ||
      gate.gate === "capacity_freshness" ||
      (gate.gate === "security" && unitHasLockedBeds(unit)),
  );
}

/** A ward request may address one receiving unit or any suitable unit in the network. */
export function referralHasOpenTurnaroundRequest(referral: Referral, unitId: string): boolean {
  return referral.destinations.some(
    (arm) =>
      arm.state === "queued" &&
      arm.withdrawnAt === undefined &&
      arm.destination.kind === "psychiatric_ward" &&
      (arm.destination.unitId === undefined || arm.destination.unitId === unitId),
  );
}

/** A staging preference must belong to a live request, including legacy direct movements. */
export function movementHasOpenTurnaroundRequest(
  state: Pick<WardFlowState, "referrals">,
  movement: Movement,
  unitId: string,
): boolean {
  if (!movement.referralId) return movement.referredUnitIds.includes(unitId);
  return state.referrals.some(
    (referral) => referral.id === movement.referralId && referralHasOpenTurnaroundRequest(referral, unitId),
  );
}

/** Readiness is a proposal; this never changes occupancy or establishes a discharge decision. */
export function unitHasCldReadyDeparture(state: CldState, unitId: string, now: Instant): boolean {
  return state.admissions.some(
    (admission) =>
      admission.unitId === unitId &&
      admission.state === "occupied" &&
      dischargeCriteriaStatus(admission.dischargeCriteria, admissionCriteriaEligibility(state, admission), now).kind ===
        "all_met",
  );
}
function cldFeatureEnabled(deviceOverride?: boolean): boolean {
  return resolveWardFeatureFlags({
    environment: wardEnvironment(),
    server: serverWardFeatureFlags(),
    device: deviceOverride === undefined ? {} : { "top25-criteria-led-discharge": deviceOverride },
  }).some((flag) => flag.name === "top25-criteria-led-discharge" && flag.on);
}
/** A confirmed, unblocked departure is distinct from CLD. Expected dates do not establish readiness. */
export function unitTurnaroundSource(
  state: TurnaroundState,
  unitId: string,
  now: Instant,
  cldEnabled = cldFeatureEnabled(),
): TurnaroundPriority["source"] | null {
  if (cldEnabled && cldFeatureEnabled(cldEnabled) && unitHasCldReadyDeparture(state, unitId, now)) return "cld";
  return state.bedReleases.some(
    (release) =>
      release.unitId === unitId &&
      release.state === "confirmed" &&
      release.blocker === null &&
      state.admissions.some(
        (admission) =>
          admission.id === release.admissionId && admission.unitId === unitId && admission.state === "occupied",
      ),
  )
    ? "departure"
    : null;
}
/** The original source must still qualify; a historical preference does not promise a clearing bed. */
export function liveTurnaroundPreference(
  state: TurnaroundState,
  preference: TurnaroundPriority | undefined,
  now: Instant,
  cldEnabled = cldFeatureEnabled(),
): TurnaroundPriority | null {
  if (!preference) return null;
  if (preference.source === "cld")
    return cldEnabled && cldFeatureEnabled(cldEnabled) && unitHasCldReadyDeparture(state, preference.unitId, now)
      ? preference
      : null;
  return unitTurnaroundSource(state, preference.unitId, now, false) === "departure" ? preference : null;
}
