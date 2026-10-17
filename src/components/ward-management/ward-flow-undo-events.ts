import type { AuditDecision } from "./ward-audit";
import type {
  bedNumberRefusal,
  findAdmission,
  findReferral,
  findUnit,
  heldBedRefusal,
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
      if (record.beforeBed !== null) {
        const bedRefusal = bedNumberRefusal(state, unit, record.beforeBed, admission.id);
        if (bedRefusal) return reject(state, event, `${bedRefusal}, so the move cannot be undone`);
        // B9 (site review, 12 Oct 2026): the same held-bed check PLACE_IN_BED makes, so an undo never
        // puts a patient back in a bed held since for somebody on their way.
        const heldRefusal = heldBedRefusal(state, unit, record.beforeBed);
        if (heldRefusal) return reject(state, event, `${heldRefusal}, so the move cannot be undone`);
      }
      // Exact: a stay that had no bed number before gets none back (the key absent, not undefined).
      const { bedNumber: _placed, ...unplaced } = admission;
      void _placed;
      const restored: Admission = record.beforeBed === null ? unplaced : { ...admission, bedNumber: record.beforeBed };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...replaceAdmission(state, admission.id, restored),
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
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const undone = applyStepUndo(state, record);
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
