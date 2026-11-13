import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

import { formProgression, formProgressionPhrase, NEXT_FORM_TO_RECORD } from "./legal-form-progression";
import { currentLegalDueAt, isLegalDeadlineBreached } from "./legal-forms-derivations";
import { hasGap, isOwnedLegalFormCode, type RecordGap } from "./legal-forms-view";
import { typedTimePhrase } from "./legal-time-as-typed";

/**
 * THE ONE NEXT STEP FOR A CHOSEN FORM (Forms side panel, Josh 1 Nov 2026: "fill the Now tab").
 *
 * It reads only what the record holds, in the order a person meets it on the paper: a form that has
 * moved on, a typed end time already gone by, then the facts still to record on this page. It names
 * the step and the control that does it. It computes no legal time and cites no section: a typed
 * time is repeated as typed, and the caveat beside it says it is not legally checked.
 */
export type NextStepAction = RecordGap | "next-form" | "extend" | "none";

export type NextStep = {
  action: NextStepAction;
  /** The step in a few words: "Mark Form 1A received". */
  title: string;
  /** One plain sentence on why, from the record. */
  detail: string;
};

export function nextStep(movement: Movement, now: Instant, dayZero?: Date): NextStep {
  const code = movement.legalForm?.code;
  const form = code ? `Form ${code}` : "The form";
  // Gap list item 5: a form a person recorded as ended asks for nothing more on this page.
  const endedBy = movement.legalForm?.endedBy;
  if (endedBy) {
    return {
      action: "none",
      title: "Form ended, as recorded",
      detail: "Record the next form here when it is made.",
    };
  }
  // D-170 item 1: "Next form to record", with no form number; the form stays as recorded (A1).
  const progression = formProgression(movement);
  if (progression) {
    return {
      action: "next-form",
      title: NEXT_FORM_TO_RECORD,
      detail: `${formProgressionPhrase(progression)}.`,
    };
  }
  const dueAt = currentLegalDueAt(movement);
  if (isLegalDeadlineBreached(movement, now) && dueAt !== undefined) {
    return {
      action: "extend",
      title: "Extend or record the next form",
      detail: `${form} ${typedTimePhrase(dueAt, now, dayZero)}.`,
    };
  }
  if (isOwnedLegalFormCode(code) && hasGap(movement, "written")) {
    return {
      action: "written",
      title: "Add the time written",
      detail: `Type the date and time written on ${form}.`,
    };
  }
  if (hasGap(movement, "received")) {
    return {
      action: "received",
      title: `Mark ${form} received`,
      detail: "Mark it when the paper form reaches you.",
    };
  }
  if (hasGap(movement, "examination")) {
    return {
      action: "examination",
      title: "Record the examination",
      detail: "The examination is recorded on the emergency department screen.",
    };
  }
  return {
    action: "none",
    title: "Nothing to record now",
    detail: "Record the next form here when it is made.",
  };
}
