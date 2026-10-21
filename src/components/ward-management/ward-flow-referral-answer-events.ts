import { closedToAdmissionsRefusal } from "./capacity/ward-closure";
import { referralIntakeError } from "./referrals/referral-submission";
import { type AuditDecision } from "./ward-audit";
import { GENDER_PLACEMENT_REASONS, GENDER_PLACEMENT_REFUSAL } from "@/components/ward-management/ward-change-reasons";
import { type Instant } from "@/components/ward-management/ward-clock";
import { isTentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import {
  WARD_FLOW_ROLE_LABELS,
  type WardFlowEvent,
  type WardFlowRole,
} from "@/components/ward-management/ward-flow-events";
import {
  GENDER_MISMATCH_DECLINE_REASON,
  WAITLIST_INSTEAD_OF_DECLINE_REASONS,
} from "@/components/ward-management/ward-legal-clock";
import {
  COHORTS,
  COMMUNITY_DECLINE_REASONS,
  DECLINE_REASONS,
  ED_DECLINE_REASONS,
  HOME_REGIONS,
  RECORDED_SEXES,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_DESTINATION_KINDS,
  REFERRAL_GENDERS,
  REFERRAL_HISTORY_LIMITS,
  REFERRAL_PURPOSES,
  REFERRAL_SOURCES,
  SENDING_TEAM_NAME_LIMIT,
  STEP_BACK_REASONS,
  genderReviewNeeded,
  type ClinicalReassessmentEntry,
  type CommunityDeclineReason,
  type Movement,
  type Notice,
  type Referral,
  type ReferralAddressing,
  type ReferralDeclineReason,
  type ReferralDestinationKind,
  type ReferralHistoryField,
} from "@/components/ward-management/ward-model";
import {
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  referralState,
  referralSuburbIsAnswered,
  wardTransferNeedsCoordinator,
} from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import type { ReferralAnswerEventHelpers, WardFlowState } from "./ward-flow-reducer";

/**
 * A ward's answer to a referral: receiving, accepting, declining and withdrawing acceptance.
 * `reduceClinicalEvent`'s cases for these events, moved here unchanged. The reducer passes its
 * helpers in, since this file may not import the reducer at run time.
 */
export type ReferralAnswerEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "ACCEPT_IN_PRINCIPLE"
      | "DECLINE"
      | "RECEIVE_REFERRAL"
      | "ACCEPT_REFERRAL"
      | "DECLINE_REFERRAL"
      | "WITHDRAW_ACCEPTANCE";
  }
>;

