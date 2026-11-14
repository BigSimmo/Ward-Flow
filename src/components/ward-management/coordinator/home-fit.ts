import {
  INFORMATIONAL_GATES,
  restrictionNotice,
  type ShortlistCandidate,
} from "@/components/ward-management/ward-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import { candidateReason, placementFit, staleCountWords } from "@/components/ward-management/ward-eligibility";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * FitHighlight (v10 Home, signature part): one answer to "can this ward take this patient now",
 * read by State bedflow and by Placement so the two always count the same wards.
 *
 * - `bed`: the eligibility rules pass and a bed is ready. Green fit tint.
 * - `no-bed`: everything fits except that the ward has no Ready bed now. Amber fit tint.
 * - `stale`: everything fits except that the ward's bed count is old (H8, D-210 (Josh, 14 Nov
 *   2026)): "Bed count N min old, check with the ward". Still choosable, never "Does not fit".
 * - `review`: a judgement a coordinator may record a reason against (Override), or a ward that
 *   declined this patient before. Never counted as a fit (chapter: "A ward that declined the patient
 *   never counts as a fit").
 * - `no`: a gate no recorded reason can buy.
 */
export type FitKind = "bed" | "no-bed" | "stale" | "review" | "no";

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

/**
 * H8 (D-210 (Josh, 14 Nov 2026)): read from the one shared classifier (`placementFit`), the same one
 * the Place tab, the next-ward list and both Ask wards lists use. Before this, an old bed count read
 * "Review" here, or "Does not fit" when the count also showed no bed.
 */
function baseFitKind(candidate: ShortlistCandidate): FitKind {
  // A closed ward is never "fits, no bed now": no bed will free up there, so it reads as not fitting.
  if (candidate.unit.isClosed) return "no";
  if (candidate.availability === "previously_declined") return "review";
  const fit = placementFit(candidate.verdict, INFORMATIONAL_GATES);
  if (fit.kind === "fits") return "bed";
  if (fit.kind === "stale_count") return "stale";
  // A bay-mix check that only lacks Ready beds is "no bed now" (H9). Where a recorded reason may
  // still answer it (one Ready bed, nobody of the same sex there), the ward stays choosable under
  // Review, as it was, rather than being shut away with the wards that have no bed at all.
  if (fit.kind === "no_bed") return fit.overridable ? "review" : "no-bed";
  // A ward a recorded reason can reach (including a gender placement still to record) stays Review.
  return candidate.availability === "overridable" ? "review" : "no";
}

/** The reason line of a row that does not fit outright: an old count names its age (H8). */
export function fitReasonWords(candidate: ShortlistCandidate, kind: FitKind, now: Instant): string {
  return kind === "stale" ? staleCountWords(candidate.unit, now) : candidateReason(candidate.verdict);
}

export type FitGroups = Record<FitKind, ShortlistCandidate[]>;

/** Candidates split by fit, each group in the shortlist's own order. */
export function fitGroups(candidates: readonly ShortlistCandidate[], movement?: Movement): FitGroups {
  const groups: FitGroups = { bed: [], "no-bed": [], stale: [], review: [], no: [] };
  for (const candidate of candidates) groups[fitKind(candidate, movement)].push(candidate);
  return groups;
}

/** The words a fit row shows on its right, with the glyph tone that carries it. */
export const FIT_LABEL: Record<FitKind, { word: string; tone: "success" | "warning" | "neutral" | "closed" }> = {
  bed: { word: "Fits", tone: "success" },
  "no-bed": { word: "No bed now", tone: "warning" },
  stale: { word: "Count not current", tone: "warning" },
  review: { word: "Review", tone: "neutral" },
  no: { word: "Does not fit", tone: "closed" },
};
