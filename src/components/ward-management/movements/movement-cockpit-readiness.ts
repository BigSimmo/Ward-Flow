import {
  clockState,
  type DueSoonThresholds,
  formatInstantWithDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { transportNeedState, transportStatusLabel } from "@/components/ward-management/ward-derivations";
import type { LegalForm, Movement } from "@/components/ward-management/ward-model";

/*
 * The cockpit's readiness and transport sentences, moved out of `movement-workspace-cockpit.tsx`
 * (H-0283, 27 Oct 2026) unchanged.
 */

export function formReadinessState(
  legalForm: LegalForm | undefined,
  now: Instant,
  thresholds: DueSoonThresholds,
): string {
  if (!legalForm) return "Not ready — no legal form recorded.";
  if (legalForm.dueAt === undefined) return "Recorded. No deadline.";
  const state = clockState(legalForm.dueAt, now, thresholds);
  if (state === "breached") return "Recorded. Deadline passed.";
  if (state === "critical" || state === "due") {
    return "Recorded. Deadline close.";
  }
  return "Recorded. Deadline ahead.";
}

export function transportReadinessState(movement: Movement, open: boolean): string {
  if (!open && movement.transport === undefined) return "Nothing was arranged before this movement closed.";
  if (movement.transport) return "A transport job exists.";
  if (transportNeedState(movement) === "not_needed") return "Not needed.";
  if (transportNeedState(movement) === "needed") return "Needed. No job yet.";
  return "No job, and need not recorded.";
}

export function blockerReadinessState(movement: Movement, open: boolean, blockerIsActive: boolean): string {
  if (!open) {
    if (blockerIsActive) {
      return "A note was recorded before closure.";
    }
    if (movement.blocker === "None — cleared") {
      return "Cleared before closure.";
    }
    if (movement.blocker === "None — in transit") {
      return "None: in transit at closure.";
    }
    if (movement.blocker === "None — handover complete") {
      return "None: handover complete.";
    }
    if (movement.blocker === "None — the movement did not proceed") {
      return "None: did not proceed.";
    }
    return "None recorded.";
  }
  if (blockerIsActive) return "A blocker is recorded.";
  if (movement.blocker === "None — cleared") {
    return "Cleared.";
  }
  if (movement.blocker === "None — in transit") return "None: in transit.";
  if (movement.blocker === "None — handover complete") return "None: handover complete.";
  if (movement.blocker === "None — the movement did not proceed") {
    return "None: did not proceed.";
  }
  return "None recorded.";
}

export function transportNeedSentence(movement: Movement, now: Instant): string {
  const state = transportNeedState(movement);
  if (state === "needed") {
    return `Yes — recorded as needed${movement.transportNeed ? ` at ${formatInstantWithDay(movement.transportNeed.at, now)}` : ""}.`;
  }
  if (state === "not_needed") return "No — recorded as not needed.";
  return "Not recorded either way.";
}

export function transportReadinessLine(movement: Movement, open: boolean): string {
  if (!open && movement.closure && movement.transport === undefined) {
    return "No transport was arranged before this movement closed";
  }
  if (movement.transport) return transportStatusLabel(movement.transport);
  if (transportNeedState(movement) === "not_needed") return "No job; none wanted.";
  if (transportNeedState(movement) === "needed") return "No job yet.";
  return "No job has been raised.";
}
