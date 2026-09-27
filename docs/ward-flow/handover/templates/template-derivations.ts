/**
 * template-derivations.ts
 *
 * Pure Mathematical Layout & Clinical Derivation Engine.
 * Contains zero JSX and zero DOM dependencies.
 * Fully unit-testable in isolation with sub-millisecond execution.
 */

export type ClinicalEventType = "admit" | "transit" | "leave" | "discharge" | "delay" | "predicted";

export interface HorizonEventItem {
  id: string;
  patientId: string;
  patientName: string;
  wardId: string;
  wardName: string;
  type: ClinicalEventType;
  startHour: number; // Hours relative to NOW anchor (-24 to +48)
  durationHours: number; // Duration of event in hours
  statusLabel: string;
  statutoryForm?: string; // e.g. "Form 4A", "Form 5A"
  escortRequired?: string; // e.g. "WA Police", "Mental Health Transport"
}

export interface ComputedBarLayout {
  leftPct: number;
  widthPct: number;
  labelMode: "id" | "compact" | "full";
  isPast: boolean;
}

/**
 * Computes exact subpixel positioning and adaptive typography tiers
 * for an event bar on the timeline track.
 *
 * Invariants:
 * - leftPct is strictly bounded in [0.0, 100.0]
 * - widthPct is bounded with a 2.5% minimum hit-target floor
 * - labelMode strictly prevents text clipping
 */
export function computeBarLayout(
  event: HorizonEventItem,
  zoomRangeHours: number,
  nowOffsetHours: number = 0,
): ComputedBarLayout {
  const effectiveStart = event.startHour - nowOffsetHours;

  // Calculate relative left percentage
  const leftPct = Math.max(0, Math.min(100, (effectiveStart / zoomRangeHours) * 100));

  // Calculate width percentage with minimum hit floor (2.5%) and maximum right boundary (100 - leftPct)
  const rawWidthPct = (event.durationHours / zoomRangeHours) * 100;
  const widthPct = Math.max(2.5, Math.min(100 - leftPct, rawWidthPct));

  // Adaptive Typography Contract:
  // Short (<16%): Show ID only (e.g. "MRN-4012")
  // Medium (16% to 32%): Show ID + Status Badge (e.g. "MRN-4012 · ADMIT")
  // Wide (>=32%): Show Full Name & Clinical Detail (e.g. "MRN-4012 · C. Higgins (Ward 4A)")
  let labelMode: "id" | "compact" | "full" = "full";
  if (widthPct < 16) {
    labelMode = "id";
  } else if (widthPct < 32) {
    labelMode = "compact";
  }

  return {
    leftPct: Number(leftPct.toFixed(3)),
    widthPct: Number(widthPct.toFixed(3)),
    labelMode,
    isPast: event.startHour + event.durationHours < 0,
  };
}

/**
 * Filters and groups events into discrete ward or health service lanes.
 */
export function groupEventsByLane(
  events: HorizonEventItem[],
  laneKey: keyof Pick<HorizonEventItem, "wardId" | "wardName">,
): Record<string, HorizonEventItem[]> {
  const grouped: Record<string, HorizonEventItem[]> = {};
  for (const ev of events) {
    const key = String(ev[laneKey]);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(ev);
  }
  return grouped;
}
