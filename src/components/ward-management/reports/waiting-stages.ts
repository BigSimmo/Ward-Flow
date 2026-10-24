// src/components/ward-management/reports/waiting-stages.ts
//
// WHERE WAITING TIME BUILDS UP (closing-the-loop features, Josh, 24 Oct 2026). A placement journey
// is split into four recorded stages, and each stage's time is counted only from times the record
// holds. A journey that passed a stage without both of its times is counted as "not recorded",
// never given a guessed time. Read-only: nothing here writes, sorts the ED queue or ranks anyone.
//
// Not a Mental Health Act clock: no legal time is read or computed here.
import type { Instant } from "@/components/ward-management/ward-clock";
import { MOVEMENT_STAGES, type Movement, type MovementStage } from "@/components/ward-management/ward-model";

import { summariseDurations, type DurationSummary } from "./pilot-measures";

export type WaitingStageId =
  "awaiting_ward_response" | "accepted_awaiting_bed" | "awaiting_bed_preparation" | "awaiting_transport";

type WaitingStageDefinition = {
  id: WaitingStageId;
  /** The movement stage a journey is in while it waits here. */
  stage: MovementStage;
  label: string;
  /** What starts and ends the stage, in plain words, from the recorded times used. */
  span: string;
};

/** Fixed order: the order a journey passes through them. Never sorted by size. */
export const WAITING_STAGES: readonly WaitingStageDefinition[] = [
  {
    id: "awaiting_ward_response",
    stage: "destination_review",
    label: "Awaiting ward response",
    span: "First ward asked to a ward accepting",
  },
  {
    id: "accepted_awaiting_bed",
    stage: "accepted_awaiting_bed",
    label: "Accepted, awaiting bed",
    span: "Ward accepting to a bed pulled",
  },
  {
    id: "awaiting_bed_preparation",
    stage: "pulled",
    label: "Departure awaiting bed preparation",
    span: "Bed pulled to bed and paperwork ready",
  },
  {
    id: "awaiting_transport",
    stage: "handover_ready",
    label: "Awaiting transport",
    span: "Bed and paperwork ready to the patient collected",
  },
];

/** The first time this movement reached `stage`, from its recorded stage changes. */
function firstReached(movement: Movement, stage: MovementStage): Instant | undefined {
  return movement.stageChanges.find((change) => change.to === stage)?.at;
}

/**
 * When the journey entered `stage`, from a recorded time only: the stage change first, then the
 * field that records the same step on journeys written before stage changes were kept.
 */
function enteredAt(movement: Movement, stage: MovementStage): Instant | undefined {
  const recorded = firstReached(movement, stage);
  if (recorded !== undefined) return recorded;
  if (stage === "destination_review") return movement.referredAt;
  if (stage === "accepted_awaiting_bed") return movement.acceptedAt;
  if (stage === "moving") return movement.transport?.collectedAt;
  return undefined;
}

/** When the journey left `stage`: the first recorded entry into any later stage, at or after `from`. */
function leftAt(movement: Movement, stage: MovementStage, from: Instant): Instant | undefined {
  const later = MOVEMENT_STAGES.slice(MOVEMENT_STAGES.indexOf(stage) + 1);
  const times = later
    .map((next) => enteredAt(movement, next))
    .filter((at): at is Instant => at !== undefined && Number.isFinite(at) && at >= from);
  return times.length > 0 ? Math.min(...times) : undefined;
}

export type WaitingStageJourney = { movement: Movement; minutes?: number };

export type WaitingStageRow = {
  id: WaitingStageId;
  label: string;
  span: string;
  /** Journeys that passed the stage with both times recorded, with the minutes spent. */
  recorded: WaitingStageJourney[];
  /** Journeys that passed the stage without both times recorded. Never given a time. */
  notRecorded: WaitingStageJourney[];
  /** Open journeys in this stage now. Not counted in the typical time: the stage has not ended. */
  inStageNow: WaitingStageJourney[];
  /** Typical (median) and slowest 1 in 10, with the same sample floor as the pilot measures. */
  summary: DurationSummary;
};

/**
 * Each stage's recorded time across `movements`, in recorded order. A journey closed before it
 * reached a stage, or still before it, is not counted in that stage at all.
 */
export function waitingStages(movements: readonly Movement[]): WaitingStageRow[] {
  return WAITING_STAGES.map((definition) => {
    const recorded: WaitingStageJourney[] = [];
    const notRecorded: WaitingStageJourney[] = [];
    const inStageNow: WaitingStageJourney[] = [];
    const stageIndex = MOVEMENT_STAGES.indexOf(definition.stage);
    for (const movement of movements) {
      const currentIndex = MOVEMENT_STAGES.indexOf(movement.stage);
      if (currentIndex === stageIndex) {
        if (movement.closure === undefined) inStageNow.push({ movement });
        continue;
      }
      if (currentIndex < stageIndex) continue;
      const start = enteredAt(movement, definition.stage);
      const end = start === undefined ? undefined : leftAt(movement, definition.stage, start);
      if (start === undefined || end === undefined) {
        notRecorded.push({ movement });
        continue;
      }
      recorded.push({ movement, minutes: end - start });
    }
    const durations = recorded.map((journey) => journey.minutes!);
    return {
      id: definition.id,
      label: definition.label,
      span: definition.span,
      recorded,
      notRecorded,
      inStageNow,
      summary: summariseDurations(durations, recorded.length + notRecorded.length),
    };
  });
}
