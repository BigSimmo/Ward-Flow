import type { Movement } from "@/components/ward-management/ward-model";

/**
 * PRACTICE MODE (smart features idea 10, 19 Oct 2026): a guided placement on the demo data, for
 * staff learning Ward Flow before a pilot. Each step ticks itself off from the shared record as the
 * learner does it in the real screens; nothing here raises an event or changes the record.
 *
 * Progress is worked out from the movements alone, against the ids that existed when practice
 * started, so it is held on screen only and never saved (D-18). It follows the first bed request
 * raised since practice started.
 */

type PracticeStepId = "raise" | "ask" | "accept" | "hold" | "transport" | "arrive";

export type PracticeStep = { id: PracticeStepId; title: string; how: string };

export const PRACTICE_STEPS: readonly PracticeStep[] = [
  {
    id: "raise",
    title: "Raise a bed request",
    how: "Start a bed request for a person in an emergency department, from New referral or the ED board.",
  },
  {
    id: "ask",
    title: "Ask two wards",
    how: "As the bed coordinator, refer the request to two wards from its shortlist.",
  },
  { id: "accept", title: "A ward accepts", how: "Switch to one of those wards' desks and accept the request." },
  { id: "hold", title: "Pull the bed", how: "Pull the bed for the person, so the ward keeps it for them." },
  { id: "transport", title: "Book transport", how: "Book transport from the person's movement record." },
  { id: "arrive", title: "Record the arrival", how: "Mark the person arrived on the ward." },
];

export type PracticeProgress = {
  /** The bed request being followed, once one has been raised since practice started. */
  movementId: Movement["id"] | undefined;
  done: Record<PracticeStepId, boolean>;
  /** The first step not yet done, or `undefined` when every step is done. */
  next: PracticeStepId | undefined;
};

/** Every ward this request has been put to: live, answered, withdrawn or accepted. */
function wardsAsked(movement: Movement): number {
  return new Set([
    ...movement.referredUnitIds,
    ...movement.declines.map((decline) => decline.unitId),
    ...movement.withdrawnReferrals.map((withdrawn) => withdrawn.unitId),
    ...(movement.waitlistedUnitIds ?? []),
    ...(movement.acceptedUnitId === undefined ? [] : [movement.acceptedUnitId]),
  ]).size;
}

function reached(movement: Movement, stage: Movement["stage"]): boolean {
  return movement.stage === stage || movement.stageChanges.some((change) => change.to === stage);
}

export function practiceProgress(movements: readonly Movement[], startedWith: ReadonlySet<string>): PracticeProgress {
  const fresh = movements
    .filter((movement) => !startedWith.has(movement.id))
    // The first request raised since Start, so a later one (another tab's) never takes over the
    // practice part way through (audit 24-7, CT-05).
    .sort((a, b) => a.openedAt - b.openedAt)[0];
  const done: Record<PracticeStepId, boolean> = {
    raise: fresh !== undefined,
    ask: fresh !== undefined && wardsAsked(fresh) >= 2,
    accept:
      fresh !== undefined &&
      (fresh.acceptedUnitId !== undefined ||
        reached(fresh, "accepted_awaiting_bed") ||
        reached(fresh, "pulled") ||
        reached(fresh, "arrived")),
    hold: fresh !== undefined && (reached(fresh, "pulled") || reached(fresh, "arrived")),
    transport: fresh !== undefined && fresh.transport !== undefined,
    arrive: fresh !== undefined && (reached(fresh, "arrived") || fresh.closure?.outcome === "arrived"),
  };
  return { movementId: fresh?.id, done, next: PRACTICE_STEPS.find((step) => !done[step.id])?.id };
}
