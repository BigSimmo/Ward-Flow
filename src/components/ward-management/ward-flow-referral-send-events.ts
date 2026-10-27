import { closedToAdmissionsRefusal } from "./capacity/ward-closure";
import { journeySentByKind } from "@/components/ward-management/ward-journey-sender";
import { type AuditDecision } from "./ward-audit";
import { uniqueRecord } from "./ward-discharge-records";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  LEGAL_FORM_RECEIPT_CORRECTION_REASONS,
  LEGAL_STATUS_CHANGE_REASONS,
  OVERRIDE_REASONS,
  REFERRAL_CAP_REASONS,
  URGENCY_CHANGE_REASONS,
  URGENCY_REASON_NOT_GIVEN,
  WARD_REQUEST_WITHDRAWAL_REASONS,
  wardRequestWithdrawalReasonLabels,
} from "@/components/ward-management/ward-change-reasons";
import { type Instant } from "@/components/ward-management/ward-clock";
import { isTentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import { isObservation } from "@/components/ward-management/ward-observation";
import {
  WARD_FLOW_ROLE_LABELS,
  type WardFlowEvent,
  type WardFlowRole,
} from "@/components/ward-management/ward-flow-events";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import {
  REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS,
  REFERRAL_GENDERS,
  URGENCY_LEVELS,
  genderReviewNeeded,
  type Movement,
  type Notice,
  type Referral,
  type ReferralCorrection,
} from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { scenarioEmergencyDepartments } from "@/components/ward-management/ward-scenarios";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import type { ReferralSendEventHelpers, WardFlowState } from "./ward-flow-reducer";
import { isCommunityReferralPurpose } from "@/components/ward-management/ward-model-referral-parts";
import { communityPurposeOf } from "@/components/ward-management/ward-referrals";

/**
 * Raising, sending, correcting and withdrawing a referral: `reduceClinicalEvent`'s cases for these
 * events, moved here unchanged. The reducer passes its helpers in, since this file may not import
 * the reducer at run time.
 */
export type ReferralSendEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "RAISE_REFERRAL"
      | "CORRECT_LEGAL_FORM_RECEIPT"
      | "REFER_TO_COMMUNITY_TEAM"
      | "REFER_TO_UNITS"
      | "WITHDRAW_REFERRAL"
      | "WITHDRAW_WARD_REQUEST"
      | "ADD_REFERRAL_CORRECTION"
      | "CHANGE_URGENCY"
      | "CHANGE_LEGAL_STATUS";
  }
>;

