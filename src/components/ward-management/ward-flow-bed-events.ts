import { appendRefreshRequest } from "./ward/ward-buzz-keys";
import { isDischargeBarrier } from "./ward-admissions";
import { finiteInstant, type AuditDecision } from "./ward-audit";
import { withUndoRecord } from "./ward-undo";
import { numberedBedKind } from "./ward-bed-designation";
import { bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  DISCHARGE_DELAY_CLEAR_REASONS,
  type DischargeDelayClearReason,
} from "@/components/ward-management/ward-change-reasons";
import { nextDischargeCriteria } from "@/components/ward-management/ward-discharge-criteria";
import { type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { leaveBedNeedsOpenWarning } from "@/components/ward-management/ward-legal-clock";
import {
  BED_RELEASE_WAITING_ON,
  type BedRelease,
  type Movement,
  type Notice,
  type Unit,
} from "@/components/ward-management/ward-model";
import type { BedEventHelpers, WardFlowState } from "./ward-flow-reducer";

/**
 * A ward's own beds and stays: bed moves, capacity, bed release and preparation, leave, discharge
 * plans and forms. `reduceClinicalEvent`'s cases for these events, moved here unchanged. The reducer
 * passes its helpers in, since this file may not import the reducer at run time.
 */
export type BedEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "PLACE_IN_BED"
      | "UPDATE_EXPECTED_DISCHARGE"
      | "CLEAR_STAY_DISCHARGE_BLOCKER"
      | "CONFIRM_CAPACITY"
      | "FLAG_BED_RELEASE"
      | "CONFIRM_BED_RELEASE"
      | "REVERT_BED_RELEASE"
      | "BLOCK_BED_RELEASE"
      | "CLEAR_BED_RELEASE_BLOCK"
      | "SET_BED_PREPARATION"
      | "RELEASE_BED"
      | "END_LEAVE_BED"
      | "END_COMMUNITY_TREATMENT_ORDER"
      | "REQUEST_CAPACITY_REFRESH"
      | "SET_STEP_DOWN_CANDIDATE"
      | "SET_DISCHARGE_BARRIER"
      | "SET_DISCHARGE_CRITERIA"
      | "UPLOAD_PATIENT_FORM"
      | "EVALUATE_LEAVE_BED_WARNINGS";
  }
>;

/**
 * Whether two stays belong to the same linked patient. Kept here, on the patient-link allowlist,
 * so Undo can refuse restoring a second bed for one person without reading the link itself.
 */
export function sameLinkedPatient(a: Pick<Admission, "patientId">, b: Pick<Admission, "patientId">): boolean {
  return a.patientId !== null && a.patientId === b.patientId;
}

