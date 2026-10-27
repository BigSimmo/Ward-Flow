import type { Instant } from "./ward-clock";
import type { BedReleaseBlocker } from "./ward-change-reasons";
import type { WardFlowRole } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Admission } from "./ward-admissions";
import type { BedRelease, LeaveBed, Movement, Referral, Unit } from "./ward-model";

/** Find and replace helpers for the records in `WardFlowState`, moved from the reducer (H-0283). */
export function findMovement(state: WardFlowState, movementId: string): Movement | undefined {
  return state.movements.find((candidate) => candidate.id === movementId);
}

export function findUnit(state: WardFlowState, unitId: string): Unit | undefined {
  return state.units.find((candidate) => candidate.id === unitId);
}

export function findBedRelease(state: WardFlowState, releaseId: string): BedRelease | undefined {
  return state.bedReleases.find((candidate) => candidate.id === releaseId);
}

/** Replaces one bed release in the array by id, leaving every other element untouched. */
export function replaceBedRelease(state: WardFlowState, releaseId: string, next: BedRelease): WardFlowState {
  return {
    ...state,
    bedReleases: state.bedReleases.map((candidate) => (candidate.id === releaseId ? next : candidate)),
  };
}

/**
 * Keeps the stay's own discharge decision in step with its bed release. Screens that read the stay
 * (the bed board's shift list, the patient card, the discharge board) read
 * `Admission.dischargeConfirmedAt`; the ward's Confirm and Revert act on the release. Without this,
 * one discharge carried two answers (release gate, 15 Oct 2026).
 *
 * Only the ward is named as the confirmer: "Ward manager" is the one label `DISCHARGE_ROLE_LABELS`
 * holds, so a coordinator's confirmation records the time with the role left unrecorded rather
 * than naming the wrong person. The change moves the stay's discharge revision, so an edit made
 * against the record as it stood before is refused as stale.
 */
export function withAdmissionDischargeDecision(
  state: WardFlowState,
  admissionId: string,
  at: Instant | null,
  role: WardFlowRole,
): WardFlowState {
  const admission = findAdmission(state, admissionId);
  if (!admission) return state;
  // A stay already confirmed keeps its own confirmation time: the release agrees with it, so
  // restamping would rewrite when the discharge was decided. A revert still clears it, because the
  // ward has said the discharge is no longer decided.
  if (at !== null && admission.dischargeConfirmedAt !== null) return state;
  if (at === null && admission.dischargeConfirmedAt === null) return state;
  const withStay = replaceAdmission(state, admissionId, {
    ...admission,
    dischargeConfirmedAt: at,
    dischargeConfirmedBy: at !== null && role === "ward" ? "Ward manager" : null,
  });
  return {
    ...withStay,
    dischargeRevisions: {
      ...withStay.dischargeRevisions,
      [admissionId]: (state.dischargeRevisions[admissionId] ?? 0) + 1,
    },
  };
}

export function findAdmission(state: WardFlowState, admissionId: string): Admission | undefined {
  return state.admissions.find((candidate) => candidate.id === admissionId);
}

/** Replaces one admission in the array by id, leaving every other element untouched — the same
 *  discipline `replaceBedRelease` and `replaceUnit` already use. */
export function replaceAdmission(state: WardFlowState, admissionId: string, next: Admission): WardFlowState {
  return {
    ...state,
    admissions: state.admissions.map((candidate) => (candidate.id === admissionId ? next : candidate)),
    dischargeRevisions: state.admissions.some(
      (candidate) => candidate.id === admissionId && candidate.state !== next.state,
    )
      ? { ...state.dischargeRevisions, [admissionId]: (state.dischargeRevisions[admissionId] ?? 0) + 1 }
      : state.dischargeRevisions,
  };
}

/**
 * One discharge blocker, two records: the release's own `blocker` and the stay's `blockReason`.
 * Whenever a release-level event changes the first, the linked stay follows, so a blocker set on one
 * screen is never left behind on the handover, stranded list or statistics by another screen's clear.
 */
export function withStayBlocker(
  state: WardFlowState,
  admissionId: string,
  blocker: BedReleaseBlocker | null,
): WardFlowState {
  const stay = findAdmission(state, admissionId);
  if (!stay || stay.blockReason === blocker) return state;
  return replaceAdmission(state, stay.id, { ...stay, blockReason: blocker });
}

export function findLeaveBed(state: WardFlowState, leaveBedId: string): LeaveBed | undefined {
  return state.leaveBeds.find((candidate) => candidate.id === leaveBedId);
}

export function findReferral(state: WardFlowState, referralId: string): Referral | undefined {
  return state.referrals.find((candidate) => candidate.id === referralId);
}

/** Replaces one referral in the array by id, leaving every other element untouched — the same
 *  shape as `replaceBedRelease`/`replaceMovement` below. */
export function replaceReferral(state: WardFlowState, referralId: string, next: Referral): WardFlowState {
  return {
    ...state,
    referrals: state.referrals.map((candidate) => (candidate.id === referralId ? next : candidate)),
  };
}

/** Replaces one movement in the array by id, leaving every other element untouched. */
export function replaceMovement(state: WardFlowState, movementId: string, next: Movement): WardFlowState {
  return {
    ...state,
    movements: state.movements.map((candidate) => (candidate.id === movementId ? next : candidate)),
  };
}

export function replaceUnit(state: WardFlowState, unitId: string, next: Unit): WardFlowState {
  return { ...state, units: state.units.map((candidate) => (candidate.id === unitId ? next : candidate)) };
}
