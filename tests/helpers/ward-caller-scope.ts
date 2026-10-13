/**
 * Review fixes A1-1/A1-2 (owner decisions, 12 Oct 2026): a ward caller must name its own ward and an
 * ED withdrawing a referral must name its own department, as every screen now does. Tests written
 * before that rule dispatch without the scope; these helpers state the scope the target record
 * implies, so those tests keep exercising what they were written for. Refusing a missing or wrong
 * scope is covered on its own by `ward-review-2026-10-12-permissions.test.ts`. A scope the test
 * states itself is never changed.
 */
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * Events that already required a ward to name itself before the review (WLQ-11, Fix 8, the Bed
 * board). Tests of these deliberately omit or vary the scope, so it is never filled in for them.
 */
const SCOPE_REQUIRED_BEFORE_REVIEW: ReadonlySet<string> = new Set([
  "BOOK_TRANSPORT",
  "PATIENT_ARRIVED",
  "PLACE_IN_BED",
  "UNDO_PLACE_IN_BED",
]);

/** `event` with the caller scope its target record implies, when the test stated none. */
export function withCallerScope(event: WardFlowEvent, state: WardFlowState): WardFlowEvent {
  const fields = event as {
    role: string;
    type: string;
    unitId?: string;
    movementId?: string;
    admissionId?: string;
    actingUnitId?: string;
    actingPlaceId?: string;
  };
  const movement =
    fields.movementId === undefined ? undefined : state.movements.find((m) => m.id === fields.movementId);
  if (fields.role === "ward" && fields.actingUnitId === undefined && !SCOPE_REQUIRED_BEFORE_REVIEW.has(fields.type)) {
    const unitId =
      fields.unitId ??
      movement?.acceptedUnitId ??
      (fields.admissionId === undefined
        ? undefined
        : state.admissions.find((admission) => admission.id === fields.admissionId)?.unitId) ??
      wardArmUnitId(event, state);
    if (unitId !== undefined) return { ...event, actingUnitId: unitId } as WardFlowEvent;
  }
  if (fields.role === "ed" && fields.type === "WITHDRAW_REFERRAL" && fields.actingPlaceId === undefined) {
    if (movement?.originEdId !== undefined) return { ...event, actingPlaceId: movement.originEdId } as WardFlowEvent;
  }
  return event;
}

/** The ward a referral's ward arm was addressed to, or any ward for an arm open to every ward. */
function wardArmUnitId(event: WardFlowEvent, state: WardFlowState): string | undefined {
  const referralId = (event as { referralId?: string }).referralId;
  if (referralId === undefined) return undefined;
  const arm = state.referrals
    .find((referral) => referral.id === referralId)
    ?.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  if (arm === undefined || arm.destination.kind !== "psychiatric_ward") return undefined;
  return arm.destination.unitId ?? state.units[0]?.id;
}

/** `wardFlowReducer` for tests written before the scope rule: the event gains its implied scope first. */
export function scopedWardFlowReducer(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  return wardFlowReducer(state, withCallerScope(event, state));
}
