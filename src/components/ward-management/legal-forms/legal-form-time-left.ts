import type { WfTone } from "@/components/wf";
import { type DueSoonThresholds, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

import { currentLegalDueAt } from "./legal-forms-derivations";
import { STANDING_TONE, clockStanding, isActNow, type ClockStanding } from "./legal-forms-view";
import { typedTimeLine } from "./legal-time-as-typed";

/**
 * ONE RULE FOR A FORM'S TIME LEFT (audit A3-3/A3-4/S-28, 13 Oct 2026). The Patient page, the Forms
 * page and the Delays board read the same typed expiry (`legalForm.dueAt`) through the same
 * `clockState` thresholds, so a form never reads act now on one page and at risk on another. D5
 * still holds: nothing here computes a legal limit; with no typed expiry there is no time left.
 *
 * Legal times only as typed (Josh, 31 Oct 2026, replacing D-71 item 5): the text is the typed time
 * in words, "Ends 15:42 as typed" or "Ended 15:42 as typed", never a running "1h 00m left".
 */
export type FormTimeLeft = {
  /** Form short name, "Form 4A". */
  code: string;
  /** "Ends 15:42 as typed", or "Ended 15:42 as typed" once the typed time has gone by. */
  text: string;
  /** The typed expiry as a wall clock, with the day when it is not today. */
  at: string;
  standing: ClockStanding;
  /** Glyph tone only, never text colour. */
  tone: WfTone;
  actNow: boolean;
};

export function formTimeLeft(
  movement: Movement | undefined,
  now: Instant,
  thresholds: DueSoonThresholds,
): FormTimeLeft | undefined {
  const form = movement?.legalForm;
  const dueAt = movement ? currentLegalDueAt(movement) : undefined;
  if (!movement || !form || dueAt === undefined) return undefined;
  const standing = clockStanding(movement, now, thresholds);
  return {
    code: `Form ${form.code}`,
    text: typedTimeLine(dueAt, now),
    at: formatInstantWithDay(dueAt, now),
    standing,
    tone: STANDING_TONE[standing],
    actNow: isActNow(standing),
  };
}
