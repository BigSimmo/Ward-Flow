import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * PREVIEW ONLY, for the Make room plan cards (option B, picked 17 Oct 2026). The demo network has
 * no patient marked for step down and almost every ward has a Ready bed, so no chain would show. On
 * this screen only, this marks three synthetic voluntary stays as step down candidates (a transfer
 * puts anyone not voluntary in a secure bed), fills three wards and makes three wards single sex, so
 * the panel shows a two move and a three move chain. It changes no stored state, and is removed
 * when "Start plan" is wired to real step down marks.
 */
const PREVIEW_FULL_WARDS = ["rph-adult-secure", "arm-adult-open", "scgh-adult-open"];
const PREVIEW_SINGLE_SEX_WARDS: Readonly<Record<string, "Female only" | "Male only">> = {
  "bty-adult-secure": "Female only",
  "sjgm-adult-open": "Female only",
  "gry-adult-secure": "Male only",
};
/** The synthetic stays marked for step down. */
const PREVIEW_CANDIDATES = new Set(["AD-RPHS-11", "AD-ARMA-01", "AD-SCGA-05"]);

export function makeRoomPreview(input: { admissions: readonly Admission[]; units: readonly Unit[] }): {
  admissions: Admission[];
  units: Unit[];
} {
  const admissions = input.admissions.map((admission) =>
    PREVIEW_CANDIDATES.has(admission.id) ? { ...admission, stepDownCandidate: true } : admission,
  );
  const units = input.units.map((unit) => {
    if (PREVIEW_FULL_WARDS.includes(unit.id)) {
      return { ...unit, allocatable: { ...unit.allocatable, value: 0 }, empty: { ...unit.empty, value: 0 } };
    }
    const sexDesignation = PREVIEW_SINGLE_SEX_WARDS[unit.id];
    if (sexDesignation) return { ...unit, sexDesignation };
    return unit;
  });
  return { admissions, units };
}
