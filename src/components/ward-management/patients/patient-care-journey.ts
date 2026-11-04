// PT1 round 3 (Josh, 3 Nov 2026 22:29Z: "I want a journey to see the patient progress simply").
// The patient's whole path of care in six plain steps, from where it started to community care:
// In ED (or Referred), Bed found, Moving, On ward, Discharge and Community. Each step is done, now
// or next, worked out only from what the record holds: the movement's stage, the stay's own times
// and an active community episode. A step's detail is a recorded fact in words ("Day 7",
// "Expected Sun 1 Nov"), never a forecast, a score or a countdown.
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";

type CareStepState = "done" | "now" | "next";

export type CareStep = {
  id: "start" | "bed" | "moving" | "ward" | "discharge" | "community";
  label: string;
  state: CareStepState;
  /** A recorded fact in words, or undefined when nothing is recorded for this step. */
  detail?: string;
};

export type CareJourneyInput = {
  mode: PatientMode;
  /** The movement in focus (open placement, or the one that brought them to the ward). */
  movement?: Movement;
  /** The current stay, or the last one when nothing is open. */
  stay?: Admission;
  /** Whether the stay is current (on ward, leave, AWOL or at ED). */
  stayCurrent: boolean;
  stayDay?: number;
  /** The active community episode's team, when one is active. */
  communityTeam?: string;
  /** A community treatment order is in force. */
  ctoInForce?: boolean;
  /** Formats an instant as a short day ("Sun 1 Nov"). */
  day: (at: number) => string;
};

const BED_STAGES = new Set(["accepted_awaiting_bed", "pulled"]);
const MOVING_STAGES = new Set(["handover_ready", "moving"]);
const ON_STAY: readonly PatientMode[] = ["ward", "leave", "awol", "ed"];

/** Which of the six steps is current. Returns -1 when the journey is complete or not started. */
function currentIndex({ mode, movement, stay, stayCurrent, communityTeam, ctoInForce }: CareJourneyInput): number {
  if (ON_STAY.includes(mode) && stayCurrent) return 3;
  if (mode === "find" || mode === "held" || mode === "transit") {
    const stage = movement?.stage;
    if (stage && MOVING_STAGES.has(stage)) return 2;
    if (stage && BED_STAGES.has(stage)) return 1;
    if (mode === "transit") return 2;
    return 0;
  }
  // Nothing open: after a stay, community care is now when an episode or order is active.
  if (communityTeam || ctoInForce) return 5;
  return stay?.leftAt ? -1 : -2;
}

/** The six steps of this patient's path of care, each done, now or next. */
export function patientCareJourney(input: CareJourneyInput): CareStep[] {
  const { mode, movement, stay, stayDay, communityTeam, ctoInForce, day } = input;
  const now = currentIndex(input);
  // -1: the last stay ended with no community care active; every step up to Discharge is done.
  // -2: nothing on record to place the patient on the path; every step is next.
  const stateOf = (index: number): CareStepState => {
    if (now === -2) return "next";
    if (now === -1) return index <= 4 ? "done" : "next";
    return index < now ? "done" : index === now ? "now" : "next";
  };
  const fromEd = movement?.originEdId !== undefined;
  const wardDetail =
    mode === "leave"
      ? "On leave"
      : mode === "awol"
        ? "Absent"
        : mode === "ed"
          ? "At ED, bed kept"
          : stayDay !== undefined && stateOf(3) === "now"
            ? `Day ${stayDay}`
            : stay?.arrivedAt
              ? `Arrived ${day(stay.arrivedAt)}`
              : undefined;
  const dischargeDetail = stay?.leftAt
    ? `Left ${day(stay.leftAt)}`
    : stay?.expectedDischargeAt
      ? `${stay.dischargeConfirmedAt ? "Confirmed" : "Expected"} ${day(stay.expectedDischargeAt)}`
      : stateOf(4) === "next" && stateOf(3) === "now"
        ? "No date set"
        : undefined;
  const steps: CareStep[] = [
    {
      id: "start",
      label: fromEd ? "In ED" : "Referred",
      state: stateOf(0),
      detail: movement?.openedAt !== undefined ? day(movement.openedAt) : undefined,
    },
    {
      id: "bed",
      label: "Bed found",
      state: stateOf(1),
      detail: movement?.stage === "pulled" ? "Bed pulled" : movement?.acceptedAt ? day(movement.acceptedAt) : undefined,
    },
    {
      id: "moving",
      label: "Moving",
      state: stateOf(2),
      detail:
        movement?.stage === "handover_ready"
          ? "Handover ready"
          : movement?.stage === "moving"
            ? "On the way"
            : undefined,
    },
    { id: "ward", label: "On ward", state: stateOf(3), detail: wardDetail },
    { id: "discharge", label: "Discharge", state: stateOf(4), detail: dischargeDetail },
    {
      id: "community",
      label: "Community",
      state: stateOf(5),
      detail: ctoInForce
        ? "On a CTO"
        : (communityTeam ?? (stateOf(5) === "next" && now === -1 ? "None active" : undefined)),
    },
  ];
  // With no movement on record the path into the ward is unknown, so its three steps are left out
  // rather than ticked as if they happened.
  return movement ? steps : steps.filter((step) => step.id !== "start" && step.id !== "bed" && step.id !== "moving");
}
