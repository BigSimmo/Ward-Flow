import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Referral } from "./ward-model";
import { referralState } from "./ward-referrals";
type ReferralRecordsEvent = Extract<
  WardFlowEvent,
  { type: "RECORD_MEDICAL_CLEARANCE" | "RECORD_ARRIVED_IN_DEPARTMENT" | "RECORD_LOCAL_BED_SOUGHT" }
>;
type ReferralRecordsOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findReferral: (state: WardFlowState, id: string) => Referral | undefined;
  replaceReferral: (state: WardFlowState, id: string, next: Referral) => WardFlowState;
};
/** Record updates share the facade's permission, audit and revision boundary.
 * Clearance remains current state; arrival and a local search preserve their first recording. */
export function reduceReferralRecordsEvent(
  state: WardFlowState,
  event: ReferralRecordsEvent,
  operations: ReferralRecordsOperations,
): WardFlowState {
  switch (event.type) {
    case "RECORD_MEDICAL_CLEARANCE":
      return recordClearance(state, event, operations);
    case "RECORD_ARRIVED_IN_DEPARTMENT":
      return recordArrival(state, event, operations);
    case "RECORD_LOCAL_BED_SOUGHT":
      return recordLocalSearch(state, event, operations);
  }
}

function recordClearance(
  state: WardFlowState,
  event: Extract<ReferralRecordsEvent, { type: "RECORD_MEDICAL_CLEARANCE" }>,
  operations: ReferralRecordsOperations,
): WardFlowState {
  const referral = operations.findReferral(state, event.referralId);

  if (!referral) return operations.reject(state, event, `no referral found for id ${event.referralId}`);

  // ⚠️ RE-RECORDING IS ALLOWED AND OVERWRITING IS THE POINT. Unlike `RECORD_EXAMINATION`
  // above, which refuses a second examination as a data-integrity fault, a medical clearance
  // is a CURRENT STATE that legitimately changes: a patient cleared at 09:00 can deteriorate
  // by 11:00, and refusing the correction would leave the board asserting something the
  // department no longer believes. The `at` stamp is the answer's own time, so the record says
  // WHEN it was true rather than implying it always has been.
  const updated: Referral = {
    ...referral,
    medicalClearance: { cleared: event.cleared, at: event.now },
  };

  const next = operations.replaceReferral(state, referral.id, updated);

  return {
    ...next,
    movements: next.movements.map((movement) =>
      movement.referralId === referral.id &&
      (movement.patientId === undefined || movement.patientId === referral.patientId)
        ? { ...movement, medicalClearance: updated.medicalClearance }
        : movement,
    ),
  };
}

/**
 * 🔴 THE ONLY WRITER OF `Referral.inDepartmentAt`, AND THE ONLY DOOR FROM "EXPECT" TO
 * "REFERRAL".
 *
 * Product owner, 2026-09-07: "When expects arrive and are marked as arrived, they become
 * referrals." Before this case existed nothing could move a patient between those lists —
 * `triagedAt` is written only inside `RECEIVE_REFERRAL`, so a referral created without one
 * could never acquire one, and an expects list built on triage could only ever grow.
 */
function recordArrival(
  state: WardFlowState,
  event: Extract<ReferralRecordsEvent, { type: "RECORD_ARRIVED_IN_DEPARTMENT" }>,
  operations: ReferralRecordsOperations,
): WardFlowState {
  const referral = operations.findReferral(state, event.referralId);

  if (!referral) return operations.reject(state, event, `no referral found for id ${event.referralId}`);

  /*
   * ⚠️ IDEMPOTENT, AND THE FIRST RECORDING WINS.
   *
   * Two clinicians noticing the same patient is ordinary, not an error, so a second recording
   * is a no-op rather than a rejection — a refusal would read on screen as though the first one
   * had failed. And the EARLIER time is kept: the question this field answers is "since when
   * has this person been in the department", so overwriting with a later observation would
   * shorten a wait that actually happened. That is the opposite of `RECORD_MEDICAL_CLEARANCE`
   * above, which overwrites deliberately because clearance is a current state that changes;
   * arrival is a fact about the past and does not un-happen.
   */
  if (referral.inDepartmentAt !== undefined) return state;

  const updated: Referral = { ...referral, inDepartmentAt: event.now };

  return operations.replaceReferral(state, referral.id, updated);
}

function recordLocalSearch(
  state: WardFlowState,
  event: Extract<ReferralRecordsEvent, { type: "RECORD_LOCAL_BED_SOUGHT" }>,
  operations: ReferralRecordsOperations,
): WardFlowState {
  // Phase 8 (spec D8-6). Optional by design: nothing requires this to have happened, nothing
  // reads its absence as a failing, and `ACCEPT_REFERRAL` neither checks it nor cares. It is
  // a record that a coordinator looked closer to home, and when.
  const referral = operations.findReferral(state, event.referralId);

  if (!referral) return operations.reject(state, event, `no referral found for id ${event.referralId}`);

  // A search for a local bed is a thing done while the referral is still undecided. Recording
  // one against an already-decided referral would be recording it after the fact, so the
  // refused state is named exactly as `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` name theirs.
  if (referralState(referral) !== "queued") {
    return operations.reject(state, event, `referral ${referral.id} was already decided (${referralState(referral)})`);
  }

  // One-shot, the same discipline `ACCEPT_REFERRAL`'s already-decided guard uses: a second
  // record would silently overwrite the first, losing the time and role of the search that
  // actually happened.
  if (referral.localBedSought !== undefined) {
    return operations.reject(state, event, `referral ${referral.id} already records a local bed search`);
  }

  // `by` is the raising ROLE, taken from the event rather than from any caller-supplied
  // string, so a person's name cannot be written here even by a caller that wanted to.
  const sought: Referral = { ...referral, localBedSought: { at: event.now, by: event.role } };

  return operations.replaceReferral(state, referral.id, sought);
}
