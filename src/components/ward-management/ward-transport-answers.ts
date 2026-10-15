import { minuteOfDayFromClockText, type Instant } from "@/components/ward-management/ward-clock";
import type { TransportLegalStatus, TransportProvider } from "@/components/ward-management/ward-model";

/**
 * THE TRANSPORT-BOOKING ANSWERS RULE — why "Book transport" is not yet answerable — shared by the
 * ED screen and the community screen.
 *
 * Fix list 1.3 (15 Oct 2026): the ED screen and the community screen each held their own copy of
 * this rule and of the estimated-time parser it reads, word for word. Both now call this one pure
 * module, so the rule can also run without React, and later on the server. Pinned by
 * `tests/ward-ed-blocked-reasons.test.ts`.
 */

/**
 * The answers the booking popup's draft holds (`TransportDraftState` in each screen). `undefined`
 * (or `""`) is "not yet answered"; nothing here is ever filled in for the person.
 */
export type TransportAnswersDraft = {
  provider: TransportProvider | undefined;
  escortRequired: boolean | undefined;
  cadNumber: string;
  transportLegalStatus: TransportLegalStatus | undefined;
  estimatedTime: string;
  estimatedDay: "today" | "tomorrow";
};

/**
 * Owner's third ruling, 2026-09-17: the estimated time in the transport-booking popup is a typed
 * `HH:MM` plus "today" or "tomorrow" — never a calendar date picker, because the person is reading
 * a time off a phone call, not choosing a date. Reads the time with `minuteOfDayFromClockText`
 * (`ward-clock.ts`, the same parsing the ED screen's `instantFromDateAndTimeInputs` uses for its own
 * time field) rather than inventing a second HH:MM parser, and finds "today" by rounding `now` down
 * to its own day — the same minute-offset unit every other `Instant` is already counted in, so no
 * `Date` arithmetic or timezone reasoning is needed at all.
 *
 * Refuses rather than guesses: a blank or malformed time returns `undefined`, never a fabricated
 * value.
 */
export function instantFromEstimatedTimeInputs(
  timeValue: string,
  day: "today" | "tomorrow",
  now: Instant,
): number | undefined {
  const minuteOfDay = minuteOfDayFromClockText(timeValue);
  if (minuteOfDay === undefined) return undefined;
  const startOfToday = Math.floor(now / 1440) * 1440;
  return startOfToday + (day === "tomorrow" ? 1440 : 0) + minuteOfDay;
}

/**
 * Why the confirm control is unavailable, or `undefined` when the booking is answerable. Pure and
 * module-level so every state can be asserted without rendering, and so the wording lives in one
 * place rather than being spelled inside each screen's JSX.
 */
export function transportAnswersBlockedReason(draft: TransportAnswersDraft, now: Instant): string | undefined {
  const missing: string[] = [];
  if (draft.provider === undefined) missing.push("choose who is collecting the patient");
  if (draft.escortRequired === undefined) missing.push("answer the escort question");
  // Owner's third ruling, 2026-09-17: the three facts read off the phone call, none filled in.
  if (draft.cadNumber.trim().length === 0) missing.push("enter the CAD transport number");
  if (draft.transportLegalStatus === undefined) missing.push("state whether the transport is voluntary or involuntary");
  if (instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now) === undefined) {
    missing.push("enter the estimated time");
  }
  if (missing.length === 0) return undefined;
  return `Before booking, ${missing.join(", ")}. None is filled in for you: the record has to say that this team decided.`;
}
