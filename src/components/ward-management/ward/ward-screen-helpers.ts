// The ward screen's small helpers: the Bed board's undo, history and router reads, the shift line
// and place labels. Split out of `ward-screen.tsx` (18 October 2026) to keep it under the line cap.

import { useRouter, useSearchParams } from "next/navigation";
import { handoverScopeValue } from "@/components/ward-management/handover/handover-scope";
import { currentShift } from "@/components/ward-management/ward-board-time-features";
import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen, isArrivalLate } from "@/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement } from "@/components/ward-management/ward-model";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";

/** What the Bed board is waiting to hear back from the engine after a place or an undo. */
export type BoardCheck = {
  prior: number;
  bed: number;
  success: string;
  /** What Undo reverses; absent for an undo itself. */
  undo?:
    | { kind: "stay"; admissionId: string; unitId: string }
    | { kind: "referral"; referralId: string; unitId: string }
    | { kind: "movement"; movementId: string; unitId: string };
};

/** The undo event for what the Bed board placed or moved (v10 pass 2 and 3). */
export function boardUndoEvent(undo: NonNullable<BoardCheck["undo"]>, now: Instant): WardFlowEvent {
  if (undo.kind === "stay")
    return {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      now,
      admissionId: undo.admissionId,
      actingUnitId: undo.unitId,
    };
  if (undo.kind === "movement")
    return {
      type: "UNDO_ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now,
      movementId: undo.movementId,
      actingUnitId: undo.unitId,
    };
  return {
    type: "UNDO_REFERRAL_DECISION",
    role: "ward",
    now,
    referralId: undo.referralId,
    actingUnitId: undo.unitId,
  };
}

/** The router, or null where the screen renders outside the app router (a test or preview). */
/** This ward's Handover page, scoped to the ward. */
export function wardHandoverHref(unitId: string): string {
  return `/mockups/ward-flow/handover?scope=${encodeURIComponent(handoverScopeValue({ kind: "ward", id: unitId }))}`;
}

/** Set by the Census "Ward bed" link (patient-census-view.tsx): the exact `unit:bed` it opened. */
export const CENSUS_BED_OPENER_TARGET = "wardflow:census-bed-opener-target";
export const censusBedOpenerTarget = (unitId: string, bed: number) => `${unitId}:${bed}`;

/** history.state key marking the entry this screen pushed when a bed drawer opened. */
export const WARD_BED_DRAWER_ENTRY = "wardBedDrawer";

/**
 * history.state without Next.js's own entries. Next's patched history methods skip syncing
 * `useSearchParams` and the router's URL for state carrying `__NA`, so writing it back would leave
 * the router on a stale `?bed=`; Next re-adds its entries itself when it sees our write.
 */
export function ownHistoryState(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== "object") return {};
  const own = { ...(state as Record<string, unknown>) };
  delete own.__NA;
  delete own.__PRIVATE_NEXTJS_INTERNALS_TREE;
  return own;
}

export function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

/** The search params, or null where the screen renders outside the app router. */
export function useOptionalSearchParams(): ReturnType<typeof useSearchParams> | null {
  try {
    return useSearchParams();
  } catch {
    return null;
  }
}

/** "Day shift 07:00 to 15:00" for the shift `now` falls in, read from the labelled default pattern. */
export function shiftLine(now: Instant): string {
  const shift = currentShift(now);
  const clock = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const name = shift.name.charAt(0) + shift.name.slice(1).toLowerCase();
  return `${name} ${clock(shift.startMinute)} to ${clock(shift.endMinute)}`;
}

export function originPlaceLabel(originEdId: string): string {
  return edById(originEdId)?.name ?? originEdId;
}

export function arrivalIsLate(movement: Movement, now: Instant): boolean {
  return isOpen(movement) && isArrivalLate(movement, now);
}

// Fail closed for older provider adapters/test doubles without the identity projection.
// Never reconstruct the missing lookup by reaching for the full referral array here.
export const unavailablePatientIdentity = (): ResolvedPatientInfo => ({
  displayName: "Not recorded",
  formalName: "Not recorded",
  umrn: "UMRN not recorded",
  initials: "UP",
});
