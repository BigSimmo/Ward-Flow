import type { Admission } from "@/components/ward-management/ward-admissions";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";

/**
 * SEVEN DAY FOLLOW UP CHECK (Top 25 item 11, `top25-follow-up-7day`). Every discharge shows whether
 * follow up within the window is arranged, and a person on an active community treatment order gets
 * extra items. It warns and never blocks: nothing here is read by the engine.
 *
 * No new field. The appointment time is the care journey's current follow-up booking
 * (`careJourney.followUp.appointmentAt`) when one is recorded, and otherwise only the arranged or
 * not arranged status (`Admission.followUp`) is known. The window is
 * `CLINICAL_VALUES.ctoFollowUpWindow`, applied to every discharge by the owner ruling of 15 Oct 2026.
 */
type FollowUpCheckStatus = "booked_within" | "booked_outside" | "arranged_no_date" | "not_arranged";

export type FollowUpCheck = {
  status: FollowUpCheckStatus;
  /** True for every status that needs someone to act. Never a block. */
  warning: boolean;
  sentence: string;
  windowDays: number;
  /** Present only on an active community treatment order. */
  ctoItems?: { label: string; done: boolean }[];
};

export function followUpWithinWindowCheck(input: {
  followUp: Admission["followUp"];
  careJourney: Admission["careJourney"];
  /** When the person left, or the expected discharge time, or now, first present wins. */
  leftAt?: Instant | null;
  expectedDischargeAt?: Instant | null;
  now: Instant;
  onCto: boolean;
}): FollowUpCheck {
  const windowDays = CLINICAL_VALUES.ctoFollowUpWindow.value;
  const reference = input.leftAt ?? input.expectedDischargeAt ?? input.now;
  const appointmentAt = input.careJourney?.followUp?.appointmentAt;
  let status: FollowUpCheckStatus;
  if (appointmentAt !== undefined) {
    status =
      appointmentAt >= reference && appointmentAt - reference <= windowDays * MINUTES_PER_DAY
        ? "booked_within"
        : "booked_outside";
  } else if (input.followUp?.state === "arranged") {
    status = "arranged_no_date";
  } else {
    status = "not_arranged";
  }
  const sentence = {
    booked_within: `Follow up booked within ${windowDays} days of leaving.`,
    booked_outside: `Follow up is booked, but not within ${windowDays} days of leaving.`,
    arranged_no_date: `Follow up is marked arranged, with no appointment time recorded. Check it is within ${windowDays} days.`,
    not_arranged: `No follow up within ${windowDays} days is arranged yet.`,
  }[status];
  return {
    status,
    warning: status !== "booked_within",
    sentence,
    windowDays,
    ...(input.onCto
      ? {
          ctoItems: [
            { label: "Community service named for the follow up", done: !!input.careJourney?.followUp?.serviceId },
            { label: `Appointment within ${windowDays} days`, done: status === "booked_within" },
            { label: "Community treatment order paperwork recorded", done: !!input.careJourney?.legal },
          ],
        }
      : {}),
  };
}
