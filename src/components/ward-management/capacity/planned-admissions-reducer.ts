// src/components/ward-management/capacity/planned-admissions-reducer.ts
//
// Planned admissions calendar (stream D, Josh, 9 October 2026): book a known future admission,
// change it, cancel it, and convert it to an ordinary occupied admission when the person arrives.
// Every write is a reducer event, so it reaches the session event log and history like any other.
//
// A booking holds no bed. Only `CONVERT_PLANNED_ADMISSION` moves a capacity figure, and it refuses
// when the ward has no empty, allocatable bed: no booking creates a bed.
import { bedsPendingPreparation, openBedsNow } from "../ward-bed-availability";
import { lockedBedsFree, openBedsFree } from "../ward-bed-designation";
import {
  isPlannedAdmissionLegalStatus,
  isPlannedAdmissionStayDays,
  normalisePlannedAdmissionInitials,
  PLANNED_ADMISSION_CANCEL_REASONS,
  PLANNED_ADMISSION_REASONS,
  PLANNED_ADMISSION_WINDOW_DAYS,
  type Admission,
  type PlannedAdmission,
} from "../ward-admissions";
import { finiteInstant, type AuditDecision } from "../ward-audit";
import { emptyCareJourney } from "../ward-care-journey";
import { MINUTES_PER_DAY, type Instant } from "../ward-clock";
import { adjustSexMix, mixSexOf } from "../ward-eligibility";
import type { WardFlowEvent } from "../ward-flow-events";
import type { WardFlowState } from "../ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "../ward-flow-roles";
import { RECORDED_SEXES, type LegalStatus, type Movement, type MovementId, type Unit } from "../ward-model";
import { patientCohort, type Patient } from "../ward-patients";

export type RejectFn = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

/**
 * The reducer's own placement refusal (`eligibilityRefusal` in `ward-flow-reducer.ts`, the one
 * `PULL_PATIENT` calls), passed in rather than imported so this module never imports the reducer
 * at runtime. A conversion has no override path, so no override reason is ever supplied.
 */
export type PlacementRefusalFn = (movement: Movement, unit: Unit, now: Instant) => string | null;

type PlannedAdmissionEvent = Extract<
  WardFlowEvent,
  {
    type:
      "BOOK_PLANNED_ADMISSION" | "CHANGE_PLANNED_ADMISSION" | "CANCEL_PLANNED_ADMISSION" | "CONVERT_PLANNED_ADMISSION";
  }
>;

/** The statuses that take a locked bed first when one is free. */
const LOCKED_FIRST: readonly LegalStatus[] = ["Involuntary inpatient", "Detained awaiting examination"];

/**
 * The booking seen as the movement `eligibility()` reads, so a conversion is checked by the same
 * gates as a pulled bed: gender designation first (no override path), then every suitability gate.
 * The booking records sex only, never gender, so `gender` stays unset: an undesignated ward takes
 * the person, a single-sex ward refuses until gender is recorded through a referral. A linked
 * patient's cohort comes from their date of birth; initials-only bookings keep the ward's cohort
 * because no age band was recorded on the booking.
 */
function plannedAdmissionMovementView(
  planned: PlannedAdmission,
  unit: Unit,
  patient: Patient | null,
): Movement {
  const cohort =
    patient?.dateOfBirth !== undefined && patient.dateOfBirth !== ""
      ? patientCohort(patient.dateOfBirth)
      : unit.cohort;
  return {
    id: `WF-${planned.id}` as MovementId,
    originEdId: "",
    openedAt: planned.bookedAt,
    flaggedUrgent: false,
    urgency: 3,
    cohort,
    security: LOCKED_FIRST.includes(planned.legalStatus) ? "Secure" : "Open",
    sex: planned.sex,
    specialling: false,
    highAcuity: false,
    legalStatus: planned.legalStatus,
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "accepted_awaiting_bed",
    owner: "",
    referredUnitIds: [unit.id],
    acceptedUnitId: unit.id,
    declines: [],
    blocker: "",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  };
}

export function nextPlannedAdmissionId(sequence: number): string {
  return `PA-${String(sequence).padStart(2, "0")}`;
}

