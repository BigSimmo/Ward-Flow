// Synthetic planned move times for the demo seed. Owner, 26 Sept 2026: the 48-hour movement
// horizon should show demo moves spread across the window ("to show different situations"), not
// every bar stacked at now.
//
// These are demo data, like the synthetic patients they belong to. They are computed from the
// seed's own anchor instant, passed in by `seedWardFlowState` (never the wall clock), so every
// seed, test pin and count stays the same run to run, and they move with the demo clock through
// `ward-reanchor.ts` like every other instant.
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, MovementStage } from "@/components/ward-management/ward-model";
import {
  SAMPLE_WORKING_DAY_END as WORKING_DAY_END,
  SAMPLE_WORKING_DAY_START as WORKING_DAY_START,
} from "@/components/ward-management/ward-sample-working-hours";

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
 * A16-20 (Audit 16, 13 Nov 2026): planned moves fell at 01:42 and 04:42 because the spread above
 * never looked at the hour it landed on. A plan now sits inside working hours, 08:00 to 17:00 Perth.
 * That window is a synthetic sample choice, not a rule about when a move may happen, and is the one
 * sample working day the referral builders read too (`ward-sample-working-hours.ts`).
 */
const HORIZON_MINUTES = 48 * 60;

/** The spread time moved into working hours, still after `anchor` and inside the 48-hour window. */
function withinWorkingHours(at: Instant, anchor: Instant): Instant {
  const minute = ((at % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const dayStart = at - minute;
  const span = WORKING_DAY_END - WORKING_DAY_START;
  const inside =
    minute >= WORKING_DAY_START && minute <= WORKING_DAY_END ? minute : WORKING_DAY_START + (minute % span);
  let placed = dayStart + inside;
  if (placed <= anchor) placed += MINUTES_PER_DAY;
  if (placed >= anchor + HORIZON_MINUTES) placed -= MINUTES_PER_DAY;
  return placed > anchor ? placed : at;
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
    plannedAt.set(id, withinWorkingHours(anchor + plannedOffsetMinutes(index), anchor));
  });
  return movements.map((movement) => {
    const at = plannedAt.get(movement.id);
    return at === undefined ? movement : { ...movement, plannedMoveAt: at };
  });
}
