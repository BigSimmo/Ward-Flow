"use client";

import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { CapacityFigure } from "@/components/ward-management/ward-model-vocabulary";
import { wardCatchUp, type WardCatchUp } from "@/components/ward-management/ward-outage-catch-up";

/**
 * CATCH-UP AFTER AN OUTAGE (Batch 4 item 25, Josh approved the drawing 11 Nov 2026, D-142): this
 * ward's catch-up, read from the shared record. `null` when no outage is recorded, so nothing is
 * ever guessed from the device or the connection. A prompt only: it changes no bed figure.
 */
export function useWardOutageCatchUp(
  unit: { id: string; beds: number; allocatable: CapacityFigure } | null | undefined,
  now: Instant,
): WardCatchUp | null {
  const records = useOptionalWardFlowSelect("outageWindows", "downtimePackPrints");
  if (!unit || !records) return null;
  return wardCatchUp(unit, records, now);
}

/** The words every bed tile carries until the ward confirms after the outage (approved in full, D-142). */
export const NOT_CONFIRMED_SINCE_OUTAGE = "Not confirmed since the outage";
