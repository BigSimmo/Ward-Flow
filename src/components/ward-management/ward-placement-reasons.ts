import type { EligibilityGate, EligibilityVerdict } from "@/components/ward-management/ward-eligibility";

/**
 * Why a suggested ward fits this person or does not, grouped into the questions a bed coordinator
 * actually asks (owner request, 4 October 2026: "each suggested bed shows why it fits or doesn't").
 *
 * ⚠️ **A RE-READING OF THE ENGINE'S OWN GATES, NEVER A SECOND OPINION.** Every cell is built from
 * the `eligibility()` verdict the shortlist already holds: the same `pass` and the same `detail`
 * sentence the gate list shows. Nothing here scores, weights or reorders a ward, so a coordinator
 * can check each reason against the gate list and find the same words.
 *
 * A group whose gates the verdict did not emit says "Not checked", never "Met": silence from the
 * engine is not a pass.
 */
export type PlacementReasonGroup = {
  key: "gender" | "dependency" | "safety" | "bed";
  heading: string;
  gates: readonly EligibilityGate[];
};

export const PLACEMENT_REASON_GROUPS: readonly PlacementReasonGroup[] = [
  { key: "gender", heading: "Gender and sex mix", gates: ["gender_designation", "sex_mix"] },
  { key: "dependency", heading: "High-dependency and specialling", gates: ["acuity", "specialling"] },
  {
    key: "safety",
    heading: "Security, legal and forensic",
    gates: ["security", "authorisation", "legal_status", "forensic"],
  },
  { key: "bed", heading: "Bed and capacity", gates: ["allocatable_bed", "capacity_freshness"] },
];

export type PlacementReason = {
  label: "Met" | "Not met" | "Not checked";
  tone: "good" | "danger" | "neutral";
  /** The engine's own sentences: every failing gate's, or every passing gate's when none failed. */
  detail: string;
};

export function placementReason(verdict: EligibilityVerdict, group: PlacementReasonGroup): PlacementReason {
  const results = verdict.gates.filter((gate) => group.gates.includes(gate.gate));
  if (results.length === 0) return { label: "Not checked", tone: "neutral", detail: "No check of this kind was run." };
  const failed = results.filter((gate) => !gate.pass);
  if (failed.length > 0) {
    return { label: "Not met", tone: "danger", detail: failed.map((gate) => gate.detail).join(" ") };
  }
  return { label: "Met", tone: "good", detail: results.map((gate) => gate.detail).join(" ") };
}
