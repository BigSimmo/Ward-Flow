import { liveMovementForAdmission } from "./ward-admissions";
import type { AuditDecision } from "./ward-audit";
import type {
  bedNumberRefusal,
  findAdmission,
  findReferral,
  findUnit,
  heldBedRefusal,
  movementSourceAdmission,
  reject,
  replaceAdmission,
  replaceReferral,
  UNDO_STEP_NOTHING,
  WardFlowState,
} from "./ward-flow-reducer";
import {
  applyStepUndo,
  bedPlacementUndoFor,
  referralDecisionUndoFor,
  sameRecord,
  stepChangedSince,
  stepUndoFor,
  undoRoleRefusal,
  undoStepSubjectId,
  undoWindowRefusal,
  withoutUndoRecord,
} from "./ward-undo";
import { type Admission, bedIsOccupied } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { sameLinkedPatient } from "./ward-flow-bed-events";

/**
 * UNDO_* events: take back a recent step exactly, using the records kept in `ward-undo.ts`.
 * Split out of `ward-flow-reducer.ts` unchanged; role checks and pause guards still run there first.
 */
export type UndoEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "UNDO_REFERRAL_DECISION"
      | "UNDO_PLACE_IN_BED"
      | "UNDO_REFER_TO_UNITS"
      | "UNDO_ACCEPT_IN_PRINCIPLE"
      | "UNDO_LEGAL_FORM_RECORD"
      | "UNDO_SUPPORT_NOTIFICATION"
      | "UNDO_REPATRIATION"
      | "UNDO_HANDOVER_SIGN_OFF"
      | "UNDO_ED_STEP"
      | "UNDO_TRANSPORT_STEP"
      | "UNDO_DEPARTURE"
      | "UNDO_ABSENT_WITHOUT_LEAVE";
  }
>;

/**
 * The reducer helpers this slice uses. `ward-flow-reducer.ts` passes them in, so the two files do not
 * import each other at run time (tests/architecture-boundaries.test.ts forbids runtime import cycles).
 */
export type UndoEventHelpers = {
  UNDO_STEP_NOTHING: typeof UNDO_STEP_NOTHING;
  bedNumberRefusal: typeof bedNumberRefusal;
  findAdmission: typeof findAdmission;
  findReferral: typeof findReferral;
  findUnit: typeof findUnit;
  heldBedRefusal: typeof heldBedRefusal;
  movementSourceAdmission: typeof movementSourceAdmission;
  reject: typeof reject;
  replaceAdmission: typeof replaceAdmission;
  replaceReferral: typeof replaceReferral;
};

