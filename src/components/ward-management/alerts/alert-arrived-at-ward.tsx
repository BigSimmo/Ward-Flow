"use client";

import { useEffect, useRef, useState } from "react";

import { Button, useOptionalToast } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import { useOptionalWardFlowSelect, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise, type WardRaise } from "@/components/ward-management/ward-flow-raise";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import {
  ARRIVED_AT_WARD_UNDO_TOAST_MS,
  UNDO_WINDOW_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

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
 *
 * The toast is published from the click itself, like the P019 Release button, and not from a
 * `useUndoableStep` owned by this control: recording the arrival closes the alert, so the alert
 * detail (and this control with it) leaves the list before an effect-driven toast could appear.
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
  const { units } = useWardFlowSelect("units");
  const raise = useWardRaise("coordinator");
  // The Undo runs later, so it raises through the latest clock, not the one at the time of the click.
  const raiseRef = useRef(raise);
  useEffect(() => {
    raiseRef.current = raise;
  }, [raise]);
  const toast = useOptionalToast();
  const [asking, setAsking] = useState(false);
  if (!arrivedAtWardOffered(movement)) return null;
  const unitId = movement.acceptedUnitId!;
  const ward = units.find((unit) => unit.id === unitId)?.name ?? unitId;

  function confirm() {
    setAsking(false);
    const movementId = movement.id;
    const toastApi = toast;
    const say = (outcome: WardCommandOutcome | void) => {
      if (outcome?.isCurrent && !outcome.isCurrent()) return;
      if (outcome && outcome.status !== "accepted") {
        const reason = outcome.message ?? "The action was refused.";
        toastApi?.push({
          tone: "warning",
          title: outcome.status === "refused" ? `Not recorded: ${reason}` : (outcome.message ?? SAVE_NOT_CONFIRMED),
        });
        return;
      }
      const own = outcome?.undoStep;
      const recordSeq = own?.undoType === "UNDO_TRANSPORT_STEP" && own.subjectId === movementId ? own.seq : undefined;
      toastApi?.push({
        tone: "success",
        title: `${displayName} arrived at ${ward}`,
        body: `Undo within ${UNDO_WINDOW_MINUTES} min.`,
        undo: {
          durationMs: ARRIVED_AT_WARD_UNDO_TOAST_MS,
          onUndo: () => {
            if (outcome?.isCurrent && !outcome.isCurrent()) {
              toastApi.push({
                tone: "warning",
                title: "Undo is unavailable because the workspace or working role changed. Review the current board.",
              });
              return;
            }
            if (outcome?.canUndo && !outcome.canUndo()) {
              toastApi.push({
                tone: "warning",
                title:
                  "Undo is unavailable until the shared board is ready. Wait for it to reconnect, then check the board.",
              });
              return false;
            }
            const undone = (raiseRef.current as WardRaise)("UNDO_TRANSPORT_STEP", {
              movementId,
              ...(recordSeq === undefined ? {} : { recordSeq }),
            });
            void Promise.resolve(undone).then(
              (result) => {
                if (result && result.status !== "accepted") {
                  const reason = result.message ?? "The action was refused.";
                  toastApi.push({
                    tone: "warning",
                    title:
                      result.status === "refused" ? `Not recorded: ${reason}` : (result.message ?? SAVE_NOT_CONFIRMED),
                  });
                  return;
                }
                toastApi.push({ tone: "info", title: "Undone. Back as it was." });
              },
              () => toastApi.push({ tone: "warning", title: SAVE_NOT_CONFIRMED }),
            );
            return undefined;
          },
        },
      });
    };
    void Promise.resolve(raiseRef.current("PATIENT_ARRIVED", { movementId })).then(say, () =>
      toastApi?.push({ tone: "warning", title: SAVE_NOT_CONFIRMED }),
    );
  }

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
      <Button variant="pri" disabledReason={disabledReason} reasonDisplay="tooltip" onClick={confirm}>
        Mark arrived
      </Button>
    </div>
  );
}