export function reduceBedEvent(
  state: WardFlowState,
  event: BedEvent,
  decision: AuditDecision,
  helpers: BedEventHelpers,
): WardFlowState {
  const {
    admissionCriteriaEligibility,
    appendNotices,
    bedNumberRefusal,
    findAdmission,
    findBedRelease,
    findLeaveBed,
    findUnit,
    heldBedRefusal,
    makeNotice,
    recordedByLabel,
    reject,
    replaceAdmission,
    replaceBedRelease,
    replaceUnit,
    withAdmissionDischargeDecision,
    withStayBlocker,
  } = helpers;
  switch (event.type) {
    case "PLACE_IN_BED": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.role === "ward" && event.actingUnitId !== admission.unitId)
        return reject(state, event, "A ward may only move patients between its own beds");
      if (!bedIsOccupied(admission)) return reject(state, event, "Only a current stay can be placed in a bed");
      const unit = findUnit(state, admission.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${admission.unitId}`);
      if (admission.bedNumber === event.bedNumber)
        return reject(state, event, `This stay is already recorded in bed ${event.bedNumber}`);
      const bedRefusal = bedNumberRefusal(state, unit, event.bedNumber, admission.id);
      if (bedRefusal) return reject(state, event, bedRefusal);
      const heldRefusal = heldBedRefusal(state, unit, event.bedNumber);
      if (heldRefusal) return reject(state, event, heldRefusal);
      const targetKind = numberedBedKind(unit, event.bedNumber)!;
      const priorKind =
        admission.bedKind ??
        (admission.bedNumber === undefined
          ? unit.lockedBeds === 0
            ? "open"
            : unit.lockedBeds === unit.beds
              ? "locked"
              : undefined
          : numberedBedKind(unit, admission.bedNumber));
      if (priorKind === undefined)
        return reject(
          state,
          event,
          "This mixed-ward stay has no recorded current bed or bed kind; its capacity change cannot be determined safely.",
        );
      const lockedDelta = Number(priorKind === "locked") - Number(targetKind === "locked");
      const lockedAfter = unit.allocatableLocked + lockedDelta;
      // lockedDelta = prior locked − target locked: +1 frees a locked bed (locked→open), −1 takes one
      // (open→locked), 0 is a same-kind move. Only a move that raises the free-locked count is bounded
      // by the confirmed aggregate; one that keeps or lowers it is never refused for a mismatch the
      // schema accepts (CONFIRM_CAPACITY may set the total below the separately recorded count).
      if (lockedAfter < 0 || (lockedDelta > 0 && lockedAfter > Math.min(unit.lockedBeds, unit.allocatable.value)))
        return reject(state, event, "The ward's free bed-kind counts do not support this bed move.");
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const placed = replaceAdmission(state, admission.id, {
        ...admission,
        bedNumber: event.bedNumber,
        bedKind: targetKind,
      });
      return {
        ...placed,
        ...(lockedDelta === 0
          ? {}
          : {
              units: placed.units.map((row) =>
                row.id === unit.id ? { ...unit, allocatableLocked: lockedAfter } : row,
              ),
            }),
        undoRecords: withUndoRecord(state.undoRecords, {
          kind: "bed-placement",
          admissionId: admission.id,
          unitId: admission.unitId,
          at: event.now,
          role: event.role,
          beforeBed: admission.bedNumber ?? null,
          afterBed: event.bedNumber,
          bedKindChange: {
            before: admission.bedKind ?? null,
            after: targetKind,
            lockedBefore: unit.allocatableLocked,
            lockedAfter,
            capacityRevision: (unit.allocatable.revision ?? 0) + (lockedDelta === 0 ? 0 : 1),
          },
        }),
      };
    }

    case "UPDATE_EXPECTED_DISCHARGE": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) {
        return reject(state, event, `no admission found for id ${event.admissionId}`);
      }
      if (admission.state === "departed") {
        return reject(state, event, `cannot update expected discharge for departed admission ${event.admissionId}`);
      }
      if (event.role === "ward" && (!event.actingUnitId || event.actingUnitId !== admission.unitId)) {
        return reject(
          state,
          event,
          `UPDATE_EXPECTED_DISCHARGE was raised acting as unit ${event.actingUnitId ?? "unspecified"} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      if (typeof event.expectedDischargeAt !== "number" || !Number.isFinite(event.expectedDischargeAt)) {
        return reject(state, event, `UPDATE_EXPECTED_DISCHARGE expectedDischargeAt must be a valid timestamp`);
      }
      const isDateMove =
        admission.expectedDischargeAt !== null && admission.expectedDischargeAt !== event.expectedDischargeAt;
      const updated: Admission = {
        ...admission,
        expectedDischargeAt: event.expectedDischargeAt,
        dischargeDateMoves: isDateMove ? admission.dischargeDateMoves + 1 : admission.dischargeDateMoves,
        dischargeDateSetAt: event.now,
        // Walkthrough D8 (25 Sept 2026): "Ward manager" only when a ward set it. A coordinator is not
        // a ward manager, and the approved role list has no other label, so the role is not recorded.
        dischargeDateSetBy: event.role === "ward" ? "Ward manager" : null,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceAdmission(state, admission.id, updated);
    }

    case "CLEAR_STAY_DISCHARGE_BLOCKER": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `CLEAR_STAY_DISCHARGE_BLOCKER was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Refused rather than absorbed: clearing a blocker that was never recorded is a screen defect.
      if (admission.blockReason === null) {
        return reject(state, event, `admission ${admission.id} carries no discharge blocker to clear`);
      }
      if (event.reason !== undefined && !DISCHARGE_DELAY_CLEAR_REASONS.includes(event.reason)) {
        return reject(
          state,
          event,
          `CLEAR_STAY_DISCHARGE_BLOCKER reason must be chosen from DISCHARGE_DELAY_CLEAR_REASONS`,
        );
      }
      // No default: an omitted reason stays omitted rather than becoming a clinical reason.
      const clearedReason = event.reason as DischargeDelayClearReason | undefined;
      const reasonPatch = clearedReason === undefined ? {} : { reason: clearedReason };
      const linkedRelease = state.bedReleases.find(
        (candidate) =>
          candidate.admissionId === admission.id &&
          candidate.state !== "discharged" &&
          candidate.blocker !== null &&
          candidate.unitId === event.actingUnitId &&
          candidate.blocker === admission.blockReason,
      );
      const clearance = { at: event.now, by: event.role, ...reasonPatch, blocker: admission.blockReason };
      if (!linkedRelease) {
        // No bed release to hold the clearance, so the stay keeps it rather than losing it.
        return replaceAdmission(state, admission.id, {
          ...admission,
          blockReason: null,
          stayBlockClearances: [...(admission.stayBlockClearances ?? []), clearance],
        });
      }
      const next = replaceAdmission(state, admission.id, { ...admission, blockReason: null });
      return replaceBedRelease(next, linkedRelease.id, {
        ...linkedRelease,
        blocker: null,
        blockedBy: null,
        lastClearedBlockReason: clearedReason,
        clearedBlockHistory: [...(linkedRelease.clearedBlockHistory ?? []), clearance],
      });
    }

    case "CONFIRM_CAPACITY": {
      // The role check proves only that a ward raised this, not which. This compares the unit the
      // caller said it acts as against the unit written to. It does not prove the claim:
      // `actingUnitId` is whatever the call site supplied and this prototype has no authenticated
      // identity. A recorded assertion, not an authorisation decision; never describe or extend it
      // as one.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // The reducer is the trust boundary: a screen bound is bypassed by other call sites.
      //
      // The bound is `unit.beds`, never `empty.value`: a ward confirmation may disagree with a
      // stale feed (`tests/ward-flow-reducer.test.ts`'s "arrival capacity floor" relies on it).
      // Refuses rather than clamps, so no number the ward never said is recorded.
      if (!Number.isInteger(event.value) || event.value < 0) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY on unit ${unit.id} was given ${event.value}, which is not a whole number of beds`,
        );
      }
      if (event.value > unit.beds) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY says unit ${unit.id} can allocate ${event.value} beds, which is more than the ${unit.beds} beds it has`,
        );
      }
      // Optimistic-concurrency: a caller that read revision N and now writes must be told
      // when any resource change has since landed, rather than silently overwriting it.
      if (
        !Number.isSafeInteger(event.expectedRevision) ||
        (unit.allocatable.revision ?? 0) !== event.expectedRevision
      ) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY on unit ${unit.id} is stale: expected revision ${event.expectedRevision}, current ${unit.allocatable.revision ?? 0}`,
        );
      }
      const updatedUnit: Unit = {
        ...unit,
        ...(unit.reservationReleaseCapacityConflicts === undefined
          ? {}
          : {
              reservationReleaseCapacityConflicts: unit.reservationReleaseCapacityConflicts.filter(
                (entry) => entry.at > event.now,
              ),
            }),
        allocatable: {
          ...unit.allocatable,
          value: event.value,
          source: "ward",
          confirmedAt: event.now,
          revision: (unit.allocatable.revision ?? 0) + 1,
        },
      };
      return replaceUnit(state, unit.id, updatedUnit);
    }

    case "FLAG_BED_RELEASE": {
      // Claim-not-proof, as CONFIRM_CAPACITY: compares the caller's stated unit against the
      // release's unit. `FLAG_BED_RELEASE` is `ward`-only, so the comparison always runs.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `FLAG_BED_RELEASE was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const flaggedUnit = findUnit(state, event.unitId);
      if (!flaggedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Owner decision: a bed release is a named patient's discharge. These checks make
      // `admissionId` real; see `BedRelease.admissionId`.
      const flaggedAdmission = findAdmission(state, event.admissionId);
      if (!flaggedAdmission) {
        return reject(state, event, `no admission found for id ${event.admissionId}`);
      }
      if (flaggedAdmission.unitId !== event.unitId) {
        return reject(
          state,
          event,
          `FLAG_BED_RELEASE names admission ${flaggedAdmission.id} on unit ${flaggedAdmission.unitId}, not unit ${event.unitId}`,
        );
      }
      if (flaggedAdmission.state === "departed") {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} has already left, and a bed release completes when they leave`,
        );
      }
      if (flaggedAdmission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} is ${flaggedAdmission.state}, and only somebody occupying a bed can have a bed release`,
        );
      }
      const flaggedLiveRelease = state.bedReleases.find(
        (r) => r.admissionId === flaggedAdmission.id && r.state !== "discharged",
      );
      if (flaggedLiveRelease) {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} already has a live bed release (${flaggedLiveRelease.id})`,
        );
      }
      // "Blockers are chosen, never typed" (binding spec) is a runtime rule: checked by membership
      // for an untyped caller.
      if (event.blocker !== undefined && !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(state, event, `FLAG_BED_RELEASE blocker must be chosen from BED_RELEASE_BLOCKERS`);
      }
      // A flag always creates an `"expected"` release; a blocker sets the blocked flag on it rather
      // than choosing a different state, so `capacityBreakdown` counts a held-up release.
      // `waitingOn` is kept on both paths.
      //
      // `expectedAt` is the ward's estimate of when the bed will be free (`event.expectedAt`), so
      // `releaseBand()` can classify it; `confirmedAt` is when the ward reported. Neither carries
      // anything about the departing patient's own timing (binding spec §4).
      const flaggingRole = recordedByLabel(event.role, flaggedUnit.name);
      const release: BedRelease = {
        // "WR-9NN": the "9" prefix marks a runtime id. Safe to derive from `bedReleases.length`:
        // nothing ever removes a release.
        id: `WR-9${String(state.bedReleases.length).padStart(2, "0")}`,
        unitId: flaggedUnit.id,
        admissionId: flaggedAdmission.id,
        state: "expected",
        expectedAt: event.expectedAt,
        waitingOn: event.waitingOn,
        // A blocker already recorded on the stay carries over when the flag supplies none.
        blocker: event.blocker ?? flaggedAdmission.blockReason ?? null,
        blockedBy: event.blocker !== undefined || flaggedAdmission.blockReason !== null ? flaggingRole : null,
        // A bed nobody has yet left is not being made ready. Preparation only ever begins after
        // `RELEASE_BED`, and only through `SET_BED_PREPARATION` — see that case.
        preparing: false,
        preparationNote: null,
        confirmedAt: event.now,
        confirmedBy: flaggingRole,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      // The stay's reason follows the release's blocker, so an explicit blocker on the flag is not left off the stay.
      return withStayBlocker(
        { ...state, bedReleases: [...state.bedReleases, release] },
        flaggedAdmission.id,
        release.blocker,
      );
    }

    case "CONFIRM_BED_RELEASE": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      // Claim-not-proof, as FLAG_BED_RELEASE. `CONFIRM_BED_RELEASE` carries the acting unit, so the
      // comparison always runs.
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: expected -> confirmed only. A blocked release is confirmed from whichever
      // stage it is in, keeping its flag.
      if (release.state !== "expected") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to confirmed`);
      }
      // Spec D7: `confirmedAt` restates to `event.now` on every accepted transition, so freshness
      // reports when the current state was last reported. `confirmedBy` is not restated: the guard
      // above guarantees it is the same ward.
      //
      // `blocker`/`blockedBy` carry through untouched: a decided but stuck discharge is still
      // confirmed, and flagged. `CLEAR_BED_RELEASE_BLOCK` is the only way a flag comes off.
      const updated: BedRelease = {
        ...release,
        state: "confirmed",
        waitingOn: null,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return withAdmissionDischargeDecision(
        replaceBedRelease(state, release.id, updated),
        release.admissionId,
        event.now,
        event.role,
      );
    }

    case "REVERT_BED_RELEASE": {
      // The reversal is recorded like every other change (`confirmedAt` restated, `confirmedBy`
      // left alone): a reversal that cannot be recorded honestly gets recorded dishonestly instead.
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `REVERT_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: confirmed -> expected. `discharged` is terminal and `expected` is
      // already there, so both fall into the same refusal.
      if (release.state !== "confirmed") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to expected`);
      }
      // Membership check, not truthiness — the same discipline BLOCK_BED_RELEASE's own blocker
      // check holds to, and for the same reason: a runtime rule, not merely a compile-time one.
      if (!BED_RELEASE_WAITING_ON.includes(event.waitingOn)) {
        return reject(state, event, `REVERT_BED_RELEASE waitingOn must be chosen from BED_RELEASE_WAITING_ON`);
      }
      // The blocked flag survives: reversing the discharge decision does not unstick the bed.
      const reverted: BedRelease = {
        ...release,
        state: "expected",
        waitingOn: event.waitingOn,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return withAdmissionDischargeDecision(
        replaceBedRelease(state, release.id, reverted),
        release.admissionId,
        null,
        event.role,
      );
    }

    case "BLOCK_BED_RELEASE": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `BLOCK_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // "Blocked with no blocker" is a contradiction (spec D3), and "Blockers are chosen, never
      // typed" (binding spec): a real membership test for an untyped caller.
      if (!event.blocker || !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(state, event, `BLOCK_BED_RELEASE requires a blocker chosen from BED_RELEASE_BLOCKERS`);
      }
      // Sets a flag and moves no stage: a blocked release keeps its stage and keeps counting as
      // such. Only `discharged` is refused, since the bed is already free.
      const blockedUnit = findUnit(state, release.unitId);
      if (!blockedUnit) return reject(state, event, `no unit found for id ${release.unitId}`);
      if (release.state === "discharged") {
        return reject(state, event, `cannot block release ${release.id} because it is already released`);
      }
      // Spec D7: same freshness restatement as CONFIRM_BED_RELEASE. `blockedBy` is separate from
      // `confirmedBy`: "who says this bed is stuck" and "who last reported its stage" differ once a
      // block outlives a stage change.
      const updated: BedRelease = {
        ...release,
        blocker: event.blocker,
        blockedBy: recordedByLabel(event.role, blockedUnit.name),
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return withStayBlocker(replaceBedRelease(state, release.id, updated), release.admissionId, event.blocker);
    }

    case "CLEAR_BED_RELEASE_BLOCK": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CLEAR_BED_RELEASE_BLOCK was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Refused rather than a silent no-op: unblocking an unflagged release is a screen defect to
      // surface.
      if (release.blocker === null) {
        return reject(state, event, `release ${release.id} carries no blocked flag to clear`);
      }
      if (event.reason !== undefined && !DISCHARGE_DELAY_CLEAR_REASONS.includes(event.reason)) {
        return reject(state, event, `CLEAR_BED_RELEASE_BLOCK reason must be chosen from DISCHARGE_DELAY_CLEAR_REASONS`);
      }
      // No default: an omitted reason stays omitted rather than becoming a clinical reason.
      const clearedReason = event.reason as DischargeDelayClearReason | undefined;
      const reasonPatch = clearedReason === undefined ? {} : { reason: clearedReason };
      const unblocked: BedRelease = {
        ...release,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
        lastClearedBlockReason: clearedReason,
        clearedBlockHistory: [
          ...(release.clearedBlockHistory ?? []),
          { at: event.now, by: event.role, ...reasonPatch, blocker: release.blocker },
        ],
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return withStayBlocker(replaceBedRelease(state, release.id, unblocked), release.admissionId, null);
    }

    case "SET_BED_PREPARATION": {
      // Q4: marks a bed as being made ready and nothing else. It touches no unit field or capacity
      // figure, so the bed stays offered and counted as the owner requires. Do not add a unit write
      // here to "hold" a bed while it is cleaned.
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // "Notes are chosen, never typed" is a runtime rule: anything outside `BED_PREPARATION_NOTES`
      // is refused. The `string | undefined` binding and `readonly string[]` widening keep the
      // check compiling if the list is ever emptied.
      const requestedNote: string | undefined = event.note;
      if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) {
        return reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`);
      }
      const prepared: BedRelease = {
        ...release,
        preparing: event.preparing,
        // Clearing the flag clears the note with it — "being made ready, waiting on nothing" is
        // a state, "not being made ready, waiting on a clean" is a contradiction.
        preparationNote: event.preparing ? (event.note ?? null) : null,
        // Audit 2 E-11: once the patient has left, `confirmedAt` is the departure time the
        // Discharges board shows, so making the bed ready never rewrites it.
        confirmedAt: release.state === "discharged" ? release.confirmedAt : event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(state, release.id, prepared);
    }

    case "RELEASE_BED": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `RELEASE_BED was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transitions: confirmed -> discharged and expected -> discharged; `discharged` is
      // terminal (owner ruling: discharged, not released). Expected is accepted deliberately: "the
      // person has left" is a fact about an empty bed.
      if (release.state === "discharged") {
        return reject(state, event, `release ${release.id} is already discharged and cannot be discharged again`);
      }
      const unit = findUnit(state, release.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${release.unitId}`);
      // Owner decision: this completes a release only once its named admission has left. While they
      // are still in the bed, `RECORD_LEAVING` is what completes it. See `departAdmission`.
      const releasedAdmission = findAdmission(state, release.admissionId);
      if (!releasedAdmission) {
        return reject(
          state,
          event,
          `release ${release.id} names admission ${release.admissionId}, which does not exist`,
        );
      }
      if (releasedAdmission.state !== "departed") {
        return reject(
          state,
          event,
          `release ${release.id} completes when admission ${releasedAdmission.id} is recorded as having left (RECORD_LEAVING); they are still ${releasedAdmission.state}`,
        );
      }
      // Spec D7: same freshness restatement as CONFIRM_BED_RELEASE. The blocked flag comes off here
      // too: once the bed is free nothing is held up.
      const updatedRelease: BedRelease = {
        ...release,
        state: "discharged",
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
      };
      // The person has already left (refused above otherwise) and `departAdmission` moved the
      // figures then; this event only records the stage and never moves a count, so the unit is left
      // as it is. `unitCapacity`'s reconciliation identity (`tests/ward-capacity-reconciliation.test.ts`)
      // depends on that. `sexMix` is not touched either: a release does not say who left, so the
      // count moves when the admission departs (owner rulings), never by guessing here. Audit A1-11:
      // recording the stage never stamps the ward's figures as confirmed.
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(state, release.id, updatedRelease);
    }

    case "END_LEAVE_BED": {
      const leaveBed = findLeaveBed(state, event.leaveBedId);
      if (!leaveBed) return reject(state, event, `no leave bed found for id ${event.leaveBedId}`);
      if (event.actingUnitId !== leaveBed.unitId) {
        return reject(
          state,
          event,
          `END_LEAVE_BED was raised acting as unit ${event.actingUnitId} but leave bed ${leaveBed.id} belongs to unit ${leaveBed.unitId}`,
        );
      }
      return { ...state, leaveBeds: state.leaveBeds.filter((candidate) => candidate.id !== leaveBed.id) };
    }

    case "END_COMMUNITY_TREATMENT_ORDER": {
      const patient = state.patients.find((candidate) => candidate.id === event.patientId);
      if (!patient) return reject(state, event, `no patient found for id ${event.patientId}`);
      if (!patient.communityTreatmentOrder || patient.communityTreatmentOrder.endedAt !== undefined) {
        return reject(state, event, `patient ${patient.id} has no community treatment order recorded`);
      }
      const ended = { ...patient.communityTreatmentOrder, endedAt: event.now };
      return {
        ...state,
        patients: state.patients.map((candidate) =>
          candidate.id === patient.id ? { ...candidate, communityTreatmentOrder: ended } : candidate,
        ),
      };
    }

    case "REQUEST_CAPACITY_REFRESH": {
      // Spec D12: changes no number; it only records who asked and when. Nothing leaves the sandbox
      // and no message is sent.
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      return {
        ...state,
        refreshRequests: appendRefreshRequest(
          state.refreshRequests,
          {
            unitId: unit.id,
            at: event.now,
            byRole: event.role,
          },
          state.worldGeneration,
        ),
      };
    }

    case "SET_STEP_DOWN_CANDIDATE": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      // Same claim-not-proof discipline as RECORD_LEAVING: a ward may only touch its own admission.
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `SET_STEP_DOWN_CANDIDATE was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
        );
      }

      const updatedAdmission: Admission = {
        ...admission,
        stepDownCandidate: event.stepDownCandidate,
      };

      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? updatedAdmission : a)),
      };
    }

    case "SET_DISCHARGE_BARRIER": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `SET_DISCHARGE_BARRIER was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
        );
      }

      // Chosen from DISCHARGE_BARRIERS, never typed: this event is on the persistence safe list, so
      // anything off the list would reach browser storage as free text (review findings S2-12/A2-2).
      if (event.barrier !== null && event.barrier !== "None" && !isDischargeBarrier(event.barrier)) {
        return reject(state, event, "SET_DISCHARGE_BARRIER barrier must be chosen from DISCHARGE_BARRIERS");
      }

      const updatedAdmission: Admission = {
        ...admission,
        dischargeBarrier: event.barrier === "None" ? null : event.barrier,
      };

      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? updatedAdmission : a)),
      };
    }

    case "SET_DISCHARGE_CRITERIA": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(state, event, "Discharge criteria can only be set by the patient's own ward.");
      }
      if (admission.state !== "occupied")
        return reject(state, event, "Discharge criteria are for a patient on the ward.");
      if (finiteInstant(event.now) === null) return reject(state, event, "Discharge criteria review time is invalid.");
      const eligibility = admissionCriteriaEligibility(state, admission);
      const next = nextDischargeCriteria(admission.dischargeCriteria, event, eligibility, event.now);
      if ("refusal" in next) return reject(state, event, next.refusal);
      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? { ...a, dischargeCriteria: next.record } : a)),
      };
    }

    case "UPLOAD_PATIENT_FORM": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);

      // This prototype records document details only; empty details are not a document.
      if (
        typeof event.formName !== "string" ||
        event.formName.trim().length === 0 ||
        typeof event.fileName !== "string" ||
        event.fileName.trim().length === 0
      ) {
        return reject(state, event, "Enter the document name and file name.");
      }
      const sizeBytes = event.sizeBytes;
      if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
        return reject(state, event, "Document details need a non-empty file with a valid byte size.");
      }

      const newForm = {
        id: `FORM-${event.now}-${(movement.uploadedForms?.length ?? 0) + 1}`,
        formName: event.formName,
        fileName: event.fileName,
        sizeBytes,
        uploadedAt: event.now,
        uploadedBy: event.role,
      };

      const updatedMovement: Movement = {
        ...movement,
        uploadedForms: [...(movement.uploadedForms ?? []), newForm],
      };

      return {
        ...state,
        movements: state.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
      };
    }

    case "EVALUATE_LEAVE_BED_WARNINGS": {
      let noticeCount = state.notices.length;
      const notices: Notice[] = [];
      const leaveBeds = state.leaveBeds.map((leaveBed) => {
        if (leaveBed.openWarningAt !== undefined) return leaveBed;
        if (!leaveBedNeedsOpenWarning(leaveBed.confirmedAt, leaveBed.openWarningAt, event.now)) {
          return leaveBed;
        }
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "leave_bed_open_warning",
            { role: "ward", placeId: leaveBed.unitId },
            { unitId: leaveBed.unitId },
            `Leave bed ${leaveBed.id} has been away for more than 24 hours — consider opening it.`,
          ),
        );
        return { ...leaveBed, openWarningAt: event.now };
      });
      const next = { ...state, leaveBeds };
      return notices.length === 0 ? next : appendNotices(next, notices);
    }

    default: {
      // Sub-reducer slice narrowed via `Extract<WardFlowEvent, ...>`; ensure every BedEvent case is handled.
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}
