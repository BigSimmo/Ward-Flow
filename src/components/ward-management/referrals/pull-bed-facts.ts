// Pull the bed form (wave 4, D-188 as settled by Josh 13 Nov 2026): the words and small rules the
// form and its kept row share. Pure functions only; nothing here raises an event.

import type { Instant } from "../ward-clock";
import { minuteOfDay } from "../ward-clock";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "../ward-flow-roles";
import type { Movement } from "../ward-model";
import { UNDO_WINDOW_MINUTES } from "../ward-operational-defaults";
import type { AcceptedAwaitingPull } from "./accepted-awaiting-pull";

/** The desks that may pull a bed (D-188 point a): the ward-desk clinician and the coordinator. */
type PullDesk = Extract<WardFlowRole, "coordinator" | "ward">;

export function isPullDesk(role: string): role is PullDesk {
  return role === "coordinator" || role === "ward";
}

/** The desk named by role, never a person (D-188 point c): "Bed coordinator", "Nurse in charge". */
export function pullDeskName(desk: PullDesk): string {
  return WARD_FLOW_ROLE_LABELS[desk];
}

/** The three facts the movement carries. */
export type PullFact = "legalStatus" | "legalForm" | "observation";

/**
 * Where a fact on the form came from, as its label line says it (D-188):
 * - `recorded`: filled in from the record, naming the record ("From Bunbury ED board").
 * - `not-recorded`: the record holds nothing; "Not recorded", nothing selected.
 * - `changed`: the desk pulling changed or chose it; "Changed by Bed coordinator".
 */
export type PullFactSource =
  { kind: "recorded"; from: string } | { kind: "not-recorded" } | { kind: "changed"; by: PullDesk };

export function pullFactSource(recorded: boolean, changed: boolean, from: string, desk: PullDesk): PullFactSource {
  if (changed) return { kind: "changed", by: desk };
  return recorded ? { kind: "recorded", from } : { kind: "not-recorded" };
}

export function pullFactSourceText(source: PullFactSource): string {
  if (source.kind === "changed") return `Changed by ${pullDeskName(source.by)}`;
  return source.kind === "recorded" ? source.from : "Not recorded";
}

/**
 * The facts the desk changed from the record, in form order. D-188 point b: the change stays on the
 * pull and never updates the person's record. PR C stores this on the pull (see pull-step-api.md);
 * until then it shows on the open form only.
 */
export function pullFormChanges(changed: Readonly<Record<PullFact, boolean>>): PullFact[] {
  return (["legalStatus", "legalForm", "observation"] as const).filter((fact) => changed[fact]);
}

const FACT_WORDS: Record<PullFact, string> = {
  legalStatus: "legal status",
  legalForm: "legal form",
  observation: "observation level",
};

/** The lock line under Pull the bed while "Check every" is blank (D-188 (tightened 13 Nov), D-187). */
export const CHOOSE_INTERVAL_LINE = "Choose how often to check";

/** The lock line under Pull the bed: "Choose legal status, legal form and observation level". */
export function chooseFactsLine(missing: readonly PullFact[]): string | undefined {
  if (missing.length === 0) return undefined;
  const words = missing.map((fact) => FACT_WORDS[fact]);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
  return `Choose ${list}`;
}

/** An instant's clock face, "09:57". */
export function clockText(at: Instant): string {
  const minute = minuteOfDay(at);
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

/** When the ward accepted: the accepted arm's recorded decision time, when there is one. */
export function acceptedDecisionAt({ referral, unitId }: AcceptedAwaitingPull): Instant | undefined {
  return referral.destinations.find(
    (arm) =>
      arm.state === "accepted" &&
      arm.destination.kind === "psychiatric_ward" &&
      (arm.acceptedUnitId ?? arm.destination.unitId) === unitId,
  )?.decidedAt;
}

/** A bed just pulled from the form: what its kept row and its Undo need. */
export type PulledBed = {
  entry: AcceptedAwaitingPull;
  /** The person, as the row and toast name them (surname first, through the name display). */
  name: string;
  /** The desk that pulled; the movement's stage change records it as `by`. */
  desk: PullDesk;
  /** The unit a ward desk acted as; absent for the coordinator. */
  actingUnitId?: string;
  /** The pull's own time, as the movement's `to: "pulled"` stage change records it. */
  at: Instant;
};

/** The last moment the pull can be undone from its row ("Undo pull · until 10:47"). */
export function pullUndoUntil(pulled: Pick<PulledBed, "at">): Instant {
  return pulled.at + UNDO_WINDOW_MINUTES;
}

/** The movement the pull started, once the state holds it. */
export function pulledMovement(movements: readonly Movement[], pulled: PulledBed): Movement | undefined {
  return movements.find((movement) => movement.referralId === pulled.entry.referral.id && !movement.closure);
}

/**
 * The pull this Undo is for: the movement's `to: "pulled"` stage change at the pull's own time and
 * desk. Undefined once that pull is no longer the movement's latest stage change (released or
 * replaced), so an Undo never releases a different pull.
 */
export function pullStageIndex(movement: Movement, pulled: PulledBed): number | undefined {
  const index = movement.stageChanges.length - 1;
  const last = movement.stageChanges[index];
  return movement.stage === "pulled" && last?.to === "pulled" && last.at === pulled.at && last.by === pulled.desk
    ? index
    : undefined;
}

/** Whether the kept row still shows: inside the window, and the pull not yet released or replaced. */
export function pullStillUndoable(movements: readonly Movement[], pulled: PulledBed, now: Instant): boolean {
  if (now > pullUndoUntil(pulled)) return false;
  const movement = pulledMovement(movements, pulled);
  // A shared save not yet in the state keeps the row; it is checked again when Undo is pressed.
  return movement === undefined || pullStageIndex(movement, pulled) !== undefined;
}
