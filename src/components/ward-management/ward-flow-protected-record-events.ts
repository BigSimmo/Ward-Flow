import { withoutRecordNumbers } from "./ward-patient-resolver";
import { validCareChange, careChangeRefusal, applyCareChange, emptyCareJourney } from "./ward-care-journey";
import { appendAudit, finiteInstant, governanceAuditEntry, reviewDecision, type AuditDecision } from "./ward-audit";
import { undoWindowRefusal } from "./ward-undo";
import { openRestrictivePracticeRefusal } from "./restrictive-practice/ward-restrictive-practice";
import { openReturnMovementRefusal } from "./ward-flow-record-stay-events";
import {
  INVOLUNTARY_DEPARTURE_REFUSAL,
  departureNeedsPaperAuthority,
  stayLegalStatusIsInvoluntary,
  dischargeIdentity,
  dischargeMovement,
  readOpenedDischargeRecord,
  isDischargeOpenReceipt,
  validDischargeRequestNamespace,
  safeCounter,
  selectDischargeRecord,
  uniqueRecord,
  validRecordActor,
  type WardRecordActor,
} from "./ward-discharge-records";
import { isLeavingDestination, isFollowUpState } from "./ward-admissions";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { eligibility, adjustSexMix, mixSexOf } from "@/components/ward-management/ward-eligibility";
import { EVENT_ROLE, WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { MovementId, Movement } from "@/components/ward-management/ward-model";
import { lacksObservationStaff, remainingHighAcuityCapacity } from "@/components/ward-management/ward-admissions";
import type { ProtectedRecordEventHelpers, WardFlowState } from "./ward-flow-reducer";

/**
 * The protected record events: opening a discharge record, reviewing an audit event and taking
 * that review back, and recording a discharge, a follow-up or admission care. The reducer's
 * `reduceRecordEvent` and its refusal helper, moved here unchanged on 22 October 2026 for the line
 * cap. The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type ProtectedRecordEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "OPEN_DISCHARGE_RECORD"
      | "REVIEW_AUDIT_EVENT"
      | "UNDO_AUDIT_REVIEW"
      | "RECORD_PATIENT_DISCHARGE"
      | "RECORD_ADMISSION_FOLLOW_UP"
      | "RECORD_ADMISSION_CARE";
  }
>;

/** Shown when a care step, such as a revocation, is attempted on a stay with no linked patient. */
export const UNLINKED_CARE_REFUSAL =
  "Link the patient to their record first. A revocation or any other care step can only be recorded for a linked patient.";

/**
 * What a refused protected-record step says when its check gives no reason of its own: what
 * happened, then what to do (stress test 25 Oct 2026). A record outside the desk's place and one
 * that does not exist read alike, so the wording never says which.
 */
export const PROTECTED_REFUSAL_REASONS: Record<AuditDecision["reasonCode"], string> = {
  none: "This change was not made. Check the board, then try again. Nothing was changed.",
  role: "Your role cannot make this change. Nothing was changed.",
  scope: "This record is not open to your desk, or no longer exists. Nothing was changed.",
  "missing-or-inaccessible": "This record is not open to your desk, or no longer exists. Nothing was changed.",
  revision: "Someone else changed this record first. Check the board, then try again. Nothing was changed.",
  generation:
    "The board was reset or replaced since you opened this. Check the board, then try again. Nothing was changed.",
  transition:
    "This record has moved on to a step that does not allow this change. Check the board. Nothing was changed.",
  "invalid-payload": "Some details were missing or not valid. Check the form, then try again. Nothing was changed.",
  "identity-link":
    "The patient record link could not be checked. Check the patient, then try again. Nothing was changed.",
};

function protectedRefusal(
  state: WardFlowState,
  event: ProtectedRecordEvent,
  decision: AuditDecision,
  rejectionReason = PROTECTED_REFUSAL_REASONS[decision.reasonCode] ?? PROTECTED_REFUSAL_REASONS.none,
): WardFlowState {
  const rejected =
    finiteInstant(event.now) === null
      ? state
      : {
          ...state,
          rejections: [
            ...state.rejections,
            {
              id: `record-rejection-${state.auditSequence + 1}`,
              at: event.now,
              movementId: "none",
              attempted: event.type,
              reason: withoutRecordNumbers(rejectionReason),
            },
          ],
        };
  return appendAudit(state, rejected, event, decision);
}

export function reduceProtectedRecordEvent(
  state: WardFlowState,
  event: ProtectedRecordEvent,
  helpers: ProtectedRecordEventHelpers,
): WardFlowState {
  const {
    admissionLegalStatus,
    departAdmission,
    dischargeBlockingTransit,
    patientRecordIsInvoluntary,
    replaceAdmission,
    replaceUnit,
  } = helpers;
  const deny = (
    reasonCode: AuditDecision["reasonCode"],
    outcome: AuditDecision["outcome"] = "denied",
    rejectionReason?: string,
  ) => protectedRefusal(state, event, { outcome, reasonCode }, rejectionReason);
  // Role is inspected before any protected payload or legacy rejection helper.
  if (!EVENT_ROLE[event.type].includes(event.role))
    return deny("role", "denied", event.type === "UNDO_AUDIT_REVIEW" ? "Coordinator only" : undefined);
  if (finiteInstant(event.now) === null || !safeCounter(event.expectedGeneration)) return deny("invalid-payload");
  if (event.expectedGeneration !== state.worldGeneration) return deny("generation", "stale");

  if (event.type === "UNDO_AUDIT_REVIEW") {
    // v10 pass 2: takes back one review exactly — the review list returns to what it was before it.
    // The audit log keeps both the review and this undo; review ids are never reused.
    const review = uniqueRecord(state.auditReviews, event.reviewId);
    if (!review || review.generation !== state.worldGeneration)
      return deny("missing-or-inaccessible", "denied", "That review is not on record, so it cannot be undone");
    const index = state.auditReviews.indexOf(review);
    if (
      state.auditReviews.some(
        (other, at) => at > index && other.eventId === review.eventId && other.generation === review.generation,
      )
    )
      return deny("revision", "stale", "A later review of this event is on record; undo that one first");
    const windowRefusal = undoWindowRefusal(review.at, event.now);
    if (windowRefusal) return deny("transition", "denied", windowRefusal);
    return appendAudit(
      state,
      { ...state, auditReviews: state.auditReviews.filter((other) => other !== review) },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }

  if (event.type === "REVIEW_AUDIT_EVENT") {
    if (!safeCounter(event.expectedReviewCount) || !reviewDecision(event.decision)) return deny("invalid-payload");
    // v10 pass 2: the synthetic seeded governance entries (`ward-governance-seed.ts`) are reviewable too.
    const entry = governanceAuditEntry(state, event.eventId);
    if (!entry || entry.generation !== state.worldGeneration || entry.category === "review")
      return deny("missing-or-inaccessible");
    const count = state.auditReviews.filter(
      (review) => review.eventId === entry.id && review.generation === state.worldGeneration,
    ).length;
    if (count !== event.expectedReviewCount) return deny("revision", "stale");
    if (!safeCounter(state.auditReviewSequence) || state.auditReviewSequence >= Number.MAX_SAFE_INTEGER)
      return deny("invalid-payload");
    const sequence = state.auditReviewSequence + 1;
    return appendAudit(
      state,
      {
        ...state,
        auditReviewSequence: sequence,
        auditReviews: [
          ...state.auditReviews,
          {
            id: `audit-review-${sequence}`,
            eventId: entry.id,
            generation: state.worldGeneration,
            at: event.now,
            byRole: "coordinator",
            decision: event.decision,
          },
        ],
      },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }

  // The coordinator may take every action (Josh, 10 Oct 2026) and acts for no single ward, so it is
  // scoped by role alone and its unit comes from the admission below.
  const actor = (
    event.role === "coordinator"
      ? { role: event.role }
      : "actingUnitId" in event
        ? { role: event.role, actingUnitId: event.actingUnitId }
        : "actingTeamId" in event
          ? { role: event.role, actingTeamId: event.actingTeamId }
          : { role: event.role }
  ) as WardRecordActor;
  if (!validRecordActor(actor)) return deny("scope");
  if (event.type === "OPEN_DISCHARGE_RECORD") {
    if (
      !safeCounter(event.requestId) ||
      (event.requestNamespace !== undefined && !validDischargeRequestNamespace(event.requestNamespace))
    )
      return deny("invalid-payload");
    const previous = state.auditEvents.find((entry) =>
      isDischargeOpenReceipt(entry, {
        generation: state.worldGeneration,
        requestId: event.requestId,
        requestNamespace: event.requestNamespace,
      }),
    );
    if (previous) {
      const read = readOpenedDischargeRecord(state, actor, event.admissionId, {
        generation: event.expectedGeneration,
        requestId: event.requestId,
        ...(event.requestNamespace === undefined ? {} : { requestNamespace: event.requestNamespace }),
      });
      return read.status === "allowed" ? state : deny("missing-or-inaccessible");
    }
    if (selectDischargeRecord(state, actor, event.admissionId).status === "denied")
      return deny("missing-or-inaccessible");
    return appendAudit(state, state, event, { outcome: "accepted", reasonCode: "none" });
  }

  if (!safeCounter(event.expectedRevision)) return deny("invalid-payload");
  const admission = uniqueRecord(state.admissions, event.admissionId);
  const unit = uniqueRecord(
    state.units,
    event.role === "coordinator" ||
      ((event.type === "RECORD_ADMISSION_FOLLOW_UP" || event.type === "RECORD_ADMISSION_CARE") &&
        event.role === "community")
      ? admission?.unitId
      : event.actingUnitId,
  );
  if (!unit || !admission || !uniqueRecord(state.units, admission.unitId)) return deny("missing-or-inaccessible");
  if (admission.unitId !== unit.id) return deny("scope");
  const identity = dischargeIdentity(state, admission);
  // A care record (a revocation included) needs a linked patient (owner, 20 Oct 2026): say so plainly.
  if (identity.kind !== "linked" && event.type === "RECORD_ADMISSION_CARE")
    return deny("identity-link", "denied", UNLINKED_CARE_REFUSAL);
  if (identity.kind !== "linked" || identity.patient.id !== event.patientId) return deny("identity-link");
  const revision = state.dischargeRevisions[admission.id] ?? 0;
  if (!safeCounter(revision) || revision >= Number.MAX_SAFE_INTEGER) return deny("invalid-payload");
  if (revision !== event.expectedRevision) return deny("revision", "stale");
  if (event.type === "RECORD_ADMISSION_CARE") {
    if (selectDischargeRecord(state, actor, admission.id).status === "denied") return deny("scope");
    if (!validCareChange(event.change)) return deny("invalid-payload");
    if (event.role === "community" && !["follow_up", "contact", "plan", "document"].includes(event.change.kind))
      return deny("role");
    if (
      (admission.state !== "occupied" && admission.state !== "departed") ||
      (admission.arrivedAt !== null && event.now < admission.arrivedAt)
    )
      return deny("transition");
    if (
      event.role === "community" &&
      ((event.change.kind === "follow_up" && event.change.serviceId !== event.actingTeamId) ||
        (event.change.kind === "contact" &&
          admission.careJourney?.followUp &&
          admission.careJourney.followUp.serviceId !== event.actingTeamId))
    )
      return deny("scope");
    // D-30: only the central bed coordinator accepts an inter-ward transfer.
    if (event.change.kind === "transfer" && event.change.step === "accepted" && event.role !== "coordinator")
      return deny("role");
    const refusal = careChangeRefusal(admission, event.change, event.now);
    if (refusal) return deny("transition", "denied", refusal);
    if (event.change.kind === "transfer" && !uniqueRecord(state.units, event.change.receivingUnitId))
      return deny("missing-or-inaccessible");
    if (
      event.change.kind === "transport" &&
      event.change.authority === "none" &&
      ["ambulance", "service_vehicle", "police", "rfds"].includes(event.change.mode)
    ) {
      const patient = uniqueRecord(state.patients, admission.patientId);
      if (patientRecordIsInvoluntary(patient?.legalStatus) || stayLegalStatusIsInvoluntary(state, admission))
        return deny("transition", "denied", "Record the checked transport authority for this involuntary arrangement.");
    }
    if (event.change.kind === "legal" && event.change.authority === "5B") {
      const previous = admission.careJourney?.legal?.authority ?? dischargeMovement(state, admission)?.legalForm?.code;
      if (previous !== "5A" && previous !== "5B")
        return deny(
          "transition",
          "denied",
          "A Form 5B continuation needs a recorded Form 5A or earlier Form 5B for this stay.",
        );
    }
    const careJourney = applyCareChange(
      admission.careJourney ?? emptyCareJourney(),
      event.change,
      event.now,
      WARD_FLOW_ROLE_LABELS[event.role],
    );
    let next = replaceAdmission(state, admission.id, {
      ...admission,
      careJourney,
      ...(event.change.kind === "follow_up"
        ? {
            followUp: {
              state: "arranged" as const,
              recordedAt: event.now,
              recordedBy: WARD_FLOW_ROLE_LABELS[event.role],
            },
          }
        : {}),
    });
    if (event.change.kind === "transfer" && event.change.step === "arrived") {
      if (event.role !== "coordinator" || admission.state !== "occupied") return deny("role");
      const receiving = uniqueRecord(state.units, event.change.receivingUnitId);
      const movement = dischargeMovement(state, admission);
      // Audit 2 E-09: judge the receiving ward on the stay's current legal status, not the status
      // the patient arrived with on the original movement. Used for the checks only; the recorded
      // movement below keeps its own field.
      const stayLegalStatus =
        movement === undefined ? undefined : (admissionLegalStatus(state, admission) ?? movement.legalStatus);
      const judged =
        movement === undefined ? undefined : { ...movement, legalStatus: stayLegalStatus as Movement["legalStatus"] };
      if (
        !receiving ||
        receiving.isClosed ||
        !safeCounter(receiving.empty.value) ||
        receiving.empty.value <= 0 ||
        !movement ||
        !judged ||
        !eligibility(judged, receiving, event.now).eligible
      )
        return deny(
          "transition",
          "denied",
          "The receiving ward must have a suitable available bed and a linked placement record.",
        );
      if (
        state.admissions.some(
          (a) =>
            a.id !== admission.id &&
            a.patientId === admission.patientId &&
            (a.state === "occupied" || a.state === "pulled"),
        )
      )
        return deny("transition", "denied", "The patient already has another occupied or held bed.");
      const restrictiveRefusal = openRestrictivePracticeRefusal(unit.restrictivePractice, admission.id);
      if (restrictiveRefusal) return deny("transition", "denied", restrictiveRefusal);
      const returnRefusal = openReturnMovementRefusal(state.movements, admission.id);
      if (returnRefusal) return deny("transition", "denied", returnRefusal);
      if (
        lacksObservationStaff(admission.observation, receiving, state.admissions) ||
        (admission.highAcuity && remainingHighAcuityCapacity(receiving, state.admissions) <= 0)
      )
        return deny("transition", "denied", "The receiving ward must have the required staffing capacity.");
      const bedKind =
        stayLegalStatus === "Voluntary" && openBedsFree(receiving) > 0 ? ("open" as const) : ("locked" as const);
      if (bedKind === "locked" && lockedBedsFree(receiving) <= 0) return deny("transition");
      const id = `transfer-${admission.id}-${revision + 1}`;
      const movementId: MovementId = `WF-${id}`;
      if (state.admissions.some((a) => a.id === id) || state.movements.some((m) => m.id === movementId))
        return deny("invalid-payload");
      next = departAdmission(
        next,
        { ...admission, careJourney },
        unit,
        event.now,
        "transferred-to-another-psychiatric-ward",
        event.role,
      );
      next = replaceUnit(next, receiving.id, {
        ...receiving,
        empty: { ...receiving.empty, value: receiving.empty.value - 1 },
        allocatable: { ...receiving.allocatable, value: receiving.allocatable.value - 1 },
        allocatableLocked: receiving.allocatableLocked - (bedKind === "locked" ? 1 : 0),
        sexMix: adjustSexMix(receiving.sexMix, mixSexOf(admission.gender, admission.sex), 1),
      });
      const { bedNumber: _sendingBedNumber, ...admissionWithoutBedNumber } = admission;
      void _sendingBedNumber;
      next = {
        ...next,
        admissions: [
          ...next.admissions,
          {
            ...admissionWithoutBedNumber,
            id,
            unitId: receiving.id,
            movementId,
            state: "occupied",
            bedKind,
            pulledAt: event.now,
            arrivedAt: event.now,
            leftAt: null,
            leavingDestination: null,
            expectedDischargeAt: null,
            dischargeConfirmedAt: null,
            dischargeDateSetAt: null,
            dischargeDateSetBy: null,
            dischargeConfirmedBy: null,
            dischargeDateMoves: 0,
            blockReason: null,
            dischargeBarrier: null,
            dischargeCriteria: null,
            stepDownCandidate: false,
            awayAtEmergencyDepartmentSince: null,
            careJourney: { ...emptyCareJourney(), followUp: careJourney.followUp },
          },
        ],
        movements: [
          ...next.movements,
          {
            ...movement,
            id: movementId,
            admissionId: id,
            acceptedUnitId: receiving.id,
            stage: "arrived",
            openedAt: event.now,
            referredAt: undefined,
            acceptedAt: undefined,
            referredUnitIds: [receiving.id],
            arrivalDetails: undefined,
            arrivalLateNotifiedAt: undefined,
            expectFlag: undefined,
            stageChanges: [{ at: event.now, to: "arrived", by: event.role, reason: "Recorded ward transfer arrival" }],
            transport: undefined,
            closure: { at: event.now, outcome: "arrived", reason: "Recorded ward transfer arrival" },
          },
        ],
        dischargeRevisions: { ...next.dischargeRevisions, [id]: 0 },
      };
    }
    return appendAudit(
      state,
      { ...next, dischargeRevisions: { ...next.dischargeRevisions, [admission.id]: revision + 1 } },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }
  if (event.type === "RECORD_ADMISSION_FOLLOW_UP") {
    if (typeof event.followUpState !== "string" || !isFollowUpState(event.followUpState))
      return deny("invalid-payload");
    if (
      (admission.state !== "occupied" && admission.state !== "departed") ||
      admission.leavingDestination === "died-on-the-ward"
    )
      return deny("transition");
    if (admission.arrivedAt !== null && event.now < admission.arrivedAt) return deny("invalid-payload");
    const next = replaceAdmission(state, admission.id, {
      ...admission,
      followUp: { state: event.followUpState, recordedAt: event.now, recordedBy: WARD_FLOW_ROLE_LABELS[event.role] },
    });
    return appendAudit(
      state,
      {
        ...next,
        dischargeRevisions: { ...next.dischargeRevisions, [admission.id]: revision + 1 },
      },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }
  if (!isLeavingDestination(event.leavingDestination)) return deny("invalid-payload");
  if (admission.state !== "occupied") return deny("transition");
  if (admission.arrivedAt !== null && event.now < admission.arrivedAt) return deny("invalid-payload");

  // Involuntary patient discharge boundary (WA Mental Health Act 2014), one rule with the bed drawer.
  if (departureNeedsPaperAuthority(state, admission, event.leavingDestination))
    return deny("transition", "denied", INVOLUNTARY_DEPARTURE_REFUSAL);

  // Discharge blocked while in transit, inbound or outbound
  if (dischargeBlockingTransit(state, admission)) {
    return deny("transition", "denied", "Patient is currently in transit to another facility.");
  }
  const restrictiveRefusal = openRestrictivePracticeRefusal(unit.restrictivePractice, admission.id);
  if (restrictiveRefusal) return deny("transition", "denied", restrictiveRefusal);
  const returnRefusal = openReturnMovementRefusal(state.movements, admission.id);
  if (returnRefusal) return deny("transition", "denied", returnRefusal);
  return appendAudit(
    state,
    departAdmission(state, admission, unit, event.now, event.leavingDestination, event.role),
    event,
    {
      outcome: "accepted",
      reasonCode: "none",
    },
  );
}
