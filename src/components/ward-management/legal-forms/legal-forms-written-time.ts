import type { Instant } from "@/components/ward-management/ward-clock";
import type { LegalClockAgeBand, LegalClockRegion } from "@/components/ward-management/ward-legal-clock";
import type { LegalForm } from "@/components/ward-management/ward-model";

import { instantFromDateAndTimeInputs } from "./legal-forms-view";

/**
 * "Record the time written": the draft and its one check, shared by the side panel's form and the
 * Add the time pop-up. Only the time typed from the paper form is recorded; nothing is worked out
 * from it (D5, D-70, D-93).
 */

// "not_recorded" until someone picks a band: a default of Adult would record an age band nobody chose.
// Finding 210 (27 Oct 2026): region opens the same way, so a country Form 1A is never saved as metro.
export type WrittenDraft = {
  date: string;
  time: string;
  region: LegalClockRegion | "not_recorded";
  ageBand: LegalClockAgeBand | "not_recorded";
};

const BLANK_WRITTEN: WrittenDraft = { date: "", time: "", region: "not_recorded", ageBand: "not_recorded" };

/** The values the save sends: region only when chosen, so a same-form time edit keeps the recorded region. */
export type WrittenSave = {
  writtenAt: number;
  region: LegalClockRegion | undefined;
  ageBand: LegalClockAgeBand | null;
};

/** Starts from the recorded region and age band, so changing the time never resets a country form to metro. */
export function writtenDraftFor(legalForm: LegalForm | undefined): WrittenDraft {
  return {
    ...BLANK_WRITTEN,
    region: legalForm?.region ?? BLANK_WRITTEN.region,
    ageBand: legalForm?.ageBand ?? BLANK_WRITTEN.ageBand,
  };
}

/**
 * The typed date and time as one instant, and what is wrong with it if anything. The same rule as
 * the Record a form sheet: a form cannot have been written after now.
 */
export function writtenTimeCheck(
  draft: WrittenDraft,
  now: Instant,
  dayZero: Date,
): { typedWrittenAt: Instant | undefined; writtenLater: boolean; writtenProblem: string | undefined } {
  const typedWrittenAt = instantFromDateAndTimeInputs(draft.date, draft.time, dayZero);
  const writtenLater = typedWrittenAt !== undefined && typedWrittenAt > now;
  const writtenProblem =
    typedWrittenAt === undefined
      ? "Enter the time written on the form"
      : writtenLater
        ? "The time written cannot be later than now"
        : undefined;
  return { typedWrittenAt, writtenLater, writtenProblem };
}

/** The draft as the save sends it, or undefined while the typed time is missing or later than now. */
export function writtenSaveOf(draft: WrittenDraft, now: Instant, dayZero: Date): WrittenSave | undefined {
  const { typedWrittenAt, writtenLater } = writtenTimeCheck(draft, now, dayZero);
  if (typedWrittenAt === undefined || writtenLater) return undefined;
  return {
    writtenAt: typedWrittenAt,
    region: draft.region === "not_recorded" ? undefined : draft.region,
    ageBand: draft.ageBand === "not_recorded" ? null : draft.ageBand,
  };
}
