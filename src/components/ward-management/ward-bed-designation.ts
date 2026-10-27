// src/components/ward-management/ward-bed-designation.ts
//
// Every question anyone asks about a ward's locked/open bed split, in one place.
//
// ⚠️ IT EXISTS SO THE ARITHMETIC IS WRITTEN ONCE. The old `Unit.security` flag was read in eight
// files; a two-number split invites each of them to do its own subtraction, and a subtraction
// repeated eight times is eight chances to get it the wrong way round. Every screen calls these.
//
// ⚠️ EVERY FUNCTION CLAMPS AT ZERO. A fixture can disagree with itself — more locked free beds
// than free beds — and the honest response to that is "none of the other kind", never a negative
// count rendered to a coordinator as though it meant something.
import type { Unit } from "@/components/ward-management/ward-model";
import { activeClosedBeds } from "@/components/ward-management/ward-ready-beds";

/** Numbered bed sections use the same locked-first ordering as the ward board. */
export function numberedBedKind(unit: Unit, bedNumber: number): "locked" | "open" | undefined {
  if (!Number.isInteger(bedNumber) || bedNumber < 1 || bedNumber > unit.beds) return undefined;
  return bedNumber <= unit.lockedBeds ? "locked" : "open";
}

/** Keep the owner's open-first/locked-first allocation rule when a person chooses a number. */
export function numberedBedKindRefusal(unit: Unit, bedNumber: number, secureBedNeeded: boolean): string | null {
  const kind = numberedBedKind(unit, bedNumber);
  if (kind === undefined) return "The numbered bed reservation is outside this ward.";
  if (!secureBedNeeded && openBedsFree(unit) > 0 && kind === "locked")
    return "Choose an open bed first while open capacity remains.";
  if (secureBedNeeded && lockedBedsFree(unit) > 0 && kind === "open")
    return "Choose a locked bed first while locked capacity remains.";
  if ((kind === "locked" ? lockedBedsFree(unit) : openBedsFree(unit)) <= 0)
    return `No ${kind} capacity remains for that numbered bed.`;
  return null;
}

/** Beds designated open. Derived — never stored, per the owner's one-source ruling. */
export function openBeds(unit: Unit): number {
  return Math.max(0, unit.beds - unit.lockedBeds);
}

/**
 * H-0978 / WS-15: a bed closed by number (`SET_BED_CLOSED`) is not offered, so it comes off the free
 * figure of its own kind (locked beds are numbered first, `numberedBedKind`) and off the total.
 */
function closedByKind(unit: Unit): { locked: number; all: number } {
  const marks = activeClosedBeds(unit);
  return {
    locked: marks.filter((mark) => numberedBedKind(unit, mark.bedNumber) === "locked").length,
    all: marks.length,
  };
}

/** Allocatable locked beds, clamped to the allocatable total it is a part of. */
export function lockedBedsFree(unit: Unit): number {
  const closed = closedByKind(unit);
  return Math.max(0, Math.min(unit.allocatableLocked - closed.locked, unit.allocatable.value - closed.all));
}

/** Allocatable open beds. Derived from the total and the locked part. */
export function openBedsFree(unit: Unit): number {
  return Math.max(0, unit.allocatable.value - closedByKind(unit).all - lockedBedsFree(unit));
}

export function unitHasLockedBeds(unit: Unit): boolean {
  return unit.lockedBeds > 0;
}

export function unitHasOpenBeds(unit: Unit): boolean {
  return openBeds(unit) > 0;
}

/**
 * The ward's designation split as a sentence, for any screen that needs to say it.
 *
 * Deliberately says "All open" / "All locked" rather than "0 locked, 17 open": a zero rendered
 * beside a real number reads as a measurement, and a ward with no locked beds has a kind of bed
 * it does not have, not zero of them.
 */
export function designationSummary(unit: Unit): string {
  if (!unitHasLockedBeds(unit)) return "All open";
  if (!unitHasOpenBeds(unit)) return "All locked";
  return `${unit.lockedBeds} locked, ${openBeds(unit)} open`;
}

/**
 * The three kinds of ward, in the owner's own words: _"Keep it simple... just have Mixed wards,
 * Open wards, Locked wards as three categories."_ `(OWNER, 2026-09-04)`
 *
 * ⚠️ DERIVED, NEVER STORED. There is no ward-level category field and there must not be one — the
 * bed counts are the single fact and this reads them. A stored category beside the counts is two
 * sources for one fact, which is this project's most reliable defect.
 *
 * ⚠️ AND IT IS NOT A LEGAL STATEMENT. "Locked" here describes doors and bed designations. Whether
 * a ward may lawfully hold an involuntary patient is `Unit.authorised`, a separate statutory fact
 * that DISAGREES with this one in the network today: `sjgs-adult-secure` is locked and NOT
 * authorised. Merging them would let the app offer a bed for a detention that unit cannot hold.
 * The owner ruled on this knowing the consequence — "go ahead with your recommendation being aware
 * of when a unit is authorised vs unauthorised" `(OWNER, 2026-09-04)` — and
 * `tests/ward-locked-not-authorised.test.ts` is what keeps the two apart.
 *
 * ⚠️ "Voluntary" is deliberately NOT used here. The owner used it describing the concept and then
 * gave the state list as Locked / Open / Mixed. A patient is voluntary or involuntary; a bed is
 * locked or open. Pushing "voluntary" down to a bed implies an involuntary patient cannot occupy
 * an open bed and a voluntary one cannot occupy a locked bed — both false.
 */
export type WardCategory = "Open" | "Locked" | "Mixed";

export function wardCategory(unit: Unit): WardCategory {
  if (!unitHasLockedBeds(unit)) return "Open";
  if (!unitHasOpenBeds(unit)) return "Locked";
  return "Mixed";
}
