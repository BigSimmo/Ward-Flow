/**
 * Q103 (Josh, 1 Nov 2026): what an ED patient presented with, as a fixed list. More than one can be
 * chosen and "Other" takes no typed text, so the record never carries free text.
 */
export const ED_PRESENTATION_CHOICES = [
  "Suicidal thoughts",
  "Self-harm",
  "Low mood",
  "Psychosis",
  "Mania",
  "Agitation",
  "Anxiety or distress",
  "Confusion",
  "Intoxication",
  "Eating disorder",
  "Other",
] as const;

export type EdPresentation = (typeof ED_PRESENTATION_CHOICES)[number];

export function isEdPresentation(value: unknown): value is EdPresentation {
  return typeof value === "string" && (ED_PRESENTATION_CHOICES as readonly string[]).includes(value);
}
