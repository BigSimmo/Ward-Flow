import { type AuditDecision, finiteInstant } from "./ward-audit";
import { journeySentByKind } from "@/components/ward-management/ward-journey-sender";
import type {
  appendNotices,
  departAdmission,
  dischargeBlockingTransit,
  dischargeMovement,
  findAdmission,
  findMovement,
  findReferral,
  findUnit,
  makeNotice,
  movementHoldsBedByStage,
  movementSourceAdmission,
  nextLeaveBedId,
  nextReferralId,
  patientRecordIsInvoluntary,
  recordedByLabel,
  reduceClinicalEvent,
  referralReferrer,
  reject,
  releasePulledBedAndAdmission,
  withoutReferralBedHold,
  replaceAdmission,
  replaceMovement,
  replaceReferral,
  replaceUnit,
  STAGE_TRANSITION_BLOCKERS,
  WardFlowState,
  withdrawAllLiveRequestsForReferrer,
} from "./ward-flow-reducer";
import { reduceRecordedLegalEvent } from "./ward-flow-record-legal-events";
import { reduceRecordedStayEvent } from "./ward-flow-record-stay-events";
import { movementPatientIdentityMatchesRecord } from "./ward-patient-resolver";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import {
  DIVERSION_REASONS,
  TRANSPORT_WHEREABOUTS,
  WARD_INTAKE_CONSTRAINTS,
  WARD_REQUEST_WITHDRAWAL_REASONS,
} from "@/components/ward-management/ward-change-reasons";
import { WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isLegalClockFormCode } from "@/components/ward-management/ward-legal-clock";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  ED_OUTCOMES,
  EXAMINATION_OUTCOMES,
  type Movement,
  type MovementStage,
  type Notice,
  REFERRAL_GENDERS,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { referralSenderRole, referralState } from "@/components/ward-management/ward-referrals";

/**
 * RECORD_* events: facts a clinician or coordinator records against a referral, movement, stay or legal form.
 * Split out of `ward-flow-reducer.ts` unchanged; role checks and pause guards still run there first.
 */
export type RecordedFactEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "RECORD_MEDICAL_CLEARANCE"
      | "RECORD_ARRIVED_IN_DEPARTMENT"
      | "RECORD_TRANSPORT_NEED"
      | "RECORD_NO_REFERRAL"
      | "RECORD_ED_OUTCOME"
      | "RECORD_LEGAL_FORM_RECEIVED"
      | "RECORD_LEGAL_FORM_EXPIRY"
      | "RECORD_MOVEMENT_GENDER"
      | "RECORD_LEFT_DEPARTMENT"
      | "RECORD_EXAMINATION"
      | "RECORD_LEAVING"
      | "RECORD_MOVEMENT_BLOCKER"
      | "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT"
      | "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT"
      | "RECORD_STAY_DISCHARGE_BLOCKER"
      | "RECORD_WARD_INTAKE_CONSTRAINTS"
      | "RECORD_LEAVE_BED"
      | "RECORD_ABSENT_WITHOUT_LEAVE"
      | "RECORD_ABSENCE_STEP"
      | "RECORD_COMMUNITY_TREATMENT_ORDER"
      | "RECORD_REFERRER_WITHDRAWAL"
      | "RECORD_LOCAL_BED_SOUGHT"
      | "RECORD_ESCALATION"
      | "RECORD_DIVERSION"
      | "RECORD_ED_MEDICAL_DETERIORATION"
      | "RECORD_MOVEMENT_MEDICAL_CLEARANCE"
      | "RECORD_LEGAL_FORM_WRITTEN"
      | "RECORD_COUNTRY_EXTENSION"
      | "RECORD_LEGAL_FORM_CONTINUATION"
      | "RECORD_HANDOVER_SIGN_OFF"
      | "RECORD_REPATRIATION"
      | "RECORD_CLINICAL_CONTACT"
      | "RECORD_SUPPORT_NOTIFICATION";
  }
>;

/**
 * The reducer helpers this slice uses. `ward-flow-reducer.ts` passes them in, so the two files do not
 * import each other at run time (tests/architecture-boundaries.test.ts forbids runtime import cycles).
 */
export type RecordedFactEventHelpers = {
  STAGE_TRANSITION_BLOCKERS: typeof STAGE_TRANSITION_BLOCKERS;
  appendNotices: typeof appendNotices;
  departAdmission: typeof departAdmission;
  dischargeBlockingTransit: typeof dischargeBlockingTransit;
  dischargeMovement: typeof dischargeMovement;
  findAdmission: typeof findAdmission;
  findMovement: typeof findMovement;
  findReferral: typeof findReferral;
  findUnit: typeof findUnit;
  makeNotice: typeof makeNotice;
  movementHoldsBedByStage: typeof movementHoldsBedByStage;
  movementSourceAdmission: typeof movementSourceAdmission;
  nextLeaveBedId: typeof nextLeaveBedId;
  nextReferralId: typeof nextReferralId;
  patientRecordIsInvoluntary: typeof patientRecordIsInvoluntary;
  recordedByLabel: typeof recordedByLabel;
  reduceClinicalEvent: typeof reduceClinicalEvent;
  referralReferrer: typeof referralReferrer;
  reject: typeof reject;
  releasePulledBedAndAdmission: typeof releasePulledBedAndAdmission;
  withoutReferralBedHold: typeof withoutReferralBedHold;
  replaceAdmission: typeof replaceAdmission;
  replaceMovement: typeof replaceMovement;
  replaceReferral: typeof replaceReferral;
  replaceUnit: typeof replaceUnit;
  withdrawAllLiveRequestsForReferrer: typeof withdrawAllLiveRequestsForReferrer;
};