function plannedAdmissions(state: WardFlowState): PlannedAdmission[] {
  return Array.isArray(state.plannedAdmissions) ? state.plannedAdmissions : [];
}

/** A ward caller must name the ward it acts for, and may act only for that ward. */
function wardScopeRefusal(event: PlannedAdmissionEvent, unitIds: readonly string[]): string | null {
  if (event.role !== "ward") return null;
  if (!event.actingUnitId) return `${event.type} raised as ward must state its actingUnitId`;
  if (unitIds.some((unitId) => unitId !== event.actingUnitId))
    return `ward ${event.actingUnitId} can act only on its own planned admissions`;
  return null;
}

/** Shared checks for the fields a booking and a change both carry (reason membership is checked in each case). */
function bookingFieldsRefusal(
  state: WardFlowState,
  event: Extract<PlannedAdmissionEvent, { type: "BOOK_PLANNED_ADMISSION" | "CHANGE_PLANNED_ADMISSION" }>,
): string | null {
  if (!state.units.some((unit) => unit.id === event.unitId)) return `no unit found for id ${event.unitId}`;
  if (finiteInstant(event.expectedArrivalAt) === null)
    return `${event.type} expectedArrivalAt must be a finite instant`;
  if (event.expectedArrivalAt > event.now + PLANNED_ADMISSION_WINDOW_DAYS * MINUTES_PER_DAY)
    return `${event.type} expected arrival must fall within the next ${PLANNED_ADMISSION_WINDOW_DAYS} days`;
  if (!isPlannedAdmissionStayDays(event.expectedStayDays))
    return `${event.type} expectedStayDays must be a whole number of days within the form's bound`;
  if (!isPlannedAdmissionLegalStatus(event.legalStatus))
    return `${event.type} legalStatus must be chosen from the listed statuses`;
  return null;
}

/**
 * Handles the four planned-admission events, or returns `null` for any other event.
 */
