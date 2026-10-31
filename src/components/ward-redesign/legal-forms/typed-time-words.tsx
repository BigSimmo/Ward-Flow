"use client";

// Preview only (Josh, 30 Oct 2026, decision 1): one honest rule for colour on a typed legal time,
// shared by the Legal forms, Waiting and My ward mock-ups. A typed time is coloured only when the
// user's own warning settings say so (amber within the first setting, red within the second or
// passed; the app's defaults are 3h and 1h), and the colour always comes with its words
// ("within 1h", "within 3h", "passed"). Never a countdown (D-70).
import type { DueSoonThresholds, Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { STANDING_TONE, clockStanding, standingWord } from "@/components/ward-management/legal-forms/legal-forms-view";
import type { WfTone } from "@/components/wf";

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
