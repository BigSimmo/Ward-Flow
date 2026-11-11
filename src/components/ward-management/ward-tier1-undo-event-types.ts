import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import type { PatientId } from "./ward-patients";

/**
 * Tier 1 item 6 (Josh, 4 Nov 2026: "Go ahead with all recommendations"): Undo by default, for
 * `UNDO_WINDOW_MINUTES`, wherever the engine can restore a step exactly. These three undo events
 * take back the newest of their listed actions on one subject (`UNDO_STEP_ACTIONS`, ward-undo.ts),
 * including any notice the action raised. They live beside `ward-flow-events.ts` so the event union
 * stays under its line cap. Ids and instants only; nothing typed.
 */

/** Takes back a bed closed or reopened (`SET_BED_CLOSED`) or a return from leave (`END_LEAVE_BED`). */
type UndoBedStepEvent = {
  type: "UNDO_BED_STEP";
  role: WardFlowRole;
  now: Instant;
  /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
  recordSeq?: number;
  /** A ward undoing its own step names itself. */
  actingUnitId?: string;
  /** A return from leave: the leave bed record it ended. */
  leaveBedId?: string;
  /** A bed closed or reopened: its ward and number. */
  unitId?: string;
  bedNumber?: number;
};

/**
 * Takes back a pulled or held bed released, a transport cancelled, a ward request withdrawn
 * (each on its movement), a planned admission cancelled (on its booking) or a discharge signed off
 * (on its bed release, M37).
 */
type UndoReleaseStepEvent = {
  type: "UNDO_RELEASE_STEP";
  role: WardFlowRole;
  now: Instant;
  /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
  recordSeq?: number;
  /** A ward undoing its own step names itself. */
  actingUnitId?: string;
  movementId?: string;
  plannedAdmissionId?: string;
  releaseId?: string;
};

/** Takes back a community treatment order recorded or ended, or a record archived in error. */
type UndoPatientRecordEvent = {
  type: "UNDO_PATIENT_RECORD";
  role: WardFlowRole;
  now: Instant;
  /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
  recordSeq?: number;
  patientId: PatientId;
};

export type Tier1UndoEvent = UndoBedStepEvent | UndoReleaseStepEvent | UndoPatientRecordEvent;
