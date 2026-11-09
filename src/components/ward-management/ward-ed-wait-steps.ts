import {
  ED_ELEVATED_PRESSURE_WAIT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
  VERY_LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

/**
 * ED LONG WAIT STEPS (Top 25 item 13). Owner ruling 15 Oct 2026: one
 * threshold set. The steps are the thresholds the ED screens already use (side rail amber and red,
 * the long wait and the very long wait), so no second ladder exists. The showcase's 12 hour step and
 * 22 hour edge are not used.
 *
 * ⚠️ The step names are plain ("Step 2, over 8 hours"). No WA Health escalation names are sourced
 * in this repository, so none is invented; naming each step is left to Josh. Like "Waiting over 24
 * hours" (D-24), a step is a neutral fact, never a breach.
 */
export type EdWaitStep = {
  step: 1 | 2 | 3 | 4;
  /** From this many minutes in the department. */
  fromMinutes: number;
  /** "Step 2, over 8 hours". */
  label: string;
  /** The suggested next step for this wait (Josh's sign-off, 9 Nov 2026). A prompt for a person, never an automatic action. */
  nextStep: string;
  /** The same step in two or three words, for the narrow wait column. */
  nextStepShort: string;
};

/**
 * Suggested next step per wait step. Josh signed off these defaults on 9 Nov 2026 (six features
 * thread, "Go ahead with all your recommendations"). They are prototype wording, not WA Health
 * escalation policy. No ward is suggested and the queue order does not change (D-71).
 */
export const ED_WAIT_NEXT_STEPS: Readonly<Record<EdWaitStep["step"], string>> = {
  1: "Ask wards with a free bed",
  2: "Call the site bed manager",
  3: "Consider an out-of-area bed and add to the bed meeting",
  4: "Tell the executive on call",
};

const ED_WAIT_NEXT_STEPS_SHORT: Readonly<Record<EdWaitStep["step"], string>> = {
  1: "Ask wards",
  2: "Call bed manager",
  3: "Consider out of area",
  4: "Tell executive",
};

const STEP_THRESHOLDS: readonly { step: EdWaitStep["step"]; fromMinutes: number }[] = [
  { step: 4, fromMinutes: VERY_LONG_WAIT_MINUTES },
  { step: 3, fromMinutes: LONG_WAIT_MINUTES },
  { step: 2, fromMinutes: ED_SEVERE_PRESSURE_WAIT_MINUTES },
  { step: 1, fromMinutes: ED_ELEVATED_PRESSURE_WAIT_MINUTES },
];

function hoursWords(minutes: number): string {
  const hours = minutes / 60;
  return `over ${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`;
}

/** The wait step for a time in the department, or `undefined` below the first threshold. */
export function edWaitStep(minutesInDepartment: number): EdWaitStep | undefined {
  if (!Number.isFinite(minutesInDepartment)) return undefined;
  const match = STEP_THRESHOLDS.find((threshold) => minutesInDepartment >= threshold.fromMinutes);
  if (!match) return undefined;
  return {
    ...match,
    label: `Step ${match.step}, ${hoursWords(match.fromMinutes)}`,
    nextStep: ED_WAIT_NEXT_STEPS[match.step],
    nextStepShort: ED_WAIT_NEXT_STEPS_SHORT[match.step],
  };
}