export function reduceReferralAnswerEvent(
  state: WardFlowState,
  event: ReferralAnswerEvent,
  decision: AuditDecision,
  helpers: ReferralAnswerEventHelpers,
): WardFlowState {
  const {
    STAGE_TRANSITION_BLOCKERS,
    appendNotices,
    bedNumberRefusal,
    eligibilityRefusal,
    findMovement,
    findReferral,
    findUnit,
    heldBedRefusal,
    makeNotice,
    nextFrontDoorReferralId,
    overrideSignOffField,
    referralAcceptanceRefusal,
    referralReferrer,
    reject,
    releasePulledBedAndAdmission,
    replaceMovement,
    replaceReferral,
    unitName,
    wardActingMovementRefusal,
    wardActingUnitRefusal,
    withoutReferralBedHold,
  } = helpers;
  switch (event.type) {
    case "ACCEPT_IN_PRINCIPLE": {
      const actingRefusal = wardActingMovementRefusal(event);
      if (actingRefusal) return reject(state, event, actingRefusal);
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept a closed movement (${movement.closure.reason})`);
      }
      if (movement.acceptedUnitId) {
        const already = findUnit(state, movement.acceptedUnitId);
        const attemptedUnit = findUnit(state, event.unitId);
        return reject(
          state,
          event,
          `movement ${movement.id} is already accepted at ${already?.name ?? movement.acceptedUnitId}; the referral to ${attemptedUnit?.name ?? event.unitId} was withdrawn`,
        );
      }
      if (movement.stage !== "destination_review") {
        return reject(
          state,
          event,
          `cannot accept a movement at its current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      const acceptedUnit = findUnit(state, event.unitId);
      if (!acceptedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
      const closedRefusal = closedToAdmissionsRefusal(acceptedUnit);
      if (closedRefusal) return reject(state, event, closedRefusal);

      // T12: `ACCEPT_IN_PRINCIPLE` never writes a gender-placement record (only `REFER_TO_UNITS`
      // does); it refuses when nothing on the movement names this unit. See `GenderPlacement`
      // (`ward-model.ts`).
      if (
        genderReviewNeeded(movement.gender, movement.sex) &&
        !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(event.unitId))
      ) {
        return reject(state, event, GENDER_PLACEMENT_REFUSAL);
      }

      /**
       * The eligibility gate on the ward's yes to a bed, the closest thing to a placement on the
       * movement path. See `eligibilityRefusal` for the contract.
       */
      const acceptRefusal = eligibilityRefusal(event, movement, acceptedUnit, event.now);
      if (acceptRefusal) return reject(state, event, acceptRefusal);
      // v10 pass 3: the Bed board names a bed as it accepts; a taken or held bed is refused.
      if (event.bedNumber !== undefined) {
        const bedRefusal =
          bedNumberRefusal(state, acceptedUnit, event.bedNumber, undefined) ??
          heldBedRefusal(state, acceptedUnit, event.bedNumber, movement.id);
        if (bedRefusal) return reject(state, event, bedRefusal);
      }
      // An override is filed only when it is new: a gate genuinely fails for this unit and no
      // override already on the movement covers it (tests/ward-audit.test.ts).
      const overrideApplied =
        event.overrideReason !== undefined &&
        !eligibility(movement, acceptedUnit, event.now).eligible &&
        !movement.overrides.some((override) => override.unitIds.includes(event.unitId));

      const withdrawn = movement.referredUnitIds
        .filter((unitId) => unitId !== event.unitId)
        .map((unitId) => ({
          unitId,
          at: event.now,
          // FD-23: a code, never a sentence. The losing ward must not read the winner's name, and
          // "placed" would assert a transfer that has not happened. The coordinator reads
          // `acceptedUnitId` for the destination.
          reason: "another_unit_accepted" as const,
        }));

      const updated: Movement = {
        ...movement,
        acceptedUnitId: event.unitId,
        heldBedNumber: event.bedNumber,
        waitlistedUnitIds: undefined,
        // OD-3 (2026-09-02): an overridden acceptance is made accountable, never impossible — the
        // reason that bought the gate past is recorded, exactly as REFER_TO_UNITS records its own.
        overrides:
          overrideApplied && event.overrideReason !== undefined
            ? [
                ...movement.overrides,
                {
                  at: event.now,
                  by: WARD_FLOW_ROLE_LABELS[event.role],
                  reason: event.overrideReason,
                  unitIds: [event.unitId],
                  ...overrideSignOffField(event),
                },
              ]
            : movement.overrides,
        // The instant this acceptance happened. See `Movement.acceptedAt`.
        acceptedAt: event.now,
        stage: "accepted_awaiting_bed",
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawn],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          ...withdrawn.map((referral) => ({ ...referral, answer: "withdrawn" as const })),
        ],
        // A response arrived; what is outstanding is the bed. Richer prose is a ward's own
        // observation.
        blocker: STAGE_TRANSITION_BLOCKERS.accepted,
        // `acceptedAt` and this entry are written together and must agree (see `StageChange`).
        // RELEASE_PULL later adds a second entry without touching `acceptedAt`.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "accepted_awaiting_bed", by: event.role },
        ],
      };
      const next = replaceMovement(state, movement.id, updated);
      // Addendum §1.3: the referring emergency department is told a ward has said yes in principle.
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      decision.overrideFactRecorded = overrideApplied;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "accepted_in_principle",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: event.unitId },
          `${acceptedUnit.name} has accepted ${movement.id} in principle.`,
        ),
      ]);
    }

    case "DECLINE": {
      const actingRefusal = wardActingMovementRefusal(event);
      if (actingRefusal) return reject(state, event, actingRefusal);
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot decline for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "destination_review") {
        return reject(
          state,
          event,
          `cannot decline at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      if (event.reason === GENDER_MISMATCH_DECLINE_REASON || (event.reason as string) === "sex_mix") {
        return reject(
          state,
          event,
          `Gender mismatch does not decline a referral; it only filters which bed can be offered`,
        );
      }
      if ((WAITLIST_INSTEAD_OF_DECLINE_REASONS as readonly string[]).includes(event.reason)) {
        const waitlistedUnitIds = [...(movement.waitlistedUnitIds ?? [])];
        if (!waitlistedUnitIds.includes(event.unitId)) {
          if (waitlistedUnitIds.length >= state.configuration.parallelReferralCap) {
            return reject(
              state,
              event,
              `movement ${movement.id} is already waitlisted at ${state.configuration.parallelReferralCap} wards; release one before waitlisting another`,
            );
          }
          waitlistedUnitIds.push(event.unitId);
        }
        const updated: Movement = {
          ...movement,
          waitlistedUnitIds,
          declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }],
          referralAnswerHistory: [
            ...(movement.referralAnswerHistory ?? []),
            { unitId: event.unitId, at: event.now, answer: "waitlisted" },
          ],
        };
        const next = replaceMovement(state, movement.id, updated);
        return appendNotices(next, [
          makeNotice(
            event.now,
            state.notices.length,
            "referral_waitlisted",
            { role: "ed", placeId: movement.originEdId },
            { movementId: movement.id, unitId: event.unitId },
            `${unitName(state, event.unitId)} waitlisted ${movement.id} (no bed yet).`,
          ),
        ]);
      }
      if (!DECLINE_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved.
         *
         * `DECLINE_REASONS`, not `REFERRAL_DECLINE_REASONS`: `DECLINE` refuses a movement,
         * `DECLINE_REFERRAL` a referral, and swapping the lists would look like a working check.
         * `tests/ward-reason-checks-use-their-own-list.test.ts` guards the pairing. The timeline
         * reads `declineReasonLabels[...]` with no fallback, so an off-list value would print
         * "undefined".
         */
        return reject(state, event, `DECLINE reason must be chosen from DECLINE_REASONS`);
      }
      const remainingReferredUnitIds = movement.referredUnitIds.filter((unitId) => unitId !== event.unitId);
      const updated: Movement = {
        ...movement,
        referredUnitIds: remainingReferredUnitIds,
        declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }],
        stage: "destination_review",
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          { unitId: event.unitId, at: event.now, answer: "declined" },
        ],
        // Ruling 4: a decline leaves the stage unchanged and is labelled a Decline, never a
        // step-back. This entry exists for the floor that every stage-assigning case appends
        // exactly one entry.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "destination_review", by: event.role, reason: event.reason },
        ],
        // "Awaiting destination response" is only true while a live request stands; declining the
        // last one switches to `wardRequestWithdrawn`, as `WITHDRAW_WARD_REQUEST` does.
        blocker:
          remainingReferredUnitIds.length === 0 && !movement.acceptedUnitId
            ? STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn
            : movement.blocker,
      };
      const next = replaceMovement(state, movement.id, updated);
      // Addendum §1.3: the referring emergency department is told this unit said no. Shares
      // `NoticeKind` "referral_declined" with `DECLINE_REFERRAL`.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "referral_declined",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: event.unitId },
          `${unitName(state, event.unitId)} declined ${movement.id} (${event.reason.replace(/_/g, " ")}).`,
        ),
      ]);
    }

    case "RECEIVE_REFERRAL": {
      if (
        event.submissionId !== undefined &&
        (typeof event.submissionId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.submissionId) ||
          state.referrals.some((referral) => referral.submissionId === event.submissionId))
      ) {
        return reject(state, event, "RECEIVE_REFERRAL submission id must be a unique opaque UUID");
      }
      if (event.atsCategory !== undefined && ![1, 2, 3, 4, 5].includes(event.atsCategory))
        return reject(state, event, "RECEIVE_REFERRAL ATS category must be a recorded integer from 1 to 5.");
      // Spec failure behaviour: "a referral missing a required field, or carrying an unknown source
      // … → refused with a visible `Rejection`. Never silently queued, never defaulted." Every
      // check below is a membership check or a resolution against the real site list, and each
      // names what was wrong.
      if (!COHORTS.includes(event.ageBand)) {
        return reject(state, event, `RECEIVE_REFERRAL ageBand must be chosen from COHORTS`);
      }
      // `sex` is membership-checked on the ward arm (review finding M1): an off-list value would
      // otherwise match almost nothing with plausible-looking reasons.
      //
      // FD-21: one act, several destinations, up to the cap. Each refusal names a different way the
      // list can be wrong.
      if (event.destinations.length === 0) {
        return reject(state, event, `RECEIVE_REFERRAL needs at least one destination`);
      }
      if (event.destinations.length > state.configuration.parallelReferralCap) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL may address at most ${state.configuration.parallelReferralCap} destinations, not ${event.destinations.length}`,
        );
      }
      const kinds = event.destinations.map((destination) => destination.kind);
      const recipientKeys = event.destinations.map((destination) =>
        destination.kind === "psychiatric_ward" && destination.unitId
          ? `${destination.kind}:${destination.unitId}`
          : destination.kind,
      );
      const broadWard = event.destinations.some(
        (destination) => destination.kind === "psychiatric_ward" && !destination.unitId,
      );
      if (
        new Set(recipientKeys).size !== recipientKeys.length ||
        (broadWard && kinds.filter((kind) => kind === "psychiatric_ward").length > 1)
      ) {
        // Asking one kind twice is refused rather than de-duplicated, so the cap counts what the
        // referrer chose.
        return reject(state, event, `RECEIVE_REFERRAL cannot address the same destination kind twice`);
      }
      if (kinds.some((kind) => !REFERRAL_DESTINATION_KINDS.includes(kind))) {
        return reject(state, event, `RECEIVE_REFERRAL destination kind must be chosen from REFERRAL_DESTINATION_KINDS`);
      }
      /**
       * The ED arm's `edId` resolves against the real network, as `originSiteCode` does:
       * non-emptiness is not the check, since `"not-a-department"` survives every truthiness test
       * and would queue a real person at a hospital that does not exist. Every path goes through
       * here, so this is the last line, not a screen guard.
       */
      const edDestination = event.destinations.find((destination) => destination.kind === "emergency_department");
      if (edDestination?.kind === "emergency_department") {
        if (!allEmergencyDepartments().some((department) => department.id === edDestination.edId)) {
          return reject(state, event, `RECEIVE_REFERRAL edId must resolve to a real emergency department`);
        }
        if (!REFERRAL_PURPOSES.includes(edDestination.purpose)) {
          return reject(state, event, `RECEIVE_REFERRAL purpose must be chosen from REFERRAL_PURPOSES`);
        }
      }
      for (const wardDestination of event.destinations) {
        if (wardDestination.kind !== "psychiatric_ward") continue;
        const namedWard = wardDestination.unitId === undefined ? undefined : findUnit(state, wardDestination.unitId);
        if (wardDestination.unitId !== undefined && !namedWard) {
          return reject(state, event, "RECEIVE_REFERRAL unitId must resolve to a real ward");
        }
        const closedRefusal = namedWard ? closedToAdmissionsRefusal(namedWard) : null;
        if (closedRefusal) return reject(state, event, closedRefusal);
        if (!RECORDED_SEXES.includes(wardDestination.sex))
          return reject(state, event, "RECEIVE_REFERRAL sex must be chosen from RECORDED_SEXES");
        if (wardDestination.gender !== undefined && !REFERRAL_GENDERS.includes(wardDestination.gender))
          return reject(state, event, "RECEIVE_REFERRAL gender must be chosen from REFERRAL_GENDERS");
        if (
          [
            wardDestination.secureBedNeeded,
            wardDestination.involuntaryBedNeeded,
            // Legacy broad referrals omitted acuity; named recipients must answer explicitly.
            wardDestination.highAcuityNursingNeeded ?? (wardDestination.unitId === undefined ? false : undefined),
          ].some((value) => typeof value !== "boolean")
        )
          return reject(state, event, "RECEIVE_REFERRAL bed criteria must be answered");
      }
      if (event.intake !== undefined) {
        const error = referralIntakeError(event.intake);
        if (error) return reject(state, event, `RECEIVE_REFERRAL: ${error}`);
      }
      if (!REFERRAL_SOURCES.includes(event.source)) {
        return reject(state, event, `RECEIVE_REFERRAL source must be chosen from REFERRAL_SOURCES`);
      }
      // R9 (owner item 23): "only `ed_medical` is raised as `ed`, and `ed` with any other source is
      // refused. Everything else, including GP, stays `community`." Role `community` with source
      // `ed_medical` stays open (`tests/ward-ed-to-community-referral.test.ts`). Checked before the
      // `originUnitId` check so the pairing is reported first.
      if (event.role === "ed" && event.source !== "ed_medical") {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL raised as role ed must carry source ed_medical, not ${event.source}`,
        );
      }
      // Role access plan (15 Oct 2026): a ward raises a referral in its own name only as the
      // sending ward. Any other source would file it under someone else.
      if (event.role === "ward" && event.source !== "psychiatric_ward") {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL raised as role ward must carry source psychiatric_ward, not ${event.source}`,
        );
      }
      if (event.source === "psychiatric_ward") {
        if (!event.originUnitId || !findUnit(state, event.originUnitId)) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL source psychiatric_ward must name a real originUnitId (the sending ward)`,
          );
        }
      }
      // A ward names itself with `actingUnitId`, and may only send from that ward, as it answers
      // only its own movements (`wardActingUnitError`). Otherwise ward A could file a referral as B.
      if (event.role === "ward" && event.actingUnitId !== event.originUnitId) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL raised as role ward must send from its own ward: acting as ${event.actingUnitId ?? "no named ward"}, origin ${event.originUnitId}`,
        );
      }
      // `homeRegion` is a region from a fixed list, never an address or free text; see
      // `HOME_REGIONS`.
      if (!HOME_REGIONS.includes(event.homeRegion)) {
        return reject(state, event, `RECEIVE_REFERRAL homeRegion must be chosen from HOME_REGIONS`);
      }
      // The suburb is resolved against the real catchment table, never merely checked for
      // non-emptiness: a street address must not reach the one field whose defence is that it is
      // coarser (`PD-3`).
      if (!referralSuburbIsAnswered(event.suburb)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL suburb must name a suburb the catchment source knows, or state that it is not known`,
        );
      }
      if (event.urgency !== 1 && event.urgency !== 2 && event.urgency !== 3) {
        return reject(state, event, `RECEIVE_REFERRAL urgency must be 1, 2 or 3`);
      }
      // A synthetic site code, never an address — resolved against the real network rather than
      // merely checked for non-emptiness, so "12 Wellington St, Perth" cannot pass as a code.
      const originSite = siteByCode(event.originSiteCode);
      if (!originSite) {
        return reject(state, event, `RECEIVE_REFERRAL originSiteCode must resolve to a real site`);
      }
      /**
       * A referral from ED medical staff must come from a hospital that has an ED. Each field was
       * valid alone; only their combination is impossible, and no screen could catch it. Reads the
       * site's own record in `wardSites`, never a hand-written list of codes
       * (`docs/ward-flow-changeable-data-rule.md`).
       */
      if (event.source === "ed_medical" && !originSite.emergencyDepartment) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL source ed_medical requires an origin site with an emergency department`,
        );
      }
      // A future triage instant is refused: `referralClocks` clamps at zero, so it would render as
      // a plausible "0m".
      if (event.triagedAt !== undefined && event.triagedAt > event.now) {
        return reject(state, event, `RECEIVE_REFERRAL triagedAt cannot be later than the referral itself`);
      }
      /**
       * Three states: absent (a referral raised with nobody on file, legitimate), present and real,
       * and present but naming nobody, which is refused. Same shape as `RAISE_REFERRAL`'s
       * `referralId` lookup. Do not drop the presence check, or every referral with no person on
       * file would be refused.
       */
      if (event.patientId !== undefined && !state.patients.some((patient) => patient.id === event.patientId)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL patientId must name a patient this system already holds, and ${event.patientId} names none`,
        );
      }
      /**
       * The written history, the only field here that cannot be membership-checked. Only two things
       * are enforced: it is a string, and it does not exceed `REFERRAL_HISTORY_LIMITS`.
       *
       * A blank story is a complete answer (owner ruling: one story box, optional). An over-length
       * value is refused, never truncated: truncation silently drops the end of a risk note.
       * Nothing else is inspected; reading meaning out of this field would be clinical decision
       * support (see `Referral.history`).
       *
       * The shape check comes first: a thrown TypeError on an omitted field presents as a button
       * that did nothing, while a refusal is a `Rejection` a clinician can read.
       */
      for (const field of Object.keys(REFERRAL_HISTORY_LIMITS) as ReferralHistoryField[]) {
        if (typeof event[field] !== "string") {
          return reject(state, event, `RECEIVE_REFERRAL ${field} must be text, even when it is empty text`);
        }
      }
      for (const [field, limit] of Object.entries(REFERRAL_HISTORY_LIMITS) as [ReferralHistoryField, number][]) {
        if (event[field].length > limit) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL ${field} is ${event[field].length} characters and the limit is ${limit} — it is refused rather than shortened`,
          );
        }
      }
      /**
       * The sending team's name. A blank-but-present value is refused rather than normalised to
       * `undefined`, and an over-length value is refused rather than shortened: a truncated name is
       * a different team's name.
       */
      if (event.sendingTeamName !== undefined) {
        if (event.sendingTeamName.trim() === "") {
          return reject(
            state,
            event,
            "RECEIVE_REFERRAL sendingTeamName is present but blank — omit the field to record no " +
              "sending team, rather than sending an empty one",
          );
        }
        if (event.sendingTeamName.length > SENDING_TEAM_NAME_LIMIT) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL sendingTeamName is ${event.sendingTeamName.length} characters and the ` +
              `limit is ${SENDING_TEAM_NAME_LIMIT} — it is refused rather than shortened, because a ` +
              `truncated team name is a different team's name`,
          );
        }
      }
      // T15 (item 12): membership-checked when supplied; absent means nobody has recorded one.
      if (event.tentativeDiagnosis !== undefined && !isTentativeDiagnosisBlock(event.tentativeDiagnosis)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL tentativeDiagnosis must be chosen from TENTATIVE_DIAGNOSIS_BLOCKS`,
        );
      }
      const sequence = state.frontDoorReferralSequence + 1;
      const created: Referral = {
        id: nextFrontDoorReferralId(sequence),
        ...(event.intake === undefined ? {} : { intake: event.intake }),
        ...(event.submissionId === undefined ? {} : { submissionId: event.submissionId }),
        // Copied through, never defaulted: `undefined` means no person on file, and inventing an id
        // is how a referral points at the wrong human being.
        patientId: event.patientId,
        ageBand: event.ageBand,
        // Every destination starts queued: the referrer chose them, nobody has answered yet.
        // Each addressing records its own referral moment (the silence reminder reads it per ward).
        destinations: event.destinations.map((destination) => ({
          destination,
          state: "queued" as const,
          referredAt: event.now,
        })),
        homeRegion: event.homeRegion,
        suburb: event.suburb,
        source: event.source,
        originUnitId: event.source === "psychiatric_ward" ? event.originUnitId : undefined,
        // Copied through, never defaulted: `undefined` means no sending team was recorded, which
        // is a real answer for a crisis service or ambulance referral and not a gap to be filled.
        sendingTeamName: event.sendingTeamName,
        raisedAt: event.now,
        // Absent for a community expect, which is a real state and not a missing value.
        triagedAt: event.triagedAt,
        urgency: event.urgency,
        ...(event.atsCategory === undefined ? {} : { atsCategory: event.atsCategory }),
        originSiteCode: event.originSiteCode,
        transportNeeded: event.transportNeeded,
        // Byte for byte, untrimmed: the blank check trims only to decide; what the referrer wrote
        // is kept as written.
        history: event.history,
        // T15 (item 12): absent means nobody has recorded one — never defaulted, never derived
        // from anything else on the referral.
        tentativeDiagnosis: event.tentativeDiagnosis,
      };
      return { ...state, referrals: [...state.referrals, created], frontDoorReferralSequence: sequence };
    }

    case "ACCEPT_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /**
       * The role must match the destination it is answering (the narrowing half of `FD-3`). `ed`
       * may answer a referral addressed to it, so no ED decision is ever recorded under a false
       * `decidedBy`, but a role answers its own kind and nothing else. The coordinator is exempt
       * (`CO-D2`): it sees the whole picture.
       *
       * A total record over `WardFlowRole`, never `Partial`, so a new role without an entry is a
       * compile error rather than a silent bypass. `officer` and `demo` are `"any"` only because
       * `EVENT_ROLE` stops them reaching this line; widening `EVENT_ROLE` is a separate decision.
       */
      const answerableBy: Record<WardFlowRole, ReferralDestinationKind | "any"> = {
        ward: "psychiatric_ward",
        ed: "emergency_department",
        coordinator: "any",
        officer: "any",
        demo: "any",
        /**
         * `community_team`, not `"any"` (owner ruling): `EVENT_ROLE.DECLINE_REFERRAL` permits
         * `community`, and `"any"` would let a community team decline a ward's bed. Set in both the
         * accept and decline handlers so a future widening is already correct.
         */
        community: "community_team",
        bed_manager: "any",
        executive: "any",
      };
      const ownKind = answerableBy[event.role];
      if (ownKind !== "any" && ownKind !== event.destinationKind) {
        return reject(
          state,
          event,
          `${event.type} was raised by role ${event.role}, which may only answer ${ownKind.replace(/_/g, " ")} destinations, not ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      if (
        event.role === "ward" &&
        event.destinationKind === "psychiatric_ward" &&
        event.unitId !== undefined &&
        wardTransferNeedsCoordinator(referral, event.unitId, state.units)
      ) {
        return reject(
          state,
          event,
          `D-30: a transfer from a ward at another hospital is accepted by the central bed coordinator, not the receiving ward`,
        );
      }
      const eligibleAddressings = referral.destinations.filter(
        (candidate) => candidate.destination.kind === event.destinationKind,
      );
      const addressing = eligibleAddressings.find(
        (candidate) =>
          candidate.destination.kind !== "psychiatric_ward" ||
          candidate.destination.unitId === undefined ||
          candidate.destination.unitId === event.unitId,
      );
      if (
        event.destinationKind === "psychiatric_ward" &&
        eligibleAddressings.length > 1 &&
        event.unitId === undefined
      ) {
        return reject(state, event, "Name the ward that is answering this referral.");
      }
      if (!addressing) {
        return reject(
          state,
          event,
          `referral ${referral.id} was not addressed to ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const actingRefusal = wardActingUnitRefusal(event, addressing);
      if (actingRefusal) return reject(state, event, actingRefusal);
      // FD-22: the first acceptance ends the placement; a second is refused rather than recorded,
      // so two places never believe they have taken the same person.
      //
      // RB5 (item 16): not for a community arm, which never competes for the placement and stays
      // answerable after a ward or ED says yes.
      const hasClinicalReassessment =
        event.reassessment === true ||
        event.clinicalUpdate === true ||
        event.clearanceUpdated === true ||
        (typeof event.reassessmentNote === "string" && event.reassessmentNote.trim().length > 0);
      const reassessmentEntry: ClinicalReassessmentEntry | undefined = hasClinicalReassessment
        ? {
            at: event.now,
            by: event.role,
            ...(typeof event.reassessmentNote === "string" && event.reassessmentNote.trim().length > 0
              ? { note: event.reassessmentNote.trim() }
              : {}),
            ...(event.clinicalUpdate !== undefined ? { clinicalUpdate: event.clinicalUpdate } : {}),
            ...(event.clearanceUpdated !== undefined ? { clearanceUpdated: event.clearanceUpdated } : {}),
          }
        : undefined;
      if (
        event.destinationKind !== "community_team" &&
        referralState(referral) === "accepted" &&
        !(hasClinicalReassessment && addressing.state === "accepted")
      ) {
        return reject(state, event, `referral ${referral.id} has already been accepted elsewhere`);
      }
      // Per-destination, not per-referral: another destination having declined leaves this one
      // free to answer (FD-24). Only THIS destination being already decided is a refusal, unless
      // a clinical reassessment or updated clearance is being recorded. Turning a decline into an
      // acceptance needs the explicit reassessment flag: a note or update alone never reverses it.
      if (
        addressing.state !== "queued" &&
        !(
          (hasClinicalReassessment && addressing.state === "accepted") ||
          (event.reassessment === true && addressing.state === "declined")
        )
      ) {
        return reject(
          state,
          event,
          `${event.destinationKind.replace(/_/g, " ")} has already answered referral ${referral.id} (${addressing.state})`,
        );
      }
      /**
       * `RECORD_REFERRER_WITHDRAWAL` stamps `withdrawnAt`, never `state` (O-17.11), so the guard
       * above cannot see a withdrawal. A separate guard, because they are two different facts.
       */
      if (addressing.withdrawnAt !== undefined) {
        return reject(
          state,
          event,
          `referral ${referral.id} was withdrawn by its referrer, so ${event.destinationKind.replace(/_/g, " ")} cannot accept it`,
        );
      }

      // History starts at the first recorded reassessment; an older loose note is never given an
      // invented author or time.
      const appendReassessment = (
        existing: ReadonlyArray<ClinicalReassessmentEntry> | undefined,
      ): ReadonlyArray<ClinicalReassessmentEntry> | undefined =>
        reassessmentEntry === undefined ? existing : [...(existing ?? []), reassessmentEntry];
      const nextAddressingReassessmentHistory = appendReassessment(addressing.reassessmentHistory);
      const nextReferralHistory = appendReassessment(referral.reassessmentHistory);
      const latestNotePatch =
        reassessmentEntry?.note !== undefined
          ? { reassessmentNote: reassessmentEntry.note }
          : addressing.reassessmentNote !== undefined
            ? { reassessmentNote: addressing.reassessmentNote }
            : {};
      const historyPatch =
        nextAddressingReassessmentHistory === undefined
          ? {}
          : { reassessmentHistory: nextAddressingReassessmentHistory };

      if (hasClinicalReassessment && addressing.state === "accepted" && reassessmentEntry !== undefined) {
        const updatedAddressing: ReferralAddressing = { ...addressing, ...historyPatch, ...latestNotePatch };
        const updatedDestinations = referral.destinations.map((c) => (c === addressing ? updatedAddressing : c));
        let nextState = replaceReferral(state, referral.id, {
          ...referral,
          destinations: updatedDestinations,
          ...(nextReferralHistory === undefined ? {} : { reassessmentHistory: nextReferralHistory }),
          ...(reassessmentEntry.note !== undefined ? { reassessmentNote: reassessmentEntry.note } : {}),
        });
        // Only the ED answer that raised the journey belongs in its history. A community answer on
        // the same referral is a separate destination and stays on the referral alone.
        const reassessedEdId =
          addressing.destination.kind === "emergency_department" ? addressing.destination.edId : null;
        const linkedMovement =
          reassessedEdId === null
            ? undefined
            : nextState.movements.find(
                (m) => m.referralId === referral.id && m.originEdId === reassessedEdId && !m.closure,
              );
        if (linkedMovement) {
          nextState = replaceMovement(nextState, linkedMovement.id, {
            ...linkedMovement,
            reassessmentHistory: [...(linkedMovement.reassessmentHistory ?? []), reassessmentEntry],
          });
        }
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        return nextState;
      }

      let accepted: ReferralAddressing;
      // T12 (item 9): set only inside the ward branch below, when this acceptance is the FIRST
      // thing to clear a `Non-binary` referral for this specific unit.
      let genderPlacementAddition:
        | {
            at: Instant;
            by: WardFlowRole;
            unitIds: string[];
            reason: (typeof GENDER_PLACEMENT_REASONS)[number];
            wardChecked: true;
          }
        | undefined;
      if (addressing.destination.kind === "psychiatric_ward") {
        /**
         * P2-6 (Ward Lead audit): a ward must not accept this referral into a bed while a movement
         * raised from its ED arm is still under way for the same patient. `isOpen` is inlined to
         * avoid a circular import, as in `RAISE_REFERRAL`.
         */
        const openLinkedMovement = state.movements.find(
          (movement) => movement.referralId === referral.id && !movement.closure && movement.stage !== "arrived",
        );
        if (openLinkedMovement) {
          return reject(
            state,
            event,
            `referral ${referral.id} already has an open movement (${openLinkedMovement.id}); it cannot also be accepted into a ward while that movement is open`,
          );
        }
        // Only a ward acceptance names a unit, and only a ward acceptance runs the bed gates.
        if (!event.unitId) {
          return reject(state, event, `ACCEPT_REFERRAL into a psychiatric ward must name a unit`);
        }
        const unit = findUnit(state, event.unitId);
        if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
        const closedRefusal = closedToAdmissionsRefusal(unit);
        if (closedRefusal) return reject(state, event, closedRefusal);
        if (event.bedNumber !== undefined) {
          const bedRefusal = bedNumberRefusal(state, unit, event.bedNumber, undefined);
          if (bedRefusal) return reject(state, event, bedRefusal);
        }
        /**
         * T12 (owner answer 9): the front door's half of the `REFER_TO_UNITS` rule (see
         * `GenderPlacement` in `ward-model.ts`). Checked before the eligibility gate and refuses
         * the whole acceptance.
         */
        if (
          genderReviewNeeded(addressing.destination.gender, addressing.destination.sex) &&
          !(referral.genderPlacements ?? []).some((record) => record.unitIds.includes(unit.id))
        ) {
          if (event.role !== "coordinator") {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (event.genderPlacementReason === undefined || event.genderPlacementChecked !== true) {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (!GENDER_PLACEMENT_REASONS.includes(event.genderPlacementReason)) {
            return reject(
              state,
              event,
              `ACCEPT_REFERRAL genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS`,
            );
          }
          genderPlacementAddition = {
            at: event.now,
            by: event.role,
            unitIds: [unit.id],
            reason: event.genderPlacementReason,
            // Same discipline as `REFER_TO_UNITS`'s own write above: the tick is validated `true`
            // two lines up, and `wardChecked` stores it on the record rather than the reason text.
            wardChecked: true,
          };
        }
        // The rejection names the failing gate, reusing `referralEligibility`'s per-gate detail so
        // it reads the same as the match view.
        //
        // Owner reversal, item 2: the `gender_designation` gate must see this event's pending
        // gender-placement write, so both can be cleared in one acceptance. Only this local
        // eligibility read is widened; `referral` is committed unchanged.
        const referralForEligibility: Referral =
          genderPlacementAddition === undefined
            ? referral
            : { ...referral, genderPlacements: [...(referral.genderPlacements ?? []), genderPlacementAddition] };
        if (event.bedNumber !== undefined) {
          const bedRefusal =
            bedNumberRefusal(state, unit, event.bedNumber, undefined) ??
            heldBedRefusal(state, unit, event.bedNumber, undefined, referral.id);
          if (bedRefusal) return reject(state, event, bedRefusal);
        }
        const acceptRefusal = referralAcceptanceRefusal(
          event,
          referralForEligibility,
          addressing.destination,
          unit,
          event.now,
        );
        if (acceptRefusal.refusal) return reject(state, event, acceptRefusal.refusal);
        decision.overrideFactRecorded = acceptRefusal.overrideApplied;
        accepted = {
          ...addressing,
          state: "accepted",
          acceptedUnitId: unit.id,
          decidedAt: event.now,
          decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
          // Written unconditionally, so `...addressing` cannot carry an old reason onto a clean
          // acceptance.
          declineReason: undefined,
          acceptOverrideReason: acceptRefusal.overrideApplied ? event.overrideReason : undefined,
          ...(event.bedNumber === undefined ? {} : { heldBedNumber: event.bedNumber }),
          ...historyPatch,
          ...latestNotePatch,
        };
      } else {
        // An ED, medical ward or community team has no bed and no unit, so a `unitId` here is a
        // caller's mistake. A blank `unitId` is refused too: it is a malformed engine event that no
        // screen sends, not a person's choice, so the warn-and-ask rule does not apply.
        if (event.unitId !== undefined) {
          return reject(
            state,
            event,
            `${event.destinationKind.replace(/_/g, " ")} is answered by a team, not a bed — it cannot name a unit`,
          );
        }
        if (event.bedNumber !== undefined) {
          return reject(state, event, "Only a psychiatric ward answer can place a referral in a bed");
        }
        accepted = {
          ...addressing,
          state: "accepted",
          decidedAt: event.now,
          decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
          declineReason: undefined, // a re-acceptance after a decline drops the old refusal reason
          ...historyPatch,
          ...latestNotePatch,
        };
      }

      // FD-22: the first acceptance automatically cancels every destination still waiting. A
      // declined destination keeps its refusal, time and reason (FD-24).
      //
      // Before changing what this cancels: making a leaving acceptance cancel nothing (owner
      // question 7) interacts with `coordinatorWorklistReferrals` and Branch 2's lone-accepted-arm
      // reading; together they can hide a patient still awaiting a psychiatric decision. It would
      // also turn red the `"cancelled"` positive control in
      // `tests/ward-referral-visibility.test.ts`'s `multiDestinationReferral()`. Do not weaken that
      // privacy sweep's markers; split the fixture in that test file instead. No test yet drives a
      // community acceptance; write it with that change.
      const destinations = referral.destinations.map((candidate) => {
        if (candidate === addressing) return accepted;
        if (candidate.state !== "queued") return candidate;
        /**
         * RB5 (item 16): a community acceptance cancels nothing. It decides nothing about the bed,
         * so FD-22 does not apply to it.
         */
        if (accepted.destination.kind === "community_team") return candidate;
        /**
         * A community team is never cancelled by somebody else's acceptance (owner ruling:
         * "Community referral means a patient is about to be discharged"). It does not compete with
         * a bed, so cancelling it would cancel discharge planning when admission is confirmed.
         */
        if (candidate.destination.kind === "community_team") return candidate;
        return { ...candidate, state: "cancelled" as const, decidedAt: event.now };
      });
      // Spec D14: acceptance creates no `Movement`. That seam is deliberate;
      // `tests/ward-referral-reducer.test.ts` asserts it.
      const next = replaceReferral(state, referral.id, {
        ...referral,
        destinations,
        // T12: appended only when this acceptance supplied a fresh clearance.
        genderPlacements:
          genderPlacementAddition === undefined
            ? referral.genderPlacements
            : [...(referral.genderPlacements ?? []), genderPlacementAddition],
        ...(nextReferralHistory === undefined ? {} : { reassessmentHistory: nextReferralHistory }),
        ...(reassessmentEntry?.note !== undefined ? { reassessmentNote: reassessmentEntry.note } : {}),
      });
      /**
       * Addendum §1.3: "ACCEPT_REFERRAL — the referrer and the receiving ward — both sides of a
       * commitment." Two optional notices, each with its own `NoticeKind`: the referrer only when
       * `referralReferrer` resolves one safely, and the receiving ward only for a psychiatric-ward
       * acceptance. The referrer's sentence names the actual unit whenever one is known.
       */
      const referralNotices: Notice[] = [];
      const referrer = referralReferrer(referral);
      if (referrer !== undefined) {
        const acceptedBy =
          addressing.destination.kind === "psychiatric_ward" && event.unitId !== undefined
            ? unitName(state, event.unitId)
            : event.destinationKind.replace(/_/g, " ");
        referralNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "referral_accepted_referrer",
            referrer,
            { referralId: referral.id },
            `${acceptedBy} accepted referral ${referral.id}.`,
          ),
        );
      }
      if (addressing.destination.kind === "psychiatric_ward" && event.unitId !== undefined) {
        referralNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "referral_accepted_ward",
            { role: "ward", placeId: event.unitId },
            { referralId: referral.id, unitId: event.unitId },
            `${unitName(state, event.unitId)} accepted referral ${referral.id}. No bed is pulled and no movement is created.`,
          ),
        );
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return appendNotices(next, referralNotices);
    }

    case "DECLINE_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /**
       * The role must match the destination it is answering; see the identical map on
       * `ACCEPT_REFERRAL` above.
       */
      const answerableBy: Record<WardFlowRole, ReferralDestinationKind | "any"> = {
        ward: "psychiatric_ward",
        ed: "emergency_department",
        coordinator: "any",
        officer: "any",
        demo: "any",
        /** `community_team`, not `"any"` (owner ruling): see `ACCEPT_REFERRAL` above. */
        community: "community_team",
        bed_manager: "any",
        executive: "any",
      };
      const ownKind = answerableBy[event.role];
      if (ownKind !== "any" && ownKind !== event.destinationKind) {
        return reject(
          state,
          event,
          `${event.type} was raised by role ${event.role}, which may only answer ${ownKind.replace(/_/g, " ")} destinations, not ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const eligibleAddressings = referral.destinations.filter(
        (candidate) => candidate.destination.kind === event.destinationKind,
      );
      const addressing = eligibleAddressings.find(
        (candidate) =>
          candidate.destination.kind !== "psychiatric_ward" ||
          candidate.destination.unitId === undefined ||
          candidate.destination.unitId === event.unitId,
      );
      if (
        event.destinationKind === "psychiatric_ward" &&
        eligibleAddressings.length > 1 &&
        event.unitId === undefined
      ) {
        return reject(state, event, "Name the ward that is answering this referral.");
      }
      if (!addressing) {
        return reject(
          state,
          event,
          `referral ${referral.id} was not addressed to ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const actingRefusal = wardActingUnitRefusal(event, addressing);
      if (actingRefusal) return reject(state, event, actingRefusal);
      // RB5 (item 16): the same community exemption as `ACCEPT_REFERRAL`'s own guard, above -- a
      // community team may still decline its own arm after a ward or ED has accepted.
      if (event.destinationKind !== "community_team" && referralState(referral) === "accepted") {
        return reject(state, event, `referral ${referral.id} has already been accepted elsewhere`);
      }
      if (addressing.state !== "queued") {
        return reject(
          state,
          event,
          `${event.destinationKind.replace(/_/g, " ")} has already answered referral ${referral.id} (${addressing.state})`,
        );
      }
      // Same gap as ACCEPT_REFERRAL's own withdrawal guard above, and the same reasoning: O-17.11's
      // `withdrawnAt` is a separate fact from `state` and the guard above cannot see it.
      if (addressing.withdrawnAt !== undefined) {
        return reject(
          state,
          event,
          `referral ${referral.id} was withdrawn by its referrer, so ${event.destinationKind.replace(/_/g, " ")} cannot decline it`,
        );
      }
      // Membership, not truthiness: "chosen from a fixed list, never typed" is a runtime rule.
      //
      // Scoped to the answering destination kind (O-16.6): a community decline and a ward decline
      // have no overlap in meaning, so each kind is checked only against its own list.
      // `psychiatric_ward` keeps `REFERRAL_DECLINE_REASONS`.
      const declineReasonsFor: Record<
        ReferralDestinationKind,
        readonly (ReferralDeclineReason | CommunityDeclineReason)[]
      > = {
        psychiatric_ward: REFERRAL_DECLINE_REASONS,
        emergency_department: ED_DECLINE_REASONS,
        community_team: COMMUNITY_DECLINE_REASONS,
      };
      const declineReasonListName: Record<ReferralDestinationKind, string> = {
        psychiatric_ward: "REFERRAL_DECLINE_REASONS",
        emergency_department: "ED_DECLINE_REASONS",
        community_team: "COMMUNITY_DECLINE_REASONS",
      };
      if (!declineReasonsFor[event.destinationKind].includes(event.reason)) {
        return reject(
          state,
          event,
          `DECLINE_REFERRAL reason must be chosen from ${declineReasonListName[event.destinationKind]}, the vocabulary for ${event.destinationKind.replace(/_/g, " ")} destinations`,
        );
      }
      // One field, two vocabularies: `ReferralAddressing` is not discriminated on
      // `destination.kind`, so the check above is what holds the vocabularies apart at runtime.
      if (event.waitlist === true) {
        if (
          addressing.destination.kind !== "psychiatric_ward" ||
          !addressing.destination.unitId ||
          event.reason !== "no_suitable_bed"
        )
          return reject(state, event, "Only a named ward can waitlist a referral for no suitable bed.");
        return replaceReferral(state, referral.id, {
          ...referral,
          destinations: referral.destinations.map((candidate) =>
            candidate === addressing ? { ...candidate, waitlistedAt: event.now } : candidate,
          ),
        });
      }
      // FD-24: this destination declines and nothing else changes. The others stay queued, and the
      // refusal stays on record with its time and reason.
      const destinations = referral.destinations.map((candidate) =>
        candidate === addressing
          ? {
              ...candidate,
              state: "declined" as const,
              declineReason: event.reason,
              decidedAt: event.now,
              decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
            }
          : candidate,
      );
      const next = replaceReferral(state, referral.id, { ...referral, destinations });
      // Addendum §1.3 and FD-23: the decline reason reaches that referral's referrer and no other
      // team; no notice is safer than a wrongly-addressed one. Shares `NoticeKind`
      // "referral_declined" with `DECLINE`.
      const referrer = referralReferrer(referral);
      if (referrer === undefined) return next;
      // The reason reads through the curated label maps (`DECLINE_REASON_LABELS`, and the community
      // one per O-16.6), never a de-underscored code: "Another reason — needs follow-up" carries
      // meaning the referrer must act on. The `Record<string, string>` widening matches
      // `referral-board.tsx` and `ward-referrals.ts`.
      const declineLabel =
        (DECLINE_REASON_LABELS as Record<string, string>)[event.reason] ??
        (COMMUNITY_DECLINE_REASON_LABELS as Record<string, string>)[event.reason] ??
        event.reason;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "referral_declined",
          referrer,
          { referralId: referral.id },
          `${event.destinationKind.replace(/_/g, " ")} declined referral ${referral.id} (${declineLabel}).`,
        ),
      ]);
    }

    /**
     * The coordinator undoes a ward's "yes" (rulings E and F). See `WITHDRAW_ACCEPTANCE` in
     * `ward-flow-events.ts`.
     */
    case "WITHDRAW_ACCEPTANCE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot withdraw an acceptance for a closed movement (${movement.closure.reason})`);
      }
      /**
       * The message states the condition the guard tests, never a cause. `arrived` cannot reach
       * here, since arrival sets `closure`. Do not restore the removed wording, even quoted.
       *
       * `stageCopy`'s label is not used: importing `ward-derivations.ts` would be circular (and
       * pull in `lucide-react`). `.replace(/_/g, " ")` is this file's idiom.
       *
       * Q16 (owner, 16 Sept 2026): withdrawing is allowed at `pulled` too, and at any earlier stage
       * a movement was stepped back to while still holding its bed, releasing the bed in the same
       * act. It stays refused from `handover_ready` on, where a patient may be moving.
       */
      const steppedBackHoldingBed =
        movement.admissionId !== undefined &&
        (movement.stage === "placement_requested" || movement.stage === "destination_review");
      if (movement.stage !== "accepted_awaiting_bed" && movement.stage !== "pulled" && !steppedBackHoldingBed) {
        return reject(
          state,
          event,
          `cannot withdraw an acceptance unless the movement is awaiting a bed or has one pulled ` +
            `(movement ${movement.id} is at ${stageCopy[movement.stage].label})`,
        );
      }
      if (!STEP_BACK_REASONS.includes(event.reason)) {
        return reject(state, event, `WITHDRAW_ACCEPTANCE reason must be chosen from STEP_BACK_REASONS`);
      }
      /**
       * Q16: a bed is held at `pulled`, and also by a movement stepped back from `pulled` (it keeps
       * its `admissionId`). Either way the bed is released in this one act and both facts are
       * recorded: a `pull_released` unwind and an `acceptance_withdrawn` unwind. The transport
       * guards are `RELEASE_PULL`'s: a collected patient is `STOP_TRANSPORT`, and a booked job is
       * cancelled first so the officer and receiving ward are told.
       */
      const holdsBed = movement.stage === "pulled" || movement.admissionId !== undefined;
      if (holdsBed && movement.transport?.collectedAt !== undefined) {
        return reject(state, event, `movement ${movement.id}'s patient has been collected; use STOP_TRANSPORT`);
      }
      if (holdsBed && movement.transport !== undefined && movement.transport.cancelledAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a transport job booked; cancel it (CANCEL_TRANSPORT) before withdrawing the acceptance`,
        );
      }
      // Read before clearing: `UnwindRecord.unitId` names which ward's acceptance this was.
      const withdrawnUnitId = movement.acceptedUnitId;
      // The shared helper gives nothing back when the reservation does not match the movement. A
      // release is never recorded unless one happened, so this is checked before the referral's
      // bed number is stripped (that strip changes state on its own).
      const bedReleased = holdsBed ? releasePulledBedAndAdmission(state, movement, event.now) : state;
      if (holdsBed && bedReleased === state) {
        return reject(state, event, `movement ${movement.id}'s held bed matches no releasable reservation`);
      }
      const released = holdsBed ? withoutReferralBedHold(bedReleased, movement) : state;
      const withdrawnStage = steppedBackHoldingBed ? movement.stage : "destination_review";
      const updatedMovement: Movement = {
        ...movement,
        acceptedUnitId: undefined,
        acceptedAt: undefined,
        heldBedNumber: undefined,
        stage: withdrawnStage,
        // The bed is given back, so the pull's fields go with it, as in `RELEASE_PULL`. A cancelled
        // job is already in `unwinds`. The blocker is restated because a pulled movement's blocker
        // can be a transport sentence, which is false once the bed is gone.
        ...(holdsBed
          ? {
              admissionId: undefined,
              allocatedBed: undefined,
              pullExpiresAt: undefined,
              transport: undefined,
              blocker:
                movement.referredUnitIds.length > 0
                  ? STAGE_TRANSITION_BLOCKERS.referred
                  : STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn,
            }
          : {}),
        // Not pushed back into `referredUnitIds` (owner ruling 3): withdrawing an acceptance is not
        // re-referring.
        // A movement already stepped back to Destination review or earlier stays where it is, so it
        // gets no stage entry; the unwinds below still record the act.
        stageChanges:
          withdrawnStage === movement.stage
            ? movement.stageChanges
            : [
                ...movement.stageChanges,
                {
                  at: event.now,
                  from: movement.stage,
                  to: withdrawnStage,
                  by: event.role,
                  reason: event.reason,
                },
              ],
        unwinds: [
          ...movement.unwinds,
          ...(holdsBed
            ? [
                {
                  at: event.now,
                  kind: "pull_released" as const,
                  by: event.role,
                  reason: event.reason,
                  unitId: withdrawnUnitId,
                },
              ]
            : []),
          {
            at: event.now,
            kind: "acceptance_withdrawn",
            by: event.role,
            reason: event.reason,
            unitId: withdrawnUnitId,
          },
        ],
      };
      const next = replaceMovement(released, movement.id, updatedMovement);
      const reasonText = event.reason.replace(/_/g, " ");
      // Item 48, Q3 (owner): the ward whose acceptance was undone is told. `withdrawnUnitId` was
      // read before this handler cleared it.
      const notices = [
        makeNotice(
          event.now,
          state.notices.length,
          "acceptance_withdrawn_ward",
          { role: "ward", placeId: withdrawnUnitId },
          { movementId: movement.id, unitId: withdrawnUnitId },
          `The coordinator withdrew this ward's acceptance of ${movement.id}${holdsBed ? " and released the bed held for them" : ""}. The patient is not coming unless this ward is asked again.`,
        ),
      ];
      // Addendum §1.3, as in `RELEASE_PULL`: "a referrer not told goes on believing a bed is coming."
      if (holdsBed) {
        notices.push(
          makeNotice(
            event.now,
            state.notices.length + 1,
            "bed_pull_released",
            { role: "ed", placeId: movement.originEdId },
            { movementId: movement.id, unitId: withdrawnUnitId },
            `The coordinator withdrew ${withdrawnUnitId === undefined ? "the ward" : unitName(state, withdrawnUnitId)}'s acceptance of ${movement.id} and released the bed held for them (${reasonText}).`,
          ),
        );
      }
      return appendNotices(next, notices);
    }
  }
}
