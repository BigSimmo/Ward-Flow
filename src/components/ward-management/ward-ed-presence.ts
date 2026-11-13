import type { Instant } from "./ward-clock";
import type { Movement } from "./ward-model";

/**
 * A ward transfer may retain an ED routing id; it never originated as an ED wait. D-76: nor did a
 * journey from an accepted community referral, which has no ED at all.
 */
export function isEdOriginJourney(movement: Pick<Movement, "sourceAdmissionId" | "originEdId">): boolean {
  return movement.sourceAdmissionId === undefined && movement.originEdId !== undefined;
}

/**
 * Ward Lead audit (2026-09-17): the two exact `closure.reason` strings `WITHDRAW_REFERRAL`
 * (`ward-flow-reducer.ts`) writes when the REFERRER (this department, dispatching as `"ed"`)
 * withdraws or revokes — never when the coordinator does (`"The coordinator revoked the accepted
 * referral"`), and never any other closure (`RECORD_ED_OUTCOME`, `REFER_TO_COMMUNITY_TEAM`,
 * arrival). This department raised the withdrawal, so it stays accountable for knowing it
 * happened — a coordinator-driven revocation or any other closure is somebody else's decision and
 * stays off this board, exactly like every other closed movement.
 */
const ED_INITIATED_WITHDRAWAL_REASONS = [
  "The referrer withdrew the referral",
  "The referrer revoked the accepted referral",
] as const;

export function isEdInitiatedWithdrawal(movement: Movement): boolean {
  return (
    movement.closure !== undefined &&
    (ED_INITIATED_WITHDRAWAL_REASONS as readonly string[]).includes(movement.closure.reason)
  );
}

type DepartureRecord = Pick<Movement, "leftDepartmentAt" | "transport"> & Partial<Pick<Movement, "stageChanges">>;

/** Recorded physical departure only. Acceptance and closure alone do not establish departure. */
export function recordedEdDeparture(movement: DepartureRecord): Instant | undefined {
  const times = [
    movement.leftDepartmentAt,
    movement.transport?.collectedAt,
    ...(movement.stageChanges ?? [])
      .filter((change) => change.to === "moving" || change.to === "arrived")
      .map((change) => change.at),
  ].filter((at): at is Instant => at !== undefined && Number.isFinite(at));
  return times.length ? Math.min(...times) : undefined;
}

/** Physical ED presence while still awaiting an inpatient bed, rather than transit accountability. */
export function isWaitingInEd(movement: Movement): boolean {
  return (
    isEdOriginJourney(movement) &&
    !movement.closure &&
    movement.edOutcome === undefined &&
    movement.stage !== "moving" &&
    movement.stage !== "arrived" &&
    recordedEdDeparture(movement) === undefined
  );
}

/** Recorded ED departure, with closure as a fallback. Unknown transit departure stays unknown. */
export function edInpatientWaitEnd(movement: Movement, now: Instant): Instant | null {
  const departure = recordedEdDeparture(movement);
  if (departure !== undefined) return departure;
  if (movement.closure) return movement.closure.at;
  if (movement.stage === "moving" || movement.stage === "arrived") return null;
  return now;
}
