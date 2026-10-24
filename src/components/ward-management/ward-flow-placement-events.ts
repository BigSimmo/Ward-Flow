import { type AuditDecision } from "./ward-audit";
import { emptyCareJourney } from "./ward-care-journey";
import {
  lacksObservationStaff,
  remainingHighAcuityCapacity,
  remainingSpeciallingCapacity,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { observationSummary } from "@/components/ward-management/ward-observation";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import {
  lockedBedsFree,
  openBedsFree,
  numberedBedKind,
  numberedBedKindRefusal,
} from "@/components/ward-management/ward-bed-designation";
import { OVERRIDE_REASONS, RELEASE_PULL_REASONS } from "@/components/ward-management/ward-change-reasons";
import { heldUnitAuthorisationRefusal } from "@/components/ward-management/ward-held-legal-check";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  EXTRA_TRAVEL_HOLD_MINUTES,
  MOVEMENT_STAGES,
  STEP_BACK_REASONS,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { movementBedReservation } from "./ward-movement-bed-hold";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import type { PlacementEventHelpers, WardFlowState } from "./ward-flow-reducer";

/**
 * Pulling a bed for a movement and giving it back: `reduceClinicalEvent`'s cases for these events,
 * moved here unchanged. The reducer passes its helpers in, since this file may not import the
 * reducer at run time.
 */
export type PlacementEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "PULL_PATIENT"
      | "RELEASE_PULL"
      | "RELEASE_HELD_BED"
      | "RELEASE_DIVERTED_BED"
      | "STEP_BACK_STAGE"
      | "RELEASE_AND_REOPEN_SEARCH";
  }
>;

