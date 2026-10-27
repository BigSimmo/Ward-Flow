"use client";

import { useState } from "react";

import { Button } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  useOptionalWardFlowSelect,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { ARRIVED_AT_WARD_UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";

/**
 * True only where `PATIENT_ARRIVED` would be accepted straight from a pulled bed: a person recorded
 * no transport is needed and no live transport job exists (ward-flow-transport-events.ts). Josh,
 * Oct 27, 2026, 11:36 PM AWST: "P069: show the action only for no-transport pulls, no engine change".
 */
function arrivedAtWardOffered(movement: Movement): boolean {
  if (movement.closure || !movement.acceptedUnitId) return false;
  if (movement.stage !== "pulled" && movement.stage !== "handover_ready") return false;
  const liveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
  const needed = movement.transportNeed?.needed ?? movement.transport?.needed;
  return needed === false && !liveTransportJob && movement.transport?.collectedAt === undefined;
}

/**
 * "Arrived at ward" on a pulled-bed alert (P069). Asks first, records the existing arrival event and
 * offers Undo for 10 s through the existing transport-step undo. Renders nothing outside a provider.
 */
export function AlertArrivedAtWard(props: { movement: Movement; displayName: string; disabledReason?: string }) {
  return useOptionalWardFlowSelect() ? <ArrivedAtWardControl {...props} /> : null;
}

function ArrivedAtWardControl({
  movement,
  displayName,
  disabledReason,
}: {
  movement: Movement;
  displayName: string;
  disabledReason?: string;
}) {
  const { units, dispatch, rejections } = useWardFlowSelect("units", "dispatch", "rejections");
  const now = useWardFlowClock();
  const raise = useWardRaise("coordinator");
  const { offer } = useUndoableStep({ dispatch, rejections, now, routeRole: "coordinator" });
  const [asking, setAsking] = useState(false);
  if (!arrivedAtWardOffered(movement)) return null;
  const unitId = movement.acceptedUnitId!;
  const ward = units.find((unit) => unit.id === unitId)?.name ?? unitId;
  if (!asking) {
    return (
      <Button variant="sec" disabledReason={disabledReason} reasonDisplay="tooltip" onClick={() => setAsking(true)}>
        Arrived at ward
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Confirm arrival">
      <p>{`Mark ${displayName} as arrived at ${ward}? The pulled bed becomes occupied.`}</p>
      <Button variant="sec" onClick={() => setAsking(false)}>
        Cancel
      </Button>
      <Button
        variant="pri"
        disabledReason={disabledReason}
        reasonDisplay="tooltip"
        onClick={() => {
          setAsking(false);
          const outcome = raise("PATIENT_ARRIVED", { movementId: movement.id });
          offer(
            {
              success: `${displayName} arrived at ${ward}`,
              undo: (at) => ({ type: "UNDO_TRANSPORT_STEP", role: "coordinator", now: at, movementId: movement.id }),
              toastMs: ARRIVED_AT_WARD_UNDO_TOAST_MS,
            },
            { completion: outcome },
          );
        }}
      >
        Mark arrived
      </Button>
    </div>
  );
}
