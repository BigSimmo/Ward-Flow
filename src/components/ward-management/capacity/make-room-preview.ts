import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * PREVIEW ONLY, for the three Make room mockups (17 Oct 2026). The demo network has no patient
 * marked for step down and almost every ward has a Ready bed, so no chain would show. On this
 * screen only, this marks a few synthetic stays as step down candidates, fills four wards and makes
 * one open ward women only, so the mockups show a two move and a three move chain. It changes no
 * stored state and is deleted once a mockup is picked.
 */
const PREVIEW_FULL_WARDS = ["rph-adult-secure", "bty-adult-secure", "arm-adult-open", "rgh-adult-secure"];
const PREVIEW_WOMEN_ONLY_WARD = "sjgm-adult-open";
/** Ward, and the recorded sex of the stay to mark there (undefined means the first stay). */
const PREVIEW_CANDIDATES: readonly (readonly [string, string | undefined])[] = [
  ["bty-adult-secure", "Male"],
  ["arm-adult-open", "Female"],
  ["rgh-adult-secure", undefined],
];

export function makeRoomPreview(input: { admissions: readonly Admission[]; units: readonly Unit[] }): {
  admissions: Admission[];
  units: Unit[];
} {
  const marked = new Set<string>();
  const admissions = input.admissions.map((admission) => {
    const wanted = PREVIEW_CANDIDATES.find(([unitId]) => unitId === admission.unitId);
    if (!wanted || admission.state !== "occupied" || marked.has(admission.unitId)) return admission;
    if (wanted[1] !== undefined && admission.sex !== wanted[1]) return admission;
    marked.add(admission.unitId);
    return { ...admission, stepDownCandidate: true };
  });
  const units = input.units.map((unit) => {
    if (PREVIEW_FULL_WARDS.includes(unit.id)) {
      return { ...unit, allocatable: { ...unit.allocatable, value: 0 }, empty: { ...unit.empty, value: 0 } };
    }
    if (unit.id === PREVIEW_WOMEN_ONLY_WARD) return { ...unit, sexDesignation: "Female only" as const };
    return unit;
  });
  return { admissions, units };
}
