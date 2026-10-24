// Synthetic stage changes for the demo seed (closing-the-loop features, Josh, 24 Oct 2026): the
// Statistics "Where waiting time builds up" card times each placement stage from recorded stage
// changes, and no hand-authored journey carried any, so every later stage read "not recorded". These
// are demo data, like `ward-demo-stage-times.ts`: six journeys that have already arrived get stage
// changes placed between their own recorded referral, acceptance, collection and arrival times, from
// the seed's own numbers (never the wall clock), so every seed and test pin stays the same.
//
// Only arrived journeys are touched, so no open journey, queue, pull time limit or alert changes. One
// of the six deliberately has no "ready for handover" change, so the card also shows a stage that was
// not recorded.
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, StageChange } from "@/components/ward-management/ward-model";

const COMPLETE_IDS = new Set<string>(["WF-007", "WF-300", "WF-307", "WF-314", "WF-328"]);
const NO_HANDOVER_IDS = new Set<string>(["WF-321"]);

/** Share of the time from acceptance to collection before the bed was pulled. */
const PULLED_SHARE = 0.45;
/** Share of the same span before the bed and paperwork were ready. */
const READY_SHARE = 0.75;

function arrivedAt(movement: Movement): Instant | undefined {
  return movement.transport?.arrivedAt ?? (movement.closure?.outcome === "arrived" ? movement.closure.at : undefined);
}

function stageChangesFor(movement: Movement, withHandover: boolean): StageChange[] | undefined {
  const { referredAt, acceptedAt } = movement;
  const collectedAt = movement.transport?.collectedAt;
  const arrived = arrivedAt(movement);
  if (referredAt === undefined || acceptedAt === undefined || collectedAt === undefined || arrived === undefined) {
    return undefined;
  }
  if (!(referredAt < acceptedAt && acceptedAt < collectedAt && collectedAt <= arrived)) return undefined;
  const span = collectedAt - acceptedAt;
  const pulledAt = acceptedAt + Math.max(1, Math.round(span * PULLED_SHARE));
  const readyAt = acceptedAt + Math.max(2, Math.round(span * READY_SHARE));
  if (readyAt >= collectedAt) return undefined;
  const changes: StageChange[] = [
    { at: referredAt, from: "placement_requested", to: "destination_review", by: "coordinator" },
    { at: acceptedAt, from: "destination_review", to: "accepted_awaiting_bed", by: "ward" },
    { at: pulledAt, from: "accepted_awaiting_bed", to: "pulled", by: "coordinator" },
  ];
  if (withHandover) changes.push({ at: readyAt, from: "pulled", to: "handover_ready", by: "ed" });
  changes.push(
    { at: collectedAt, from: withHandover ? "handover_ready" : "pulled", to: "moving", by: "officer" },
    { at: arrived, from: "moving", to: "arrived", by: "ward" },
  );
  return changes;
}

/**
 * Returns a copy of `movements` in which the six named arrived journeys carry synthetic stage
 * changes. A journey that already has stage changes, is not arrived, or whose recorded times are
 * missing or out of order is left exactly as it is. Order and every other field are unchanged.
 */
export function withDemoWaitingStages(movements: readonly Movement[]): Movement[] {
  return movements.map((movement) => {
    const complete = COMPLETE_IDS.has(movement.id);
    if (!complete && !NO_HANDOVER_IDS.has(movement.id)) return movement;
    if (movement.stage !== "arrived" || movement.stageChanges.length > 0) return movement;
    const stageChanges = stageChangesFor(movement, complete);
    return stageChanges ? { ...movement, stageChanges } : movement;
  });
}