export function reducePlacementEvent(
  state: WardFlowState,
  event: PlacementEvent,
  decision: AuditDecision,
  helpers: PlacementEventHelpers,
): WardFlowState {
  const {
    HIGH_ACUITY_STAFFING_REFUSAL,
    OVERRIDE_REASON_REQUIRED,
    STAGE_TRANSITION_BLOCKERS,
    appendNotices,
    eligibilityRefusal,
    findMovement,
    findUnit,
    heldUnitGenderRefusal,
    makeNotice,
    movementHoldsBedByStage,
    movementSourceAdmission,
    pullOverrides,
    reject,
    releasePulledBedAndAdmission,
    replaceMovement,
    replaceUnit,
    wardActingMovementRefusal,
    withoutReferralBedHold,
  } = helpers;
  switch (event.type) {
    case "PULL_PATIENT": {
      const actingRefusal = wardActingMovementRefusal(event);
      if (actingRefusal) return reject(state, event, actingRefusal);
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot pull a bed for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "accepted_awaiting_bed") {
        return reject(
          state,
          event,
          `cannot pull a bed at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (movement.acceptedUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `movement ${movement.id} was accepted at ${movement.acceptedUnitId ?? "no unit"}, not ${event.unitId}`,
        );
      }
      // P1-3 (Ward Lead ruling): by `PULL_PATIENT` the movement is already accepted at this unit,
      // so either gender judgement failing means a correction landed after acceptance. See
      // `heldUnitGenderRefusal`.
      const heldGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (heldGenderRefusal) return reject(state, event, heldGenderRefusal);
      /**
       * A movement that still holds a bed is restored to `pulled`, never given a second bed (owner
       * decision). `STEP_BACK_STAGE` keeps the bed and `admissionId` (rulings E/F).
       *
       * Runs before every capacity and eligibility check: nothing is consumed, and those checks
       * would count the patient's own held bed against them.
       */
      const patientId =
        movement.patientId ?? state.referrals.find((r) => r.id === movement.referralId)?.patientId ?? event.patientId;
      const source = movementSourceAdmission(state, movement);
      if (
        (movement.sourceAdmissionId && !source) ||
        (source && (source.state !== "occupied" || source.patientId !== patientId || source.unitId === event.unitId))
      ) {
        return reject(state, event, "Repatriation needs the patient's occupied source stay at a different ward.");
      }
      if (
        patientId &&
        state.admissions.some(
          (a) =>
            a.patientId === patientId &&
            (a.state === "pulled" || a.state === "occupied") &&
            a.id !== movement.admissionId &&
            a.id !== source?.id,
        )
      ) {
        return reject(state, event, "This patient already holds a bed or occupies a ward; use a recorded transfer.");
      }
      if (movement.admissionId !== undefined) {
        const held = state.admissions.find((admission) => admission.id === movement.admissionId);
        if (!held || held.unitId !== event.unitId) {
          return reject(
            state,
            event,
            `movement ${movement.id} points at admission ${movement.admissionId}, which is not a bed held at ${event.unitId}; it cannot be restored or pulled again`,
          );
        }
        const restoreUnit = findUnit(state, event.unitId);
        if (!restoreUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
        // Second pull re-runs one-to-one and acuity checks and does not count this person's own held bed.
        const admissionsExcludingOwn = state.admissions.filter((admission) => admission.id !== movement.admissionId);
        const speciallingAnsweredRestore =
          event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
        if (
          !speciallingAnsweredRestore &&
          lacksObservationStaff(movement.observation, restoreUnit, admissionsExcludingOwn)
        ) {
          return reject(
            state,
            event,
            `${restoreUnit.name} has not enough observation staff left; this patient needs ${observationSummary(movement.observation)} and the ward cannot staff it`,
          );
        }
        const acuityOverrideNeededRestore =
          movement.highAcuity && remainingHighAcuityCapacity(restoreUnit, admissionsExcludingOwn) <= 0;
        const acuityAnsweredRestore =
          event.overrideReason !== undefined &&
          OVERRIDE_REASONS.includes(event.overrideReason) &&
          event.numConsulted === true;
        if (!acuityAnsweredRestore && acuityOverrideNeededRestore) {
          return reject(
            state,
            event,
            `${restoreUnit.name} ${HIGH_ACUITY_STAFFING_REFUSAL}. This placement ${OVERRIDE_REASON_REQUIRED} and the nurse unit manager consulted.`,
          );
        }
        // Audit 2 E-03 (Josh, 20 Oct 2026): a legal status change since the bed was held can leave
        // it at a ward not set up for involuntary admissions. Restoring the hold then needs a
        // recorded reason, which `pullOverrides` keeps as an `authorisation` override.
        const restoreLegalRefusal = speciallingAnsweredRestore ? null : heldUnitAuthorisationRefusal(state, movement);
        if (restoreLegalRefusal) return reject(state, event, restoreLegalRefusal);
        const restored: Movement = {
          ...movement,
          overrides: pullOverrides(movement, restoreUnit, admissionsExcludingOwn, event, false),
          stage: "pulled",
          waitlistedUnitIds: undefined,
          pullExpiresAt: event.now + pullHoldMinutesFor(state, movement, event.unitId),
          allocatedBed: movement.allocatedBed ?? held.id,
          stageChanges: [
            ...movement.stageChanges,
            { at: event.now, from: movement.stage, to: "pulled", by: event.role },
          ],
        };
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        decision.overrideFactRecorded = restored.overrides.length > movement.overrides.length;
        return replaceMovement(state, movement.id, restored);
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      if (unit.isClosed) {
        return reject(state, event, `${unit.name} is closed; a new bed cannot be reserved there`);
      }
      const pullReady = boundedBedAvailability(unit).available;
      if (pullReady <= 0) {
        /**
         * Audit 2 E-08 (Josh, 20 Oct 2026): a pull needs a Ready bed, `min(allocatable, empty)`,
         * the same figure the ward shows, so it cannot reserve a bed when the ward shows 0 Ready.
         * Reports only the two figures it read, never a cause: `CONFIRM_CAPACITY` sets allocatable
         * from a ward's self-report and `allocatable.source` cannot tell a pull from a correction.
         * An arrival is still always recorded (`PATIENT_ARRIVED`).
         */
        return reject(
          state,
          event,
          `no Ready bed remains at ${unit.name} (allocatable ${unit.allocatable.value}, physically empty ${unit.empty.value})`,
        );
      }
      /**
       * A pull is refused against a bed that is not ready (owner ruling): "A pull cannot occur
       * unless the bed is actually available and open, not pending (i.e. being cleaned)". The
       * refusal lives here, not on a screen, so the transition itself cannot happen. `availableNow`
       * is deliberately unchanged: the owner chose refusing the pull over dropping the ward's
       * number.
       *
       * Only when preparation is the cause: a refusal must state the reason that actually applies,
       * not hijack the no-free-bed case.
       */
      const pending = bedsPendingPreparation(unit.id, state.bedReleases);
      if (pending > 0 && openBedsNow(unit, state.bedReleases) <= 0) {
        return reject(
          state,
          event,
          `every free bed at ${unit.name} is still being made ready (${pending} pending); a patient cannot be pulled to a bed that is not open`,
        );
      }
      /**
       * A pull for somebody needing one-to-one observation is refused when the ward has nobody left
       * to watch them (owner ruling 1). `eligibility()`'s `specialling` gate only asks whether the
       * ward has any capacity at all; this asks whether any is left, derived from the beds
       * (`remainingSpeciallingCapacity`), never a decremented counter. The refusal lives here so
       * the transition itself cannot happen, and only when specialling is the cause.
       *
       * Owner ruling: this refusal is answerable by a recorded reason (a gate nobody can pass stops
       * the record, not the admission); the bed check above is not and still runs first.
       * Membership-checked, never truthiness: an unrecognised string falls through to
       * `eligibilityRefusal`. `specialling` is deliberately not in `SUITABILITY_GATES`, which would
       * make the static question overridable instead of this one.
       */
      const speciallingAnswered = event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
      if (!speciallingAnswered && lacksObservationStaff(movement.observation, unit, state.admissions)) {
        return reject(
          state,
          event,
          `${unit.name} has not enough observation staff left (${remainingSpeciallingCapacity(unit, state.admissions)} of ${unit.speciallingCapacity} free); this patient needs ${observationSummary(movement.observation)} and the ward cannot staff it`,
        );
      }

      /**
       * Owner ruling (`docs/ward-flow/owner-decisions-2026-09-09.md` §5): high-acuity nursing is a
       * staffing-capacity check too. `eligibility()`'s `acuity` gate only sees the authored total;
       * `remainingHighAcuityCapacity` knows what is left. Mirrors the specialling guard, including
       * membership-checked overrides, and `acuity` is deliberately not in `SUITABILITY_GATES`.
       *
       * Item 10 (owner answers): unlike specialling, this override also needs "the nurse unit
       * manager consulted", and the answer is written to `overrides`. Captured once here so the
       * refusal and the movement update below cannot drift.
       */
      const acuityOverrideNeeded = movement.highAcuity && remainingHighAcuityCapacity(unit, state.admissions) <= 0;
      const acuityAnswered =
        event.overrideReason !== undefined &&
        OVERRIDE_REASONS.includes(event.overrideReason) &&
        event.numConsulted === true;
      if (!acuityAnswered && acuityOverrideNeeded) {
        return reject(
          state,
          event,
          `${unit.name} ${HIGH_ACUITY_STAFFING_REFUSAL} (${unit.highAcuityCapacity} staffable, all in use). This placement ${OVERRIDE_REASON_REQUIRED} and the nurse unit manager consulted.`,
        );
      }

      /**
       * Item 11 (owner answer 11): "voluntary patients take open beds first, and secure patients
       * take locked beds first." Bed kind belongs to the request (`movement.security`), so
       * "voluntary" is read as `security: "Open"`.
       *
       * A capacity check, not the `security` suitability gate, which only asks whether the ward has
       * any locked beds. It sits with the other physical capacity checks before
       * `eligibilityRefusal`.
       *
       * An Open request takes an open bed while one is free, else a locked one with no override. A
       * Secure request takes a locked bed while one is free; only when none is free does it need an
       * override to fall back to an open bed. `bedKindTaken` computes this once for the refusal
       * check, the capacity decrement and the admission literal.
       */
      const secureBedNeeded = movement.security === "Secure";
      const reservedBed = movementBedReservation(movement, state.referrals, unit.id).bedNumber;
      if (reservedBed !== undefined) {
        const numberedRefusal =
          helpers.bedNumberRefusal(state, unit, reservedBed, undefined) ??
          helpers.heldBedRefusal(state, unit, reservedBed, movement.id, movement.referralId) ??
          numberedBedKindRefusal(unit, reservedBed, secureBedNeeded);
        if (numberedRefusal) return reject(state, event, numberedRefusal);
      }
      const reservedKind = reservedBed === undefined ? undefined : numberedBedKind(unit, reservedBed);
      if (reservedBed !== undefined && reservedKind === undefined)
        return reject(state, event, "The numbered bed reservation is outside this ward.");
      if (reservedKind !== undefined && (reservedKind === "locked" ? lockedBedsFree(unit) : openBedsFree(unit)) <= 0)
        return reject(
          state,
          event,
          `No free ${reservedKind} bed remains for the numbered reservation at ${unit.name}.`,
        );
      const noLockedBedFree = lockedBedsFree(unit) <= 0;
      if (secureBedNeeded && reservedKind === "open" && !noLockedBedFree)
        return reject(state, event, "The numbered reservation is an open bed, but this request needs a locked bed.");
      const bedKindOverrideNeeded = secureBedNeeded && noLockedBedFree;
      const bedKindAnswered = event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
      if (!bedKindAnswered && bedKindOverrideNeeded) {
        return reject(
          state,
          event,
          `No locked bed is free at ${unit.name}. This placement ${OVERRIDE_REASON_REQUIRED} to use an open bed.`,
        );
      }
      const bedKindTaken: "locked" | "open" =
        reservedKind ??
        (secureBedNeeded ? (noLockedBedFree ? "open" : "locked") : openBedsFree(unit) > 0 ? "open" : "locked");

      /**
       * The eligibility gate goes last, after every existing refusal (Ward Lead ruling): a
       * coordinator who pulled at the wrong stage should be told that, not told about cohort. Test
       * this gate on a pair whose only failing gate is cohort, since the refusals above can fire
       * first.
       */
      const pullRefusal = eligibilityRefusal(event, movement, unit, event.now);
      if (pullRefusal) return reject(state, event, pullRefusal);

      const updatedUnit: Unit = {
        ...unit,
        // Audit A1-11: a pull moves the figure; only Confirm numbers stamps it confirmed.
        allocatable: { ...unit.allocatable, value: unit.allocatable.value - 1 },
        // Item 11: decremented only when a locked bed was taken, mirroring the restore in
        // `releasePulledBedAndAdmission`.
        allocatableLocked: bedKindTaken === "locked" ? unit.allocatableLocked - 1 : unit.allocatableLocked,
      };
      /**
       * The patient becomes a person in a bed, built in the same shape the seed builds so every
       * consumer renders it.
       *
       * R4: `referralId`, `patientId` and `homeRegion` are derived from `resolvedReferral`, never
       * invented, so a community team's referred patient stays on its team page
       * (`admissionBelongsToTeam`). `null` is the honest answer when no referral resolves; a home
       * region is never derived from the origin emergency department.
       *
       * `state` is `"pulled"` and `arrivedAt` is `null` (owner ruling: "a patient is not marked as
       * arrived until the ward says they have arrived. The pull just means the bed is allocated to
       * them."). Only `PATIENT_ARRIVED` writes `arrivedAt`, so `daysInBed` is not inflated by the
       * transport delay. `pulledAt` is `event.now`: this event is the pull.
       *
       * D-14 / R4: `resolvedReferral` inlines `referralForMovement`'s resolution (importing
       * `ward-derivations.ts` would be circular). `undefined` when the movement has no `referralId`
       * or it does not resolve. Computed once so every field below agrees.
       */
      const resolvedReferral =
        movement.referralId === undefined
          ? undefined
          : state.referrals.find((referral) => referral.id === movement.referralId);
      const admission: Admission = {
        id: `AD-ARR-${String(state.admissionSequence + 1).padStart(2, "0")}`,
        unitId: unit.id,
        // The observation level the ward is staffing this bed at, copied from the movement where a
        // person recorded it at intake. See `Admission.observation`.
        observation: movement.observation,
        // A high-acuity place, copied from the movement, where the referring clinician marked it
        // (owner ruling). Never derived from the observation level.
        highAcuity: movement.highAcuity,
        referralId: resolvedReferral?.id ?? null,
        movementId: movement.id,
        patientId: resolvedReferral?.patientId ?? movement.patientId ?? event.patientId ?? null,
        sex: movement.sex,
        gender: movement.gender,
        // R4: a home region is a fact about the person, from the resolved referral; never invented
        // from the emergency department's location.
        homeRegion: resolvedReferral?.homeRegion ?? null,
        // T15 (item 12): copied from the movement (the referral's value, or the ED's own choice).
        // Never read from the referral directly, so a diagnosis added to the referral later does
        // not reach this admission.
        tentativeDiagnosis: movement.tentativeDiagnosis ?? null,
        // Item 11: the bed kind actually taken, shared with the refusal check and the decrement.
        // See `Admission.bedKind`.
        bedKind: bedKindTaken,
        ...(reservedBed === undefined ? {} : { bedNumber: reservedBed }),
        state: "pulled",
        pulledAt: event.now,
        arrivedAt: null,
        // Null as a statement: this person has not reached the ward, so is not away at an emergency
        // department in this field's sense.
        awayAtEmergencyDepartmentSince: null,
        expectedDischargeAt: null,
        dischargeDateMoves: 0,
        dischargeDateSetAt: null,
        dischargeDateSetBy: null,
        dischargeConfirmedAt: null,
        dischargeConfirmedBy: null,
        blockReason: null,
        leavingDestination: null,
        leftAt: null,
        followUp: null,
        careJourney: emptyCareJourney(),
        dischargeBarrier: null,
        dischargeCriteria: null,
        stepDownCandidate: false,
      };

      const updatedMovement: Movement = {
        ...movement,
        stage: "pulled",
        waitlistedUnitIds: undefined,
        pullExpiresAt: event.now + pullHoldMinutesFor(state, movement, event.unitId),
        allocatedBed: admission.id,
        // The join `RELEASE_PULL` needs to undo exactly this record, and `PATIENT_ARRIVED` needs to
        // mark exactly this one as having arrived. See `Movement.admissionId`.
        admissionId: admission.id,
        stageChanges: [...movement.stageChanges, { at: event.now, from: movement.stage, to: "pulled", by: event.role }],
        overrides: pullOverrides(movement, unit, state.admissions, event, true),
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      const withPerson: WardFlowState = {
        ...withUnit,
        admissions: [...withUnit.admissions, admission],
        admissionSequence: withUnit.admissionSequence + 1,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      decision.overrideFactRecorded = updatedMovement.overrides.length > movement.overrides.length;
      return replaceMovement(withPerson, movement.id, updatedMovement);
    }

    case "RELEASE_PULL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot release a pull for a closed movement (${movement.closure.reason})`);
      }
      // WFA-004: physical collection is not erased by a stage correction. Releasing the bed after
      // collection is `STOP_TRANSPORT`, never `RELEASE_PULL`.
      if (movement.transport?.collectedAt !== undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of releasing the pull`,
        );
      }
      // A booked (uncollected) transport job must not be silently deleted by releasing the pull —
      // cancel it explicitly first so the officer and receiving ward are told, never left believing.
      if (movement.transport !== undefined && movement.transport.cancelledAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the pull`,
        );
      }
      if (movement.stage !== "pulled") {
        return reject(
          state,
          event,
          `cannot release a pull at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      // Claim-not-proof, as CONFIRM_CAPACITY: the caller's stated unit against the unit holding the
      // bed. A coordinator may act for any unit.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_PULL was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is pulled at ${movement.acceptedUnitId}`,
        );
      }
      if (!RELEASE_PULL_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved. An off-list reason would reach `stageChanges` and `unwinds` and render
         * as no reason at all. Checked before the unit lookups below.
         */
        return reject(state, event, `RELEASE_PULL reason must be chosen from RELEASE_PULL_REASONS`);
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted unit holding a bed`);
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);

      // The exact inverse of PULL_PATIENT's writes (ruling P4-1): `allocatable` is given back, and
      // the admission the pull created is deleted, so no phantom occupant remains. `Unit.held` is
      // seed-only; the live held count is derived.
      //
      // Deleted, not ended, unlike `RECORD_LEAVING`: a released pull is a retracted assertion, so
      // no discharge is recorded. `admissionSequence` is not rewound, so no id is reused. Both
      // halves live in `releasePulledBedAndAdmission`, shared with `WITHDRAW_REFERRAL` and
      // `STOP_TRANSPORT` (WLQ-38).
      const withoutPhantom = releasePulledBedAndAdmission(state, movement, event.now);
      // Never closes the movement, never clears `legalForm`, never touches `referredUnitIds` —
      // the patient survives and keeps their acceptance; only the pull itself unwinds.
      const updatedMovement: Movement = {
        ...movement,
        stage: "accepted_awaiting_bed",
        // Restate the blocker as at first acceptance: once the bed is given back, a
        // transport-provider sentence is false. A standing job is flagged by `orphanedTransport`,
        // not here.
        blocker: STAGE_TRANSITION_BLOCKERS.accepted,
        pullExpiresAt: undefined,
        allocatedBed: undefined,
        // The admission the pull created was deleted by the shared helper, so the join goes too.
        admissionId: undefined,
        transport: undefined,
        unwinds: [...movement.unwinds, { at: event.now, kind: "pull_released", by: event.role, reason: event.reason }],
        // Appends a second `to: accepted_awaiting_bed` entry and must never touch `acceptedAt`: a
        // release is not a re-acceptance. See `StageChange`.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "accepted_awaiting_bed", by: event.role, reason: event.reason },
        ],
      };
      const next = replaceMovement(withoutPhantom, movement.id, updatedMovement);
      // Addendum §1.3: "a referrer not told goes on believing a bed is coming."
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "bed_pull_released",
          referrerOf(movement),
          { movementId: movement.id, unitId: unit.id },
          `${unit.name} released the bed it had pulled for ${movement.id} (${event.reason.replace(/_/g, " ")}).`,
        ),
      ]);
    }

    /**
     * Releases a bed `STOP_TRANSPORT` left held (owner answer 8). See `ward-flow-events.ts` for why
     * this is a new case rather than a loosened `RELEASE_PULL`.
     */
    case "RELEASE_HELD_BED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      const isStoppedTransport = movement.transport?.stoppedAt !== undefined;
      const examinationOutcome = movement.examination?.outcome;
      const isRevokedExamHold =
        (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
        (movement.admissionId !== undefined || (movement.closure === undefined && movementHoldsBedByStage(movement)));
      const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;

      if (!isStoppedTransport && !isRevokedExamHold && !awaitingRelease) {
        return reject(
          state,
          event,
          `movement ${movement.id} was not stopped by STOP_TRANSPORT and has no examination-revoked hold, so there is no held bed to release this way`,
        );
      }
      // A stopped journey or revoked-exam hold holds a bed until explicitly released.
      const heldBedOutstanding =
        movement.admissionId !== undefined ||
        (movement.closure === undefined && movementHoldsBedByStage(movement)) ||
        movement.blocker === STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease ||
        movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
      if (!heldBedOutstanding) {
        return reject(state, event, `movement ${movement.id} holds no bed — it may already have been released`);
      }
      // Claim-not-proof, as RELEASE_PULL and CANCEL_TRANSPORT. A coordinator or ed caller may act
      // regardless.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_HELD_BED was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is held at ${movement.acceptedUnitId}`,
        );
      }
      const withoutHeldBed = withoutReferralBedHold(releasePulledBedAndAdmission(state, movement, event.now), movement);
      const released: Movement = {
        ...movement,
        admissionId: undefined,
        heldBedNumber: undefined,
        ...(isRevokedExamHold || awaitingRelease
          ? {
              acceptedUnitId: undefined,
              referredUnitIds: [],
              ...(movement.transport && movement.transport.cancelledAt === undefined
                ? {
                    transport: {
                      ...movement.transport,
                      cancelledAt: event.now,
                    },
                  }
                : {}),
            }
          : {}),
        // Nothing is blocking any more — the release this sentence describes is the one thing that
        // was outstanding.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
        examRevoked: undefined,
        closure: movement.closure ?? {
          at: event.now,
          outcome: "did_not_proceed",
          reason: isRevokedExamHold || awaitingRelease ? "examination_revoked" : "bed_released",
        },
      };
      return replaceMovement(withoutHeldBed, movement.id, released);
    }

    /** Item 29 (T4a) / OA-29: release a bed left held by a diversion. */
    case "RELEASE_DIVERTED_BED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.transport?.diversion === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} was not diverted, so there is no diverted bed to release this way`,
        );
      }
      // A diverted journey stays open until this release closes it, so the closure is the
      // released marker; a seeded journey with no `admissionId` still holds its bed by stage.
      if (movement.closure !== undefined || !movementHoldsBedByStage(movement)) {
        return reject(state, event, `movement ${movement.id} holds no bed — it may already have been released`);
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_DIVERTED_BED was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is held at ${movement.acceptedUnitId}`,
        );
      }
      const withoutHeldBed = withoutReferralBedHold(releasePulledBedAndAdmission(state, movement, event.now), movement);
      const diversionReason = movement.transport.diversion.reason;
      const released: Movement = {
        ...movement,
        admissionId: undefined,
        heldBedNumber: undefined,
        transport: {
          ...movement.transport,
          cancelledAt: event.now,
        },
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: diversionReason,
        },
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      const next = replaceMovement(withoutHeldBed, movement.id, released);
      if (event.role === "ward" || movement.acceptedUnitId === undefined) {
        return next;
      }
      const receivingUnitId = movement.acceptedUnitId;
      return appendNotices(next, [
        makeNotice(
          event.now,
          next.notices.length,
          "diversion_bed_released_ward",
          { role: "ward", placeId: receivingUnitId },
          { movementId: movement.id, unitId: receivingUnitId },
          `The bed held for diverted patient ${movement.id} was released.`,
        ),
      ]);
    }

    /**
     * The coordinator's own record correction (owner rulings E and F). See `STEP_BACK_STAGE` in
     * `ward-flow-events.ts`.
     */
    case "STEP_BACK_STAGE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.stage === "arrived" || movement.transport?.arrivedAt !== undefined) {
        return reject(
          state,
          event,
          `cannot step back an arrived movement (invariant I-05: physical arrival is irreversible)`,
        );
      }
      if (movement.closure) {
        return reject(state, event, `cannot step back a closed movement (${movement.closure.reason})`);
      }
      if (!MOVEMENT_STAGES.includes(event.to)) {
        return reject(state, event, `STEP_BACK_STAGE target must be chosen from MOVEMENT_STAGES`);
      }
      const fromIndex = MOVEMENT_STAGES.indexOf(movement.stage);
      const toIndex = MOVEMENT_STAGES.indexOf(event.to);
      if (toIndex >= fromIndex) {
        return reject(
          state,
          event,
          `STEP_BACK_STAGE target must be strictly before the movement's current stage (movement ${movement.id} is at ${stageCopy[movement.stage].label}, target was ${stageCopy[event.to].label})`,
        );
      }
      if (!STEP_BACK_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only requirement passes `vitest run` with
         * no `tsc` involved.
         */
        return reject(state, event, `STEP_BACK_STAGE reason must be chosen from STEP_BACK_REASONS`);
      }
      // Q25: a seeded journey at "pulled" or later can hold its bed by its stage alone, with no
      // `admissionId` (review finding S2-1). Stepped back before "pulled", nothing would record the
      // hold any more, so every later ending would keep that bed out of the count. Refused instead.
      const pulledIndex = MOVEMENT_STAGES.indexOf("pulled");
      if (movement.admissionId === undefined && fromIndex >= pulledIndex && toIndex < pulledIndex) {
        return reject(
          state,
          event,
          `cannot step movement ${movement.id} back before ${stageCopy.pulled.label}: its bed is held by its stage alone, so the hold would be lost. Step back no further than ${stageCopy.pulled.label}, or release the bed`,
        );
      }
      // Touch nothing else (F3, ruling E: "does not release the bed / does not cancel the
      // transport"). Never write `acceptedUnitId`, `acceptedAt`, `pullExpiresAt`, `admissionId`,
      // `transport` or any `Unit.allocatable` field. The only side effects are the two appends
      // below and `stage`.
      const updatedMovement: Movement = {
        ...movement,
        stage: event.to,
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: event.to, by: event.role, reason: event.reason },
        ],
        unwinds: [
          ...movement.unwinds,
          { at: event.now, kind: "stage_corrected", by: event.role, reason: event.reason },
        ],
      };
      return replaceMovement(state, movement.id, updatedMovement);
    }

    case "RELEASE_AND_REOPEN_SEARCH": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot release and reopen a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled" && movement.stage !== "accepted_awaiting_bed") {
        return reject(
          state,
          event,
          `cannot release and reopen at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (movement.transport !== undefined && movement.transport.cancelledAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing and reopening the search`,
        );
      }
      if (!RELEASE_PULL_REASONS.includes(event.reason)) {
        return reject(state, event, `RELEASE_AND_REOPEN_SEARCH reason must be chosen from RELEASE_PULL_REASONS`);
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_AND_REOPEN_SEARCH was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is at ${movement.acceptedUnitId}`,
        );
      }
      const withoutPhantom = withoutReferralBedHold(releasePulledBedAndAdmission(state, movement, event.now), movement);
      // A stepped-back movement keeps its bed and admission at `accepted_awaiting_bed` (same rule
      // as `releasePulledBedAndAdmission`).
      const heldBed = movement.stage === "pulled" || movement.admissionId !== undefined;
      const releasedUnitId = movement.acceptedUnitId;
      const updatedMovement: Movement = {
        ...movement,
        stage: "placement_requested",
        acceptedUnitId: undefined,
        acceptedAt: undefined,
        heldBedNumber: undefined,
        admissionId: undefined,
        allocatedBed: undefined,
        pullExpiresAt: undefined,
        waitlistedUnitIds: undefined,
        referredUnitIds: [],
        transport: undefined,
        blocker: STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn,
        unwinds: [
          ...movement.unwinds,
          // From accepted_awaiting_bed no bed was ever held: this undoes the ward's acceptance, not a pull.
          {
            at: event.now,
            kind: heldBed ? "pull_released" : "acceptance_withdrawn",
            by: event.role,
            reason: event.reason,
            // Name the former accepting ward: `acceptedUnitId` is cleared in this same update.
            ...(releasedUnitId !== undefined ? { unitId: releasedUnitId } : {}),
          },
        ],
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "placement_requested", by: event.role, reason: event.reason },
        ],
      };
      const next = replaceMovement(withoutPhantom, movement.id, updatedMovement);
      const reasonText = event.reason.replace(/_/g, " ");
      // Clinical owner ruling, 14 Oct 2026: the ED is ALWAYS notified, whether a bed was released
      // or only an acceptance was withdrawn.
      const notices = [
        makeNotice(
          event.now,
          state.notices.length,
          heldBed ? "bed_pull_released" : "acceptance_withdrawn_referrer",
          referrerOf(movement),
          { movementId: movement.id, unitId: releasedUnitId },
          heldBed
            ? `Bed released and search reopened for ${movement.id} (${reasonText}).`
            : `Acceptance withdrawn and search reopened for ${movement.id} (${reasonText}).`,
        ),
      ];
      // No bed was held: the accepting ward is told its acceptance was released when someone else
      // (the coordinator) made that call (main's ruling, 2026-10-13 22:13 AWST).
      if (!heldBed && releasedUnitId !== undefined && event.role !== "ward") {
        notices.push(
          makeNotice(
            event.now,
            state.notices.length + 1,
            "acceptance_withdrawn_ward",
            { role: "ward", placeId: releasedUnitId },
            { movementId: movement.id, unitId: releasedUnitId },
            `The acceptance for ${movement.id} was released and the search reopened (${reasonText}).`,
          ),
        );
      }
      return appendNotices(next, notices);
    }
  }
}

/**
 * D-72: the configured pull hold, plus `EXTRA_TRAVEL_HOLD_MINUTES` when the acceptance that still
 * stands at this ward asked for the extra-travel hold. See `Movement.extendedHoldAt`.
 */
function pullHoldMinutesFor(state: WardFlowState, movement: Movement, unitId: string): number {
  const extended =
    movement.extendedHoldAt !== undefined &&
    movement.acceptedAt === movement.extendedHoldAt &&
    movement.acceptedUnitId === unitId;
  return state.configuration.pullHoldMinutes + (extended ? EXTRA_TRAVEL_HOLD_MINUTES : 0);
}

/** D-76: the referrer told about a released bed is the origin ED, or the referring community team. */
function referrerOf(movement: Movement) {
  const team = movement.originCommunity?.teamName;
  return team === undefined
    ? { role: "ed" as const, placeId: movement.originEdId }
    : { role: "community" as const, placeId: communityTeamSlug(team) };
}
