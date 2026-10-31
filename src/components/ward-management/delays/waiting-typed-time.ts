// Legal times only as typed (Josh, 31 Oct 2026; D-93 on #1135). The Waiting page's copy of the
// helpers that #1135 adds to `legal-forms/legal-forms-view.ts` and `legal-forms/legal-time-as-typed.ts`,
// word for word, so this page can be built before #1135 merges. When #1135 is in this branch, this
// file is replaced by imports from those two files.
//
// A typed time is coloured only when the user's own warning settings say so (amber within the first
// setting, red within the second or passed), and the colour always comes with its words ("within
// 1h", "within 3h", "passed"). Never a countdown (D-70).
import {
  formatInstantWithDay,
  type DueSoonThresholds,
  type Instant,
  isClockBreached,
} from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { STANDING_TONE, clockStanding, standingWord } from "@/components/ward-management/legal-forms/legal-forms-view";
import type { WfTone } from "@/components/wf";

/** The one key line the page carries near its list, word for word. */
export const TYPED_TIME_KEY = "Colours compare the time as typed with the clock. Not legally checked.";

export type TypedTimeStanding = {
  /** The glyph tone: danger, warning, or neutral when the typed time is not inside a warning. */
  tone: WfTone;
  /** "within 1h", "within 3h" or "passed"; undefined when no colour is shown. */
  word: string | undefined;
  /** Red: within the second warning or passed. */
  urgent: boolean;
};

/** How the movement's typed legal time stands against the user's warning settings. */
export function typedTimeStanding(movement: Movement, now: Instant, thresholds: DueSoonThresholds): TypedTimeStanding {
  const standing = clockStanding(movement, now, thresholds);
  const coloured = standing === "passed" || standing === "urgent" || standing === "soon";
  return {
    tone: coloured ? STANDING_TONE[standing] : "neutral",
    word: coloured ? standingWord(standing, thresholds).toLowerCase() : undefined,
    urgent: standing === "passed" || standing === "urgent",
  };
}

/** " · within 1h" after a typed time, or nothing when the time carries no colour. */
export function standingSuffix(standing: TypedTimeStanding): string {
  return standing.word ? ` · ${standing.word}` : "";
}

/** "ends 15:42 as typed", or "ended 15:42 as typed" once the typed time has gone by. */
export function typedTimePhrase(dueAt: Instant, now: Instant): string {
  return `${isClockBreached(dueAt, now) ? "ended" : "ends"} ${formatInstantWithDay(dueAt, now)} as typed`;
}
