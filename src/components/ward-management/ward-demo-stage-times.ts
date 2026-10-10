// Synthetic stage times for the demo seed (v10 pass 3, Josh, 10 Oct 2026): the Journey strip on the
// ED person sheet and the patient page reads `referredAt` and `acceptedAt`, and a hand-authored
// fixture carried neither, so every seeded journey showed one stage. These are demo data, like the
// synthetic patients they belong to: computed from each movement's own recorded times and the seed's
// anchor (never the wall clock), so every seed and test pin stays the same run to run, and they move
// with the demo clock through `ward-reanchor.ts` like every other instant.
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

/** The share of the time from arrival to the next recorded step that passes before the referral. */
const REFERRED_SHARE = 0.4;
/** The share of the time from the referral to the next recorded step that passes before acceptance. */
const ACCEPTED_SHARE = 0.5;

/** The earliest recorded step after the department stage: transport, departure, closure or the anchor. */
function nextRecordedStep(movement: Movement, anchor: Instant): Instant {
  const transportTimes = Object.entries(movement.transport ?? {})
    .filter(([key, value]) => key.endsWith("At") && typeof value === "number")
    .map(([, value]) => value as number);
  return Math.min(
    anchor,
    ...transportTimes,
    movement.leftDepartmentAt ?? anchor,
    movement.closure?.at ?? anchor,
    movement.pullExpiresAt ?? anchor,
  );
}

/**
 * Returns a copy of `movements` in which each referred movement carries a synthetic `referredAt`,
 * and each accepted one a synthetic `acceptedAt`, between its arrival and its next recorded step.
 * A time already recorded is kept, and a movement with no room between its steps is left alone.
 * Order and every other field are unchanged.
 */
export function withDemoStageTimes(movements: readonly Movement[], anchor: Instant): Movement[] {
  return movements.map((movement) => {
    const referred =
      movement.referredUnitIds.length > 0 || movement.acceptedUnitId !== undefined || movement.declines.length > 0;
    if (!referred) return movement;
    const limit = nextRecordedStep(movement, anchor);
    if (limit - movement.openedAt < 4) return movement;
    const referredAt =
      movement.referredAt ?? movement.openedAt + Math.max(1, Math.round((limit - movement.openedAt) * REFERRED_SHARE));
    if (referredAt >= limit) return movement;
    const acceptedAt =
      movement.acceptedUnitId === undefined
        ? movement.acceptedAt
        : (movement.acceptedAt ?? referredAt + Math.max(1, Math.round((limit - referredAt) * ACCEPTED_SHARE)));
    return {
      ...movement,
      referredAt,
      ...(acceptedAt !== undefined ? { acceptedAt } : {}),
    };
  });
}
