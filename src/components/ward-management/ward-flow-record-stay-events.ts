// The RECORD_* events about a person's stay on the ward: leaving, trips to an emergency department,
// discharge blockers, leave, absence, handover, repatriation, clinical contact and support
// notifications. Moved out of `ward-flow-record-events.ts` unchanged, which hands these events here.
import { stayLegalStatusIsInvoluntary } from "./ward-discharge-records";
import { isLeavingDestination } from "./ward-admissions";
import { type AuditDecision, finiteInstant } from "./ward-audit";
import { recordedCommunityTransition } from "./ward-care-journey";
import type {
  ClinicalContactRecord,
  HandoverSignOffRecord,
  RepatriationRecord,
  WardFlowState,
} from "./ward-flow-reducer";
import type { RecordedFactEvent, RecordedFactEventHelpers } from "./ward-flow-record-events";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { REPATRIATION_MODES } from "@/components/ward-management/ward-flow-events";
import {
  ABSENCE_STEPS,
  type LeaveBed,
  type Movement,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
} from "@/components/ward-management/ward-model";
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

type RecordedStayEvent = Extract<
  RecordedFactEvent,
  {
    type:
      | "RECORD_LEAVING"
      | "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT"
      | "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT"
      | "RECORD_STAY_DISCHARGE_BLOCKER"
      | "RECORD_LEAVE_BED"
      | "RECORD_ABSENT_WITHOUT_LEAVE"
      | "RECORD_ABSENCE_STEP"
      | "RECORD_HANDOVER_SIGN_OFF"
      | "RECORD_REPATRIATION"
      | "RECORD_CLINICAL_CONTACT"
      | "RECORD_SUPPORT_NOTIFICATION";
  }
>;

export function reduceRecordedStayEvent(
  state: WardFlowState,
  event: RecordedStayEvent,
  decision: AuditDecision,
  helpers: RecordedFactEventHelpers,
): WardFlowState {
  const {
    departAdmission,
    dischargeBlockingTransit,
    dischargeMovement,
    findAdmission,
    findMovement,
    findUnit,
    nextLeaveBedId,
    nextReferralId,
    patientRecordIsInvoluntary,
    recordedByLabel,
    reject,
    replaceAdmission,
  } = helpers;
  switch (event.type) {
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
        decision.reasonCode = "scope";
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
        stayLegalStatusIsInvoluntary(state, admission, linkedMovement)
      ) {
        if (
          event.leavingDestination === "discharged-to-the-community" ||
          event.leavingDestination === "left-against-advice"
        ) {
          if (
            !recordedCommunityTransition(admission, linkedMovement?.statusChanges.at(-1)?.at, event.leavingDestination)
          ) {
            // A revocation is a care record on a linked patient only (owner, 20 Oct 2026), so an
            // unlinked stay is told to link first rather than to record something it cannot.
            return reject(
              state,
              event,
              admission.patientId
                ? `cannot record leaving for involuntary patient ${linkedPatient?.id ?? admission.id}: involuntary legal status prohibits unrevoked discharge to the community or left-against-advice`
                : `cannot record leaving for admission ${admission.id}: the booking is involuntary. Link the patient to their record first, then record the revocation or community treatment order before discharge to the community or left-against-advice`,
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
      const updated = replaceAdmission(state, admission.id, { ...admission, blockReason: event.blocker });
      return {
        ...updated,
        bedReleases: updated.bedReleases.map((release) =>
          release.admissionId === admission.id && release.state !== "discharged"
            ? {
                ...release,
                blocker: event.blocker,
                blockedBy: recordedByLabel(event.role, findUnit(state, admission.unitId)?.name ?? admission.unitId),
                confirmedAt: event.now,
              }
            : release,
        ),
      };
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
      const existingRecord = existing.find((record) => record.admissionId === admission.id);
      if (existingRecord && (existingRecord.receivingWardAgreed || event.receivingWardAgreed !== true)) {
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
      // One home hospital for the record and for the return movement: an agreement that arrives
      // naming a different site never moves the one the plan was sent to.
      const homeHospital = existingRecord?.homeHospital ?? event.homeHospital;
      const recorded: RepatriationRecord = {
        admissionId: admission.id,
        at: existingRecord?.at ?? event.now,
        by: existingRecord?.by ?? event.role,
        homeHospital,
        receivingWardAgreed: event.receivingWardAgreed,
        ...(event.receivingWardAgreed && existingRecord ? { agreedAt: event.now, agreedBy: event.role } : {}),
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
        const targetSite = siteByCode(homeHospital);
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
          observation: admission.observation,
          highAcuity: admission.highAcuity,
          legalStatus: event.transportLegalStatus === "involuntary" ? "Involuntary inpatient" : "Voluntary",
          statusChanges: [],
          urgencyChanges: [],
          overrides: [],
          stage: "placement_requested",
          owner: currentSite?.name ?? "Outside Hospital",
          referredUnitIds: [],
          declines: [],
          blocker: `Repatriation to ${targetSite?.name ?? homeHospital} (${targetHealthService}) agreed; awaiting destination bed placement`,
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
        repatriations: existingRecord
          ? existing.map((record) => (record.admissionId === admission.id ? recorded : record))
          : [...existing, recorded],
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
