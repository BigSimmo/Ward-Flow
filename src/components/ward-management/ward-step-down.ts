import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { lockedBedsFree } from "@/components/ward-management/ward-bed-designation";
import {
  eligibility,
  type EligibilitySubject,
  type EligibilityVerdict,
} from "@/components/ward-management/ward-eligibility";
import { REFERRABLE_MOVEMENT_STAGES } from "@/components/ward-management/ward-flow-reducer";
import {
  genderReviewNeeded,
  type LegalStatus,
  type Movement,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { stayLegalStatus } from "@/components/ward-management/ward-stay-legal";

/**
 * STEP-DOWN BOARD (Top 25 item 8). A stay flagged for step-down care
 * (`Admission.stepDownCandidate`, set by `SET_STEP_DOWN_CANDIDATE`) is matched to wards by the SAME
 * `eligibility()` gates the movement path uses, so single sex designation (D-31), sex mix, legal
 * authorisation, cohort, forensic and capacity freshness all apply. The showcase version matched on
 * cohort and open beds alone; this replaces its matching, not adds a second one.
 */

const LEGAL_STATUSES: readonly LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];

/**
 * The stay-based adapter: a candidate movement-like input built from the admission. Stepping down
 * asks for an open bed, so `security` is "Open". The legal status is the stay's recorded one; when
 * none is recorded it stays `undefined`, which the authorisation gate treats as needing an
 * authorised ward. A stay has no declines and no gender placement record of its own.
 */
export function stepDownSubject(
  admission: Admission,
  fromUnit: Unit,
  legalStatus: string | undefined,
): EligibilitySubject {
  return {
    legalStatus: LEGAL_STATUSES.find((status) => status === legalStatus),
    declines: [],
    gender: admission.gender,
    sex: admission.sex,
    genderPlacements: undefined,
    cohort: fromUnit.cohort,
    security: "Open",
    highAcuity: admission.highAcuity,
    observation: admission.observation,
  };
}

type StepDownWard = { unit: Unit; verdict: EligibilityVerdict; readyBeds: number };

export type StepDownSwapCandidate = {
  incomingMovement: Movement;
  verdict: EligibilityVerdict;
};

export type StepDownBoardRow = {
  admission: Admission;
  fromUnit: Unit;
  /** Wards that pass every gate and have a Ready bed now, most Ready beds first. */
  wards: StepDownWard[];
  /** An open ward-to-ward movement for this stay that can still be referred, if there is one. */
  transferMovement: Movement | undefined;
  /**
   * Top 25 item 16 (D-30): open incoming admission movements that pass
   * `eligibility()` on the LIVE `fromUnit`. Owner ruling (17 Oct 2026, 10:13 PM AWST): the incoming
   * leg is offered only once a bed there is actually free, never against a modelled freed bed, and
   * there is no combined swap. A Secure movement needs a locked bed actually free. Empty when no
   * receiving step-down ward has a Ready bed now.
   */
  swapCandidates: StepDownSwapCandidate[];
  /**
   * Owner ruling (17 Oct 2026, 10:13 PM AWST): movements that would otherwise match but need a
   * coordinator gender placement review for `fromUnit` (`genderReviewNeeded`, no placement record
   * covering it). They are never offered as a swap; the board routes them to Placement.
   */
  placementReview: Movement[];
  /** Whether `fromUnit` has a bed actually free now (the bounded Ready figure is above 0). */
  fromUnitHasFreeBed: boolean;
};

/** A movement whose recorded sex and gender need a coordinator placement for this ward first. */
function needsGenderPlacementReview(movement: Movement, unitId: string): boolean {
  return (
    genderReviewNeeded(movement.gender, movement.sex) &&
    !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(unitId))
  );
}

/**
 * Incoming movements for the step-down swap, split into those the board may refer to `fromUnit`
 * now and those it routes to Placement for a gender placement review. Both are checked against the
 * live `fromUnit`, so nothing is offered until a bed there is actually free.
 */
