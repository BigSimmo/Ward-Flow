// Synthetic planned move times for the demo seed. Owner, 26 Sept 2026: the 48-hour movement
// horizon should show demo moves spread across the window ("to show different situations"), not
// every bar stacked at now.
//
// These are demo data, like the synthetic patients they belong to. They are computed from the
// seed's own anchor instant, passed in by `seedWardFlowState` (never the wall clock), so every
// seed, test pin and count stays the same run to run, and they move with the demo clock through
// `ward-reanchor.ts` like every other instant.
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, MovementStage } from "@/components/ward-management/ward-model";

/** Stages that are accepted but not yet travelling, so a planned move time means something. A
 *  pulled bed already has its own real deadline (`pullExpiresAt`), and a moving patient is already
 *  on the road, so neither is given a plan. */
const PLANNABLE_STAGES: ReadonlySet<MovementStage> = new Set(["accepted_awaiting_bed", "handover_ready"]);

/** Every fifth plannable move keeps no plan, so the demo still shows a move with nothing recorded. */
const UNPLANNED_EVERY = 5;

/** Spread across the window in 30-minute steps, from 1 hour to about 46 hours ahead. */
function plannedOffsetMinutes(index: number): number {
  const halfHours = 2 + ((index * 17) % 91);
  return halfHours * 30;
}

/**
 * Returns a copy of `movements` in which each open, accepted, not-yet-travelling move carries a
 * synthetic `plannedMoveAt` after `anchor` (unless it already has one). Order and every other field
 * are unchanged.
 */
export function withDemoPlannedMoveTimes(movements: readonly Movement[], anchor: Instant): Movement[] {
  const plannable = movements
    .filter(
      (movement) =>
        !movement.closure &&
        movement.acceptedUnitId !== undefined &&
        PLANNABLE_STAGES.has(movement.stage) &&
        movement.plannedMoveAt === undefined,
    )
    .map((movement) => movement.id)
    .sort();
  const plannedAt = new Map<string, number>();
  plannable.forEach((id, index) => {
    if (index % UNPLANNED_EVERY === UNPLANNED_EVERY - 1) return;
    plannedAt.set(id, anchor + plannedOffsetMinutes(index));
  });
  return movements.map((movement) => {
    const at = plannedAt.get(movement.id);
    return at === undefined ? movement : { ...movement, plannedMoveAt: at };
  });
}
