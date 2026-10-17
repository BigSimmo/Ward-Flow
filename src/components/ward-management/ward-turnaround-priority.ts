import type { Instant } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";
import type { TurnaroundPriority } from "./ward-model";
import { admissionCriteriaEligibility } from "./ward-discharge-records";
import { dischargeCriteriaStatus } from "./ward-discharge-criteria";
import { resolveWardFeatureFlags, serverWardFeatureFlags, wardEnvironment } from "./ward-feature-flags";

type CldState = Pick<WardFlowState, "admissions" | "patients" | "movements">;
type TurnaroundState = CldState & Pick<WardFlowState, "bedReleases">;

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
function cldFeatureEnabled(): boolean {
  return resolveWardFeatureFlags({ environment: wardEnvironment(), server: serverWardFeatureFlags(), device: {} }).some(
    (flag) => flag.name === "top25-criteria-led-discharge" && flag.on,
  );
}
/** A confirmed, unblocked departure is distinct from CLD. Expected dates do not establish readiness. */
export function unitTurnaroundSource(
  state: TurnaroundState,
  unitId: string,
  now: Instant,
  cldEnabled = cldFeatureEnabled(),
): TurnaroundPriority["source"] | null {
  if (cldEnabled && unitHasCldReadyDeparture(state, unitId, now)) return "cld";
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
    return cldEnabled && unitHasCldReadyDeparture(state, preference.unitId, now) ? preference : null;
  return unitTurnaroundSource(state, preference.unitId, now, false) === "departure" ? preference : null;
}
