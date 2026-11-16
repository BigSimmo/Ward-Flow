"use client";

import { useEffect, useRef } from "react";

import { useOptionalToast } from "@/components/wf";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

/**
 * Live walk 16 Nov 2026: Reset demo (or a scenario load) replaces the whole demo world, so an Undo
 * still waiting in a toast has nothing left to undo. When the world changes, every waiting Undo toast
 * closes, as its X would. Only a reset or load moves `worldGeneration` (the reducer), from any of the
 * places that offer one. Renders nothing; outside a Ward Flow world (the executive view) it does
 * nothing.
 */
export function WardUndoWorldClear() {
  const generation = useOptionalWardFlowSelect("worldGeneration")?.worldGeneration;
  const toast = useOptionalToast();
  const seen = useRef(generation);
  useEffect(() => {
    if (generation === undefined) return;
    if (seen.current !== undefined && seen.current !== generation) toast?.dismissUndo?.();
    seen.current = generation;
  }, [generation, toast]);
  return null;
}
