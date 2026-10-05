"use client";

import { useMemo } from "react";

import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { movementBelongsToService } from "@/components/ward-management/ward-service-scope";

import { boardFigures, transportFigures } from "./movement-flow-figures";

/**
 * Every movement and transport screen reads the live shared state through this one hook, filtered by the same
 * service scope the shell's switcher sets, so the three screens cannot disagree.
 */
export function useMovementFlow() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  const service = useServiceScope();
  const { movements, units, dayZero } = world;

  return useMemo(() => {
    const scoped = service
      ? movements.filter((movement) => movementBelongsToService(movement, service, units))
      : movements;
    return {
      world,
      now,
      service,
      scoped,
      board: boardFigures(scoped, now),
      transport: transportFigures(scoped),
      asAt: `As at ${formatSheetMoment(now, dayZero)}`,
      scopeLabel: service ? service : "Statewide",
    };
  }, [world, now, service, movements, units, dayZero]);
}
