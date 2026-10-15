import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  eligibility,
  type EligibilitySubject,
  type EligibilityVerdict,
} from "@/components/ward-management/ward-eligibility";
import { REFERRABLE_MOVEMENT_STAGES } from "@/components/ward-management/ward-flow-reducer";
import type { LegalStatus, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { stayLegalStatus } from "@/components/ward-management/ward-stay-legal";

/**
 * STEP-DOWN BOARD (Top 25 item 8, `top25-step-down-board`). A stay flagged for step-down care
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
    specialling: admission.specialling,
  };
}

export type StepDownWard = { unit: Unit; verdict: EligibilityVerdict; readyBeds: number };

export type StepDownBoardRow = {
  admission: Admission;
  fromUnit: Unit;
  /** Wards that pass every gate and have a Ready bed now, most Ready beds first. */
  wards: StepDownWard[];
  /** An open ward-to-ward movement for this stay that can still be referred, if there is one. */
  transferMovement: Movement | undefined;
};

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
      .sort((a, b) => b.readyBeds - a.readyBeds || a.unit.name.localeCompare(b.unit.name));
    const transferMovement = input.movements.find(
      (movement) =>
        movement.sourceAdmissionId === admission.id &&
        !movement.closure &&
        REFERRABLE_MOVEMENT_STAGES.includes(movement.stage),
    );
    rows.push({ admission, fromUnit, wards, transferMovement });
  }
  return rows;
}