export function deriveStepDownSwapCandidates(input: {
  fromUnit: Unit;
  movements: readonly Movement[];
  transferMovementId?: string;
  now: Instant;
}): { candidates: StepDownSwapCandidate[]; placementReview: Movement[] } {
  const { fromUnit } = input;
  // "Actually free" is the bounded Ready figure: allocatable AND physically empty, never closed.
  const freeNow = boundedBedAvailability(fromUnit).available;
  if (freeNow <= 0) return { candidates: [], placementReview: [] };
  const matches = input.movements
    .filter(
      (movement) =>
        !movement.closure &&
        movement.id !== input.transferMovementId &&
        movement.sourceAdmissionId === undefined &&
        movement.acceptedUnitId !== fromUnit.id &&
        REFERRABLE_MOVEMENT_STAGES.includes(movement.stage) &&
        // A Secure movement is offered only if a locked bed is actually free on this ward.
        (movement.security !== "Secure" || Math.min(lockedBedsFree(fromUnit), freeNow) > 0),
    )
    .map((incomingMovement) => ({
      incomingMovement,
      verdict: eligibility(incomingMovement, fromUnit, input.now),
    }))
    .filter((candidate) => candidate.verdict.eligible)
    // Audit 1, Josh 20 Oct (CS-04, NB-7): longest wait first, then the id. Secure or high-acuity
    // patients used to sort first; acuity and security are shown on the row instead.
    .sort(
      (a, b) =>
        a.incomingMovement.openedAt - b.incomingMovement.openedAt ||
        (a.incomingMovement.id < b.incomingMovement.id ? -1 : a.incomingMovement.id > b.incomingMovement.id ? 1 : 0),
    );
  return {
    candidates: matches.filter((candidate) => !needsGenderPlacementReview(candidate.incomingMovement, fromUnit.id)),
    placementReview: matches
      .filter((candidate) => needsGenderPlacementReview(candidate.incomingMovement, fromUnit.id))
      .map((candidate) => candidate.incomingMovement),
  };
}

export function deriveStepDownBoard(input: {
  admissions: readonly Admission[];
  units: readonly Unit[];
  movements: readonly Movement[];
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  now: Instant;
}): StepDownBoardRow[] {
  const rows: StepDownBoardRow[] = [];
  for (const admission of input.admissions) {
    if (admission.stepDownCandidate !== true || admission.state !== "occupied") continue;
    const fromUnit = input.units.find((unit) => unit.id === admission.unitId);
    if (!fromUnit) continue;
    const subject = stepDownSubject(
      admission,
      fromUnit,
      stayLegalStatus(admission, { movements: input.movements, patients: input.patients, referrals: input.referrals }),
    );
    const wards = input.units
      .filter((unit) => unit.id !== fromUnit.id)
      .map((unit) => ({
        unit,
        verdict: eligibility(subject, unit, input.now),
        readyBeds: boundedBedAvailability(unit).available,
      }))
      .filter((ward) => ward.verdict.eligible && ward.readyBeds > 0)
      // Audit 1, Josh 20 Oct: a fixed order by name, not most Ready beds first.
      .sort((a, b) => a.unit.name.localeCompare(b.unit.name));
    const transferMovement = input.movements.find(
      (movement) =>
        movement.sourceAdmissionId === admission.id &&
        !movement.closure &&
        REFERRABLE_MOVEMENT_STAGES.includes(movement.stage),
    );
    const swap =
      wards.length > 0
        ? deriveStepDownSwapCandidates({
            fromUnit,
            movements: input.movements,
            transferMovementId: transferMovement?.id,
            now: input.now,
          })
        : { candidates: [], placementReview: [] };
    rows.push({
      admission,
      fromUnit,
      wards,
      transferMovement,
      swapCandidates: swap.candidates,
      placementReview: swap.placementReview,
      fromUnitHasFreeBed: boundedBedAvailability(fromUnit).available > 0,
    });
  }
  return rows;
}