export function reduceUndoEvent(
  state: WardFlowState,
  event: UndoEvent,
  decision: AuditDecision,
  helpers: UndoEventHelpers,
): WardFlowState {
  const {
    UNDO_STEP_NOTHING,
    bedNumberRefusal,
    findAdmission,
    findReferral,
    findUnit,
    heldBedRefusal,
    movementSourceAdmission,
    reject,
    replaceAdmission,
    replaceReferral,
  } = helpers;
  switch (event.type) {
    case "UNDO_REFERRAL_DECISION": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      const record = referralDecisionUndoFor(state.undoRecords, referral.id);
      if (!record) return reject(state, event, "There is no decision on this referral to undo");
      const refusal =
        undoRoleRefusal(record, event.role, event.actingUnitId) ??
        undoWindowRefusal(record.at, event.now) ??
        (sameRecord(referral, record.after)
          ? null
          : "This referral has changed since the decision, so it cannot be undone");
      if (refusal) return reject(state, event, refusal);
      const restored = replaceReferral(state, referral.id, structuredClone(record.before));
      const raised = new Set(record.noticeIds);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...restored,
        notices: restored.notices.filter((notice) => !(raised.has(notice.id) && notice.raisedAt === record.at)),
        undoRecords: withoutUndoRecord(state.undoRecords, record),
      };
    }

    case "UNDO_PLACE_IN_BED": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      const record = bedPlacementUndoFor(state.undoRecords, admission.id);
      if (!record) return reject(state, event, "There is no bed move on this stay to undo");
      const refusal =
        undoRoleRefusal(record, event.role, event.actingUnitId) ??
        undoWindowRefusal(record.at, event.now) ??
        (admission.unitId === record.unitId && admission.bedNumber === record.afterBed && bedIsOccupied(admission)
          ? null
          : "This stay has changed since the bed move, so it cannot be undone");
      if (refusal) return reject(state, event, refusal);
      const unit = findUnit(state, admission.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${admission.unitId}`);
      const kindChange = record.bedKindChange;
      // A same-kind move (equal locked counts) is undone without touching the ward row, so a later
      // resource update such as CONFIRM_CAPACITY cannot be overwritten and must not block it.
      const capacityChanged = kindChange !== undefined && kindChange.lockedBefore !== kindChange.lockedAfter;
      if (
        kindChange &&
        (admission.bedKind !== kindChange.after ||
          (capacityChanged &&
            (unit.allocatableLocked !== kindChange.lockedAfter ||
              (unit.allocatable.revision ?? 0) !== kindChange.capacityRevision)))
      )
        return reject(state, event, "The stay or ward capacity has changed since the bed move, so it cannot be undone");
      const linkedMovement =
        record.beforeMovementBed !== undefined ? liveMovementForAdmission(admission, state.movements) : undefined;
      if (
        record.beforeMovementBed !== undefined &&
        (!linkedMovement ||
          linkedMovement.closure ||
          admission.state !== "pulled" ||
          linkedMovement.heldBedNumber !== record.afterBed)
      )
        return reject(state, event, "The bed journey has changed, so the pulled-bed move cannot be undone");
      const linkedReferral =
        record.beforeReferralBed === undefined
          ? undefined
          : findReferral(state, admission.referralId ?? linkedMovement?.referralId ?? "");
      const acceptedArmIndexes =
        linkedReferral?.destinations.flatMap((arm, index) =>
          arm.state === "accepted" &&
          arm.destination.kind === "psychiatric_ward" &&
          (arm.acceptedUnitId ?? arm.destination.unitId) === admission.unitId
            ? [index]
            : [],
        ) ?? [];
      // Legacy records may restore only an unambiguous accepted ward arm.
      const referralArmIndex =
        record.beforeReferralArmIndex ?? (acceptedArmIndexes.length === 1 ? acceptedArmIndexes[0] : undefined);
      const linkedArm = referralArmIndex === undefined ? undefined : linkedReferral?.destinations[referralArmIndex];
      if (
        record.beforeReferralBed !== undefined &&
        (referralArmIndex === undefined ||
          !acceptedArmIndexes.includes(referralArmIndex) ||
          linkedArm?.heldBedNumber !== record.afterBed)
      )
        return reject(state, event, "The accepted referral arm has changed, so the pulled-bed move cannot be undone");
      // Older pulled stays can be unnumbered while their journey or referral holds a number.
      // Validate every number restored by Undo, including those absent from the admission.
      const restoredBeds = new Set(
        [record.beforeBed, record.beforeMovementBed, record.beforeReferralBed].filter(
          (bed): bed is number => bed !== null && bed !== undefined,
        ),
      );
      for (const bed of restoredBeds) {
        const bedRefusal = bedNumberRefusal(state, unit, bed, admission.id);
        if (bedRefusal) return reject(state, event, `${bedRefusal}, so the move cannot be undone`);
        const heldRefusal = heldBedRefusal(
          state,
          unit,
          bed,
          linkedMovement?.id,
          admission.referralId ?? linkedMovement?.referralId,
        );
        if (heldRefusal) return reject(state, event, `${heldRefusal}, so the move cannot be undone`);
      }
      // Exact: a stay that had no bed number before gets none back (the key absent, not undefined).
      const { bedNumber: _placed, ...unplaced } = admission;
      void _placed;
      let restored: Admission = record.beforeBed === null ? unplaced : { ...admission, bedNumber: record.beforeBed };
      if (kindChange) {
        const { bedKind: _kind, ...withoutKind } = restored;
        void _kind;
        restored = kindChange.before === null ? withoutKind : { ...restored, bedKind: kindChange.before };
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...replaceAdmission(state, admission.id, restored),
        ...(capacityChanged
          ? {
              units: state.units.map((row) =>
                row.id === unit.id ? { ...unit, allocatableLocked: kindChange.lockedBefore } : row,
              ),
            }
          : {}),
        movements: linkedMovement
          ? state.movements.map((movement) =>
              movement === linkedMovement
                ? { ...movement, heldBedNumber: record.beforeMovementBed ?? undefined }
                : movement,
            )
          : state.movements,
        referrals:
          record.beforeReferralBed !== undefined
            ? state.referrals.map((referral) =>
                referral === linkedReferral
                  ? {
                      ...referral,
                      destinations: referral.destinations.map((arm, index) =>
                        index === referralArmIndex
                          ? { ...arm, heldBedNumber: record.beforeReferralBed ?? undefined }
                          : arm,
                      ),
                    }
                  : referral,
              )
            : state.referrals,
        undoRecords: withoutUndoRecord(state.undoRecords, record),
      };
    }

    case "UNDO_REFER_TO_UNITS":
    case "UNDO_ACCEPT_IN_PRINCIPLE":
    case "UNDO_LEGAL_FORM_RECORD":
    case "UNDO_SUPPORT_NOTIFICATION":
    case "UNDO_REPATRIATION":
    case "UNDO_HANDOVER_SIGN_OFF":
    case "UNDO_ED_STEP":
    case "UNDO_TRANSPORT_STEP":
    case "UNDO_DEPARTURE":
    case "UNDO_ABSENT_WITHOUT_LEAVE": {
      // v10 pass 3: takes back the newest step of this kind on this subject, exactly (`ward-undo.ts`).
      const record = stepUndoFor(state.undoRecords, event.type, undoStepSubjectId(event));
      if (!record) return reject(state, event, UNDO_STEP_NOTHING[event.type]);
      // An older toast's Undo must not take back a newer step that replaced its record.
      if (event.recordSeq !== undefined && record.seq !== event.recordSeq)
        return reject(state, event, "A later step replaced this one, so this Undo no longer applies");
      const refusal =
        undoRoleRefusal(record, event.role, "actingUnitId" in event ? event.actingUnitId : undefined) ??
        undoWindowRefusal(record.at, event.now) ??
        (stepChangedSince(state, record) ? "This has changed since, so it cannot be undone" : null);
      if (refusal) return reject(state, event, refusal);
      const undone = applyStepUndo(state, record);
      // Unchanged original rows do not prove that a later, independent stay is absent.
      // Check the restored claims against the current world before committing any part of Undo.
      for (const admission of undone.admissions) {
        if (!bedIsOccupied(admission)) continue;
        const current = state.admissions.find((candidate) => candidate.id === admission.id);
        if (current && sameRecord(current, admission)) continue;
        if (
          undone.admissions.some(
            (other) =>
              other.id !== admission.id &&
              sameLinkedPatient(other, admission) &&
              bedIsOccupied(other) &&
              // A recorded transfer may keep the source occupied while the destination is
              // pulled. Undoing its arrival must be able to restore that legitimate hold.
              !undone.movements.some((movement) => {
                if (movement.closure) return false;
                const source = movementSourceAdmission(undone, movement);
                const target = undone.admissions.find((a) => a.id === movement.admissionId);
                return (
                  source?.state === "occupied" &&
                  target?.state === "pulled" &&
                  ((source.id === admission.id && target.id === other.id) ||
                    (source.id === other.id && target.id === admission.id))
                );
              }),
          )
        )
          return reject(state, event, "This patient now occupies or holds another bed, so this step cannot be undone");
        const unit = findUnit(undone, admission.unitId);
        if (unit && admission.bedNumber !== undefined) {
          const conflict =
            bedNumberRefusal(undone, unit, admission.bedNumber, admission.id) ??
            heldBedRefusal(
              undone,
              unit,
              admission.bedNumber,
              admission.movementId ?? undefined,
              admission.referralId ?? undefined,
            );
          if (conflict) return reject(state, event, `${conflict}, so this step cannot be undone`);
        }
      }
      // An arrival can also depart a sending stay. Every undo that restores a bed must recheck
      // ownership, including rows a later command changed outside this step's snapshot.
      for (const change of record.changes) {
        if (change.slice !== "admissions" || change.mode !== "id" || change.before === null) continue;
        const admission = change.before as Admission;
        const after = change.after as Admission | null;
        if (!bedIsOccupied(admission) || admission.bedNumber === undefined) continue;
        if (
          after &&
          bedIsOccupied(after) &&
          after.unitId === admission.unitId &&
          after.bedNumber === admission.bedNumber
        )
          continue;
        const unit = findUnit(undone, admission.unitId);
        if (!unit) return reject(state, event, "The original ward is unavailable, so the step cannot be undone");
        const bedRefusal =
          bedNumberRefusal(undone, unit, admission.bedNumber, admission.id) ??
          heldBedRefusal(undone, unit, admission.bedNumber);
        if (bedRefusal) return reject(state, event, `${bedRefusal}, so the step cannot be undone`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      // A stay the step created and the undo removed takes its own bed-move record with it.
      const remaining = withoutUndoRecord(state.undoRecords, record).filter(
        (other) => other.kind !== "bed-placement" || undone.admissions.some((stay) => stay.id === other.admissionId),
      );
      return { ...undone, undoRecords: remaining };
    }

    default: {
      // Sub-reducer slice narrowed via `Extract<WardFlowEvent, ...>`; ensure every UndoEvent case is handled.
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}
