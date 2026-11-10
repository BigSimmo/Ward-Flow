/**
 * M134 (audit 10 Nov 2026, approved by Josh as D-125): the synthetic hard cases, as an opt-in
 * overlay on the standard seed. Audits and demos that pass "on the seed" prove nothing for a case
 * the seed lacks, so this adds one record for each case the default seed did not hold:
 *
 * - absent without leave on a voluntary stay (WL-001's stay) and on an involuntary one (a new leave
 *   bed, WL-HC01, for the first involuntary inpatient on a ward);
 * - an admitted inpatient whose journey carries a Form 5A (an arrived journey linked to a new stay);
 * - one-to-one (within sight) and two-to-one observation on admitted stays;
 * - a ward with 0 beds (a new synthetic unit on an existing site);
 * - look-alike names: two people on one ward with the same family name and given-name initial.
 *
 * Data only: no rule, threshold or verdict changes, and every name and number is invented. It is
 * NOT applied by `seedWardFlowState`, so no existing count, screen or test moves; a test or a demo
 * opts in by calling `applyHardCasesOverlay(seedWardFlowState())`. Records missing from the seed are
 * skipped rather than invented around, so a later seed edit never breaks the overlay.
 */
import type { Admission } from "./ward-admissions";
import type { Instant } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";
import type { LeaveBed, Unit } from "./ward-model";
import { observationAt } from "./ward-observation";

const VOLUNTARY_AWOL_LEAVE_ID = "WL-001";
const FORM_5A_MOVEMENT_ID = "WF-300";
const ONE_TO_ONE_ADMISSION_ID = "AD-SCGA-02";
const TWO_TO_ONE_ADMISSION_ID = "AD-SCGA-03";
// PT-003 (Ines Marrowby) is on this ward; the look-alike shares her family name and initial.
const LOOK_ALIKE_PATIENT_ID = "PT-G-AD-RPHS-01";

export const HARD_CASE_IDS = {
  involuntaryAwolLeaveBed: "WL-HC01",
  form5aAdmission: "AD-HC-5A",
  zeroBedUnit: "rph-hc-zero-bed",
} as const;

const NURSE = "Nurse in charge";

function zeroBedUnit(template: Unit, now: Instant): Unit {
  const figure = (staleAfterMinutes: number) => ({
    value: 0,
    source: "ward" as const,
    confirmedAt: now - 30,
    staleAfterMinutes,
  });
  return {
    id: HARD_CASE_IDS.zeroBedUnit,
    siteCode: template.siteCode,
    name: "Synthetic annexe (no beds)",
    cohort: "Adult",
    lockedBeds: 0,
    authorised: false,
    beds: 0,
    empty: { ...figure(template.empty.staleAfterMinutes), source: "feed" },
    allocatable: figure(template.allocatable.staleAfterMinutes),
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix: { Female: 0, Male: 0 },
    speciallingCapacity: 0,
    highAcuityCapacity: 0,
    sexDesignation: "Undesignated",
    forensic: false,
  };
}

export function applyHardCasesOverlay(state: WardFlowState, now: Instant): WardFlowState {
  const admissionById = new Map(state.admissions.map((admission) => [admission.id, admission]));

  // Absent without leave on a voluntary stay: the existing leave bed, now recorded as missing.
  let leaveBeds = state.leaveBeds.map((bed): LeaveBed =>
    bed.id === VOLUNTARY_AWOL_LEAVE_ID && !bed.absentWithoutLeave
      ? {
          ...bed,
          absentWithoutLeave: {
            since: now - 35,
            steps: [
              { step: "searched", at: now - 30 },
              { step: "psychiatrist_told", at: now - 25 },
            ],
          },
        }
      : bed,
  );
  // Absent without leave on an involuntary stay: a new leave bed for a stay with none.
  // The first stay of an involuntary inpatient that is on the ward (not on leave, not away at an ED).
  const involuntaryPatients = new Set(
    state.patients.filter((patient) => patient.legalStatus === "Involuntary inpatient").map((patient) => patient.id),
  );
  const involuntary = state.admissions.find(
    (admission) =>
      admission.state === "occupied" &&
      admission.movementId === null &&
      admission.awayAtEmergencyDepartmentSince === null &&
      admission.patientId !== null &&
      involuntaryPatients.has(admission.patientId) &&
      !leaveBeds.some((bed) => bed.admissionId === admission.id),
  );
  if (involuntary && !leaveBeds.some((bed) => bed.id === HARD_CASE_IDS.involuntaryAwolLeaveBed)) {
    leaveBeds = [
      ...leaveBeds,
      {
        id: HARD_CASE_IDS.involuntaryAwolLeaveBed,
        unitId: involuntary.unitId,
        admissionId: involuntary.id,
        expectedReturn: now - 20,
        confirmedAt: now - 180,
        confirmedBy: NURSE,
        kind: "off_ward",
        psychiatristAuthorised: true,
        absentWithoutLeave: {
          since: now - 50,
          steps: [
            { step: "searched", at: now - 45 },
            { step: "psychiatrist_told", at: now - 40 },
            { step: "return_order_made", at: now - 30 },
          ],
        },
      },
    ];
  }

  // Constant observation on admitted stays: one within sight (1:1), one two-staff (2:1).
  let admissions = state.admissions.map((admission): Admission => {
    if (admission.state !== "occupied") return admission;
    if (admission.id === ONE_TO_ONE_ADMISSION_ID) return { ...admission, observation: observationAt("within_sight") };
    if (admission.id === TWO_TO_ONE_ADMISSION_ID) return { ...admission, observation: observationAt("two_staff") };
    return admission;
  });

  // An admitted inpatient on Form 5A: the arrived journey gets its stay, and the stay its journey.
  let movements = state.movements;
  const arrived = movements.find((movement) => movement.id === FORM_5A_MOVEMENT_ID);
  const template = admissions.find(
    (admission) => admission.state === "occupied" && admission.unitId === arrived?.acceptedUnitId,
  );
  if (
    arrived?.closure?.outcome === "arrived" &&
    arrived.admissionId === undefined &&
    arrived.patientId !== undefined &&
    template &&
    !admissionById.has(HARD_CASE_IDS.form5aAdmission)
  ) {
    const arrivedAt = arrived.closure.at;
    admissions = [
      ...admissions,
      {
        ...template,
        id: HARD_CASE_IDS.form5aAdmission,
        movementId: arrived.id,
        referralId: arrived.referralId ?? null,
        patientId: arrived.patientId,
        sex: arrived.sex,
        ...(arrived.gender !== undefined ? { gender: arrived.gender } : {}),
        observation: arrived.observation,
        highAcuity: arrived.highAcuity,
        pulledAt: arrivedAt - 60,
        arrivedAt,
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
      } as Admission,
    ];
    movements = movements.map((movement) =>
      movement.id === arrived.id
        ? { ...movement, admissionId: HARD_CASE_IDS.form5aAdmission, legalForm: { code: "5A" } }
        : movement,
    );
  }

  // A ward with 0 beds, on an existing site.
  const site = state.units[0];
  const units =
    site && !state.units.some((unit) => unit.id === HARD_CASE_IDS.zeroBedUnit)
      ? [...state.units, zeroBedUnit(site, now)]
      : state.units;

  // Look-alike names on one ward: same family name and given-name initial as PT-003.
  const patients = state.patients.map((patient) =>
    patient.id === LOOK_ALIKE_PATIENT_ID ? { ...patient, givenName: "Isobel", familyName: "Marrowby" } : patient,
  );

  return { ...state, leaveBeds, admissions, movements, units, patients };
}
