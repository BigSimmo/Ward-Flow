import { ED_HELD_STAGES, type EdSummary } from "@/components/ward-management/ed/ed-home-derivations";
import { edHasNoBedYet } from "@/components/ward-management/ed/ed-no-bed";
import { splitDuration } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { ED_TREND_SPAN_MINUTES, ED_TREND_STEP_MINUTES } from "@/components/ward-management/ward-operational-defaults";

/*
 * Types and small helpers shared by the ED index and its lazily loaded preview (ed-preview.tsx).
 * They live here, not in ed-index.tsx, so the preview's import does not form a cycle with the page.
 */

export const trendSpanHours = ED_TREND_SPAN_MINUTES / 60;
export const trendStepHours = ED_TREND_STEP_MINUTES / 60;

export type WaitClock = "past" | "severe" | "in";

export type EdPerson = {
  movement: Movement;
  name: string;
  /** UMRN, or "UMRN not recorded" (D-39: never the movement id). */
  umrn: string;
  href: string;
  wait: number;
  clock: WaitClock;
  stage: string;
  destination?: string;
};

export type EdRow = {
  summary: EdSummary;
  short: string;
  people: EdPerson[];
  pastTarget: number;
  /** Everyone at or over the 8h line, past-target people included. */
  severe: number;
  noBed: number;
  held: number;
  leaving: number;
  forms: number;
  /** Waiting at each 2 hour point over the last 12 hours, the last point now (`edWaitingSeries`). */
  trend: number[];
};

export const CLOCK_TONE = { past: "danger", severe: "warning", in: "neutral" } as const;

/**
 * Hero highlight chips (v10, five at most). Pressing one keeps the people it names solid in every
 * view and dims the rest by colour. It never hides an ED.
 */
export type Highlight = "past" | "severe" | "no-bed" | "held" | "form";
const HIGHLIGHT_MATCH: Record<Highlight, (person: EdPerson) => boolean> = {
  past: (person) => person.clock === "past",
  severe: (person) => person.clock !== "in",
  "no-bed": (person) => edHasNoBedYet(person.movement),
  held: (person) => ED_HELD_STAGES.includes(person.movement.stage),
  form: (person) => Boolean(person.movement.legalForm),
};
export function personDim(person: EdPerson, highlight: Highlight | null): boolean {
  return highlight !== null && !HIGHLIGHT_MATCH[highlight](person);
}
export function rowHighlighted(row: EdRow, highlight: Highlight | null): boolean {
  return highlight === null || row.people.some(HIGHLIGHT_MATCH[highlight]);
}

/** "24h", "8h": the two wait lines as a person says them, never "1d" or "8h 00m". */
export function waitLine(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : splitDuration(minutes);
}
