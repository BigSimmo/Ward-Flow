"use client";

import { useEffect, useRef } from "react";

import { useOptionalToast } from "@/components/wf";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  forgetJourneyUndoToasts,
  journeyUndoToastsMovedOn,
  takeUndoRefusalToasts,
  undoToastsPastWindow,
} from "@/components/ward-management/ward-undo-journey-toasts";

/**
 * Live walk 16 Nov 2026: Reset demo (or a scenario load) replaces the whole demo world, so an Undo
 * still waiting in a toast has nothing left to undo. When the world changes, every waiting Undo toast
 * closes, as its X would. Only a reset or load moves `worldGeneration` (the reducer), from any of the
 * places that offer one. Renders nothing; outside a Ward Flow world (the executive view) it does
 * nothing.
 *
 * Screen audit 19 Nov 2026 (item 4): the same goes for one journey. Once a journey records its next
 * step or closes, the Undo toasts for its earlier steps close too, because the engine would refuse
 * them (`ward-undo-journey-toasts.ts`).
 *
 * Re-walk 20 Nov 2026 (fault 1): an Undo toast also closes once the board clock (a demo clock jump
 * included) passes the time it names, and a reset closes the warnings of refused Undos as well.
 */
export function WardUndoWorldClear() {
  const world = useOptionalWardFlowSelect("worldGeneration", "movements", "now");
  const generation = world?.worldGeneration;
  const movements = world?.movements;
  const now = world?.now;
  const toast = useOptionalToast();
  const seen = useRef(generation);
  useEffect(() => {
    if (generation === undefined) return;
    if (seen.current !== undefined && seen.current !== generation) {
      const refused = takeUndoRefusalToasts();
      forgetJourneyUndoToasts();
      toast?.dismissUndo?.();
      for (const toastId of refused) toast?.dismiss(toastId);
    }
    seen.current = generation;
  }, [generation, toast]);
  useEffect(() => {
    if (!movements || !toast) return;
    for (const toastId of journeyUndoToastsMovedOn(movements, toast.isShown)) toast.dismiss(toastId);
  }, [movements, toast]);
  useEffect(() => {
    if (now === undefined || !toast) return;
    for (const toastId of undoToastsPastWindow(now, toast.isShown)) toast.dismiss(toastId);
  }, [now, toast]);
  return null;
}
