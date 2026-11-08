import type { Instant } from "./ward-clock";
import type { WithdrawalReason } from "./ward-change-reasons";
import type { STAGE_TRANSITION_BLOCKERS } from "./ward-flow-reducer";
import type { Movement } from "./ward-model";

/**
 * TASK-L3-06 (8 Nov 2026): the shared close step for a movement's bed search, kept out of
 * `ward-flow-reducer.ts` (which re-exports it) so that file stays within its size limit. Imports
 * from the reducer are type-only, so there is no import cycle; `satisfies` keeps this blocker
 * sentence identical to `STAGE_TRANSITION_BLOCKERS.didNotProceed`.
 */
const DID_NOT_PROCEED = "None — the movement did not proceed" satisfies typeof STAGE_TRANSITION_BLOCKERS.didNotProceed;

/**
 * The single writer for a referrer's own withdrawal (`WITHDRAW_REFERRAL` before acceptance and the
 * `RECORD_REFERRER_WITHDRAWAL` cascade): every live ward request is recorded as `referrer_withdrew`
 * and the movement no longer names an accepting or reviewing ward.
 */
export function withdrawAllLiveRequestsForReferrer(
  movement: Movement,
  now: Instant,
  /** Who ended the referral. A coordinator withdrawing it is recorded as such, not as the referrer. */
  reason: WithdrawalReason = "referrer_withdrew",
): Pick<Movement, "acceptedUnitId" | "referredUnitIds" | "withdrawnReferrals" | "referralAnswerHistory"> {
  return {
    acceptedUnitId: undefined,
    referredUnitIds: [],
    withdrawnReferrals: [
      ...movement.withdrawnReferrals,
      ...movement.referredUnitIds.map((unitId) => ({ unitId, at: now, reason })),
    ],
    referralAnswerHistory: [
      ...(movement.referralAnswerHistory ?? []),
      ...movement.referredUnitIds.map((unitId) => ({ unitId, at: now, answer: "withdrawn" as const })),
    ],
  };
}

/**
 * TASK-L3-06 (8 Nov 2026): the one way a movement's bed search ends without the patient arriving.
 * Every such closure clears the same fields: no admission, held bed or accepting ward; every live
 * ward request withdrawn with its true cause; a booked, uncollected job cancelled; nothing left
 * blocking. The caller gives back any pulled bed with `releaseMovementBed` and writes its own
 * notices. `STOP_TRANSPORT` keeps its bed until released, and the two release events end a search
 * that has no live requests left, so those three keep their own closures.
 */
export function endedBedSearch(
  movement: Movement,
  now: Instant,
  withdrawReason: WithdrawalReason,
  closure: Omit<Movement["closure"] & {}, "at" | "outcome">,
): Pick<
  Movement,
  | "admissionId"
  | "heldBedNumber"
  | "acceptedUnitId"
  | "referredUnitIds"
  | "withdrawnReferrals"
  | "referralAnswerHistory"
  | "transport"
  | "closure"
  | "blocker"
> {
  return {
    admissionId: undefined,
    heldBedNumber: undefined,
    ...withdrawAllLiveRequestsForReferrer(movement, now, withdrawReason),
    transport:
      movement.transport && movement.transport.cancelledAt === undefined
        ? { ...movement.transport, cancelledAt: now }
        : movement.transport,
    closure: { at: now, outcome: "did_not_proceed", ...closure },
    blocker: DID_NOT_PROCEED,
  };
}