export function reduceRecordedFactEvent(
  state: WardFlowState,
  event: RecordedFactEvent,
  decision: AuditDecision,
  helpers: RecordedFactEventHelpers,
): WardFlowState {
  const {
    STAGE_TRANSITION_BLOCKERS,
    appendNotices,
    findAdmission,
    findMovement,
    findReferral,
    findUnit,
    makeNotice,
    movementHoldsBedByStage,
    movementSourceAdmission,
    referralReferrer,
    reject,
    releasePulledBedAndAdmission,
    withoutReferralBedHold,
    replaceAdmission,
    replaceMovement,
    replaceReferral,
    replaceUnit,
    withdrawAllLiveRequestsForReferrer,
  } = helpers;
  switch (event.type) {
    case "RECORD_MEDICAL_CLEARANCE": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      if (finiteInstant(event.now) === null || typeof event.cleared !== "boolean")
        return reject(state, event, "Medical clearance needs a valid timestamp and recorded answer.");
      if (
        event.cleared &&
        state.movements.some(
          (movement) =>
            movement.referralId === referral.id &&
            movement.medicalDeterioration &&
            movement.medicalDeterioration.resumedAt === undefined &&
            event.now <= movement.medicalDeterioration.at,
        )
      )
        return reject(state, event, "Re-clearance must be recorded after the medical deterioration.");
      // Re-recording overwrites on purpose: medical clearance is a current state that changes,
      // unlike an examination. `at` records when the answer was true.
      const updated: Referral = {
        ...referral,
        medicalClearance: { cleared: event.cleared, at: event.now },
      };
      const next = replaceReferral(state, referral.id, updated);
      return {
        ...next,
        movements: next.movements.map((movement) =>
          movement.referralId === referral.id &&
          (movement.patientId === undefined || movement.patientId === referral.patientId)
            ? {
                ...movement,
                medicalClearance: updated.medicalClearance,
                ...(event.cleared &&
                movement.medicalDeterioration &&
                movement.medicalDeterioration.resumedAt === undefined
                  ? {
                      medicalDeterioration: { ...movement.medicalDeterioration, resumedAt: event.now },
                      blocker: "Awaiting coordinator referral",
                    }
                  : {}),
              }
            : movement,
        ),
      };
    }

    /**
     * The only writer of `Referral.inDepartmentAt`, and the only door from "expect" to "referral"
     * (product owner: "When expects arrive and are marked as arrived, they become referrals.").
     */
    case "RECORD_ARRIVED_IN_DEPARTMENT": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /**
       * Idempotent, and the first recording wins: two clinicians noticing the same patient is
       * ordinary, and keeping the earlier time preserves the true wait. Arrival is a fact about the
       * past, unlike medical clearance.
       */
      if (referral.inDepartmentAt !== undefined) return state;
      const updated: Referral = { ...referral, inDepartmentAt: event.now };
      return replaceReferral(state, referral.id, updated);
    }

    case "RECORD_TRANSPORT_NEED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Refused once the journey is over, as for `RECORD_EXAMINATION`.
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot record a transport need for a closed movement (${movement.closure.reason})`,
        );
      }
      if (event.role === "ward") {
        const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
        // The stay a journey leaves names its sender first, as in the access check (review on PR #617).
        const sendingWard =
          movementSourceAdmission(state, movement)?.unitId ??
          referral?.originUnitId ??
          (movement as { originUnitId?: string }).originUnitId;
        // Audit 2 E-20: with no sending ward (an ED or community start), no ward desk records the
        // transport need, named or not; the origin and coordinator do. With a sending ward, an
        // unnamed ward desk is bound to it by its signed-in scope (commandRefusal), so only a named
        // acting ward is checked here.
        if (!sendingWard) {
          return reject(
            state,
            event,
            `RECORD_TRANSPORT_NEED was raised by ward ${event.actingUnitId ?? "(unnamed)"}, but this patient did not start on a ward`,
          );
        }
        if (event.actingUnitId !== undefined && event.actingUnitId !== sendingWard) {
          return reject(
            state,
            event,
            `RECORD_TRANSPORT_NEED was raised acting as unit ${event.actingUnitId} but movement origin is ward ${sendingWard}; only the sending ward can record transport need`,
          );
        }
      }
      const actingPlaceId = event.actingPlaceId;
      if (event.role === "ed" && actingPlaceId !== undefined && actingPlaceId !== movement.originEdId) {
        return reject(
          state,
          event,
          `${event.type} was raised acting as ED ${actingPlaceId} but movement origin is ${movement.originEdId ?? "a community team"}; only the origin ED can book or record transport for its own movement`,
        );
      }
      // Re-recording overwrites on purpose, as for medical clearance. "Not needed" is refused while
      // a booked job is live (audit §3 item 4): that job is cancelled through CANCEL_TRANSPORT
      // first, or PATIENT_ARRIVED could close the movement with a vehicle still booked.
      if (
        !event.needed &&
        movement.transport !== undefined &&
        movement.transport.cancelledAt === undefined &&
        movement.transport.arrivedAt === undefined
      ) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a booked transport job; cancel it before recording that no transport is needed`,
        );
      }
      const updated: Movement = {
        ...movement,
        transportNeed: { needed: event.needed, at: event.now },
        ...(movement.transport ? { transport: { ...movement.transport, needed: event.needed } } : {}),
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_NO_REFERRAL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot record a referral answer for a closed movement (${movement.closure.reason})`,
        );
      }
      /**
       * The contradiction is refused rather than stored: `referralId` and `referralAbsence` answer
       * the same question.
       */
      if (movement.referralId !== undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} was raised from referral ${movement.referralId}, so it cannot also record that nobody referred this patient`,
        );
      }
      const updated: Movement = { ...movement, referralAbsence: { reason: "none_raised", at: event.now } };
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * RB3, item 19 (owner answers): the department holding the patient records that no psychiatric
     * bed search is needed ("for discharge" or "for community follow-up"). Unwinds like
     * `WITHDRAW_REFERRAL`'s pre-collection path: live ward requests withdrawn, a pulled bed and
     * admission released once, an uncollected transport job cancelled.
     */
    case "RECORD_ED_OUTCOME": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (!ED_OUTCOMES.includes(event.outcome as (typeof ED_OUTCOMES)[number])) {
        return reject(state, event, `RECORD_ED_OUTCOME outcome must be chosen from ED_OUTCOMES`);
      }
      if (movement.closure) {
        return reject(state, event, `cannot record an ED outcome for a closed movement (${movement.closure.reason})`);
      }
      // Once the patient is collected this is a journey under way; STOP_TRANSPORT is the event for
      // stopping it.
      if (
        movement.stage === "moving" ||
        movement.transport?.collectedAt !== undefined ||
        (movement.transport &&
          movement.transport.collectedAt !== undefined &&
          movement.transport.arrivedAt === undefined &&
          movement.transport.cancelledAt === undefined)
      ) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s patient is actively in transit; use STOP_TRANSPORT to stop the journey instead of recording an ED outcome`,
        );
      }
      // Owner answer 1: the F4 gate mirrored for "for_discharge" only. A patient on a legal form
      // cannot go home before a conclusive examination outcome; "further_examination ordered"
      // settles nothing. Voluntary patients are never blocked.
      const isOnLegalFormForDischarge =
        !!movement.legalForm || (movement.legalStatus !== undefined && movement.legalStatus !== "Voluntary");
      if (
        event.outcome === "for_discharge" &&
        isOnLegalFormForDischarge &&
        (!movement.examination || movement.examination.outcome === "further_examination_ordered")
      ) {
        return reject(
          state,
          event,
          `movement ${movement.id} is on a legal form; a conclusive examination outcome must be recorded before recording "for discharge"`,
        );
      }
      // Gives back a pulled bed and its admission, or does nothing; safe to call unconditionally.
      const withoutPulledBed = withoutReferralBedHold(
        releasePulledBedAndAdmission(state, movement, event.now),
        movement,
      );
      // Truthful cause: the department recorded an outcome that ends the bed search, not the
      // referrer withdrawing (`WithdrawalReason.ed_outcome_recorded`, `ward-change-reasons.ts`).
      const withdrawnLiveRequests = movement.referredUnitIds.map((unitId) => ({
        unitId,
        at: event.now,
        reason: "ed_outcome_recorded" as const,
      }));
      const reasonLabel = event.outcome === "for_discharge" ? "For discharge" : "For community follow-up";
      // P1-4 (Ward Lead audit): captured before `updatedMovement` overwrites them, so the accepting
      // ward, the transport officer and any ward with a live request can be told the bed search
      // ended.
      const acceptingUnitId = movement.acceptedUnitId;
      const hadLiveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      const updatedMovement: Movement = {
        ...movement,
        admissionId: undefined,
        // See `acceptingUnitId` above: left set, this movement would go on reading as accepted at a
        // ward after the bed search that acceptance belonged to had already ended.
        acceptedUnitId: undefined,
        heldBedNumber: undefined,
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawnLiveRequests],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          ...withdrawnLiveRequests.map((referral) => ({
            unitId: referral.unitId,
            at: referral.at,
            answer: "withdrawn" as const,
          })),
        ],
        edOutcome: event.outcome,
        // A booked-but-uncollected job is cancelled in the same update that closes the movement.
        transport:
          movement.transport && movement.transport.cancelledAt === undefined
            ? { ...movement.transport, cancelledAt: event.now }
            : movement.transport,
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: reasonLabel,
        },
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      const next = replaceMovement(withoutPulledBed, movement.id, updatedMovement);
      // The same three notices as `REFER_TO_COMMUNITY_TEAM` and `WITHDRAW_REFERRAL`: the accepting
      // ward, the transport officer, and every ward still holding a live request. Each has its own
      // `NoticeKind` or `count`, so ids cannot collide.
      const outcomeNotices: Notice[] = [];
      let noticeCount = withoutPulledBed.notices.length;
      if (acceptingUnitId !== undefined) {
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "referral_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            `The referral for ${movement.id} was withdrawn (${reasonLabel.toLowerCase()}); the patient is no longer coming.`,
          ),
        );
      }
      if (hadLiveTransportJob) {
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "transport_cancelled_officer",
            { role: "officer" },
            { movementId: movement.id },
            `Transport for ${movement.id} was cancelled (${reasonLabel.toLowerCase()}); no bed is pulled and nothing has been rebooked.`,
          ),
        );
      }
      for (const unitId of movement.referredUnitIds) {
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "ward_request_withdrawn",
            { role: "ward", placeId: unitId },
            { movementId: movement.id, unitId },
            `The request for ${movement.id} was withdrawn: ${reasonLabel.toLowerCase()}.`,
          ),
        );
      }
      return appendNotices(next, outcomeNotices);
    }

    /**
     * Ruling 1: ED marks a Form 1A as received. Records the receipt instant only; this prototype
     * computes no legal time limits (T2, owner answer 1).
     */
    case "RECORD_LEGAL_FORM_RECEIVED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // D-80: a ward or team acts here only on a journey its kind of desk sent (scope is the server's).
      if (!journeySentByKind(state.referrals, movement, event.role)) {
        return reject(state, event, `only the desk that sent movement ${movement.id} may mark its form received`);
      }
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot mark legal form received for a closed movement (${movement.closure.reason})`,
        );
      }
      if (movement.legalFormReceivedAt !== undefined) {
        return reject(state, event, `legal form for movement ${movement.id} was already marked as received`);
      }
      // Receipt is a fact about a supported form (1A, 3A, 3C, 3D, 6A, 6B, 6C, 5A or 5B); any other
      // code, or no form, is refused.
      if (!movement.legalForm || !isLegalClockFormCode(movement.legalForm.code)) {
        return reject(
          state,
          event,
          `movement ${movement.id} does not carry a receivable legal form (legal form ${movement.legalForm?.code ?? "none"}), so a legal form receipt cannot be recorded against it`,
        );
      }
      // No statutory deadline is computed here: a clinician's typed expiry
      // (`RECORD_LEGAL_FORM_EXPIRY`) is the only source of a `dueAt`.
      const updated: Movement = {
        ...movement,
        legalFormReceivedAt: event.now,
      };
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * The `gender_designation` refusal says "Record gender first"; this is the event that does it
     * for an existing movement. Refuses a closed movement, an off-list gender and an unchanged
     * value.
     */
    case "RECORD_MOVEMENT_GENDER": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot record gender for a closed movement (${movement.closure.reason})`);
      }
      if (!REFERRAL_GENDERS.includes(event.gender)) {
        return reject(state, event, `RECORD_MOVEMENT_GENDER gender must be chosen from REFERRAL_GENDERS`);
      }
      if (movement.gender === event.gender) {
        return reject(state, event, `movement ${movement.id} is already recorded as gender ${event.gender}`);
      }
      const changeEntry = { at: event.now, by: event.role, from: movement.gender, to: event.gender };
      const updated: Movement = {
        ...movement,
        gender: event.gender,
        genderChanges: [...(movement.genderChanges ?? []), changeEntry],
      };
      let next = replaceMovement(state, movement.id, updated);
      const held = movement.admissionId ? findAdmission(state, movement.admissionId) : undefined;
      if (held?.state === "pulled" && held.movementId === movement.id) {
        next = replaceAdmission(next, held.id, { ...held, gender: event.gender });
      }
      /**
       * P1-3 (Ward Lead ruling): a correction while an acceptance or bed is held
       * (`accepted_awaiting_bed` through `moving`) tells the coordinator immediately, rather than
       * waiting for `heldUnitGenderRefusal` on the next forward step (which never comes at
       * `moving`). Not raised earlier (nothing held; referral events re-ask the gate) or at
       * `arrived`.
       */
      const HELD_STAGES_FOR_GENDER_NOTICE: readonly MovementStage[] = [
        "accepted_awaiting_bed",
        "pulled",
        "handover_ready",
        "moving",
      ];
      if (!HELD_STAGES_FOR_GENDER_NOTICE.includes(movement.stage)) return next;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "movement_gender_recorded_after_placement",
          { role: "coordinator" },
          { movementId: movement.id },
          `Gender recorded after a ward was chosen for ${movement.id}. Check the placement still suits.`,
        ),
      ]);
    }

    case "RECORD_LEFT_DEPARTMENT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.leftDepartmentAt !== undefined) {
        return reject(state, event, `movement ${movement.id} has already been recorded as left department`);
      }
      if (movement.edOutcome === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has no ed outcome recorded; record an outcome before marking left department`,
        );
      }
      const updated: Movement = {
        ...movement,
        leftDepartmentAt: event.now,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_EXAMINATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (!EXAMINATION_OUTCOMES.includes(event.outcome as (typeof EXAMINATION_OUTCOMES)[number])) {
        return reject(state, event, `RECORD_EXAMINATION outcome must be chosen from EXAMINATION_OUTCOMES`);
      }
      // Refuse a closed movement, as every other movement-scoped handler does; otherwise a
      // `did_not_proceed` closure could overwrite an arrival.
      if (movement.closure) {
        return reject(state, event, `cannot record an examination for a closed movement (${movement.closure.reason})`);
      }
      // No form gate: an examination may be recorded for any patient, whatever form they carry
      // (product owner). Recording two examinations is a data-integrity fault, not a form rule.
      //
      // Owner item 7: "a repeat examination is a new record, with a 'further examination ordered'
      // outcome." A second examination is refused unless the current outcome is
      // `further_examination_ordered`; superseding appends the current record to
      // `supersededExaminations`, never discards it.
      const previousExamination = movement.examination;
      if (previousExamination && previousExamination.outcome !== "further_examination_ordered") {
        return reject(state, event, `movement ${movement.id} was already examined`);
      }
      const supersededExaminations = previousExamination
        ? [...(movement.supersededExaminations ?? []), previousExamination]
        : movement.supersededExaminations;

      if (event.outcome === "inpatient_order" || event.outcome === "further_examination_ordered") {
        // Recorded and nothing else changes: `further_examination_ordered` and `inpatient_order`
        // close and refund nothing (owner item 7). A form changes only when a clinician changes it.
        const updated: Movement = {
          ...movement,
          examination: { at: event.now, outcome: event.outcome },
          supersededExaminations,
        };
        return replaceMovement(state, movement.id, updated);
      }

      /**
       * WLQ-4 (owner): "a revoked examination after transport is booked or the patient is moving
       * does NOT release the bed." At `handover_ready` and `moving`, the bed is not refunded, the
       * admission is not deleted and `movement.transport` is untouched; refunding and cancelling
       * are coordinator judgements once transport is committed.
       *
       * The examination is still recorded, but `movement.closure` is deliberately not set:
       * `STEP_BACK_STAGE`, `RELEASE_PULL` and `CANCEL_TRANSPORT` all refuse a closed movement, so
       * closing would leave a dead end. The coordinator releases via `STEP_BACK_STAGE` to `pulled`
       * then `RELEASE_PULL`. Covered by the WLQ-4 block in `tests/ward-flow-reducer.test.ts`.
       *
       * `TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE` and `PATIENT_COLLECTED` refuse while this is
       * unresolved; `PATIENT_ARRIVED` stays reachable (owner answer 5). This case cannot run after
       * arrival, since arrival closes the movement.
       *
       * WFA-004: `STEP_BACK_STAGE` can return the stage to `pulled` while `transport.collectedAt`
       * stays set, so retention also keys off `collectedAt`.
       */
      const patientPhysicallyCollected = movement.transport?.collectedAt !== undefined;
      const transportAlreadyCommitted =
        patientPhysicallyCollected || movement.stage === "handover_ready" || movement.stage === "moving";
      /**
       * Audit 24-1 decision 3 (owner, CS2-21): a revoked examination never releases a bed by
       * itself, before transport as well as after. A `"revoked"` outcome on a movement that still
       * holds a bed (`movementHoldsBedByStage`, the same rule `releasePulledBedAndAdmission` uses)
       * takes this same held path: the examination is recorded, the bed and admission stay held,
       * the movement is not closed, and a person releases it with `RELEASE_PULL` or
       * `RELEASE_HELD_BED`. `"community_order"` before transport is unchanged and still closes
       * and releases below.
       */
      const revokedWhileBedHeld = event.outcome === "revoked" && movementHoldsBedByStage(movement);
      if (transportAlreadyCommitted || revokedWhileBedHeld) {
        const flagged: Movement = {
          ...movement,
          examination: { at: event.now, outcome: event.outcome },
          supersededExaminations,
          blocker: STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease,
          examRevoked: event.outcome === "revoked" ? true : movement.examRevoked,
        };
        const next = replaceMovement(state, movement.id, flagged);
        // Item 48, Q3 (owner): the accepting ward is told only for `"revoked"`, not
        // `"community_order"`, and only when there is one.
        if (event.outcome !== "revoked" || movement.acceptedUnitId === undefined) return next;
        return appendNotices(next, [
          makeNotice(
            event.now,
            state.notices.length,
            "examination_revoked_ward",
            { role: "ward", placeId: movement.acceptedUnitId },
            { movementId: movement.id, unitId: movement.acceptedUnitId },
            transportAlreadyCommitted
              ? `The examination for ${movement.id} was revoked after transport was booked. The bed stays pulled until a person decides whether to release it.`
              : `The examination for ${movement.id} was revoked. The bed stays pulled until a person decides whether to release it.`,
          ),
        ]);
      }

      // `community_order` at any other stage (in practice `pulled`), or `revoked` on a movement
      // that holds no bed: the patient does not proceed, so the record closes. The form is
      // deliberately left as it is. The closure must unwind an in-flight transport job and any
      // pulled bed, not just stop further progress.
      //
      // T7: uses the shared `releasePulledBedAndAdmission`, the one place that knows how to give a
      // pulled bed back. This movement's own `admissionId` is cleared below whenever the helper
      // would have released (including after a step-back, WFA-004).
      const withoutPulledBed = withoutReferralBedHold(
        releasePulledBedAndAdmission(state, movement, event.now),
        movement,
      );
      const acceptingUnitId = movement.acceptedUnitId;
      const hadLiveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      const withdrawnLiveRequests = movement.referredUnitIds.map((unitId) => ({
        unitId,
        at: event.now,
        reason: "ed_outcome_recorded" as const,
      }));
      const updated: Movement = {
        ...movement,
        examination: { at: event.now, outcome: event.outcome },
        supersededExaminations,
        examRevoked: event.outcome === "revoked" ? true : movement.examRevoked,
        transport: hadLiveTransportJob ? { ...movement.transport!, cancelledAt: event.now } : movement.transport,
        closure: { at: event.now, outcome: "did_not_proceed", reason: `examination outcome ${event.outcome}` },
        // Same reasoning as `WITHDRAW_REFERRAL`'s own closure: the movement is over, so nothing is
        // holding it up.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
        // Un-join the admission deleted inside the shared helper; stage alone must not keep a stale
        // join after a step-back.
        admissionId: undefined,
        // S1-5: Clear acceptedUnitId and referredUnitIds so the closed movement does not linger as live.
        acceptedUnitId: undefined,
        heldBedNumber: undefined,
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawnLiveRequests],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          ...withdrawnLiveRequests.map((referral) => ({
            unitId: referral.unitId,
            at: referral.at,
            answer: "withdrawn" as const,
          })),
        ],
      };
      const next = replaceMovement(withoutPulledBed, movement.id, updated);
      const outcomeNotices: Notice[] = [];
      let noticeCount = withoutPulledBed.notices.length;
      if (acceptingUnitId !== undefined && event.outcome === "revoked") {
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "examination_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            // Audit 24-1 decision 3: a revoked examination reaches this closing path only when no
            // bed is held, so this notice never claims a release.
            `The examination for ${movement.id} was revoked. The patient is not coming.`,
          ),
        );
      }
      if (hadLiveTransportJob) {
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "transport_cancelled_officer",
            { role: "officer" },
            { movementId: movement.id },
            `Transport for ${movement.id} was cancelled (examination outcome ${event.outcome}); no bed is pulled and nothing has been rebooked.`,
          ),
        );
      }
      for (const unitId of movement.referredUnitIds) {
        if (unitId === acceptingUnitId) continue;
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "ward_request_withdrawn",
            { role: "ward", placeId: unitId },
            { movementId: movement.id, unitId },
            `The request for ${movement.id} was withdrawn: examination outcome ${event.outcome}.`,
          ),
        );
      }
      return appendNotices(next, outcomeNotices);
    }

    case "RECORD_MOVEMENT_BLOCKER": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Refused for a closed movement: its blocker is the closing one.
      if (movement.closure) {
        return reject(state, event, `cannot record a blocker for a closed movement (${movement.closure.reason})`);
      }
      const examinationOutcome = movement.examination?.outcome;
      const examinationRevokedHoldingBed =
        (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
        movementHoldsBedByStage(movement);
      const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
      if (examinationRevokedHoldingBed || awaitingRelease) {
        return reject(
          state,
          event,
          `cannot change blocker on movement ${movement.id}: examination was revoked while holding a bed — requires explicit RELEASE_HELD_BED or doctor reassessment`,
        );
      }
      const divertedHoldingBed =
        movement.transport?.diversion !== undefined ||
        movement.blocker === STAGE_TRANSITION_BLOCKERS.divertedAwaitingRelease;
      if (divertedHoldingBed) {
        return reject(
          state,
          event,
          `cannot overwrite diversion hold on movement ${movement.id}: patient was diverted while holding a bed — requires bed release (RELEASE_DIVERTED_BED)`,
        );
      }
      const blocker = event.blocker.trim();
      if (blocker.length === 0) {
        return reject(state, event, `RECORD_MOVEMENT_BLOCKER blocker must say something — a blank is not a statement`);
      }
      /**
       * A case-insensitive near-miss of a "nothing is blocking" sentinel is refused and pointed at
       * `CLEAR_MOVEMENT_BLOCKER`; `hasActiveBlocker` matches exactly, so it would otherwise score
       * as an active blocker.
       *
       * Exact equality ignoring case against a closed set, and must never become a pattern: `"None
       * of the secure units can take him"` is a real blocker (`tests/ward-priority.test.ts`), which
       * `/^none/i` would swallow. This set does not interpret English.
       */
      const nearMiss = BLOCKERS_MEANING_NOTHING_IS_BLOCKING.find(
        (inactive) => inactive.toLowerCase() === blocker.toLowerCase() && inactive !== blocker,
      );
      if (nearMiss !== undefined) {
        return reject(
          state,
          event,
          `"${blocker}" differs from "${nearMiss}" only in case, and would be stored as an active blocker — use CLEAR_MOVEMENT_BLOCKER to say nothing is holding this up`,
        );
      }
      // Trimmed: `hasActiveBlocker` trims before matching, and two identical statements must
      // compare equal.
      return replaceMovement(state, movement.id, { ...movement, blocker });
    }

    case "RECORD_WARD_INTAKE_CONSTRAINTS": {
      // Same claim-not-proof discipline as CONFIRM_CAPACITY immediately above (see that case's own
      // comment in full).
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `RECORD_WARD_INTAKE_CONSTRAINTS was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const constrainedUnit = findUnit(state, event.unitId);
      if (!constrainedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Chosen, never typed: the runtime half of the union-type check, for an untyped caller.
      if (event.codes.some((code) => !WARD_INTAKE_CONSTRAINTS.includes(code))) {
        return reject(
          state,
          event,
          "RECORD_WARD_INTAKE_CONSTRAINTS codes must all be chosen from WARD_INTAKE_CONSTRAINTS",
        );
      }
      const updatedConstrainedUnit: Unit = { ...constrainedUnit, intakeConstraints: event.codes };
      return replaceUnit(state, constrainedUnit.id, updatedConstrainedUnit);
    }

    /**
     * FD-5: the referrer took the referral back (O-17.11). A field (`withdrawnAt`), not a fifth
     * state: the one switch over `addressing.state` has no `never` guard, so a new state would
     * silently count as open. The state is deliberately left untouched.
     *
     * Unscoped: every waiting destination, because the sender takes back the whole referral. A
     * destination that already answered keeps its answer. Owner ruling 11 is the one exception:
     * `destinationKind: "community_team"` withdraws that arm alone, in its own branch below (see
     * `ward-flow-events.ts`).
     */
    case "RECORD_REFERRER_WITHDRAWAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);

      /**
       * Owner: the community team and the ED may withdraw only their own referral. DEC-L5-03: a
       * ward may withdraw a `psychiatric_ward` referral from its origin unit. Checked before both
       * branches below. The coordinator may record it for any referral.
       */
      if (event.role === "ward") {
        if (referral.source !== "psychiatric_ward") {
          return reject(
            state,
            event,
            `referral ${referral.id} was not sent by a psychiatric ward, so role ward cannot withdraw it`,
          );
        }
        const callerUnitId = event.actingUnitId ?? event.actingPlaceId;
        if (
          callerUnitId === undefined ||
          referral.originUnitId === undefined ||
          callerUnitId !== referral.originUnitId
        ) {
          return reject(
            state,
            event,
            `caller ${callerUnitId} is not the referral origin unit (${referral.originUnitId}); only the sending ward or coordinator may withdraw it`,
          );
        }
      } else if (event.role === "community" || event.role === "ed") {
        if (referral.source === "psychiatric_ward") {
          return reject(
            state,
            event,
            `referral ${referral.id} was sent by a psychiatric ward, so role ${event.role} cannot withdraw it`,
          );
        }
        const sender = referralSenderRole(referral);
        if (event.role !== sender) {
          return reject(
            state,
            event,
            `referral ${referral.id} was sent by the ${sender === "ed" ? "emergency department" : "community side"}, so role ${event.role} cannot withdraw it`,
          );
        }
        if (event.role === "ed" && event.actingPlaceId !== undefined) {
          const referrer = referralReferrer(referral);
          const originEdId = referrer?.role === "ed" ? referrer.placeId : undefined;
          if (originEdId === undefined || event.actingPlaceId !== originEdId) {
            return reject(
              state,
              event,
              `caller ED ${event.actingPlaceId} is not the referral origin ED (${originEdId ?? referral.originSiteCode ?? "unknown"}); only the sending ED or coordinator may withdraw it`,
            );
          }
        }
        if (event.role === "community" && event.actingPlaceId !== undefined) {
          if (
            referral.sendingTeamName === undefined ||
            (event.actingPlaceId !== referral.sendingTeamName &&
              event.actingPlaceId !== communityTeamSlug(referral.sendingTeamName))
          ) {
            return reject(
              state,
              event,
              `caller community team ${event.actingPlaceId} is not the referral origin team (${referral.sendingTeamName}); only the sending community team or coordinator may withdraw it`,
            );
          }
        }
      }

      /**
       * Owner ruling 11: the scoped community-arm branch, self-contained so every whole-referral
       * behaviour is untouched when `destinationKind` is absent.
       */
      if (event.destinationKind === "community_team") {
        const addressing = referral.destinations.find((candidate) => candidate.destination.kind === "community_team");
        if (!addressing) {
          return reject(state, event, `referral ${referral.id} was not addressed to a community team`);
        }
        if (addressing.withdrawnAt !== undefined) {
          return reject(state, event, `the community team on referral ${referral.id} was already withdrawn`);
        }
        // A team that already answered keeps its answer. A still-queued community arm can be taken
        // back after a ward has accepted, since a community team is not in the FD-22 race.
        if (addressing.state !== "queued") {
          return reject(
            state,
            event,
            `the community team on referral ${referral.id} has already answered (${addressing.state}), so its arm cannot be withdrawn`,
          );
        }
        if (event.reason === undefined || !WARD_REQUEST_WITHDRAWAL_REASONS.includes(event.reason)) {
          return reject(
            state,
            event,
            `RECORD_REFERRER_WITHDRAWAL scoped to community_team must give a reason from WARD_REQUEST_WITHDRAWAL_REASONS`,
          );
        }
        const destinations = referral.destinations.map((candidate) =>
          candidate === addressing
            ? {
                ...candidate,
                withdrawnAt: event.now,
                withdrawalRecordedBy: WARD_FLOW_ROLE_LABELS[event.role],
                withdrawalReason: event.reason,
              }
            : candidate,
        );
        const next: WardFlowState = {
          ...state,
          referrals: state.referrals.map((candidate) =>
            candidate.id === referral.id ? { ...candidate, destinations } : candidate,
          ),
        };
        // Read defensively: an unresolvable name degrades to no notice, never a wrong one.
        const teamName = addressing.destination.kind === "community_team" ? addressing.destination.teamName : undefined;
        if (teamName === undefined) return next;
        return appendNotices(next, [
          makeNotice(
            event.now,
            next.notices.length,
            "community_referral_withdrawn",
            { role: "community", placeId: communityTeamSlug(teamName) },
            { referralId: referral.id },
            "The referrer withdrew this referral's request to your team.",
          ),
        ]);
      }

      /**
       * An accepted referral is not withdrawable: the person has a bed or is on the way to one.
       * `referralState` answers that question.
       */
      if (referralState(referral) === "accepted") {
        return reject(state, event, `referral ${referral.id} has already been accepted, so it cannot be withdrawn`);
      }
      if (
        referral.destinations.some(
          (addressing) => addressing.destination.kind !== "community_team" && addressing.withdrawnAt !== undefined,
        )
      ) {
        return reject(state, event, `referral ${referral.id} has already been recorded as withdrawn by its referrer`);
      }
      /**
       * Nothing left waiting means nothing to withdraw; refused rather than a silent success that
       * would later read as a timely withdrawal.
       */
      const waiting = referral.destinations.filter(
        (addressing) => addressing.state === "queued" && addressing.withdrawnAt === undefined,
      );
      if (waiting.length === 0) {
        return reject(state, event, `every destination on referral ${referral.id} has already answered`);
      }

      const destinations = referral.destinations.map((addressing) =>
        addressing.state === "queued" && addressing.withdrawnAt === undefined
          ? { ...addressing, withdrawnAt: event.now, withdrawalRecordedBy: WARD_FLOW_ROLE_LABELS[event.role] }
          : addressing,
      );
      /**
       * Invariant I-07: cascade to every linked open movement, each unwound as `WITHDRAW_REFERRAL`
       * and `STOP_TRANSPORT` do via `releasePulledBedAndAdmission`.
       *
       * A linked movement already collected refuses the whole event, state unchanged: stopping a
       * vehicle on the road is `STOP_TRANSPORT`'s decision, not this handler's.
       */
      const linkedOpenMovements = state.movements.filter((m) => m.referralId === referral.id && !m.closure);
      const collectedLinkedMovement = linkedOpenMovements.find((m) => m.transport?.collectedAt !== undefined);
      if (collectedLinkedMovement) {
        return reject(
          state,
          event,
          `referral ${referral.id} is linked to movement ${collectedLinkedMovement.id}, whose transport has already been collected; this needs a coordinator decision (see STOP_TRANSPORT) rather than an automatic withdrawal`,
        );
      }
      const stateAfterReleases = linkedOpenMovements.reduce(
        (carried, m) => releasePulledBedAndAdmission(carried, m, event.now),
        state,
      );
      const linkedIds = new Set(linkedOpenMovements.map((m) => m.id));
      const nextMovements = stateAfterReleases.movements.map((m) =>
        linkedIds.has(m.id)
          ? {
              ...m,
              admissionId: undefined,
              heldBedNumber: undefined,
              ...withdrawAllLiveRequestsForReferrer(m, event.now),
              transport:
                m.transport && m.transport.cancelledAt === undefined
                  ? { ...m.transport, cancelledAt: event.now }
                  : m.transport,
              closure: {
                at: event.now,
                outcome: "did_not_proceed" as const,
                reason: "The referral was recorded as withdrawn by its referrer",
              },
              blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
            }
          : m,
      );
      let cascadeNoticeCount = stateAfterReleases.notices.length;
      const cascadeNotices: Notice[] = [];
      for (const m of linkedOpenMovements) {
        if (m.transport && m.transport.cancelledAt === undefined) {
          cascadeNotices.push(
            makeNotice(
              event.now,
              cascadeNoticeCount++,
              "transport_cancelled_officer",
              { role: "officer" },
              { movementId: m.id },
              `Transport for ${m.id} was cancelled: referral was recorded as withdrawn by its referrer.`,
            ),
          );
        }
        if (m.acceptedUnitId) {
          cascadeNotices.push(
            makeNotice(
              event.now,
              cascadeNoticeCount++,
              "referral_revoked_ward",
              { role: "ward", placeId: m.acceptedUnitId },
              { movementId: m.id, unitId: m.acceptedUnitId },
              `The referral for ${m.id} was withdrawn by its referrer; the patient is no longer coming.`,
            ),
          );
        }
        for (const unitId of m.referredUnitIds) {
          cascadeNotices.push(
            makeNotice(
              event.now,
              cascadeNoticeCount++,
              "ward_request_withdrawn",
              { role: "ward", placeId: unitId },
              { movementId: m.id, unitId },
              `The referral for ${m.id} was withdrawn by its referrer.`,
            ),
          );
        }
      }
      return appendNotices(
        {
          ...stateAfterReleases,
          movements: nextMovements,
          referrals: stateAfterReleases.referrals.map((candidate) =>
            candidate.id === referral.id ? { ...candidate, destinations } : candidate,
          ),
        },
        cascadeNotices,
      );
    }

    case "RECORD_LOCAL_BED_SOUGHT": {
      // Spec D8-6: optional by design and never read as a failing; a record that a coordinator
      // looked closer to home, and when.
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      // Only while the referral is undecided; recording it afterwards would be after the fact.
      if (referralState(referral) !== "queued") {
        return reject(state, event, `referral ${referral.id} was already decided (${referralState(referral)})`);
      }
      // One-shot: a second record would overwrite the time and role of the search that actually
      // happened.
      if (referral.localBedSought !== undefined) {
        return reject(state, event, `referral ${referral.id} already records a local bed search`);
      }
      // `by` is the raising ROLE, taken from the event rather than from any caller-supplied
      // string, so a person's name cannot be written here even by a caller that wanted to.
      const sought: Referral = { ...referral, localBedSought: { at: event.now, by: event.role } };
      return replaceReferral(state, referral.id, sought);
    }

    case "RECORD_ESCALATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot escalate a closed movement (${movement.closure.reason})`);
      }
      const updated: Movement = {
        ...movement,
        escalation: { at: event.now, triedUnitIds: [...event.triedUnitIds], contact: event.contact },
      };
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * Item 29 (T4a) / R2-7: record a diversion on a collected journey. The bed stays held and the
     * movement open until `RELEASE_DIVERTED_BED`.
     */
    case "RECORD_DIVERSION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot divert a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to divert`);
      }
      if (movement.transport.collectedAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s transport has not been collected yet; diversion is only for a journey already under way`,
        );
      }
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `movement ${movement.id}'s patient has already arrived`);
      }
      if (movement.transport.stoppedAt !== undefined || movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `movement ${movement.id}'s transport was already stopped or cancelled`);
      }
      if (movement.transport.diversion) {
        return reject(state, event, `movement ${movement.id} was already diverted`);
      }
      if (!DIVERSION_REASONS.includes(event.reason)) {
        return reject(state, event, `RECORD_DIVERSION reason must be chosen from DIVERSION_REASONS`);
      }
      if (!TRANSPORT_WHEREABOUTS.includes(event.place)) {
        return reject(state, event, `RECORD_DIVERSION place must be chosen from TRANSPORT_WHEREABOUTS`);
      }

      const diverted: Movement = {
        ...movement,
        transport: {
          ...movement.transport,
          diversion: {
            at: event.now,
            by: event.role,
            place: event.place,
            reason: event.reason,
          },
        },
        blocker: STAGE_TRANSITION_BLOCKERS.divertedAwaitingRelease,
      };
      const next = replaceMovement(state, movement.id, diverted);
      const diversionNotices: Notice[] = [];
      if (movement.acceptedUnitId !== undefined) {
        const receivingUnitId = movement.acceptedUnitId;
        diversionNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "diversion_recorded_ward",
            { role: "ward", placeId: receivingUnitId },
            { movementId: movement.id, unitId: receivingUnitId },
            `The patient for ${movement.id} was diverted (${event.reason}). Where they are now: ${event.place}. The bed stays pulled until it is released.`,
          ),
        );
      }
      diversionNotices.push(
        makeNotice(
          event.now,
          state.notices.length + diversionNotices.length,
          "diversion_recorded_ed",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id },
          `The patient for ${movement.id} was diverted (${event.reason}). Where they are now: ${event.place}.`,
        ),
      );
      return appendNotices(next, diversionNotices);
    }

    case "RECORD_ED_MEDICAL_DETERIORATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, "No movement found for medical deterioration.");
      if (finiteInstant(event.now) === null || event.now < movement.openedAt)
        return reject(state, event, "Medical deterioration needs a valid current timestamp.");
      if (
        !event.actingPlaceId ||
        event.actingPlaceId !== movement.originEdId ||
        movement.sourceAdmissionId !== undefined
      )
        return reject(state, event, "Only the originating ED may record this pre-transport deterioration.");
      if (movement.closure || movement.stage === "moving" || movement.transport?.collectedAt !== undefined)
        return reject(
          state,
          event,
          "D-34 cannot cancel or refund a patient already collected or arrived; use the separately approved escalation pathway.",
        );
      if (movement.medicalDeterioration?.resumedAt === undefined && movement.medicalDeterioration)
        return reject(state, event, "This referral is already paused for medical deterioration.");
      if (!movement.acceptedUnitId) return reject(state, event, "D-34 requires an accepted psychiatric destination.");
      const heldAdmission = movement.admissionId === undefined ? undefined : findAdmission(state, movement.admissionId);
      if (
        movement.admissionId !== undefined &&
        (!heldAdmission ||
          heldAdmission.state !== "pulled" ||
          heldAdmission.unitId !== movement.acceptedUnitId ||
          (heldAdmission.movementId !== movement.id &&
            !(heldAdmission.movementId === null && !heldAdmission.id.startsWith("AD-ARR-"))))
      )
        return reject(state, event, "Medical deterioration needs a consistent reservation before releasing it.");
      const reason = "Medical Deterioration - ED Resuscitation Required";
      const hadPull =
        movement.admissionId !== undefined || movement.stage === "pulled" || movement.stage === "handover_ready";
      const liveJob = movement.transport && movement.transport.cancelledAt === undefined;
      const withoutHold = withoutReferralBedHold(releasePulledBedAndAdmission(state, movement, event.now), movement);
      const updated: Movement = {
        ...movement,
        stage: "placement_requested",
        acceptedUnitId: undefined,
        acceptedAt: undefined,
        heldBedNumber: undefined,
        admissionId: undefined,
        pullExpiresAt: undefined,
        referredUnitIds: [],
        waitlistedUnitIds: undefined,
        medicalClearance: { cleared: false, at: event.now },
        medicalDeterioration: { at: event.now, by: "ed" },
        transport: liveJob ? { ...movement.transport!, cancelledAt: event.now } : movement.transport,
        blocker: `${reason} — psychiatric referral paused`,
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "placement_requested", by: event.role, reason },
        ],
        unwinds: [
          ...movement.unwinds,
          ...(liveJob
            ? [
                {
                  at: event.now,
                  kind: "transport_cancelled" as const,
                  by: event.role,
                  reason,
                  transportId: movement.transport!.id,
                  ...(movement.transport!.cadNumber ? { cadNumber: movement.transport!.cadNumber } : {}),
                },
              ]
            : []),
          ...(hadPull
            ? [
                {
                  at: event.now,
                  kind: "pull_released" as const,
                  by: event.role,
                  reason,
                  unitId: movement.acceptedUnitId,
                },
              ]
            : []),
          { at: event.now, kind: "acceptance_withdrawn", by: event.role, reason, unitId: movement.acceptedUnitId },
        ],
      };
      let next = replaceMovement(withoutHold, movement.id, updated);
      if (movement.referralId)
        next = {
          ...next,
          referrals: next.referrals.map((referral) =>
            referral.id === movement.referralId && movementPatientIdentityMatchesRecord(movement, referral)
              ? { ...referral, medicalClearance: updated.medicalClearance }
              : referral,
          ),
        };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return appendNotices(next, [
        makeNotice(
          event.now,
          next.notices.length,
          "acceptance_withdrawn_ward",
          { role: "ward", placeId: movement.acceptedUnitId },
          { movementId: movement.id, unitId: movement.acceptedUnitId },
          reason + ". Allocation cancelled; psychiatric referral paused until medical re-clearance.",
        ),
      ]);
    }

    case "RECORD_MOVEMENT_MEDICAL_CLEARANCE": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (event.role !== "ed" && event.role !== "coordinator") {
        return reject(
          state,
          event,
          `role ${event.role} cannot record movement medical clearance; only ed or coordinator may record clearance`,
        );
      }

      if (finiteInstant(event.now) === null || typeof event.cleared !== "boolean")
        return reject(state, event, "Medical clearance needs a valid timestamp and recorded answer.");
      const pause = movement.medicalDeterioration;
      if (event.cleared && pause && pause.resumedAt === undefined && event.now <= pause.at)
        return reject(state, event, "Re-clearance must be recorded after the medical deterioration.");
      const updatedMovement: Movement = {
        ...movement,
        medicalClearance: { cleared: event.cleared, at: event.now },
        ...(event.cleared && pause && pause.resumedAt === undefined
          ? {
              medicalDeterioration: { ...pause, resumedAt: event.now },
              blocker: "Awaiting coordinator referral",
            }
          : {}),
      };

      let referrals = state.referrals;
      if (movement.referralId) {
        referrals = referrals.map((r) =>
          r.id === movement.referralId && (movement.patientId === undefined || movement.patientId === r.patientId)
            ? { ...r, medicalClearance: { cleared: event.cleared, at: event.now } }
            : r,
        );
      }

      return {
        ...state,
        movements: state.movements.map((m) =>
          m.id === movement.id ||
          (movement.referralId !== undefined &&
            m.referralId === movement.referralId &&
            referrals.some(
              (r) =>
                r.id === movement.referralId &&
                (movement.patientId === undefined || movement.patientId === r.patientId) &&
                (m.patientId === undefined || m.patientId === r.patientId),
            ))
            ? {
                ...m,
                medicalClearance: updatedMovement.medicalClearance,
                ...(event.cleared &&
                m.medicalDeterioration &&
                m.medicalDeterioration.resumedAt === undefined &&
                event.now > m.medicalDeterioration.at
                  ? {
                      medicalDeterioration: { ...m.medicalDeterioration, resumedAt: event.now },
                      blocker: "Awaiting coordinator referral",
                    }
                  : {}),
              }
            : m,
        ),
        referrals,
      };
    }

    // A person's stay on the ward: leaving, trips to an emergency department, discharge blockers,
    // leave, absence, handover, repatriation, clinical contact and support notifications.
    case "RECORD_LEAVING":
    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT":
    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT":
    case "RECORD_STAY_DISCHARGE_BLOCKER":
    case "RECORD_LEAVE_BED":
    case "RECORD_ABSENT_WITHOUT_LEAVE":
    case "RECORD_ABSENCE_STEP":
    case "RECORD_HANDOVER_SIGN_OFF":
    case "RECORD_REPATRIATION":
    case "RECORD_CLINICAL_CONTACT":
    case "RECORD_SUPPORT_NOTIFICATION":
      return reduceRecordedStayEvent(state, event, decision, helpers);

    // Legal forms and orders: typed expiries, forms written, country extensions, continuations and
    // community treatment orders.
    case "RECORD_LEGAL_FORM_EXPIRY":
    case "RECORD_COMMUNITY_TREATMENT_ORDER":
    case "RECORD_LEGAL_FORM_WRITTEN":
    case "RECORD_COUNTRY_EXTENSION":
    case "RECORD_LEGAL_FORM_CONTINUATION":
      return reduceRecordedLegalEvent(state, event, decision, helpers);
  }
  return state;
}
