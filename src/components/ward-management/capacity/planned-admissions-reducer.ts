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
  isPlannedAdmissionCancelReason,
  isPlannedAdmissionLegalStatus,
  isPlannedAdmissionReason,
  isPlannedAdmissionStayDays,
  normalisePlannedAdmissionInitials,
  PLANNED_ADMISSION_WINDOW_DAYS,
  type Admission,
  type PlannedAdmission,
} from "../ward-admissions";
import { finiteInstant, type AuditDecision } from "../ward-audit";
import { emptyCareJourney } from "../ward-care-journey";
import { dayOf, MINUTES_PER_DAY, type Instant } from "../ward-clock";
import { adjustSexMix, mixSexOf } from "../ward-eligibility";
import type { WardFlowEvent } from "../ward-flow-events";
import type { WardFlowState } from "../ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "../ward-flow-roles";
import {
  COHORTS,
  RECORDED_SEXES,
  type Cohort,
  type LegalStatus,
  type Movement,
  type MovementId,
  type Unit,
} from "../ward-model";
import { patientCohort } from "../ward-patients";

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
 * the person, a single-sex ward refuses until gender is recorded through a referral. `cohort` is
 * the age group the booking was made for, so an adult booked onto an older adult ward is refused.
 */
function plannedAdmissionMovementView(planned: PlannedAdmission, unit: Unit): Movement {
  return {
    id: `WF-${planned.id}` as MovementId,
    originEdId: "",
    openedAt: planned.bookedAt,
    flaggedUrgent: false,
    urgency: 3,
    cohort: planned.ageBand,
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

/** Whether a linked patient already holds a pulled or occupied stay. */
function holdsABed(state: WardFlowState, patientId: string): boolean {
  return state.admissions.some(
    (admission) =>
      admission.patientId === patientId && (admission.state === "pulled" || admission.state === "occupied"),
  );
}

/** Whether a linked patient is on an open movement, still on their way to a bed through it. */
function onAnOpenJourney(state: WardFlowState, patientId: string): boolean {
  // `isOpen` from ward-derivations, spelled out: importing it here closes a runtime import cycle
  // (ward-derivations -> ward-flow-reducer -> this module).
  return state.movements.some(
    (movement) => movement.patientId === patientId && !movement.closure && movement.stage !== "arrived",
  );
}

/**
 * The bookings still to count as beds needed: booked, on a known ward, due by `until`, and not a
 * linked patient already counted through an open movement waiting for a bed (`waitingMovements`).
 * Initials-only bookings are always counted: nothing links them to a movement.
 */
export function plannedAdmissionsStillNeedingABed(
  planned: readonly PlannedAdmission[],
  unitIds: ReadonlySet<string>,
  until: Instant,
  waitingMovements: readonly Movement[],
): PlannedAdmission[] {
  const waitingPatientIds = new Set(
    waitingMovements.map((movement) => movement.patientId).filter((id): id is NonNullable<typeof id> => Boolean(id)),
  );
  return planned.filter(
    (booking) =>
      booking.state === "booked" &&
      unitIds.has(booking.unitId) &&
      booking.expectedArrivalAt <= until &&
      (booking.patientId === null || !waitingPatientIds.has(booking.patientId)),
  );
}

/**
 * Why a linked patient's booked age group is not the record's on the expected arrival's calendar
 * date, or null when it is. The reducer holds no calendar: that date is the event's `calendarDate`
 * (today) moved on by the whole days between `now` and the arrival, so a birthday inside the
 * booking window (turning 25 or 65) counts.
 */
function linkedAgeBandRefusal(
  event: Extract<PlannedAdmissionEvent, { type: "BOOK_PLANNED_ADMISSION" | "CHANGE_PLANNED_ADMISSION" }>,
  dateOfBirth: string,
  ageBand: Cohort,
): string | null {
  const today = localCalendarDate(event.calendarDate);
  if (today === null)
    return `${event.type} needs today's calendar date (yyyy-mm-dd) to check a linked patient's age group`;
  const arrivalDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + dayOf(event.expectedArrivalAt) - dayOf(event.now),
  );
  const recorded = patientCohort(dateOfBirth, arrivalDay);
  return recorded === ageBand
    ? null
    : `On the expected arrival date this patient's recorded date of birth gives the ${recorded} age group, not ${ageBand}.`;
}

/** A "yyyy-mm-dd" calendar date as local midnight, or null when it is not one. */
function localCalendarDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
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

/** Shared checks for the fields a booking and a change both carry. */
function bookingFieldsRefusal(
  state: WardFlowState,
  event: Extract<PlannedAdmissionEvent, { type: "BOOK_PLANNED_ADMISSION" | "CHANGE_PLANNED_ADMISSION" }>,
): string | null {
  if (!isPlannedAdmissionReason(event.reason)) return `${event.type} reason must be chosen from the listed reasons`;
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
      const fields = bookingFieldsRefusal(state, event);
      if (fields) return reject(state, event, fields);
      if (event.expectedArrivalAt < event.now)
        return reject(state, event, "BOOK_PLANNED_ADMISSION expected arrival must not be in the past");
      const scope = wardScopeRefusal(event, [event.unitId]);
      if (scope) return reject(state, event, scope);
      if (!(RECORDED_SEXES as readonly string[]).includes(event.sex))
        return reject(state, event, "BOOK_PLANNED_ADMISSION sex must be chosen from the recorded sexes");
      if (!(COHORTS as readonly string[]).includes(event.ageBand))
        return reject(state, event, "BOOK_PLANNED_ADMISSION ageBand must be chosen from the listed age groups");
      const hasPatient = typeof event.patientId === "string" && event.patientId.length > 0;
      const hasInitials = typeof event.initials === "string" && event.initials.trim().length > 0;
      if (hasPatient === hasInitials)
        return reject(state, event, "BOOK_PLANNED_ADMISSION needs either an existing patient or initials, not both");
      let initials: string | null = null;
      if (hasPatient) {
        const patient = state.patients.find((candidate) => candidate.id === event.patientId);
        if (!patient) return reject(state, event, `no patient found for id ${event.patientId}`);
        // The same rule the booking picker applies: a person in a bed is not booked a second one.
        if (holdsABed(state, event.patientId as string))
          return reject(state, event, "This patient already holds a bed or occupies a ward.");
        if (
          plannedAdmissions(state).some(
            (planned) => planned.state === "booked" && planned.patientId === event.patientId,
          )
        )
          return reject(state, event, "This patient already has a planned admission booked.");
        // A linked patient's age group is the record's, never the caller's: a Youth record booked
        // as Adult would otherwise pass the cohort gate onto an Adult ward when it converts.
        const ageBand = linkedAgeBandRefusal(event, patient.dateOfBirth, event.ageBand);
        if (ageBand) return reject(state, event, ageBand);
      } else {
        initials = normalisePlannedAdmissionInitials(event.initials);
        if (initials === null)
          return reject(state, event, "BOOK_PLANNED_ADMISSION initials must be one to three letters");
      }
      const sequence = state.plannedAdmissionSequence + 1;
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
        ageBand: event.ageBand,
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
      const planned = plannedAdmissions(state).find((candidate) => candidate.id === event.plannedAdmissionId);
      if (!planned) return reject(state, event, "This planned admission was not found");
      if (planned.state !== "booked")
        return reject(state, event, `This planned admission is ${planned.state} and can no longer change`);
      const fields = bookingFieldsRefusal(state, event);
      if (fields) return reject(state, event, fields);
      const scope = wardScopeRefusal(event, [planned.unitId, event.unitId]);
      if (scope) return reject(state, event, scope);
      // A new arrival time may not be in the past; an overdue booking keeps its own time while its
      // other fields are edited.
      if (event.expectedArrivalAt !== planned.expectedArrivalAt && event.expectedArrivalAt < event.now)
        return reject(state, event, "CHANGE_PLANNED_ADMISSION expected arrival must not be in the past");
      // Moving a linked booking's arrival to another day can cross a birthday that changes its
      // age group; the booked age group must still be the record's on the new day.
      if (planned.patientId !== null && dayOf(event.expectedArrivalAt) !== dayOf(planned.expectedArrivalAt)) {
        const patient = state.patients.find((candidate) => candidate.id === planned.patientId);
        if (!patient) return reject(state, event, `no patient found for id ${planned.patientId}`);
        const ageBand = linkedAgeBandRefusal(event, patient.dateOfBirth, planned.ageBand);
        if (ageBand) return reject(state, event, ageBand);
      }
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
      if (!isPlannedAdmissionCancelReason(event.reason))
        return reject(state, event, "CANCEL_PLANNED_ADMISSION reason must be chosen from the listed reasons");
      if (event.unitId !== planned.unitId)
        return reject(state, event, "CANCEL_PLANNED_ADMISSION unitId must be the booking's own ward");
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
      if (event.unitId !== planned.unitId)
        return reject(state, event, "CONVERT_PLANNED_ADMISSION unitId must be the booking's own ward");
      const scope = wardScopeRefusal(event, [planned.unitId]);
      if (scope) return reject(state, event, scope);
      const unit = state.units.find((candidate) => candidate.id === planned.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${planned.unitId}`);
      // A linked patient already in a bed, or still on an open movement, arrives through that
      // record, never through a second, parallel one.
      if (planned.patientId !== null && holdsABed(state, planned.patientId))
        return reject(state, event, "This patient already holds another bed or occupies another ward.");
      if (planned.patientId !== null && onAnOpenJourney(state, planned.patientId))
        return reject(
          state,
          event,
          "This patient is on an open movement. Record the arrival on that movement, or close it first.",
        );
      // Same order as `PULL_PATIENT`: the physical bed facts first, then the eligibility gates.
      if (unit.empty.value <= 0 || unit.allocatable.value <= 0)
        return reject(state, event, `${unit.name} has no empty bed to admit this planned arrival`);
      const pending = bedsPendingPreparation(unit.id, state.bedReleases);
      if (pending > 0 && openBedsNow(unit, state.bedReleases) <= 0)
        return reject(
          state,
          event,
          `every free bed at ${unit.name} is still being made ready (${pending} pending); a patient cannot be admitted to a bed that is not open`,
        );
      const view = plannedAdmissionMovementView(planned, unit);
      // `PULL_PATIENT` lets a recorded override reason take an open bed when no locked bed is free.
      // A booking has no override path, so the same fact is a plain refusal here.
      if (view.security === "Secure" && lockedBedsFree(unit) <= 0)
        return reject(state, event, `No locked bed is free at ${unit.name} for this planned arrival.`);
      const ineligible = placementRefusal(view, unit, event.now);
      if (ineligible)
        return reject(state, event, ineligible.replace(`for movement ${view.id}`, "for this planned admission"));
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
