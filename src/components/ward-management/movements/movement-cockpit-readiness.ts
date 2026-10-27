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
  if (legalForm.dueAt === undefined) return "Recorded, with no deadline on it.";
  const state = clockState(legalForm.dueAt, now, thresholds);
  if (state === "breached") return "Recorded, and its deadline has passed. Needs attention says by how much.";
  if (state === "critical" || state === "due") {
    return "Recorded, and its deadline is close. Needs attention says how close.";
  }
  return "Recorded, and its deadline is still ahead.";
}

export function transportReadinessState(movement: Movement, open: boolean): string {
  if (!open && movement.transport === undefined) return "Nothing was arranged before this movement closed.";
  if (movement.transport) return "A transport job exists.";
  if (transportNeedState(movement) === "not_needed") return "None is needed, and somebody recorded that.";
  if (transportNeedState(movement) === "needed") return "Needed, and no job has been raised for it yet.";
  return "Nothing recorded either way — neither a job nor an answer about whether one is wanted.";
}

export function blockerReadinessState(movement: Movement, open: boolean, blockerIsActive: boolean): string {
  if (!open) {
    if (blockerIsActive) {
      return "A note was recorded before this movement closed. Nothing is holding it up now, because nothing is moving.";
    }
    if (movement.blocker === "None — cleared") {
      return "Somebody recorded a blocker and cleared it before this movement closed.";
    }
    if (movement.blocker === "None — in transit") {
      return "Nothing was holding this up: the patient was in transit when it closed.";
    }
    if (movement.blocker === "None — handover complete") {
      return "Nothing was holding this up: handover was complete.";
    }
    if (movement.blocker === "None — the movement did not proceed") {
      return "Nothing was holding this up: the movement did not proceed.";
    }
    return "Nothing was recorded as holding this up.";
  }
  if (blockerIsActive) return "Somebody has recorded, by hand, something that is holding this up.";
  if (movement.blocker === "None — cleared") {
    return "Somebody recorded a blocker and then cleared it. Nothing is holding this up now.";
  }
  if (movement.blocker === "None — in transit") return "Nothing is holding this up: the patient is in transit.";
  if (movement.blocker === "None — handover complete") return "Nothing is holding this up: handover is complete.";
  if (movement.blocker === "None — the movement did not proceed") {
    return "Nothing is holding this up: the movement did not proceed.";
  }
  return "Nobody has recorded anything as holding this up.";
}

export function transportNeedSentence(movement: Movement, now: Instant): string {
  const state = transportNeedState(movement);
  if (state === "needed") {
    return `Yes — recorded as needed${movement.transportNeed ? ` at ${formatInstantWithDay(movement.transportNeed.at, now)}` : ""}.`;
  }
  if (state === "not_needed")
    return "No — somebody recorded that this patient needs no transport. That is an answer, not a gap.";
  return "Nobody has recorded an answer either way. This is not the same as deciding transport is not needed.";
}

export function transportReadinessLine(movement: Movement, open: boolean): string {
  if (!open && movement.closure && movement.transport === undefined) {
    return "No transport was arranged before this movement closed";
  }
  if (movement.transport) return transportStatusLabel(movement.transport);
  if (transportNeedState(movement) === "not_needed") return "No job has been raised, and none is wanted.";
  if (transportNeedState(movement) === "needed") return "No job has been raised for it yet.";
  return "No job has been raised.";
}