export function reducePlannedAdmissionEvent(
  state: WardFlowState,
  event: WardFlowEvent,
  decision: AuditDecision,
  reject: RejectFn,
  placementRefusal: PlacementRefusalFn,
): WardFlowState | null {
  switch (event.type) {
    case "BOOK_PLANNED_ADMISSION": {
      if (finiteInstant(event.now) === null) return reject(state, event, "BOOK_PLANNED_ADMISSION needs a finite time");
      if (!PLANNED_ADMISSION_REASONS.includes(event.reason))
        return reject(state, event, "BOOK_PLANNED_ADMISSION reason must be chosen from the listed reasons");
      const fields = bookingFieldsRefusal(state, event);
      if (fields) return reject(state, event, fields);
      if (event.expectedArrivalAt < event.now)
        return reject(state, event, "BOOK_PLANNED_ADMISSION expected arrival must not be in the past");
      const scope = wardScopeRefusal(event, [event.unitId]);
      if (scope) return reject(state, event, scope);
      if (!(RECORDED_SEXES as readonly string[]).includes(event.sex))
        return reject(state, event, "BOOK_PLANNED_ADMISSION sex must be chosen from the recorded sexes");
      const hasPatient = typeof event.patientId === "string" && event.patientId.length > 0;
      const hasInitials = typeof event.initials === "string" && event.initials.trim().length > 0;
      if (hasPatient === hasInitials)
        return reject(state, event, "BOOK_PLANNED_ADMISSION needs either an existing patient or initials, not both");
      let initials: string | null = null;
      if (hasPatient) {
        if (!state.patients.some((patient) => patient.id === event.patientId))
          return reject(state, event, `no patient found for id ${event.patientId}`);
        if (
          state.admissions.some(
            (admission) =>
              admission.patientId === event.patientId &&
              (admission.state === "pulled" || admission.state === "occupied"),
          )
        )
          return reject(state, event, "This patient already holds a bed or occupies another ward.");
        if (
          plannedAdmissions(state).some(
            (planned) => planned.state === "booked" && planned.patientId === event.patientId,
          )
        )
          return reject(state, event, "This patient already has a planned admission booked.");
      } else {
        initials = normalisePlannedAdmissionInitials(event.initials);
        if (initials === null)
          return reject(state, event, "BOOK_PLANNED_ADMISSION initials must be one to three letters");
      }
      const sequence = (state.plannedAdmissionSequence ?? 0) + 1;
      const booked: PlannedAdmission = {
        id: nextPlannedAdmissionId(sequence),
        patientId: hasPatient ? (event.patientId ?? null) : null,
        initials,
        sex: event.sex,
        reason: event.reason,
        unitId: event.unitId,
        expectedArrivalAt: event.expectedArrivalAt,
        expectedStayDays: event.expectedStayDays,
        legalStatus: event.legalStatus,
        state: "booked",
        bookedAt: event.now,
        bookedBy: WARD_FLOW_ROLE_LABELS[event.role],
        changedAt: null,
        changeCount: 0,
        cancelledAt: null,
        cancelReason: null,
        convertedAt: null,
        admissionId: null,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...state,
        plannedAdmissions: [...plannedAdmissions(state), booked],
        plannedAdmissionSequence: sequence,
      };
    }

    case "CHANGE_PLANNED_ADMISSION": {
      if (finiteInstant(event.now) === null)
        return reject(state, event, "CHANGE_PLANNED_ADMISSION needs a finite time");
      if (!PLANNED_ADMISSION_REASONS.includes(event.reason))
        return reject(state, event, "CHANGE_PLANNED_ADMISSION reason must be chosen from the listed reasons");
      const planned = plannedAdmissions(state).find((candidate) => candidate.id === event.plannedAdmissionId);
      if (!planned) return reject(state, event, "This planned admission was not found");
      if (planned.state !== "booked")
        return reject(state, event, `This planned admission is ${planned.state} and can no longer change`);
      const fields = bookingFieldsRefusal(state, event);
      if (fields) return reject(state, event, fields);
      const scope = wardScopeRefusal(event, [planned.unitId, event.unitId]);
      if (scope) return reject(state, event, scope);
      // Preserve an already-overdue arrival; refuse only a newly chosen past time.
      if (event.expectedArrivalAt < event.now && event.expectedArrivalAt !== planned.expectedArrivalAt)
        return reject(state, event, "CHANGE_PLANNED_ADMISSION expected arrival must not be in the past");
      const changed: PlannedAdmission = {
        ...planned,
        reason: event.reason,
        unitId: event.unitId,
        expectedArrivalAt: event.expectedArrivalAt,
        expectedStayDays: event.expectedStayDays,
        legalStatus: event.legalStatus,
        changedAt: event.now,
        changeCount: planned.changeCount + 1,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...state,
        plannedAdmissions: plannedAdmissions(state).map((candidate) =>
          candidate.id === planned.id ? changed : candidate,
        ),
      };
    }

    case "CANCEL_PLANNED_ADMISSION": {
      if (finiteInstant(event.now) === null)
        return reject(state, event, "CANCEL_PLANNED_ADMISSION needs a finite time");
      const planned = plannedAdmissions(state).find((candidate) => candidate.id === event.plannedAdmissionId);
      if (!planned) return reject(state, event, "This planned admission was not found");
      if (planned.state !== "booked") return reject(state, event, `This planned admission is already ${planned.state}`);
      if (!PLANNED_ADMISSION_CANCEL_REASONS.includes(event.reason))
        return reject(state, event, "CANCEL_PLANNED_ADMISSION reason must be chosen from the listed reasons");
      const scope = wardScopeRefusal(event, [planned.unitId]);
      if (scope) return reject(state, event, scope);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...state,
        plannedAdmissions: plannedAdmissions(state).map((candidate) =>
          candidate.id === planned.id
            ? { ...candidate, state: "cancelled" as const, cancelledAt: event.now, cancelReason: event.reason }
            : candidate,
        ),
      };
    }

    case "CONVERT_PLANNED_ADMISSION": {
      if (finiteInstant(event.now) === null)
        return reject(state, event, "CONVERT_PLANNED_ADMISSION needs a finite time");
      const planned = plannedAdmissions(state).find((candidate) => candidate.id === event.plannedAdmissionId);
      if (!planned) return reject(state, event, "This planned admission was not found");
      if (planned.state !== "booked") return reject(state, event, `This planned admission is already ${planned.state}`);
      const scope = wardScopeRefusal(event, [planned.unitId]);
      if (scope) return reject(state, event, scope);
      const unit = state.units.find((candidate) => candidate.id === planned.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${planned.unitId}`);
      // Same order as `PULL_PATIENT`: the physical bed facts first, then the eligibility gates.
      if (unit.empty.value <= 0 || unit.allocatable.value <= 0)
        return reject(state, event, `${unit.name} has no empty bed to admit this planned arrival`);
      const pending = bedsPendingPreparation(unit.id, state.bedReleases);
      if (pending > 0 && openBedsNow(unit, state.bedReleases) <= 0) {
        return reject(
          state,
          event,
          `every free bed at ${unit.name} is still being made ready (${pending} pending); a patient cannot be pulled to a bed that is not open`,
        );
      }
      const linkedPatient =
        planned.patientId === null
          ? null
          : (state.patients.find((patient) => patient.id === planned.patientId) ?? null);
      const view = plannedAdmissionMovementView(planned, unit, linkedPatient);
      // `PULL_PATIENT` lets a recorded override reason take an open bed when no locked bed is free.
      // A booking has no override path, so the same fact is a plain refusal here.
      if (view.security === "Secure" && lockedBedsFree(unit) <= 0)
        return reject(state, event, `No locked bed is free at ${unit.name} for this planned arrival.`);
      const ineligible = placementRefusal(view, unit, event.now);
      if (ineligible)
        return reject(state, event, ineligible.replace(`for movement ${view.id}`, "for this planned admission"));
      if (
        planned.patientId !== null &&
        state.admissions.some(
          (admission) =>
            admission.patientId === planned.patientId &&
            (admission.state === "pulled" || admission.state === "occupied"),
        )
      )
        return reject(state, event, "This patient already holds another bed or occupies another ward.");
      // Inlined open-journey check — avoid importing `isOpen` from ward-derivations (cycle risk).
      if (
        planned.patientId !== null &&
        state.movements.some(
          (movement) =>
            movement.patientId === planned.patientId && !movement.closure && movement.stage !== "arrived",
        )
      )
        return reject(
          state,
          event,
          "This patient already has an open journey waiting; finish or close that journey before recording this arrival.",
        );
      const bedKind: "locked" | "open" =
        view.security === "Secure" ? "locked" : openBedsFree(unit) > 0 ? "open" : "locked";
      const sequence = state.admissionSequence + 1;
      const admission: Admission = {
        id: `AD-ARR-${String(sequence).padStart(2, "0")}`,
        unitId: unit.id,
        specialling: false,
        highAcuity: false,
        referralId: null,
        movementId: null,
        patientId: planned.patientId,
        sex: planned.sex,
        homeRegion: null,
        tentativeDiagnosis: null,
        bedKind,
        state: "occupied",
        pulledAt: event.now,
        arrivedAt: event.now,
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
        stepDownCandidate: false,
      };
      const updatedUnit: Unit = {
        ...unit,
        empty: { ...unit.empty, value: unit.empty.value - 1, confirmedAt: event.now },
        allocatable: { ...unit.allocatable, value: unit.allocatable.value - 1, confirmedAt: event.now },
        allocatableLocked: bedKind === "locked" ? Math.max(0, unit.allocatableLocked - 1) : unit.allocatableLocked,
        sexMix: adjustSexMix(unit.sexMix, mixSexOf(undefined, planned.sex), 1),
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...state,
        units: state.units.map((candidate) => (candidate.id === unit.id ? updatedUnit : candidate)),
        admissions: [...state.admissions, admission],
        admissionSequence: sequence,
        plannedAdmissions: plannedAdmissions(state).map((candidate) =>
          candidate.id === planned.id
            ? { ...candidate, state: "arrived" as const, convertedAt: event.now as Instant, admissionId: admission.id }
            : candidate,
        ),
      };
    }

    default:
      return null;
  }
}
