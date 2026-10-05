import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen, transportLeg, type TransportLeg } from "@/components/ward-management/ward-derivations";
import type { Movement, MovementStage } from "@/components/ward-management/ward-model";
import { isOfficerJob } from "@/components/ward-management/officer/officer-screen";

import {
  byLongestWait,
  corridorCounts,
  journeyStages,
  refusedCorridorCounts,
  transportCounts,
  transportLegs,
  waitedMinutes,
} from "./movements-derivations";

/**
 * Figures for the 5 October 2026 movements and transport proposal. Every count here is read
 * through the engine's own derivations (`journeyStages`, `transportLegs`, `transportLeg`,
 * `isOfficerJob`), so the movement board, the movement record and the Transport Hub proposal
 * cannot disagree with each other or with the current screens.
 */

export type JobState = Exclude<TransportLeg, "Arrived">;

/** The four states an open transport job can be in, in the order a job moves through them. */
export const JOB_STATES: readonly JobState[] = ["Requested", "Accepted", "En route", "Collected"];

/** One plain meaning per state, used on every proposal screen. Matches `transportStatusLabel`. */
export const JOB_STATE_LABEL: Record<JobState, { label: string; meaning: string }> = {
  Requested: { label: "Waiting for a provider", meaning: "Requested; no provider has accepted yet" },
  Accepted: { label: "Accepted, not yet left", meaning: "A provider accepted; the vehicle has not left" },
  "En route": { label: "On the way to collect", meaning: "The vehicle is on its way to the patient" },
  Collected: { label: "Patient on board", meaning: "Collected and travelling to the ward" },
};

export function jobState(movement: Movement): JobState | undefined {
  const state = transportLeg(movement.transport);
  return state === undefined || state === "Arrived" || state === "Cancelled" ? undefined : state;
}

export function boardFigures(movements: Movement[], now: Instant) {
  const open = movements.filter(isOpen);
  const closedToday = movements.filter(
    (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now),
  );
  const arrivedToday = movements.filter(
    (movement) =>
      movement.transport?.arrivedAt !== undefined &&
      movement.transport.cancelledAt === undefined &&
      dayOf(movement.transport.arrivedAt) === dayOf(now),
  );
  const stages = journeyStages(open, now).filter((stage) => stage.id !== "arrived");
  const tierOne = byLongestWait(
    open.filter((movement) => movement.urgency === 1),
    now,
  );
  const legsLive = transportCounts(transportLegs(open, now));
  const corridors = corridorCounts(movements);
  const corridorPairs = new Set(corridors.map((corridor) => `${corridor.originEdId}|${corridor.acceptedUnitId}`)).size;
  const declined = refusedCorridorCounts(movements, now);
  const noTransport = open.filter((movement) => movement.transport === undefined);
  const awaitingWard = open.filter(
    (movement) => movement.stage === "placement_requested" || movement.stage === "destination_review",
  );
  return {
    open,
    closedToday,
    arrivedToday,
    stages,
    tierOne,
    legsLive,
    liveLegCount: legsLive.Accepted + legsLive["En route"] + legsLive.Collected,
    corridors,
    corridorPairs,
    declined,
    noTransport,
    awaitingWard,
    longest: byLongestWait(open, now)[0],
  };
}

export function stageLongestWait(movements: Movement[], now: Instant): number {
  return movements.reduce((max, movement) => Math.max(max, waitedMinutes(movement, now)), 0);
}

export function transportFigures(movements: Movement[]) {
  const jobs = movements.filter(isOfficerJob);
  const byState: Record<JobState, number> = { Requested: 0, Accepted: 0, "En route": 0, Collected: 0 };
  for (const job of jobs) {
    const state = jobState(job);
    if (state) byState[state] += 1;
  }
  return {
    jobs,
    byState,
    escort: jobs.filter((job) => job.transport?.escortRequired).length,
    noCad: jobs.filter((job) => !job.transport?.cadNumber).length,
  };
}

/** Index of a stage in the journey, for the stepper. */
export function stageIndex(stage: MovementStage, stages: readonly MovementStage[]): number {
  return Math.max(0, stages.indexOf(stage));
}
