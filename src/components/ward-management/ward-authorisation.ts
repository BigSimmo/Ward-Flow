import type { Unit } from "@/components/ward-management/ward-model";

/**
 * D-189 item 8(a) and D-209 item 9: the one place a ward's involuntary-admission authorisation is read.
 *
 * D-209 item 9 (Josh, 14 Nov 2026): a ward's authorisation is shown from the Office of the Chief
 * Psychiatrist's Register of Authorised Hospitals in Western Australia,
 * dated 7 September 2026, read 14 Nov 2026. The register lists hospitals and their service types, not
 * this app's sample ward names, so each ward below is matched to its hospital's register entry by
 * service type. The four sample older adult wards at hospitals the register lists with no older adult
 * service stay "not stated", as does any ward not named here.
 *
 * Authorisation still steers no placement (D-209 item 9, Josh: no steering; D-189 item 9(a)): not the
 * fit check, the bed finders, held-bed refusals, alerts, the legal mismatch flag or planned
 * admissions. The invented `authorised` flag in the sample data is never read. Read authorisation
 * through this file only.
 */
export type UnitAuthorisation = "on_register" | "not_on_register" | "not_stated";

export const AUTHORISATION_NOT_STATED = "Not stated";

/** The register the labels quote, and its date. */
export const AUTHORISATION_REGISTER_DATE = "7 Sep 2026";

/** Sample wards whose hospital's register entry lists their service type (D-209 item 9). */
const ON_REGISTER: ReadonlySet<string> = new Set([
  "rph-adult-secure", // Royal Perth Hospital Debakarn Mental Health Unit: Adult
  "scgh-adult-open", // Sir Charles Gairdner Hospital Mental Health Unit: Adult
  "fsh-adult-secure", // Fiona Stanley Hospital Mental Health Unit: Adult
  "arm-adult-open", // Armadale Health Service Mental Health Unit: Adult
  "sjgm-adult-open", // St John of God Midland Hospital Mental Health Unit: Adult
  "rgh-adult-secure", // Rockingham Hospital Mimidi Park Mental Health Unit: Adult
  "fre-adult-open", // Fremantle Hospital Mental Health Unit: Adult
  "fre-older-adult", // Fremantle Hospital Mental Health Unit: Older adult
  "bty-adult-secure", // Bentley Health Service Mental Health Unit: Adult
  "bty-older-adult", // Bentley Health Service Mental Health Unit: Older adult
  "bty-youth", // East Metropolitan Youth Unit: Youth
  "gry-adult-secure", // Graylands Hospital: Adult
  "alb-adult-open", // Albany Health Campus Mental Health Unit: Adult
  "bun-adult-open", // Bunbury Hospital Mental Health Unit: Adult
  "brm-adult-secure", // Broome Hospital Mabu Liyan Mental Health Unit: Adult
  "ger-adult-open", // Geraldton Health Campus Mental Health Unit: Adult
]);

/** Sample wards at a hospital the register does not list (D-209 item 9). */
const NOT_ON_REGISTER: ReadonlySet<string> = new Set([
  "sjgs-adult-open", // St John of God Subiaco Hospital: not listed
  "sjgs-adult-secure", // St John of God Subiaco Hospital: not listed
]);

/** A ward's authorisation as the 7 Sep 2026 register shows it. */
export function unitAuthorisation(unit: Pick<Unit, "id">): UnitAuthorisation {
  if (ON_REGISTER.has(unit.id)) return "on_register";
  if (NOT_ON_REGISTER.has(unit.id)) return "not_on_register";
  return "not_stated";
}

/** The label shown wherever a ward's authorisation is shown. */
export function authorisationLabel(unit: Pick<Unit, "id">): string {
  const value = authorisationValue(unit);
  return `Involuntary admissions: ${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

/** The short value for an "Involuntary admissions" fact row. */
export function authorisationValue(unit: Pick<Unit, "id">): string {
  switch (unitAuthorisation(unit)) {
    case "on_register":
      return `Authorised (Chief Psychiatrist register, ${AUTHORISATION_REGISTER_DATE})`;
    case "not_on_register":
      return `Not on the authorised register (${AUTHORISATION_REGISTER_DATE})`;
    default:
      return AUTHORISATION_NOT_STATED;
  }
}

/**
 * Whether authorisation stops a person being placed on this unit. Never: Josh chose no steering
 * (D-209 item 9), so the label informs and the placement paths stay as D-189 item 9(a) left them.
 */
export function authorisationBlocksPlacement(unit: Pick<Unit, "authorised">): boolean {
  void unit;
  return false;
}
