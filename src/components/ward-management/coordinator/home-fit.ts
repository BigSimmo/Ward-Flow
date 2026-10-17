import {
  INFORMATIONAL_GATES,
  restrictionNotice,
  type ShortlistCandidate,
} from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

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

/**
 * Audit S-21: given the movement, a ward that would hold a voluntary patient behind locked doors
 * (the same `restrictionNotice` the panel shows) reads `review`, never `bed`, so open fits list first.
 */
export function fitKind(candidate: ShortlistCandidate, movement?: Movement): FitKind {
  const kind = baseFitKind(candidate);
  if (
    movement &&
    (kind === "bed" || kind === "no-bed") &&
    restrictionNotice(movement, candidate.unit)?.level === "voluntary_on_locked"
  )
    return "review";
  return kind;
}

function baseFitKind(candidate: ShortlistCandidate): FitKind {
  // A closed ward is never "fits, no bed now": no bed will free up there, so it reads as not fitting.
  if (candidate.unit.isClosed) return "no";
  if (candidate.availability === "eligible") return "bed";
  if (candidate.availability === "overridable" || candidate.availability === "previously_declined") return "review";
  const failing = candidate.verdict.gates.filter((gate) => !gate.pass && !INFORMATIONAL_GATES.includes(gate.gate));
  return failing.length > 0 && failing.every((gate) => gate.gate === "allocatable_bed") ? "no-bed" : "no";
}

export type FitGroups = Record<FitKind, ShortlistCandidate[]>;

/** Candidates split by fit, each group in the shortlist's own order. */
export function fitGroups(candidates: readonly ShortlistCandidate[], movement?: Movement): FitGroups {
  const groups: FitGroups = { bed: [], "no-bed": [], review: [], no: [] };
  for (const candidate of candidates) groups[fitKind(candidate, movement)].push(candidate);
  return groups;
}

/** The words a fit row shows on its right, with the glyph tone that carries it. */
export const FIT_LABEL: Record<FitKind, { word: string; tone: "success" | "warning" | "neutral" | "closed" }> = {
  bed: { word: "Fits", tone: "success" },
  "no-bed": { word: "No bed now", tone: "warning" },
  review: { word: "Review", tone: "neutral" },
  no: { word: "Does not fit", tone: "closed" },
};
