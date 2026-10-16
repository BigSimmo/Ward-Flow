import { isLeavingDestination } from "./ward-admissions";
import { type AuditDecision, finiteInstant } from "./ward-audit";
import { recordedCommunityTransition } from "./ward-care-journey";
import type {
  appendNotices,
  ClinicalContactRecord,
  departAdmission,
  dischargeBlockingTransit,
  dischargeMovement,
  findAdmission,
  findMovement,
  findReferral,
  findUnit,
  HandoverSignOffRecord,
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
  RepatriationRecord,
  replaceAdmission,
  replaceMovement,
  replaceReferral,
  replaceUnit,
  STAGE_TRANSITION_BLOCKERS,
  WardFlowState,
  withdrawAllLiveRequestsForReferrer,
} from "./ward-flow-reducer";
import { movementPatientIdentityMatchesRecord } from "./ward-patient-resolver";
import { communityTeamById, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import {
  BED_RELEASE_BLOCKERS,
  DIVERSION_REASONS,
  TRANSPORT_WHEREABOUTS,
  WARD_INTAKE_CONSTRAINTS,
  WARD_REQUEST_WITHDRAWAL_REASONS,
} from "@/components/ward-management/ward-change-reasons";
import {
  REPATRIATION_MODES,
  WARD_FLOW_ROLE_LABELS,
  type WardFlowEvent,
} from "@/components/ward-management/ward-flow-events";
import { form3CRefusedAfter3D, isLegalClockFormCode } from "@/components/ward-management/ward-legal-clock";
import { countryExtensionEligible } from "@/components/ward-management/ward-legal-forms";
import {
  ABSENCE_STEPS,
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  ED_OUTCOMES,
  EXAMINATION_OUTCOMES,
  type LeaveBed,
  type Movement,
  type MovementStage,
  type Notice,
  REFERRAL_GENDERS,
  type Referral,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  type Unit,
} from "@/components/ward-management/ward-model";
import { referralSenderRole, referralState } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import {
  SUPPORT_NOTIFICATION_OCCASIONS,
  SUPPORT_NOTIFICATION_OUTCOMES,
  SUPPORT_NOTIFICATION_PARTIES,
  SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS,
  SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS,
  type SupportNotificationRecord,
  admissionSupportNotificationSubject,
  movementSupportNotificationSubject,
} from "@/components/ward-management/ward-support-notifications";

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
      if (event.role === "ward" && event.actingUnitId !== undefined) {
        const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
        const sendingWard =
          referral?.originUnitId ??
          movementSourceAdmission(state, movement)?.unitId ??
          (movement as { originUnitId?: string }).originUnitId;
        if (sendingWard) {
          if (event.actingUnitId !== sendingWard) {
            return reject(
              state,
              event,
              `RECORD_TRANSPORT_NEED was raised acting as unit ${event.actingUnitId} but movement origin is ward ${sendingWard}; only the sending ward can record transport need`,
            );
          }
        } else if (movement.acceptedUnitId && event.actingUnitId === movement.acceptedUnitId) {
          return reject(
            state,
            event,
            `RECORD_TRANSPORT_NEED was raised acting as destination ward ${event.actingUnitId}; receiving ward cannot record transport need`,
          );
        }
      }
      const actingPlaceId = (event as { actingPlaceId?: string }).actingPlaceId;
      if (event.role === "ed" && actingPlaceId !== undefined && actingPlaceId !== movement.originEdId) {
        return reject(
          state,
          event,
          `${event.type} was raised acting as ED ${actingPlaceId} but movement origin is ${movement.originEdId}; only the origin ED can book or record transport for its own movement`,
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
      const withoutPulledBed = releasePulledBedAndAdmission(state, movement, event.now);
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
            `Transport for ${movement.id} was cancelled (${reasonLabel.toLowerCase()}); no bed is held and nothing has been rebooked.`,
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
     * T2 (owner answer 1, item 5): the clinician types the expiry written on the form, for any
     * form, and later any extension from a fresh form. Whether this is an extension is read off the
     * state, never a caller flag.
     */
    case "RECORD_LEGAL_FORM_EXPIRY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // T2r finding 11: a fixed sentence, never interpolating the clinical `closure.reason`.
      if (movement.closure) {
        return reject(state, event, "This record is closed, so no expiry can be added to it.");
      }
      // §2's exact sentence — there is no form here to attach a typed expiry to, so this refuses
      // rather than inventing one.
      if (!movement.legalForm) {
        return reject(state, event, "There is no legal form on this record to add an expiry to.");
      }
      // T2r finding 8: `Instant` is a bare number, so a non-finite value is refused before it
      // becomes an expiry nothing can compare or render.
      if (!Number.isFinite(event.dueAt)) {
        return reject(state, event, "Enter the expiry written on the form.");
      }
      const currentDueAt = movement.legalForm.dueAt;
      // Legacy calculated clocks are not paper authority. The six authored fixture values and
      // current entered values are; absence of an old actor-history record does not discard them.
      const legacyCalculatedExpiry =
        movement.legalClock !== undefined && currentDueAt === movement.legalClock.expiresAt;
      const isExtension = currentDueAt !== undefined && !legacyCalculatedExpiry;
      // An extension only ever moves an expiry later; the clinician types it, this only orders it
      // against what is recorded.
      if (isExtension && event.dueAt <= currentDueAt) {
        return reject(state, event, "An extension's new expiry must be later than the expiry already recorded.");
      }
      const basis: "written_on_form" | "extension" = isExtension ? "extension" : "written_on_form";
      const historyEntry = { at: event.now, by: event.role, dueAt: event.dueAt, basis };
      const updated: Movement = {
        ...movement,
        legalForm: { ...movement.legalForm, dueAt: event.dueAt },
        legalClock: undefined,
        legalFormExpiryHistory: [...(movement.legalFormExpiryHistory ?? []), historyEntry],
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
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
      if (transportAlreadyCommitted) {
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
            `The examination for ${movement.id} was revoked after transport was booked. The bed stays held until a person decides whether to release it.`,
          ),
        ]);
      }

      // `community_order` or `revoked` at any other stage (in practice `pulled`): the patient does
      // not proceed, so the record closes. The form is deliberately left as it is. The closure must
      // unwind an in-flight transport job and any pulled bed, not just stop further progress.
      //
      // T7: uses the shared `releasePulledBedAndAdmission`, the one place that knows how to give a
      // pulled bed back. This movement's own `admissionId` is cleared below whenever the helper
      // would have released (including after a step-back, WFA-004). S1-5: check whether a bed was
      // held so the notice does not falsely claim a release.
      const bedWasHeld = movementHoldsBedByStage(movement);
      const withoutPulledBed = releasePulledBedAndAdmission(state, movement, event.now);
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
            bedWasHeld
              ? `The examination for ${movement.id} was revoked. The patient is not coming and the bed has been released.`
              : `The examination for ${movement.id} was revoked. The patient is not coming.`,
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
            `Transport for ${movement.id} was cancelled (examination outcome ${event.outcome}); no bed is held and nothing has been rebooked.`,
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

    /**
     * A patient leaves: the mirror of `PATIENT_ARRIVED`.
     *
     * `empty` rises by one, clamped to `unit.beds` so `unitCapacity`'s reconciliation identity
     * holds. `sexMix` falls for this person's sex, floored at zero. `allocatable` rises with
     * `empty`, once (owner decision: leaving is the discharge, and completes the person's bed
     * release if any).
     *
     * The admission is not deleted: it ends (`state: "departed"`, with instant and destination), so
     * the board, discharge dates and community hub can still see where they went.
     */
    case "RECORD_LEAVING": {
      if (finiteInstant(event.now) === null || !isLeavingDestination(event.leavingDestination)) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, "Departure needs a finite time and a listed destination");
      }
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_LEAVING was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Refused rather than treated as a no-op: a second discharge would overwrite `leftAt` with a
      // later instant and silently shorten the recorded stay of somebody who left hours earlier.
      if (admission.state === "departed") {
        return reject(state, event, `admission ${admission.id} has already left`);
      }
      // Only somebody in a bed can leave one. Giving back a pull is `RELEASE_PULL`'s job; routing
      // it here would credit a bed never lost.
      if (admission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${admission.id} is ${admission.state}, and only somebody occupying a bed can leave one`,
        );
      }
      if (admission.arrivedAt !== null && event.now < admission.arrivedAt) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, "Departure cannot precede this admission's arrival");
      }

      // Discharge blocked while in transit: a patient cannot be discharged while their transfer
      // ambulance is actively on the road.
      const linkedMovement = dischargeMovement(state, admission);
      const transit = dischargeBlockingTransit(state, admission);
      if (transit) {
        return reject(
          state,
          event,
          `cannot record leaving for admission ${admission.id}: patient is actively in transit (movement ${transit.id})`,
        );
      }

      // Involuntary patient discharge boundary (WA Mental Health Act 2014)
      const linkedPatient = admission.patientId ? state.patients.find((p) => p.id === admission.patientId) : undefined;
      if (
        patientRecordIsInvoluntary(linkedPatient?.legalStatus) ||
        (linkedMovement?.legalStatus !== undefined && linkedMovement.legalStatus !== "Voluntary")
      ) {
        if (
          event.leavingDestination === "discharged-to-the-community" ||
          event.leavingDestination === "left-against-advice"
        ) {
          if (
            !recordedCommunityTransition(admission, linkedMovement?.statusChanges.at(-1)?.at, event.leavingDestination)
          ) {
            return reject(
              state,
              event,
              `cannot record leaving for involuntary patient ${linkedPatient?.id ?? admission.id}: involuntary legal status prohibits unrevoked discharge to the community or left-against-advice`,
            );
          }
        }
      }

      const unit = findUnit(state, admission.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${admission.unitId}`);

      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return departAdmission(state, admission, unit, event.now, event.leavingDestination, event.role);
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

    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Only somebody in a bed can leave the ward and have it kept. A `waitlisted` or `pulled`
      // admission has never reached the ward; a `departed` one has no bed.
      if (admission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${admission.id} is ${admission.state}, and only somebody occupying a bed can be away from it`,
        );
      }
      // Refused rather than overwritten: a later instant would silently shorten the recorded trip.
      if (admission.awayAtEmergencyDepartmentSince !== null) {
        return reject(state, event, `admission ${admission.id} is already recorded as away at an emergency department`);
      }
      // Leave, absence and a trip to ED are three different answers to "where are they now", so one
      // stay holds at most one of them. End the leave or the absence first.
      const heldBed = state.leaveBeds.find((bed) => bed.admissionId === admission.id);
      if (heldBed) {
        return reject(
          state,
          event,
          `admission ${admission.id} is ${heldBed.absentWithoutLeave ? "absent without leave" : "on leave"} (${heldBed.id}); record the return first`,
        );
      }
      return replaceAdmission(state, admission.id, { ...admission, awayAtEmergencyDepartmentSince: event.now });
    }

    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Refused rather than written as `null`, which already means "on the ward": a control must
      // not report success for an act that did not happen.
      if (admission.awayAtEmergencyDepartmentSince === null) {
        return reject(state, event, `admission ${admission.id} is not recorded as away at an emergency department`);
      }
      // `state` is deliberately not checked: the guard above proves the admission is away, and a
      // state check could strand the badge permanently.
      return replaceAdmission(state, admission.id, { ...admission, awayAtEmergencyDepartmentSince: null });
    }

    case "RECORD_STAY_DISCHARGE_BLOCKER": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_STAY_DISCHARGE_BLOCKER was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Blockers are chosen, never typed: a membership test, not a truthiness test.
      if (!event.blocker || !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(
          state,
          event,
          `RECORD_STAY_DISCHARGE_BLOCKER requires a blocker chosen from BED_RELEASE_BLOCKERS`,
        );
      }
      // Only somebody occupying a bed has a discharge to hold up; a waitlisted or departed stay does not.
      if (admission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${admission.id} is ${admission.state}, and only somebody occupying a bed can have a discharge blocker`,
        );
      }
      return replaceAdmission(state, admission.id, { ...admission, blockReason: event.blocker });
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

    case "RECORD_LEAVE_BED": {
      // Same claim-not-proof discipline as FLAG_BED_RELEASE's own field: this compares what the
      // caller SAID it was acting as against the unit the leave bed is being recorded against.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `RECORD_LEAVE_BED was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Owner ruling 2026-09-25: a leave bed names the stay it belongs to, never a guessed one.
      const onLeave = findAdmission(state, event.admissionId);
      if (!onLeave) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (onLeave.unitId !== event.unitId) {
        return reject(
          state,
          event,
          `RECORD_LEAVE_BED names admission ${onLeave.id} on unit ${onLeave.unitId}, not unit ${event.unitId}`,
        );
      }
      if (onLeave.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${onLeave.id} is ${onLeave.state}, and only somebody occupying a bed can be on leave from it`,
        );
      }
      const current = state.leaveBeds.find((bed) => bed.admissionId === onLeave.id);
      if (current) return reject(state, event, `admission ${onLeave.id} is already on leave (${current.id})`);
      if (onLeave.awayAtEmergencyDepartmentSince !== null) {
        return reject(
          state,
          event,
          `admission ${onLeave.id} is away at an emergency department; record the return first`,
        );
      }
      const sequence = state.leaveBedSequence + 1;
      const created: LeaveBed = {
        id: nextLeaveBedId(sequence),
        unitId: unit.id,
        admissionId: onLeave.id,
        expectedReturn: event.expectedReturn,
        confirmedAt: event.now,
        confirmedBy: recordedByLabel(event.role, unit.name),
        kind: event.kind ?? "off_ward",
      };
      return { ...state, leaveBeds: [...state.leaveBeds, created], leaveBedSequence: sequence };
    }

    case "RECORD_ABSENT_WITHOUT_LEAVE": {
      const stay = findAdmission(state, event.admissionId);
      if (!stay) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== stay.unitId) {
        return reject(
          state,
          event,
          `RECORD_ABSENT_WITHOUT_LEAVE was raised acting as unit ${event.actingUnitId} but admission ${stay.id} is on unit ${stay.unitId}`,
        );
      }
      if (stay.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${stay.id} is ${stay.state}, and only somebody occupying a bed can be absent from it`,
        );
      }
      const current = state.leaveBeds.find((bed) => bed.admissionId === stay.id);
      if (current?.absentWithoutLeave) {
        return reject(state, event, `admission ${stay.id} is already recorded absent without leave (${current.id})`);
      }
      if (stay.awayAtEmergencyDepartmentSince !== null) {
        return reject(state, event, `admission ${stay.id} is away at an emergency department; record the return first`);
      }
      const absence = { since: event.now, steps: [] };
      if (current) {
        return {
          ...state,
          leaveBeds: state.leaveBeds.map((bed) =>
            bed.id === current.id ? { ...bed, absentWithoutLeave: absence } : bed,
          ),
        };
      }
      // Absent straight from the ward: the bed is held as leave holds it, with the held bed's
      // return time set to when the absence was recorded. Ward surfaces check `absentWithoutLeave`
      // so it never reads as leave.
      const unit = findUnit(state, stay.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${stay.unitId}`);
      const sequence = state.leaveBedSequence + 1;
      const created: LeaveBed = {
        id: nextLeaveBedId(sequence),
        unitId: unit.id,
        admissionId: stay.id,
        expectedReturn: event.now,
        confirmedAt: event.now,
        confirmedBy: recordedByLabel(event.role, unit.name),
        kind: "off_ward",
        absentWithoutLeave: absence,
      };
      return { ...state, leaveBeds: [...state.leaveBeds, created], leaveBedSequence: sequence };
    }

    case "RECORD_ABSENCE_STEP": {
      if (!(ABSENCE_STEPS as readonly string[]).includes(event.step)) {
        return reject(state, event, `${String(event.step)} is not a missing person step`);
      }
      const bed = state.leaveBeds.find((candidate) => candidate.admissionId === event.admissionId);
      if (!bed?.absentWithoutLeave) {
        return reject(state, event, `admission ${event.admissionId} is not recorded absent without leave`);
      }
      if (event.actingUnitId !== bed.unitId) {
        return reject(
          state,
          event,
          `RECORD_ABSENCE_STEP was raised acting as unit ${event.actingUnitId} but the absence is on unit ${bed.unitId}`,
        );
      }
      if (bed.absentWithoutLeave.steps.some((done) => done.step === event.step)) {
        return reject(state, event, `${event.step} is already recorded for admission ${event.admissionId}`);
      }
      if (event.now < bed.absentWithoutLeave.since) {
        return reject(state, event, `${event.step} cannot be recorded before the absence began`);
      }
      const absentWithoutLeave = {
        ...bed.absentWithoutLeave,
        steps: [...bed.absentWithoutLeave.steps, { step: event.step, at: event.now }],
      };
      return {
        ...state,
        leaveBeds: state.leaveBeds.map((candidate) =>
          candidate.id === bed.id ? { ...candidate, absentWithoutLeave } : candidate,
        ),
      };
    }

    case "RECORD_COMMUNITY_TREATMENT_ORDER": {
      const patient = state.patients.find((candidate) => candidate.id === event.patientId);
      if (!patient) return reject(state, event, `no patient found for id ${event.patientId}`);
      // Only an order still in force refuses a new one. An ended order is kept below (D-40), so a
      // patient can be placed on a second CTO without the first leaving Documents.
      if (patient.communityTreatmentOrder && patient.communityTreatmentOrder.endedAt === undefined) {
        return reject(state, event, `patient ${patient.id} already has a community treatment order recorded`);
      }
      // The Patient page shows an open placement or occupied stay ahead of a CTO, so an order
      // recorded now would save unseen. Refused until the placement closes or the stay ends. A
      // waitlisted or pulled stay alone does not count.
      const openStay = state.admissions.some((stay) => stay.patientId === patient.id && stay.state === "occupied");
      const openPlacement = state.movements.some(
        (movement) => movement.patientId === patient.id && !movement.closure && movement.stage !== "arrived",
      );
      if (openStay || openPlacement) {
        return reject(
          state,
          event,
          `patient ${patient.id} has an open placement or stay; record the order once it has closed`,
        );
      }
      // D-40: an ended order is kept in `earlier` rather than overwritten, so Documents still lists it.
      const previous = patient.communityTreatmentOrder;
      const earlier =
        previous?.endedAt !== undefined
          ? [
              ...(previous.earlier ?? []),
              {
                form: previous.form,
                recordedAt: previous.recordedAt,
                recordedBy: previous.recordedBy,
                endedAt: previous.endedAt,
              },
            ]
          : undefined;
      const order = {
        form: "5A" as const,
        recordedAt: event.now,
        recordedBy: WARD_FLOW_ROLE_LABELS[event.role],
        ...(earlier ? { earlier } : {}),
      };
      return {
        ...state,
        patients: state.patients.map((candidate) =>
          candidate.id === patient.id ? { ...candidate, communityTreatmentOrder: order } : candidate,
        ),
      };
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
            `The patient for ${movement.id} was diverted (${event.reason}). Where they are now: ${event.place}. The bed stays held until it is released.`,
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
      const withoutHold = releasePulledBedAndAdmission(state, movement, event.now);
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

    case "RECORD_LEGAL_FORM_WRITTEN": {
      if (event.role !== "ed" && event.role !== "coordinator") {
        return reject(
          state,
          event,
          `${event.role} cannot record a written legal form; only ed and coordinator may record written forms`,
        );
      }
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot record a written form for a closed movement (${movement.closure.reason})`);
      }
      if (
        (event.region !== undefined && !["metro", "country"].includes(event.region)) ||
        !Number.isFinite(event.writtenAt) ||
        (event.paperExpiresAt !== undefined && !Number.isFinite(event.paperExpiresAt))
      ) {
        return reject(state, event, "Enter the time and expiry written on the form.");
      }
      if (!isLegalClockFormCode(event.formCode)) {
        return reject(state, event, `Form ${event.formCode} is not a recognised legal form in this prototype`);
      }
      if (event.formCode === "3C" && form3CRefusedAfter3D(movement.legalForm?.code ?? movement.legalClock?.code)) {
        return reject(state, event, `Form 3C is refused when the person arrived on a Form 3D`);
      }
      const kind =
        event.formCode === "1A"
          ? ("examination" as const)
          : event.formCode === "3A" || event.formCode === "3C" || event.formCode === "3D"
            ? ("detention" as const)
            : undefined;
      // Editing the current form's written time preserves its recorded paper facts. A different
      // form starts new facts; a legacy calculated expiry is never promoted to paper authority.
      const sameFormTimeEdit = movement.legalForm?.code === event.formCode && event.paperExpiresAt === undefined;
      const currentPaperExpiry =
        movement.legalClock !== undefined && movement.legalForm?.dueAt === movement.legalClock.expiresAt
          ? undefined
          : movement.legalForm?.dueAt;
      // A1-5: A written form expiry cannot shorten an existing recorded expiry on the same form.
      if (
        movement.legalForm?.code === event.formCode &&
        currentPaperExpiry !== undefined &&
        event.paperExpiresAt !== undefined &&
        event.paperExpiresAt < currentPaperExpiry
      ) {
        return reject(state, event, "A written form expiry cannot shorten an existing recorded expiry.");
      }
      const dueAt = event.paperExpiresAt ?? (sameFormTimeEdit ? currentPaperExpiry : undefined);
      const updated: Movement = {
        ...movement,
        formedAt: event.writtenAt,
        legalForm: {
          code: event.formCode,
          kind,
          ...(event.region
            ? { region: event.region }
            : sameFormTimeEdit && movement.legalForm?.region
              ? { region: movement.legalForm.region }
              : {}),
          ...(dueAt === undefined ? {} : { dueAt }),
        },
        legalClock: undefined,
        legalFormReceivedAt: sameFormTimeEdit ? movement.legalFormReceivedAt : undefined,
        legalFormExpiryHistory:
          event.paperExpiresAt === undefined
            ? movement.legalFormExpiryHistory
            : [
                ...(movement.legalFormExpiryHistory ?? []),
                { at: event.now, by: event.role, dueAt: event.paperExpiresAt, basis: "written_on_form" },
              ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_COUNTRY_EXTENSION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure || event.paperExpiresAt === undefined || !Number.isFinite(event.paperExpiresAt))
        return reject(
          state,
          event,
          "Country extensions are recorded as a typed expiry. Enter the new expiry written on the country extension form.",
        );
      if (!countryExtensionEligible(movement))
        return reject(
          state,
          event,
          "A country extension requires a current Form 1A with its paper setting recorded as country.",
        );
      const next = reduceClinicalEvent(
        state,
        {
          type: "RECORD_LEGAL_FORM_EXPIRY",
          role: event.role,
          now: event.now,
          movementId: event.movementId,
          dueAt: event.paperExpiresAt,
        },
        decision,
      );
      if (next.rejections.length === state.rejections.length) {
        decision.outcome = "accepted";
        decision.reasonCode = "none";
      }
      return next;
    }

    case "RECORD_LEGAL_FORM_CONTINUATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This record is closed, so no continuation can be added.");
      if (
        (event.region !== undefined && !["metro", "country"].includes(event.region)) ||
        !Number.isFinite(event.startedAt) ||
        (event.paperExpiresAt !== undefined && !Number.isFinite(event.paperExpiresAt))
      ) {
        return reject(state, event, "Enter the time and expiry written on the form.");
      }
      if (!isLegalClockFormCode(event.formCode)) {
        return reject(state, event, `Form ${event.formCode} is not a recognised legal form in this prototype`);
      }
      const expiryHistory =
        event.paperExpiresAt === undefined
          ? movement.legalFormExpiryHistory
          : [
              ...(movement.legalFormExpiryHistory ?? []),
              { at: event.now, by: event.role, dueAt: event.paperExpiresAt, basis: "written_on_form" as const },
            ];
      // Owner ruling: a Form 5B continues a current Form 5A (one community treatment order) rather
      // than replacing it. The 5A record, `formedAt` and receipt stay; the 5B is recorded as
      // `continuedBy`, and the current end is the 5B's typed end. Nothing is computed.
      if (event.formCode === "5B" && movement.legalForm?.code === "5A") {
        // A second 5B updates the continuation; the 5A's own typed end is kept from the first.
        const { dueAt: currentDueAt, continuedBy: earlier, ...fiveA } = movement.legalForm;
        const continuedFormDueAt = earlier === undefined ? currentDueAt : earlier.continuedFormDueAt;
        const continued: Movement = {
          ...movement,
          legalForm: {
            ...fiveA,
            ...(event.paperExpiresAt === undefined ? {} : { dueAt: event.paperExpiresAt }),
            continuedBy: {
              code: event.formCode,
              startedAt: event.startedAt,
              recordedAt: event.now,
              by: event.role,
              ...(continuedFormDueAt === undefined ? {} : { continuedFormDueAt }),
            },
          },
          legalClock: undefined,
          legalFormExpiryHistory: expiryHistory,
        };
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        return replaceMovement(state, movement.id, continued);
      }
      // Any other continuation replaces current paper facts while retaining the earlier expiry history.
      const updated: Movement = {
        ...movement,
        formedAt: event.startedAt,
        legalForm: {
          code: event.formCode,
          ...(event.region ? { region: event.region } : {}),
          ...(event.paperExpiresAt === undefined ? {} : { dueAt: event.paperExpiresAt }),
        },
        legalClock: undefined,
        legalFormReceivedAt: undefined,
        legalFormExpiryHistory: expiryHistory,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_HANDOVER_SIGN_OFF": {
      // Role and time only. Never a note, a name, or a claim that anyone was notified.
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const recorded: HandoverSignOffRecord = { at: event.now, by: event.role };
      const existing = Array.isArray(state.handoverSignOffs) ? state.handoverSignOffs : [];
      return { ...state, handoverSignOffs: [...existing, recorded] };
    }

    case "RECORD_REPATRIATION": {
      // Phone-log only. Never mints a transport job and never claims a booking went through.
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (admission.state === "departed" || admission.leftAt !== null) {
        return reject(state, event, `cannot initiate repatriation for discharged admission ${admission.id}`);
      }
      // An ordinary admission keeps its source movement, which PATIENT_ARRIVED closes as "arrived";
      // only a journey that ended any other way blocks repatriation.
      const movement = state.movements.find((m) => m.id === admission.movementId);
      if (movement?.closure && movement.closure.outcome !== "arrived") {
        return reject(state, event, `cannot initiate repatriation for closed movement ${movement.id}`);
      }
      const existing = Array.isArray(state.repatriations) ? state.repatriations : [];
      if (existing.some((record) => record.admissionId === admission.id)) {
        return reject(state, event, `admission ${admission.id} already has a repatriation record`);
      }
      if (!siteByCode(event.homeHospital)) {
        return reject(state, event, `RECORD_REPATRIATION homeHospital ${event.homeHospital} does not name a real site`);
      }
      if (typeof event.receivingWardAgreed !== "boolean") {
        return reject(state, event, `RECORD_REPATRIATION receivingWardAgreed must be answered, and it has no default`);
      }
      if (!(REPATRIATION_MODES as readonly string[]).includes(event.mode)) {
        return reject(state, event, `RECORD_REPATRIATION mode must be chosen from REPATRIATION_MODES`);
      }
      if (!(TRANSPORT_PROVIDERS as readonly string[]).includes(event.provider)) {
        return reject(state, event, `RECORD_REPATRIATION provider must be chosen from TRANSPORT_PROVIDERS`);
      }
      if (typeof event.cadNumber !== "string" || event.cadNumber.trim().length === 0) {
        return reject(state, event, `RECORD_REPATRIATION cadNumber must be answered, and it has no default`);
      }
      if (!TRANSPORT_LEGAL_STATUSES.includes(event.transportLegalStatus)) {
        return reject(
          state,
          event,
          `RECORD_REPATRIATION transportLegalStatus must be chosen from TRANSPORT_LEGAL_STATUSES`,
        );
      }
      if (typeof event.estimatedAt !== "number" || !Number.isFinite(event.estimatedAt)) {
        return reject(state, event, `RECORD_REPATRIATION estimatedAt must be answered, and it has no default`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const recorded: RepatriationRecord = {
        admissionId: admission.id,
        at: event.now,
        by: event.role,
        homeHospital: event.homeHospital,
        receivingWardAgreed: event.receivingWardAgreed,
        mode: event.mode,
        provider: event.provider,
        cadNumber: event.cadNumber.trim(),
        transportLegalStatus: event.transportLegalStatus,
        estimatedAt: event.estimatedAt,
      };
      let nextMovements = state.movements;
      let nextSequence = state.referralSequence;
      if (event.receivingWardAgreed) {
        nextSequence = state.referralSequence + 1;
        let returnMovementId = nextReferralId(nextSequence);
        while (state.movements.some((m) => m.id === returnMovementId)) {
          nextSequence++;
          returnMovementId = nextReferralId(nextSequence);
        }
        const currentUnit = findUnit(state, admission.unitId);
        const currentSite = currentUnit?.siteCode ? siteByCode(currentUnit.siteCode) : undefined;
        const currentEdId =
          currentSite?.emergencyDepartment?.id ??
          allEmergencyDepartments().find((ed) => ed.siteCode === currentSite?.code)?.id ??
          allEmergencyDepartments()[0]?.id ??
          "rph-ed";
        const targetSite = siteByCode(event.homeHospital);
        const targetHealthService = targetSite?.service ?? "North Metro";

        const returnMovement: Movement = {
          id: returnMovementId,
          patientId: admission.patientId ?? undefined,
          originEdId: currentEdId,
          openedAt: event.now,
          referralId: admission.referralId ?? undefined,
          referralAbsence: admission.referralId ? undefined : { reason: "not_asked", at: event.now },
          flaggedUrgent: false,
          urgency: 2,
          cohort: currentUnit?.cohort ?? "Adult",
          security:
            admission.bedKind === "locked" || (currentUnit ? currentUnit.lockedBeds > 0 : false) ? "Secure" : "Open",
          sex: admission.sex,
          gender: admission.gender,
          tentativeDiagnosis: admission.tentativeDiagnosis ?? undefined,
          specialling: admission.specialling,
          highAcuity: admission.highAcuity,
          legalStatus: event.transportLegalStatus === "involuntary" ? "Involuntary inpatient" : "Voluntary",
          statusChanges: [],
          urgencyChanges: [],
          overrides: [],
          stage: "placement_requested",
          owner: currentSite?.name ?? "Outside Hospital",
          referredUnitIds: [],
          declines: [],
          blocker: `Repatriation to ${targetSite?.name ?? event.homeHospital} (${targetHealthService}) agreed; awaiting destination bed placement`,
          withdrawnReferrals: [],
          unwinds: [],
          stageChanges: [{ at: event.now, to: "placement_requested", by: event.role }],
          homeRegion: admission.homeRegion ?? undefined,
          sourceAdmissionId: admission.id,
        };
        nextMovements = [...state.movements, returnMovement];
      }
      return {
        ...state,
        repatriations: [...existing, recorded],
        movements: nextMovements,
        referralSequence: nextSequence,
      };
    }

    case "RECORD_CLINICAL_CONTACT": {
      // Contacting a team is this record, not a sent message.
      const team = communityTeamById(event.teamId);
      if (!team)
        return reject(state, event, `RECORD_CLINICAL_CONTACT teamId ${event.teamId} does not name a real team`);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const recorded: ClinicalContactRecord = { teamId: team.id, at: event.now, by: event.role };
      const existing = Array.isArray(state.clinicalContacts) ? state.clinicalContacts : [];
      return { ...state, clinicalContacts: [...existing, recorded] };
    }

    case "RECORD_SUPPORT_NOTIFICATION": {
      // Advisory only: records what a person says happened. Never decides whether a notice is
      // legally required, never computes when, never blocks a move.
      if (finiteInstant(event.now) === null)
        return reject(state, event, "RECORD_SUPPORT_NOTIFICATION now must be a finite instant");
      if (!SUPPORT_NOTIFICATION_OCCASIONS.includes(event.occasion))
        return reject(state, event, "RECORD_SUPPORT_NOTIFICATION occasion is not one this checklist covers");
      if (!SUPPORT_NOTIFICATION_PARTIES.includes(event.party))
        return reject(
          state,
          event,
          "RECORD_SUPPORT_NOTIFICATION party must be the carer, personal support person or MHAS",
        );
      if (!SUPPORT_NOTIFICATION_OUTCOMES.includes(event.outcome))
        return reject(state, event, "RECORD_SUPPORT_NOTIFICATION outcome must be told or not applicable");

      let subjectId: string;
      if (event.occasion === "discharge") {
        if (event.admissionId === undefined || event.movementId !== undefined)
          return reject(state, event, "a discharge notification names the admission, not a movement");
        const admission = findAdmission(state, event.admissionId);
        if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
        if (!admissionSupportNotificationSubject(admission, state))
          return reject(
            state,
            event,
            `admission ${admission.id} is not a completed discharge of an involuntary patient`,
          );
        subjectId = admission.id;
      } else {
        if (event.movementId === undefined || event.admissionId !== undefined)
          return reject(state, event, "an admission or transfer notification names the movement, not an admission");
        const movement = findMovement(state, event.movementId);
        if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
        const subject = movementSupportNotificationSubject(movement, state.referrals);
        if (!subject)
          return reject(state, event, `movement ${movement.id} is not a completed arrival of an involuntary patient`);
        if (subject.occasion !== event.occasion)
          return reject(state, event, `movement ${movement.id} is a ${subject.occasion}, not a ${event.occasion}`);
        subjectId = movement.id;
      }

      const base = { occasion: event.occasion, subjectId, party: event.party, at: event.now, by: event.role };
      let detail: Pick<SupportNotificationRecord, "outcome" | "who" | "contactedAt" | "reason">;
      if (event.outcome === "told") {
        if (event.reason !== undefined)
          return reject(state, event, "a told notification carries no not-applicable reason");
        // Refused, never shortened: a truncated name silently drops whatever was typed last.
        const who = (event.who ?? "").trim();
        if (who.length === 0) return reject(state, event, "say who was told");
        if (who.length > SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS)
          return reject(
            state,
            event,
            `who is ${who.length} characters and the limit is ${SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS}`,
          );
        const contactedAt = event.contactedAt ?? event.now;
        if (finiteInstant(contactedAt) === null || contactedAt > event.now)
          return reject(state, event, "the time they were told must be a real time no later than now");
        detail = { outcome: "told", who, contactedAt };
      } else {
        if (event.who !== undefined || event.contactedAt !== undefined)
          return reject(state, event, "a not-applicable notification names nobody and no time");
        const reason = (event.reason ?? "").trim();
        if (reason.length === 0) return reject(state, event, "say why it does not apply");
        if (reason.length > SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS)
          return reject(
            state,
            event,
            `reason is ${reason.length} characters and the limit is ${SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS}`,
          );
        detail = { outcome: "not_applicable", reason };
      }

      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const existing = Array.isArray(state.supportNotifications) ? state.supportNotifications : [];
      const recorded: SupportNotificationRecord = { id: `SN-${existing.length + 1}`, ...base, ...detail };
      return { ...state, supportNotifications: [...existing, recorded] };
    }
  }
  return state;
}
