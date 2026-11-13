// The departure arithmetic shared by RECORD_LEAVING and RECORD_PATIENT_DISCHARGE, moved out of
// `ward-flow-reducer.ts` unchanged (line cap, 10 Nov 2026), which re-exports it.
import type { Admission, LeavingDestination } from "./ward-admissions";
import type { Instant } from "./ward-clock";
import { adjustSexMix, mixSexOf } from "./ward-eligibility";
import type { WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "./ward-flow-roles";
import { replaceAdmission, replaceBedRelease, replaceUnit } from "./ward-flow-state-records";
import type { BedRelease, Unit } from "./ward-model";
import { nextBedReleaseId } from "./ward-runtime-ids";

/** "NUM <ward>" when the ward recorded it, otherwise the role's own label (the coordinator acts too). */
export function recordedByLabel(role: WardFlowRole, unitName: string): string {
  return role === "ward" ? `NUM ${unitName}` : WARD_FLOW_ROLE_LABELS[role];
}

/** The established departure arithmetic, shared by the legacy and patient-linked commands. */
export function departAdmission(
  state: WardFlowState,
  admission: Admission,
  unit: Unit,
  now: Instant,
  leavingDestination: LeavingDestination,
  role: WardFlowRole,
  /** Item 18, "Left the ward": the person waits on site for transport. Checked by the caller. */
  awaitingTransport = false,
): WardFlowState {
  // Owner decision: a bed release is a named patient's discharge, so pairing is by admission, never
  // by ward-wide counts. `releaseAlreadyIncremented` should be unreachable (RELEASE_BED refuses
  // while the person is in the bed, and storage validation refuses it); if met, not raising the
  // figures again can only under-state free beds.
  const liveRelease = state.bedReleases.find((r) => r.admissionId === admission.id && r.state !== "discharged");
  const releaseAlreadyIncremented = state.bedReleases.some(
    (r) => r.admissionId === admission.id && r.state === "discharged",
  );

  // Item 11 / WFA-003: `PULL_PATIENT` decrements `allocatableLocked` when the bed taken was locked;
  // departure restores it on both branches, since `RELEASE_BED` never touches that field.
  //
  // S2-3: a departure resolves one over-capacity arrival (this admission's, or the unit's earliest
  // pending conflict), so bed figures do not rise above true capacity.
  const admittingMovement = state.movements.find((m) => m.admissionId === admission.id);
  const matchingConflictIndex =
    unit.arrivalCapacityConflicts?.findIndex(
      (entry) =>
        entry.admissionId === admission.id ||
        (admittingMovement?.id !== undefined && entry.movementId === admittingMovement.id),
    ) ?? -1;
  const conflictToResolveIndex =
    matchingConflictIndex >= 0 ? matchingConflictIndex : (unit.arrivalCapacityConflicts?.length ?? 0) > 0 ? 0 : -1;
  const arrivalAwaitingCapacity = conflictToResolveIndex >= 0;
  const remainingArrivalConflicts =
    conflictToResolveIndex >= 0 && unit.arrivalCapacityConflicts
      ? unit.arrivalCapacityConflicts.filter((_, idx) => idx !== conflictToResolveIndex)
      : unit.arrivalCapacityConflicts;
  const restoreLocked = !arrivalAwaitingCapacity && admission.bedKind === "locked" ? 1 : 0;
  // Owner ruling 2026-09-25: occupant counts follow gender (recorded sex for a non-binary person).
  // An admission carries only `sex`, so the gender comes from the movement that admitted it.
  const leaverSex = mixSexOf(admission.gender ?? admittingMovement?.gender, admission.sex);
  // Audit A1-11 (13 Oct 2026): a departure moves the figures but never stamps them as confirmed;
  // only the ward's own Confirm numbers (`CONFIRM_CAPACITY`) sets `confirmedAt`.
  const updatedUnit: Unit =
    releaseAlreadyIncremented || arrivalAwaitingCapacity
      ? {
          ...unit,
          allocatableLocked: Math.min(unit.lockedBeds, unit.allocatableLocked + restoreLocked),
          sexMix: adjustSexMix(unit.sexMix, leaverSex, -1),
          ...(remainingArrivalConflicts === undefined ? {} : { arrivalCapacityConflicts: remainingArrivalConflicts }),
        }
      : {
          ...unit,
          empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1) },
          allocatable: {
            ...unit.allocatable,
            value: Math.min(unit.beds, unit.allocatable.value + 1),
          },
          allocatableLocked: Math.min(unit.lockedBeds, unit.allocatableLocked + restoreLocked),
          sexMix: adjustSexMix(unit.sexMix, leaverSex, -1),
          ...(remainingArrivalConflicts === undefined ? {} : { arrivalCapacityConflicts: remainingArrivalConflicts }),
        };
  // Leaving ends any discharge blocker too: the stay is over, so it must not carry a "held up" reason
  // into history, the same way its bed release loses its blocker below.
  const departed: Admission = {
    ...admission,
    state: "departed",
    leftAt: now,
    leavingDestination,
    blockReason: null,
    dischargeCriteria: null,
    // Item 18: kept on the "Waiting for transport" list until collected. The bed itself frees here,
    // once, by the same arithmetic as any departure.
    ...(awaitingTransport ? { waitingForTransport: { since: now, by: role } } : {}),
  };
  const departedState = replaceAdmission(replaceUnit(state, unit.id, updatedUnit), admission.id, departed);
  // Owner ruling: a leave bed belongs to one stay, so leaving ends it in the same write. No bed
  // figure moves here.
  const withPerson: WardFlowState = departedState.leaveBeds.some((bed) => bed.admissionId === admission.id)
    ? { ...departedState, leaveBeds: departedState.leaveBeds.filter((bed) => bed.admissionId !== admission.id) }
    : departedState;
  // A4-24 (owner decision): a vacated bed goes to "Being made ready" (`preparing: true` on the
  // discharged release) until one tap of Ready (`SET_BED_PREPARATION`, `preparing: false`). When no
  // bed came free here, nothing is marked.
  const bedCameFree = !releaseAlreadyIncremented && !arrivalAwaitingCapacity;
  // Item 18 (Josh): a bed left by somebody waiting for transport is Ready at once, no cleaning step.
  const beingMadeReady = bedCameFree && !awaitingTransport;
  if (!liveRelease) {
    if (!bedCameFree) return withPerson;
    // A departure nobody flagged still vacates a bed: record its release, already discharged, to
    // carry "Being made ready". Same id scheme as FLAG_BED_RELEASE.
    const vacated: BedRelease = {
      id: nextBedReleaseId(withPerson.bedReleases),
      unitId: unit.id,
      admissionId: admission.id,
      state: "discharged",
      expectedAt: now,
      waitingOn: null,
      blocker: null,
      blockedBy: null,
      preparing: beingMadeReady,
      preparationNote: null,
      confirmedAt: now,
      confirmedBy: recordedByLabel(role, unit.name),
    };
    return { ...withPerson, bedReleases: [...withPerson.bedReleases, vacated] };
  }
  // Leaving completes this person's release — the same fields RELEASE_BED used to write. A stuck flag
  // comes off, because the bed is no longer held up.
  return replaceBedRelease(withPerson, liveRelease.id, {
    ...liveRelease,
    state: "discharged",
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: beingMadeReady,
    preparationNote: null,
    confirmedAt: now,
  });
}