export function reduceReferralSendEvent(
  state: WardFlowState,
  event: ReferralSendEvent,
  decision: AuditDecision,
  helpers: ReferralSendEventHelpers,
): WardFlowState {
  const {
    REFERRABLE_MOVEMENT_STAGES,
    STAGE_TRANSITION_BLOCKERS,
    appendNotices,
    eligibilityRefusal,
    findMovement,
    findReferral,
    findUnit,
    makeNotice,
    movementSourceAdmission,
    nextFrontDoorReferralId,
    nextReferralId,
    overrideSignOffField,
    referralReferrer,
    reject,
    releasePulledBedAndAdmission,
    replaceMovement,
    replaceReferral,
    withdrawAllLiveRequestsForReferrer,
    withoutReferralBedHold,
  } = helpers;
  switch (event.type) {
    case "RAISE_REFERRAL": {
      if (!isObservation(event.draft.observation))
        return reject(state, event, "RAISE_REFERRAL observation must be a recorded level with a valid interval.");
      if (event.draft.atsCategory !== undefined && ![1, 2, 3, 4, 5].includes(event.draft.atsCategory))
        return reject(state, event, "RAISE_REFERRAL ATS category must be a recorded integer from 1 to 5.");
      // D-76: with no ED named, only an accepted community referral's journey may start (checked below).
      const department =
        event.edId === undefined
          ? undefined
          : scenarioEmergencyDepartments(state.scenario).find((ed) => ed.id === event.edId);
      if (event.edId !== undefined && !department) {
        return reject(state, event, `no emergency department found for id ${event.edId}`);
      }
      if (!department && event.acceptedUnitId === undefined)
        return reject(
          state,
          event,
          "RAISE_REFERRAL needs an emergency department unless it starts an accepted community referral",
        );
      if (event.acceptedUnitId === undefined && event.role === "ward") {
        return reject(state, event, "A ward desk raises a placement only for an accepted direct continuation");
      }
      const sequence = state.referralSequence + 1;
      // The clinician chooses the form; nothing derives one from `legalStatus` (product owner:
      // "avoid any hard rules now please"). `null` means the clinician chose no form, a real
      // answer. A code the picker cannot offer is refused rather than dropped or invented.
      const chosenCode = event.draft.legalFormCode;
      const chosenForm =
        chosenCode === null ? undefined : SELECTABLE_LEGAL_FORMS.find((form) => form.code === chosenCode);
      if (chosenCode !== null && chosenForm === undefined) {
        return reject(state, event, `no selectable legal form found for code ${chosenCode}`);
      }
      /**
       * The only place this reducer writes a `dueAt` on creation;
       * `tests/ward-legal-form-due-at-capture.test.ts` keeps it so. Typed by the clinician, never
       * computed: nothing here may turn a statutory interval into a deadline (owner: "just start a
       * clock once the patient arrives to ED").
       *
       * T2 (owner answer 1): the clinician types the expiry written on whichever form they hold, of
       * any code, so this keeps whatever was supplied regardless of the form's `kind`.
       * `RECORD_LEGAL_FORM_EXPIRY` records later expiries or extensions.
       */
      const capturedDueAt = event.draft.legalFormDueAt;
      /**
       * The link back to the front door: the only writer of `Movement.referralId` (owner ruling 8:
       * a community referral and the journey the ED raises are two linked records). It resolves
       * rather than stores: an id naming no referral is refused, since a plausible-looking id that
       * joins to nothing typechecks and renders.
       *
       * The referral must name this department: a journey at one ED claiming a referral addressed
       * to another is a false join. The purpose is deliberately not checked (owner: nobody declines
       * an ED notification on purpose).
       *
       * R5: a journey cannot be raised from an addressing its referrer withdrew or its
       * department declined, and a referral cannot fund two live journeys (checked below).
       */
      let raisedFrom: Referral | undefined;
      let continuedAcceptance: Referral["destinations"][number] | undefined;
      if (event.acceptedUnitId !== undefined && event.referralId === undefined)
        return reject(state, event, "Starting an accepted placement requires its referral");
      if (event.referralId !== undefined) {
        raisedFrom = findReferral(state, event.referralId);
        if (!raisedFrom) {
          return reject(
            state,
            event,
            `RAISE_REFERRAL referralId must name a referral this system already holds, and ${event.referralId} names none`,
          );
        }
        const referral = raisedFrom;
        const directContinuation = event.acceptedUnitId !== undefined;
        if (directContinuation) {
          if (
            (event.role !== "ward" && event.role !== "coordinator") ||
            (event.role === "ward" && event.actingUnitId !== event.acceptedUnitId) ||
            (department
              ? referral.source !== "ed_medical" || department.siteCode !== referral.originSiteCode
              : referral.source !== "community" || referral.sendingTeamName === undefined) ||
            !findUnit(state, event.acceptedUnitId!)
          )
            return reject(state, event, "Only the accepting ward or coordinator can start this direct ED placement");
          continuedAcceptance = referral.destinations.find(
            (candidate) =>
              candidate.destination.kind === "psychiatric_ward" &&
              (candidate.acceptedUnitId ?? candidate.destination.unitId) === event.acceptedUnitId &&
              candidate.state === "accepted" &&
              candidate.withdrawnAt === undefined,
          );
          if (!continuedAcceptance) return reject(state, event, "This referral has no current acceptance at that ward");
          const destination = continuedAcceptance.destination;
          if (
            destination.kind !== "psychiatric_ward" ||
            event.draft.cohort !== referral.ageBand ||
            event.draft.sex !== destination.sex ||
            event.draft.gender !== destination.gender ||
            event.draft.security !== (destination.secureBedNeeded ? "Secure" : "Open") ||
            event.draft.highAcuity !== (destination.highAcuityNursingNeeded === true)
          )
            return reject(state, event, "Start placement must retain the accepted referral's recorded needs");
        }
        const addressing =
          continuedAcceptance ??
          referral.destinations.find(
            (candidate) =>
              candidate.destination.kind === "emergency_department" && candidate.destination.edId === event.edId,
          );
        if (!addressing) {
          return reject(
            state,
            event,
            `referral ${referral.id} was never addressed to ${department?.name ?? "this ward"}, so a journey raised there did not come from it`,
          );
        }
        /**
         * Withdrawal is checked separately from `state` (the O-17.11 split):
         * `RECORD_REFERRER_WITHDRAWAL` stamps `withdrawnAt` and never touches `state`. Checked
         * first: a withdrawn referral is dead whatever `state` reads.
         */
        if (addressing.withdrawnAt !== undefined) {
          return reject(
            state,
            event,
            `referral ${referral.id} was withdrawn by its referrer, so no journey can be raised from it`,
          );
        }
        // Declined specifically: `accepted` and `cancelled` do not say this department turned the
        // referral away. A decline on this destination is what must stop this department raising a
        // journey from it.
        if (addressing.state === "declined") {
          return reject(
            state,
            event,
            `${department?.name ?? "This ward"} declined referral ${referral.id}, so no journey can be raised from it`,
          );
        }
        /**
         * Owner Q11: a second journey from the same referral is refused while an earlier
         * one blocks, and permitted once that earlier one closed `did_not_proceed`. P2-6: an
         * arrival also blocks, since it fulfilled the referral.
         * `tests/ward-raise-referral-uniqueness.test.ts` covers the Q11 case.
         *
         * `isOpen` (`ward-derivations.ts`) is not imported: that module imports from this file, so
         * importing back would be circular. Scoped to this referral's id, never `edId` alone.
         */
        const blockingLinkedMovement = state.movements.find(
          (movement) => movement.referralId === referral.id && movement.closure?.outcome !== "did_not_proceed",
        );
        if (blockingLinkedMovement) {
          return reject(
            state,
            event,
            `referral ${referral.id} already has a linked movement (${blockingLinkedMovement.id}) that did not close as "did not proceed"; a second journey cannot be raised while it stands`,
          );
        }
      }
      // Membership-checked like `RECEIVE_REFERRAL`'s `gender` and `tentativeDiagnosis`, so a caller
      // bypassing the picker's type cannot write an invented value.
      if (event.draft.gender !== undefined && !REFERRAL_GENDERS.includes(event.draft.gender)) {
        return reject(state, event, `RAISE_REFERRAL gender must be chosen from REFERRAL_GENDERS`);
      }
      if (
        event.draft.urgency !== undefined &&
        !URGENCY_LEVELS.includes(event.draft.urgency as (typeof URGENCY_LEVELS)[number])
      ) {
        return reject(state, event, `RAISE_REFERRAL urgency must be chosen from URGENCY_LEVELS`);
      }
      if (event.draft.tentativeDiagnosis !== undefined && !isTentativeDiagnosisBlock(event.draft.tentativeDiagnosis)) {
        return reject(state, event, `RAISE_REFERRAL tentativeDiagnosis must be chosen from TENTATIVE_DIAGNOSIS_BLOCKS`);
      }
      // A journey raised from a referral is for that referral's patient; naming someone else could
      // leave a person holding two beds (review finding S1-2).
      if (
        event.patientId !== undefined &&
        raisedFrom?.patientId !== undefined &&
        event.patientId !== raisedFrom.patientId
      ) {
        return reject(state, event, "RAISE_REFERRAL names a different patient from the one this referral is for");
      }
      /**
       * WT-04 and WT-30 (walk-through, 26 Oct 2026): a journey started from an ED referral a ward
       * accepted opens when the person was recorded in the department, or else when the referral was
       * sent, never later than now. The ED wait clock keeps the time already waited, and the stage
       * history carries the recorded request and acceptance times instead of the pull time.
       */
      const edReferral = department && continuedAcceptance ? raisedFrom : undefined;
      const openedAt = edReferral
        ? Math.min(
            edReferral.inDepartmentAt ?? edReferral.triagedAt ?? edReferral.raisedAt,
            edReferral.raisedAt,
            event.now,
          )
        : event.now;
      const acceptedAt = continuedAcceptance
        ? Math.min(continuedAcceptance.decidedAt ?? event.now, event.now)
        : undefined;
      const created: Movement = {
        id: nextReferralId(sequence),
        ...(department
          ? { originEdId: department.id }
          : // D-76: the referring team and location, as the accepted community referral recorded them.
            // The team's own transport answer carries over, so a carer-brought patient can arrive
            // without a booking. A needed vehicle is booked on the journey as for any other.
            {
              originCommunity: { siteCode: raisedFrom!.originSiteCode, teamName: raisedFrom!.sendingTeamName },
              ...(raisedFrom!.transportNeeded ? {} : { transportNeed: { needed: false, at: event.now } }),
            }),
        openedAt,
        patientId: event.patientId ?? raisedFrom?.patientId,
        // `undefined` when nobody referred this person, a real answer. Never a manufactured id: the
        // guard above refuses anything that does not resolve.
        referralId: raisedFrom?.id ?? event.referralId,
        ...(raisedFrom?.turnaroundPriority === undefined
          ? {}
          : { turnaroundPriority: { ...raisedFrom.turnaroundPriority } }),
        /**
         * Owner ruling R-2026-09-04-D: the absence is written down, not left empty. A runtime
         * movement with no id says `not_asked`; only `RECORD_NO_REFERRAL`, where somebody answers
         * the question, writes `none_raised`. Exactly one of `referralId` and `referralAbsence` is
         * ever set.
         */
        referralAbsence: raisedFrom === undefined ? { reason: "not_asked" as const, at: event.now } : undefined,
        // A newly raised movement is never flagged. The flag is an act somebody takes on a
        // patient already in the queue, not a property of arriving.
        flaggedUrgent: false,
        urgency: event.draft.urgency,
        // WT-06: with no clearance recorded since, the ED referrer's own answer at Send is carried.
        ...(raisedFrom?.medicalClearance !== undefined
          ? { medicalClearance: { ...raisedFrom.medicalClearance } }
          : edReferral?.intake?.medicalClearance !== undefined
            ? { medicalClearance: { cleared: edReferral.intake.medicalClearance.cleared, at: edReferral.raisedAt } }
            : {}),
        ...(event.draft.atsCategory === undefined && raisedFrom?.atsCategory === undefined
          ? {}
          : { atsCategory: event.draft.atsCategory ?? raisedFrom?.atsCategory }),
        cohort: event.draft.cohort,
        security: event.draft.security,
        sex: event.draft.sex,
        gender: event.draft.gender,
        // T15 (item 12): the ED's own choice replaces whatever the linked referral carried.
        tentativeDiagnosis: event.draft.tentativeDiagnosis ?? raisedFrom?.tentativeDiagnosis,
        observation: { ...event.draft.observation },
        highAcuity: event.draft.highAcuity,
        legalStatus: event.draft.legalStatus,
        // Spread-copied, never aliased: `SELECTABLE_LEGAL_FORMS` entries must not become mutable
        // state. The spread keeps `dueAt` off the object when none was typed, so absent and
        // explicitly-nothing are one shape.
        legalForm:
          chosenForm === undefined
            ? undefined
            : { ...chosenForm, ...(capturedDueAt === undefined ? {} : { dueAt: capturedDueAt }) },
        /**
         * T2r: a captured `dueAt` also gets its first history entry, so `dueAt` always equals the
         * last `legalFormExpiryHistory` entry. Written only when a due time was captured ("absent
         * means untouched").
         */
        legalFormExpiryHistory:
          capturedDueAt === undefined
            ? undefined
            : [{ at: event.now, by: event.role, dueAt: capturedDueAt, basis: "written_on_form" as const }],
        statusChanges: [],
        urgencyChanges: [],
        overrides: [],
        stage: continuedAcceptance ? "accepted_awaiting_bed" : "placement_requested",
        owner: continuedAcceptance ? findUnit(state, event.acceptedUnitId!)!.name : department!.name,
        // Acceptance empties the live requests, as ACCEPT_IN_PRINCIPLE does: the accepted ward lives
        // in `acceptedUnitId`, so WITHDRAW_WARD_REQUEST cannot take it back (review: CodeRabbit).
        referredUnitIds: [],
        ...(continuedAcceptance
          ? {
              acceptedUnitId: event.acceptedUnitId,
              acceptedAt,
              genderPlacements: raisedFrom?.genderPlacements,
              ...(continuedAcceptance.heldBedNumber === undefined
                ? {}
                : { heldBedNumber: continuedAcceptance.heldBedNumber }),
            }
          : {}),
        declines: [],
        blocker: continuedAcceptance ? "Awaiting bed pull" : "Awaiting coordinator referral",
        withdrawnReferrals: [],
        unwinds: [],
        // The creation moment is the first entry, with no `from`.
        stageChanges:
          edReferral && acceptedAt !== undefined && openedAt < acceptedAt
            ? [
                { at: openedAt, to: "placement_requested", by: "ed" },
                {
                  at: acceptedAt,
                  from: "placement_requested",
                  to: "accepted_awaiting_bed",
                  by: continuedAcceptance?.decidedBy ?? event.role,
                },
              ]
            : [
                {
                  at: openedAt,
                  to: continuedAcceptance ? "accepted_awaiting_bed" : "placement_requested",
                  by: event.role,
                },
              ],
        // `formedAt` is deliberately unset: when a patient was formed in the community is a fact
        // only a clinician holds, and no rule may invent it. The fixture keeps its authored values.
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...state,
        movements: [...state.movements, created],
        referralSequence: sequence,
      };
    }

    /**
     * T4: the undo for `RECORD_LEGAL_FORM_RECEIVED`. Clears `legalFormReceivedAt` and appends the
     * original instant, who corrected it and the reason to `legalFormReceiptCorrections`, so the
     * fact a receipt was recorded is kept and a fresh receipt can follow.
     */
    case "CORRECT_LEGAL_FORM_RECEIPT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // D-80: a ward or team acts here only on a journey its kind of desk sent (scope is the server's).
      if (!journeySentByKind(state.referrals, movement, event.role)) {
        return reject(state, event, `only the desk that sent movement ${movement.id} may correct its form receipt`);
      }
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot correct a legal form receipt for a closed movement (${movement.closure.reason})`,
        );
      }
      if (movement.legalFormReceivedAt === undefined) {
        return reject(state, event, `movement ${movement.id} has no recorded legal form receipt to correct`);
      }
      if (!LEGAL_FORM_RECEIPT_CORRECTION_REASONS.includes(event.reason)) {
        return reject(
          state,
          event,
          `CORRECT_LEGAL_FORM_RECEIPT reason "${event.reason}" is not one of the fixed correction reasons`,
        );
      }
      const correction = {
        at: event.now,
        by: event.role,
        reason: event.reason,
        receivedAt: movement.legalFormReceivedAt,
      };
      const updated: Movement = {
        ...movement,
        legalFormReceivedAt: undefined,
        legalFormReceiptCorrections: [...(movement.legalFormReceiptCorrections ?? []), correction],
      };
      // Audited as "legal-form" (`classifyAuditEvent`); without this the stored change was
      // recorded in the audit trail as "denied".
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * Ruling 16, items 14 and 48: the direct ED-to-CMHT referral pathway when inpatient admission
     * is not needed. Creates a real community referral, notifies the destination team and records
     * the outcome.
     */
    case "REFER_TO_COMMUNITY_TEAM": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot refer a closed movement (${movement.closure.reason})`);
      }
      if (!communityTeamOptions().includes(event.team)) {
        return reject(state, event, `team "${event.team}" is not a valid community mental health team`);
      }
      if (event.purpose !== undefined && !isCommunityReferralPurpose(event.purpose)) {
        return reject(state, event, "REFER_TO_COMMUNITY_TEAM purpose must be chosen from COMMUNITY_REFERRAL_PURPOSES");
      }
      // Refused once collected, as `WITHDRAW_REFERRAL` does: use `STOP_TRANSPORT`.
      if (movement.transport?.collectedAt !== undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of referring to a community team`,
        );
      }
      // F4 / owner answer 14: a patient on a legal form cannot be referred to a community team
      // until a conclusive examination outcome is recorded ("further examination ordered" does not
      // unlock it). Enforced here as well as by `communityReferralBlockedReason` (ed-screen.tsx).
      // Voluntary patients are never blocked.
      const isOnForm =
        !!movement.legalForm || (movement.legalStatus !== undefined && movement.legalStatus !== "Voluntary");
      if (isOnForm && (!movement.examination || movement.examination.outcome === "further_examination_ordered")) {
        return reject(
          state,
          event,
          `movement ${movement.id} is on a legal form; a conclusive examination outcome must be recorded before referring to a community team`,
        );
      }
      const withoutPulledBed = withoutReferralBedHold(
        releasePulledBedAndAdmission(state, movement, event.now),
        movement,
      );
      const linkedReferral = withoutPulledBed.referrals.find((r) => r.id === movement.referralId);
      const originEd = scenarioEmergencyDepartments(state.scenario).find((d) => d.id === movement.originEdId);
      const originSite = originEd ? siteByCode(originEd.siteCode) : undefined;

      // Reuse a queued arm to this exact team rather than asking the same team twice. Settled arms
      // are not reused.
      const existingQueuedArm = linkedReferral?.destinations.find(
        (addressing) =>
          addressing.destination.kind === "community_team" &&
          addressing.destination.teamName === event.team &&
          addressing.state === "queued" &&
          addressing.withdrawnAt === undefined,
      );

      // D-74: a reused arm keeps the purpose it was sent with unless this referral names one.
      const reusedArmPurpose =
        existingQueuedArm?.destination.kind === "community_team" ? existingQueuedArm.destination.purpose : undefined;
      const purpose = communityPurposeOf({ purpose: event.purpose ?? reusedArmPurpose });
      const purposeWords = purpose === "assess_for_admission" ? "assessment for admission" : "community follow-up";

      const sequence = existingQueuedArm
        ? withoutPulledBed.frontDoorReferralSequence
        : withoutPulledBed.frontDoorReferralSequence + 1;
      const referralId = existingQueuedArm && linkedReferral ? linkedReferral.id : nextFrontDoorReferralId(sequence);

      // F6: with no linked referral, the suburb is a stated absence (`{ kind: "unknown", reason:
      // "not_known" }`), never a hospital's name. `HOME_REGIONS` has no unknown member, so
      // `homeRegion` keeps its "Perth Metropolitan" fallback.
      //
      // `undefined` when reusing an existing queued arm.
      const newReferral: Referral | undefined = existingQueuedArm
        ? undefined
        : {
            id: referralId,
            patientId: linkedReferral?.patientId ?? movement.patientId,
            ageBand: movement.cohort,
            homeRegion: linkedReferral?.homeRegion ?? "Perth Metropolitan",
            suburb: linkedReferral?.suburb ?? { kind: "unknown", reason: "not_known" },
            source: "ed_medical",
            originSiteCode: originSite?.code ?? "ARM",
            raisedAt: event.now,
            urgency: movement.urgency,
            ...(movement.atsCategory === undefined ? {} : { atsCategory: movement.atsCategory }),
            destinations: [
              {
                destination: {
                  kind: "community_team",
                  teamName: event.team,
                  ...(event.purpose === undefined ? {} : { purpose: event.purpose }),
                },
                state: "queued",
                referredAt: event.now,
              },
            ],
            transportNeeded: false,
            // An unlinked movement states the absence rather than leaving `history` blank. A linked
            // referral's own `history` is never overwritten, even when empty.
            history: linkedReferral
              ? linkedReferral.history
              : "Referred from the emergency department; no written referral history was recorded.",
          };

      // F10: the plan's §4 wording. Reusing a queued arm says so.
      const communityNotice = makeNotice(
        event.now,
        withoutPulledBed.notices.length,
        "community_referral_received",
        { role: "community", placeId: communityTeamSlug(event.team) },
        { movementId: movement.id, referralId },
        existingQueuedArm
          ? `${originEd?.name ?? "Emergency Department"} referred a patient for ${purposeWords}: reusing the existing queued referral rather than raising a second one to the same team.`
          : `${originEd?.name ?? "Emergency Department"} referred a patient for ${purposeWords}.`,
      );

      // F5: live ward requests are withdrawn (recorded with `ed_outcome_recorded`, since the
      // department recorded an outcome rather than withdrawing) and an accepting ward is told, so
      // the movement does not stay queued or accepted at a ward.
      const acceptingUnitId = movement.acceptedUnitId;
      // P1-4: captured before `updated` overwrites it, so the officer can be told the journey
      // ended.
      const hadLiveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      // Truthful cause: the department recorded an outcome that ends the bed search, not the
      // referrer withdrawing (`WithdrawalReason.ed_outcome_recorded`, `ward-change-reasons.ts`).
      const withdrawnLiveRequests = movement.referredUnitIds.map((unitId) => ({
        unitId,
        at: event.now,
        reason: "ed_outcome_recorded" as const,
      }));
      const updated: Movement = {
        ...movement,
        admissionId: undefined,
        acceptedUnitId: undefined,
        heldBedNumber: undefined,
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawnLiveRequests],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          ...withdrawnLiveRequests.map((referral) => ({ ...referral, answer: "withdrawn" as const })),
        ],
        edOutcome: "for_community_follow_up",
        communityPurpose: purpose,
        transport:
          movement.transport && movement.transport.cancelledAt === undefined
            ? { ...movement.transport, cancelledAt: event.now }
            : movement.transport,
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: event.reason ?? `Referred to community mental health team: ${event.team}`,
        },
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };

      const withMovement = replaceMovement(withoutPulledBed, movement.id, updated);
      // Finding 3: no `newReferral` at all when reusing an existing queued arm — the linked
      // referral's own array keeps its arms, never a second arm appended beside it. D-74: a purpose
      // chosen now is written onto the reused arm, so the arm the team answers, the notice and the
      // closed record all say the same thing.
      const reusedArmToUpdate =
        existingQueuedArm && linkedReferral && event.purpose !== undefined && event.purpose !== reusedArmPurpose
          ? existingQueuedArm
          : undefined;
      const withReferral: WardFlowState =
        newReferral === undefined
          ? reusedArmToUpdate && linkedReferral
            ? replaceReferral(withMovement, linkedReferral.id, {
                ...linkedReferral,
                destinations: linkedReferral.destinations.map((arm) =>
                  arm === reusedArmToUpdate && arm.destination.kind === "community_team"
                    ? { ...arm, destination: { ...arm.destination, purpose } }
                    : arm,
                ),
              })
            : withMovement
          : {
              ...withMovement,
              referrals: [...withMovement.referrals, newReferral],
              frontDoorReferralSequence: sequence,
            };
      const notices: Notice[] = [communityNotice];
      let noticeCount = withoutPulledBed.notices.length + 1;
      if (acceptingUnitId !== undefined) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "referral_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            `The referral for ${movement.id} was referred to a community team instead; the patient is no longer coming.`,
          ),
        );
      }
      // P1-4: the officer's half, the same "job cancelled, nothing rebooked" shape
      // `CANCEL_TRANSPORT`'s own notice and `RECORD_ED_OUTCOME`'s P1-4 fix (above) already hold to.
      if (hadLiveTransportJob) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "transport_cancelled_officer",
            { role: "officer" },
            { movementId: movement.id },
            `Transport for ${movement.id} was cancelled (referred to a community team instead); no bed is pulled and nothing has been rebooked.`,
          ),
        );
      }
      // P1-4: every ward still holding a live request is told, reusing `WITHDRAW_WARD_REQUEST`'s
      // `ward_request_withdrawn` shape.
      for (const unitId of movement.referredUnitIds) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "ward_request_withdrawn",
            { role: "ward", placeId: unitId },
            { movementId: movement.id, unitId },
            `The request for ${movement.id} was withdrawn: referred to a community team instead.`,
          ),
        );
      }
      return appendNotices(withReferral, notices);
    }

    case "REFER_TO_UNITS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot refer a closed movement (${movement.closure.reason})`);
      }
      /**
       * RA1 (owner answer 18): re-referring adds wards and never silently drops a live one.
       * `liveUnitIds` is the standing set; only `newUnitIds` enter the eligibility gate, so a live
       * ward is neither re-checked nor double-counted.
       */
      const liveUnitIds = movement.referredUnitIds;
      const uniqueUnitIds = Array.from(new Set(event.unitIds));
      const newUnitIds = uniqueUnitIds.filter((unitId) => !liveUnitIds.includes(unitId));
      // Top 25 item 2 (owner ruling, 15 Oct 2026): a chosen reason for asking past the cap is kept
      // in the audit trail. Finding 188 (Josh, 27 Oct 2026): the cap is a warning everywhere, so
      // going past it no longer needs a reason. `overCapRecorded` below still marks it.
      if (event.overCapReason !== undefined && !REFERRAL_CAP_REASONS.includes(event.overCapReason)) {
        return reject(state, event, `REFER_TO_UNITS overCapReason must be chosen from REFERRAL_CAP_REASONS`);
      }
      if (!REFERRABLE_MOVEMENT_STAGES.includes(movement.stage)) {
        return reject(
          state,
          event,
          `cannot refer a movement at its current stage (${stageCopy[movement.stage].label})`,
        );
      }
      const unknown = newUnitIds.find((unitId) => !findUnit(state, unitId));
      if (unknown) {
        return reject(state, event, `no unit found for id ${unknown}`);
      }
      // Membership-checked, not truthiness-checked: an unrecognised reason is never written into an
      // accountability record.
      if (event.overrideReason !== undefined && !OVERRIDE_REASONS.includes(event.overrideReason)) {
        return reject(state, event, `REFER_TO_UNITS overrideReason must be chosen from OVERRIDE_REASONS`);
      }
      /**
       * T12 (owner answer 9): a Non-binary movement may be referred only to units a coordinator has
       * already checked with the ward, or is checking now. Runs before the per-ward eligibility
       * loop and refuses the whole event: a procedural requirement, not a suitability judgement a
       * reason can buy past (see `GenderPlacement` in `ward-model.ts`).
       *
       * No role check here: `EVENT_ROLE.REFER_TO_UNITS` is coordinator-only. "Ward and ED staff
       * cannot bypass it" is enforced on `ACCEPT_REFERRAL`.
       */
      let genderPlacementAddition:
        | {
            at: Instant;
            by: WardFlowRole;
            unitIds: string[];
            reason: (typeof GENDER_PLACEMENT_REASONS)[number];
            wardChecked: true;
          }
        | undefined;
      // R7 (owner ruling, 25 September 2026): widened from `"Non-binary"` alone to any gender or
      // recorded sex that is not female or male, including not recorded (`genderReviewNeeded`).
      if (genderReviewNeeded(movement.gender, movement.sex)) {
        const uncovered = newUnitIds.filter(
          (unitId) => !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(unitId)),
        );
        if (uncovered.length > 0) {
          if (event.genderPlacementReason === undefined || event.genderPlacementChecked !== true) {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (!GENDER_PLACEMENT_REASONS.includes(event.genderPlacementReason)) {
            return reject(
              state,
              event,
              `REFER_TO_UNITS genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS`,
            );
          }
          genderPlacementAddition = {
            at: event.now,
            by: event.role,
            unitIds: uncovered,
            reason: event.genderPlacementReason,
            // Stores the validated `genderPlacementChecked` fact on the record rather than leaving
            // it implied by the reason text.
            wardChecked: true,
          };
        }
      }

      /**
       * The eligibility gate, per ward (owner ruling): the suitable wards proceed; an unsuitable
       * one is held back unless a reason is given for it. Per ward, never per referral, and never
       * one reason covering the whole list.
       *
       * A held-back ward is recorded with its own rejection naming its failing gate, never silently
       * dropped. If every new ward is held back, nothing is referred.
       *
       * RA1: runs over `newUnitIds` only; an already-live ward passed this gate when first referred
       * and is carried forward unconditionally below.
       */
      const targets: NonNullable<AuditDecision["targets"]>[number][] = [];
      decision.targets = targets;
      const heldBack: string[] = [];
      const permitted: string[] = [];
      // Owner reversal, item 2: the per-unit `gender_designation` gate must see the placement
      // record this event is about to write, so both gates can be cleared in one act. Never
      // persisted from here.
      const movementForEligibility: Movement =
        genderPlacementAddition === undefined
          ? movement
          : { ...movement, genderPlacements: [...(movement.genderPlacements ?? []), genderPlacementAddition] };
      for (const unitId of newUnitIds) {
        const candidate = findUnit(state, unitId);
        // Audit 2 E-02: a closed ward is held back like any unsuitable ward, and no override
        // reason reopens it; only reopening the ward does.
        const refusal = candidate
          ? (closedToAdmissionsRefusal(candidate) ??
            eligibilityRefusal(event, movementForEligibility, candidate, event.now))
          : null;
        targets.push({
          unitId: uniqueRecord(state.units, unitId)?.id ?? null,
          outcome: refusal ? "denied" : "accepted",
          reasonCode: refusal ? "transition" : "none",
        });
        if (refusal) heldBack.push(refusal);
        else permitted.push(unitId);
      }
      const withHeldBack = heldBack.reduce((carried, refusal) => reject(carried, event, refusal), state);
      // Refuse when something new was attempted and all of it was held back; a call that attempted
      // nothing new falls through to the harmless re-assertion below.
      if (newUnitIds.length > 0 && permitted.length === 0) return withHeldBack;
      if (event.overrideReason !== undefined && permitted.length === 0) {
        return reject(withHeldBack, event, "cannot record a placement override when no new units are referred");
      }

      // Re-referral: this movement is ALREADY at `destination_review`, so adding wards is not a
      // fresh transition — see the `stageChanges` field below.
      const isReReferral = movement.stage === "destination_review";

      const updated: Movement = {
        ...movement,
        // RA1: the union of what was already live and what just got through the gate — never a
        // replacement. Order keeps every live ward's own position stable and appends new ones after.
        referredUnitIds: Array.from(new Set([...liveUnitIds, ...permitted])),
        // The first referral's own moment, never rewritten by a re-referral.
        referredAt: movement.referredAt ?? event.now,
        // Stream A decision targets: open a fresh wait when this act refers into an empty live set.
        // Adding wards while others are live keeps the standing clock. A decline alone never writes
        // this field.
        referralDecisionOpenedAt:
          permitted.length === 0
            ? movement.referralDecisionOpenedAt
            : liveUnitIds.length === 0
              ? event.now
              : (movement.referralDecisionOpenedAt ?? movement.referredAt ?? event.now),
        // OD-3: the override reason is kept, appended rather than replaced, since a movement can be
        // overridden more than once.
        overrides:
          event.overrideReason === undefined
            ? movement.overrides
            : [
                ...movement.overrides,
                {
                  at: event.now,
                  by: WARD_FLOW_ROLE_LABELS[event.role],
                  reason: event.overrideReason,
                  // The NEWLY added wards this call actually referred to, not the wards asked for and
                  // never a ward already live — an accountability record names what THIS act did.
                  unitIds: [...permitted],
                  ...overrideSignOffField(event),
                },
              ],
        // T12: narrowed to the units actually referred (`permitted`); a held-back unit was never
        // referred.
        genderPlacements:
          genderPlacementAddition === undefined
            ? movement.genderPlacements
            : [
                ...(movement.genderPlacements ?? []),
                {
                  ...genderPlacementAddition,
                  unitIds: genderPlacementAddition.unitIds.filter((unitId) => permitted.includes(unitId)),
                },
              ].filter((record) => record.unitIds.length > 0),
        stage: "destination_review",
        // Restated unconditionally, including on a re-referral: adding a ward can contradict a
        // standing sentence such as `wardRequestWithdrawn`.
        blocker: STAGE_TRANSITION_BLOCKERS.referred,
        // RA1: a re-referral adds wards without a stage transition, so it appends no stage change.
        // The first referral still appends exactly one (`ward-movement-stage-changes.test.ts`).
        stageChanges: isReReferral
          ? movement.stageChanges
          : [
              ...movement.stageChanges,
              { at: event.now, from: movement.stage, to: "destination_review", by: event.role },
            ],
      };
      // `withHeldBack`, not `state` — any ward refused above must survive into the returned state,
      // or the coordinator is told nothing and the referral silently shrank.
      decision.outcome = heldBack.length ? "partial" : "accepted";
      decision.reasonCode = heldBack.length ? "transition" : "none";
      decision.overrideFactRecorded = event.overrideReason !== undefined;
      decision.overCapRecorded = updated.referredUnitIds.length > state.configuration.parallelReferralCap;
      return replaceMovement(withHeldBack, movement.id, updated);
    }

    /**
     * The referrer takes the referral back: a patient who improved, went home or went elsewhere no
     * longer needs a bed.
     *
     * Withdraws every live referral at once, because the referrer is saying the patient needs no
     * bed at all. The reason code is `referrer_withdrew`, never taken from the event: adding
     * `WITHDRAWAL_REASONS` members is a governance decision left to the owner.
     */
    case "WITHDRAW_REFERRAL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Already finished: withdrawing a closed movement would count a referral that was never live
      // at that moment.
      if (movement.closure) {
        return reject(state, event, `movement ${movement.id} has already closed and cannot be withdrawn`);
      }
      // A place claim must match the recorded sender before either closure path can run.
      // A ward transfer's sourceAdmissionId identifies a stay, not the caller who owns it.
      const caller = event as {
        role: WardFlowRole;
        placeId?: string;
        actingPlaceId?: string;
        actingUnitId?: string;
      };
      const callerPlaceId =
        caller.placeId ?? caller.actingPlaceId ?? (caller.role === "ward" ? caller.actingUnitId : undefined);
      const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
      // Verified senders: a transfer from a recorded stay is the sending ward's alone. Otherwise
      // the ED that raised the journey (`originEdId`) owns it, and for a ward-sent referral the
      // sending ward may also withdraw. Community teams may also withdraw.
      const senders: { role: WardFlowRole; placeId: string | undefined }[] =
        movement.sourceAdmissionId !== undefined
          ? [{ role: "ward", placeId: movementSourceAdmission(state, movement)?.unitId }]
          : [
              { role: "ed", placeId: movement.originEdId },
              ...(referral?.source === "psychiatric_ward"
                ? [{ role: "ward" as WardFlowRole, placeId: referral.originUnitId }]
                : []),
              ...(referral?.sendingTeamName !== undefined
                ? [
                    {
                      role: "community" as WardFlowRole,
                      placeId: communityTeamSlug(referral.sendingTeamName),
                    },
                  ]
                : []),
            ];
      const senderPlaceId = senders.find((sender) => sender.role === event.role)?.placeId;
      if (
        event.role !== "coordinator" &&
        (!callerPlaceId ||
          !senders.some(
            (sender) =>
              sender.role === event.role &&
              sender.placeId !== undefined &&
              (sender.placeId === callerPlaceId ||
                (event.role === "community" &&
                  referral?.sendingTeamName !== undefined &&
                  callerPlaceId === referral.sendingTeamName)),
          ))
      ) {
        return reject(
          state,
          event,
          `caller ${callerPlaceId ?? "without a place ID"} is not the referral origin site (${senderPlaceId ?? "not recorded"}) for role ${event.role}; only the referrer or the coordinator may withdraw it`,
        );
      }

      /**
       * WLQ-38 (owner): "This should also be the referring doctors responsibility as well to be
       * able to revoke the transport as well as referral in addition to the coordinator." The
       * referrer (`ed`) or the coordinator may revoke an accepted referral, once, until the patient
       * is collected (then `STOP_TRANSPORT`). Still refused for `community` and `ward`.
       *
       * Runs before the `referredUnitIds.length === 0` guard below: acceptance empties
       * `referredUnitIds`, so that guard would refuse this happy path.
       */
      if (movement.acceptedUnitId) {
        if (event.role !== "coordinator" && event.role !== "ed") {
          return reject(
            state,
            event,
            `movement ${movement.id} has already been accepted by ${movement.acceptedUnitId}; only the referrer or the coordinator may revoke it now`,
          );
        }
        // Once the patient has been physically collected this is a journey under way, not a
        // referral to take back — `STOP_TRANSPORT` is the event for stopping it from here.
        if (movement.transport?.collectedAt !== undefined) {
          return reject(
            state,
            event,
            `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of withdrawing the referral`,
          );
        }

        // Gives back a pulled bed and its admission, or does nothing if none was pulled. Shared
        // with `RELEASE_PULL`.
        const withoutPulledBed = withoutReferralBedHold(
          releasePulledBedAndAdmission(state, movement, event.now),
          movement,
        );
        const revokedByCoordinator = event.role === "coordinator";
        const acceptingUnitId = movement.acceptedUnitId;
        const liveTransport =
          movement.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
        const hadLiveTransport = liveTransport !== undefined;
        const revoked: Movement = {
          ...movement,
          admissionId: undefined,
          // A revoked acceptance holds no ward: cleared here, as RECORD_ED_OUTCOME and
          // REFER_TO_COMMUNITY_TEAM do, so no board reads a closed movement as still going to it.
          acceptedUnitId: undefined,
          heldBedNumber: undefined,
          // A booked-but-uncollected job is cancelled in the same update that closes the movement;
          // `orphanedTransport` assumes no live job outlives a closure.
          transport: liveTransport ? { ...liveTransport, cancelledAt: event.now } : movement.transport,
          closure: {
            at: event.now,
            outcome: "did_not_proceed",
            reason: revokedByCoordinator
              ? "The coordinator revoked the accepted referral"
              : "The referrer revoked the accepted referral",
          },
          // Nothing blocks a movement that is over; this also clears WLQ-4's
          // `examinationRevokedAwaitingRelease`.
          blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
        };
        const next = replaceMovement(withoutPulledBed, movement.id, revoked);
        // Addendum §1.3, extended by WLQ-38: a ward that believed it was getting this patient is
        // told it is not. `acceptingUnitId` was read before this handler's writes.
        let noticeCount = state.notices.length;
        const notices: Notice[] = [
          makeNotice(
            event.now,
            noticeCount++,
            "referral_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            `The referral for ${movement.id} was revoked after being accepted; the patient is no longer coming.`,
          ),
        ];
        if (hadLiveTransport) {
          notices.push(
            makeNotice(
              event.now,
              noticeCount++,
              "transport_cancelled_officer",
              { role: "officer" },
              { movementId: movement.id, unitId: acceptingUnitId },
              `Transport for ${movement.id} was cancelled: referral was revoked by ${revokedByCoordinator ? "coordinator" : "referrer"}.`,
            ),
          );
        }
        return appendNotices(next, notices);
      }

      if (movement.referredUnitIds.length === 0) {
        return reject(state, event, `movement ${movement.id} holds no live referral to withdraw`);
      }

      const liveTransport =
        movement.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
      const hadLiveTransport = liveTransport !== undefined;
      const updated: Movement = {
        ...movement,
        ...withdrawAllLiveRequestsForReferrer(
          movement,
          event.now,
          event.role === "coordinator" ? "coordinator_withdrew" : "referrer_withdrew",
        ),
        transport: liveTransport ? { ...liveTransport, cancelledAt: event.now } : movement.transport,
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason:
            event.role === "coordinator"
              ? "The coordinator withdrew the referral"
              : "The referrer withdrew the referral",
        },
        // Nothing is blocking a movement that is over. Left saying "Awaiting destination response"
        // it would keep a withdrawn patient looking like a live obstruction.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      const next = replaceMovement(state, movement.id, updated);
      let noticeCount = state.notices.length;
      const actorLabel = event.role === "coordinator" ? "coordinator" : "referrer";
      const wardNotices = movement.referredUnitIds.map((unitId) =>
        makeNotice(
          event.now,
          noticeCount++,
          "ward_request_withdrawn",
          { role: "ward", placeId: unitId },
          { movementId: movement.id, unitId },
          `The referral for ${movement.id} was withdrawn by the ${actorLabel}.`,
        ),
      );
      if (hadLiveTransport) {
        wardNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "transport_cancelled_officer",
            { role: "officer" },
            { movementId: movement.id },
            `Transport for ${movement.id} was cancelled: referral was withdrawn by the ${actorLabel}.`,
          ),
        );
      }
      return appendNotices(next, wardNotices);
    }

    case "WITHDRAW_WARD_REQUEST": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot withdraw a ward request for a closed movement (${movement.closure.reason})`,
        );
      }
      // Membership, not truthiness: an accepted, declined or withdrawn unit holds no live referral
      // to take back.
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      if (!WARD_REQUEST_WITHDRAWAL_REASONS.includes(event.reason)) {
        return reject(state, event, `WITHDRAW_WARD_REQUEST reason must be chosen from WARD_REQUEST_WITHDRAWAL_REASONS`);
      }

      const remainingUnitIds = movement.referredUnitIds.filter((unitId) => unitId !== event.unitId);
      const updated: Movement = {
        ...movement,
        referredUnitIds: remainingUnitIds,
        // `reason` says who (a role); `detail` says why, from the coordinator's §2 pick, and is
        // never folded into `reason`.
        withdrawnReferrals: [
          ...movement.withdrawnReferrals,
          { unitId: event.unitId, at: event.now, reason: "coordinator_withdrew", detail: event.reason },
        ],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          { unitId: event.unitId, at: event.now, answer: "withdrawn" },
        ],
        // RA1: only the last live request going changes `blocker`.
        blocker: remainingUnitIds.length === 0 ? STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn : movement.blocker,
      };
      const next = replaceMovement(state, movement.id, updated);
      // Addendum §1.3, extended by RA1: the one ward named is told it is no longer being asked.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "ward_request_withdrawn",
          { role: "ward", placeId: event.unitId },
          { movementId: movement.id, unitId: event.unitId },
          `The request for ${movement.id} was withdrawn: ${wardRequestWithdrawalReasonLabels[event.reason]}.`,
        ),
      ]);
    }

    /**
     * RB7 (item 27): appends an attributed, timestamped note to `referral.corrections` and never
     * assigns `history:` (`tests/ward-referral-history-immutable.test.ts` checks this). No
     * referral-state precondition: a correction is a note on top of whatever has happened.
     */
    case "ADD_REFERRAL_CORRECTION": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      if (event.role === "ed" && event.actingPlaceId !== undefined) {
        const referrer = referralReferrer(referral);
        const originEdId = referrer?.role === "ed" ? referrer.placeId : undefined;
        if (originEdId === undefined || event.actingPlaceId !== originEdId) {
          return reject(
            state,
            event,
            `caller ED ${event.actingPlaceId} is not the referral origin ED (${originEdId ?? referral.originSiteCode ?? "unknown"}); only origin ED or coordinator may add corrections`,
          );
        }
      }
      // D-80: a ward corrects only what a ward sent, never a referral it is answering.
      if (event.role === "ward" && referral.source !== "psychiatric_ward") {
        return reject(state, event, `only the desk that sent referral ${referral.id} may add corrections`);
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
            `caller community team ${event.actingPlaceId} is not the referral origin team (${referral.sendingTeamName}); only origin team or coordinator may add corrections`,
          );
        }
      }
      // Trimmed for the blank check, the same discipline `RECORD_MOVEMENT_BLOCKER` already holds a
      // typed, must-say-something field to — a whitespace-only note is not a correction.
      const note = event.note.trim();
      if (note.length === 0) {
        return reject(state, event, `ADD_REFERRAL_CORRECTION note must say something — a blank is not a correction`);
      }
      // ⚠️ Refused, never shortened — the same rule `history` and `sendingTeamName` are held to on
      // `RECEIVE_REFERRAL` above: a truncated correction silently drops whatever was typed last.
      if (note.length > REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS) {
        return reject(
          state,
          event,
          `ADD_REFERRAL_CORRECTION note is ${note.length} characters and the limit is ${REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS} — it is refused rather than shortened`,
        );
      }
      const correction: ReferralCorrection = { at: event.now, by: event.role, note };
      const corrected: Referral = {
        ...referral,
        corrections: [...(referral.corrections ?? []), correction],
      };
      return replaceReferral(state, referral.id, corrected);
    }

    case "CHANGE_URGENCY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // D-80: a ward or team acts here only on a journey its kind of desk sent (scope is the server's).
      if (!journeySentByKind(state.referrals, movement, event.role)) {
        return reject(state, event, `only the desk that sent movement ${movement.id} may change its urgency`);
      }
      if (movement.closure) {
        return reject(state, event, `cannot change urgency for a closed movement (${movement.closure.reason})`);
      }
      if (!URGENCY_LEVELS.includes(event.urgency as (typeof URGENCY_LEVELS)[number])) {
        return reject(state, event, `CHANGE_URGENCY urgency must be chosen from URGENCY_LEVELS`);
      }
      if (event.reason !== undefined && !URGENCY_CHANGE_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved. `changeReasonLabels` has no fallback, so an off-list value would
         * render "undefined". Finding 15 (Josh, 27 Oct 2026): a reason is no longer required, and
         * none is recorded as `not_given`.
         */
        return reject(state, event, `CHANGE_URGENCY reason must be chosen from URGENCY_CHANGE_REASONS`);
      }
      // Nothing auto-allocates: this records who changed the tier, when and why, and never
      // re-sorts, re-suggests or re-refers (Global Constraint 3, spec D2).
      const updated: Movement = {
        ...movement,
        urgency: event.urgency,
        urgencyChanges: [
          ...movement.urgencyChanges,
          {
            at: event.now,
            from: movement.urgency,
            to: event.urgency,
            by: event.role,
            reason: event.reason ?? URGENCY_REASON_NOT_GIVEN,
          },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "CHANGE_LEGAL_STATUS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // D-80: a ward or team acts here only on a journey its kind of desk sent (scope is the server's).
      if (!journeySentByKind(state.referrals, movement, event.role)) {
        return reject(state, event, `only the desk that sent movement ${movement.id} may change its legal status`);
      }
      if (movement.closure) {
        return reject(state, event, `cannot change legal status for a closed movement (${movement.closure.reason})`);
      }
      if (!LEGAL_STATUS_CHANGE_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved. This records why a Mental Health Act status changed, so an off-list
         * reason must never reach the legal-and-forms panel.
         */
        return reject(state, event, `CHANGE_LEGAL_STATUS reason must be chosen from LEGAL_STATUS_CHANGE_REASONS`);
      }
      // A legal status change can make an accepted destination unlawful;
      // `destinationNoLongerLawful` surfaces that for a human. This handler only records the
      // change.
      const updated: Movement = {
        ...movement,
        legalStatus: event.legalStatus,
        statusChanges: [
          ...movement.statusChanges,
          { at: event.now, from: movement.legalStatus, to: event.legalStatus, by: event.role, reason: event.reason },
        ],
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }
  }
}
