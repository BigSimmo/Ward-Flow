"use client";

import { useEffect, useRef } from "react";

import { useOptionalToast } from "@/components/wf";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  forgetJourneyUndoToasts,
  journeyUndoToastsMovedOn,
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
 */
export function WardUndoWorldClear() {
  const world = useOptionalWardFlowSelect("worldGeneration", "movements");
  const generation = world?.worldGeneration;
  const movements = world?.movements;
  const toast = useOptionalToast();
  const seen = useRef(generation);
  useEffect(() => {
    if (generation === undefined) return;
    if (seen.current !== undefined && seen.current !== generation) {
      forgetJourneyUndoToasts();
      toast?.dismissUndo?.();
    }
    seen.current = generation;
  }, [generation, toast]);
  useEffect(() => {
    if (!movements || !toast) return;
    for (const toastId of journeyUndoToastsMovedOn(movements, toast.isShown)) toast.dismiss(toastId);
  }, [movements, toast]);
  return null;
}
