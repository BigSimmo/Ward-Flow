"use client";

import { useEffect, useLayoutEffect, type RefObject } from "react";
import type { WardCommandOutcome } from "./ward-shared-client";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";

export type LocalCommandState = {
  world: WardFlowState;
  sequence: number;
  early: Map<WardFlowEvent, (outcome: Omit<WardCommandOutcome, "commandId">) => void>;
  active: boolean;
};
/** Command lifetimes and early restoration results stay in memory, apart from browser persistence. */
export function useLocalCommandCompletion(
  commandsRef: RefObject<LocalCommandState>,
  state: WardFlowState,
  earlyOutcomes: readonly { event: WardFlowEvent; outcome: Omit<WardCommandOutcome, "commandId"> }[] | undefined,
  adopted: boolean,
) {
  useEffect(() => {
    if (!adopted) return;
    for (const result of earlyOutcomes ?? []) {
      commandsRef.current.early.get(result.event)?.(result.outcome);
      commandsRef.current.early.delete(result.event);
    }
  }, [adopted, earlyOutcomes, commandsRef]);
  useLayoutEffect(() => {
    commandsRef.current.world = state;
  }, [state, commandsRef]);
  useEffect(() => {
    const lifetime = commandsRef.current;
    lifetime.active = true;
    return () => {
      lifetime.active = false;
      // StrictMode immediately reconnects effects; only an actual unmount cancels early commands.
      queueMicrotask(() => {
        if (lifetime.active) return;
        for (const settle of lifetime.early.values())
          settle({
            status: "cancelled",
            message: "The demonstration closed before restoration finished. Review the board before trying again.",
          });
        lifetime.early.clear();
      });
    };
  }, [commandsRef]);
}

/** A local refusal appends a new rejection; an accepted reset may clear the old history. */
export function localCommandOutcome(
  before: WardFlowState,
  next: WardFlowState,
  isCurrent?: () => boolean,
): Omit<WardCommandOutcome, "commandId"> {
  const refusal = next.rejections.at(-1);
  const accepted = !refusal || refusal === before.rejections.at(-1);
  return {
    status: accepted ? "accepted" : "refused",
    message: accepted ? undefined : refusal?.reason,
    undoRecords: next.undoRecords,
    generation: next.worldGeneration,
    isCurrent,
  };
}
