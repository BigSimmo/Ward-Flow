"use client";

import dynamic from "next/dynamic";

import type { Instant } from "../ward-clock";
import type { WardRecordActor } from "../ward-discharge-records";
import type { Movement, Unit } from "../ward-model";
import { activeWardRestrictions, isCancelledMove } from "./ward-loop-checks";

/**
 * Closing the loop, package D (24 Oct 2026): the screens import the panels from here. Their code
 * loads only when the record has something to show, so the movement and capacity pages stay within
 * their phone script budgets.
 */
const panelPending = () => null;

const LazyCancelled = dynamic(() => import("./movement-loop-checks").then((m) => m.CancelledMoveChecklist), {
  loading: panelPending,
});
const LazyConditions = dynamic(() => import("./movement-loop-checks").then((m) => m.AcceptanceConditionsPanel), {
  loading: panelPending,
});
const LazyReviews = dynamic(() => import("./ward-closure-loop-checks").then((m) => m.WardRestrictionReviews), {
  loading: panelPending,
});
const LazyTransition = dynamic(() => import("./ward-closure-loop-checks").then((m) => m.ClosureTransitionChecklist), {
  loading: panelPending,
});

/** The cancelled move's checklist and the acceptance's conditions, each only when it applies. */
export function MovementLoopChecks({
  movement,
  units,
  now,
}: {
  movement: Movement;
  units: readonly Unit[];
  now: Instant;
}) {
  if (isCancelledMove(movement)) return <LazyCancelled movement={movement} units={units} now={now} />;
  if (movement.acceptedUnitId !== undefined && movement.closure === undefined) {
    return <LazyConditions movement={movement} now={now} />;
  }
  return null;
}

export function WardRestrictionReviews(props: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  return activeWardRestrictions(props.unit).length > 0 ? <LazyReviews {...props} /> : null;
}

export function ClosureTransitionChecklist(props: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  return props.unit.isClosed ? <LazyTransition {...props} /> : null;
}
