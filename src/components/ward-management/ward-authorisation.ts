import type { Unit } from "@/components/ward-management/ward-model";

/**
 * D-189 item 8(a): the one place a ward's involuntary-admission authorisation is read.
 *
 * Every unit's `authorised` flag in the sample data is invented and unsigned (Q42). Until Josh
 * signs real authorisations, every unit reads "not stated" and the flag steers no placement:
 * not the fit check, the bed finders, held-bed refusals, alerts, the legal mismatch flag or
 * planned admissions (D-189 item 9(a)). Read authorisation through this file only.
 */
export type UnitAuthorisation = "not_stated";

export const AUTHORISATION_NOT_STATED = "Not stated";

/** Every unit's authorisation is "not stated" until Q42 is signed. */
export function unitAuthorisation(unit: Pick<Unit, "authorised">): UnitAuthorisation {
  void unit; // the invented flag is deliberately not read until Q42 is signed
  return "not_stated";
}

/** The label shown wherever a ward's authorisation was shown. */
export function authorisationLabel(unit: Pick<Unit, "authorised">): string {
  return unitAuthorisation(unit) === "not_stated" ? "Involuntary admissions: not stated" : "";
}

/** Whether authorisation stops a person being placed on this unit. Never, while "not stated". */
export function authorisationBlocksPlacement(unit: Pick<Unit, "authorised">): boolean {
  return unitAuthorisation(unit) !== "not_stated";
}
