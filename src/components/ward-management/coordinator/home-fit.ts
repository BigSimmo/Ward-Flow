import { INFORMATIONAL_GATES, type ShortlistCandidate } from "@/components/ward-management/ward-derivations";

/**
 * FitHighlight (v10 Home, signature part): one answer to "can this ward take this patient now",
 * read by State bedflow and by Placement so the two always count the same wards.
 *
 * - `bed`: the eligibility rules pass and a bed is ready. Green fit tint.
 * - `no-bed`: everything fits except that the ward has no allocatable bed now. Amber fit tint.
 * - `review`: a judgement a coordinator may record a reason against (Override), or a ward that
 *   declined this patient before. Never counted as a fit (chapter: "A ward that declined the patient
 *   never counts as a fit").
 * - `no`: a gate no recorded reason can buy.
 */
export type FitKind = "bed" | "no-bed" | "review" | "no";

export function fitKind(candidate: ShortlistCandidate): FitKind {
  if (candidate.availability === "eligible") return "bed";
  if (candidate.availability === "overridable" || candidate.availability === "previously_declined") return "review";
  const failing = candidate.verdict.gates.filter((gate) => !gate.pass && !INFORMATIONAL_GATES.includes(gate.gate));
  return failing.length > 0 && failing.every((gate) => gate.gate === "allocatable_bed") ? "no-bed" : "no";
}

export type FitGroups = Record<FitKind, ShortlistCandidate[]>;

/** Candidates split by fit, each group in the shortlist's own order. */
export function fitGroups(candidates: readonly ShortlistCandidate[]): FitGroups {
  const groups: FitGroups = { bed: [], "no-bed": [], review: [], no: [] };
  for (const candidate of candidates) groups[fitKind(candidate)].push(candidate);
  return groups;
}

/** The words a fit row shows on its right, with the glyph tone that carries it. */
export const FIT_LABEL: Record<FitKind, { word: string; tone: "success" | "warning" | "neutral" | "closed" }> = {
  bed: { word: "Fits", tone: "success" },
  "no-bed": { word: "No bed now", tone: "warning" },
  review: { word: "Review", tone: "neutral" },
  no: { word: "Does not fit", tone: "closed" },
};
