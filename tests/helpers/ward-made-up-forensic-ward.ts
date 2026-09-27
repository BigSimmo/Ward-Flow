import { afterAll, beforeAll } from "vitest";

import type { Unit } from "../../src/components/ward-management/ward-model";
import { unitById } from "../../src/components/ward-management/ward-sites";

/**
 * A MADE-UP FORENSIC WARD, FOR TESTS ONLY. Owner ruling 2026-09-25 (answer 1A): Broome's Mabu
 * Liyan is the Kimberley adult inpatient unit, not a forensic unit, so the sample network no longer
 * has a forensic ward. The tests of the forensic gate build this one instead.
 *
 * It is Broome's ward with `forensic` set and one ready bed, so every gate other than
 * `forensic` answers exactly as it did when Broome was the forensic example, and the tests keep
 * proving the same thing: that `forensic` alone excludes the ward. The same id is kept so the
 * seeded movements and referrals that name it still point at it.
 */
export function madeUpForensicWard(): Unit {
  const broome = unitById("brm-adult-secure");
  if (!broome) throw new Error("brm-adult-secure is missing from the sample network");
  // One ready bed, as Broome had while it was the forensic example, so `forensic` stays the only
  // reason the made-up ward is refused.
  const ward = structuredClone(broome);
  return { ...ward, forensic: true, allocatable: { ...ward.allocatable, value: 1 }, allocatableLocked: 1 };
}

/** The given units with Broome's ward replaced by the made-up forensic ward. */
export function withMadeUpForensicWard(units: readonly Unit[]): Unit[] {
  return units.map((unit) => (unit.id === "brm-adult-secure" ? madeUpForensicWard() : unit));
}

/**
 * For screen tests that mount the real provider, which seeds its wards from the sample network:
 * makes Broome's ward the made-up forensic ward (forensic, one ready bed) for the calling file, and
 * puts it back afterwards.
 * The seed copies the ward when the provider mounts, so the flag is in place before any render.
 */
export function markBroomeForensicForThisFile(): void {
  let saved: Pick<Unit, "allocatable" | "allocatableLocked"> | undefined;
  beforeAll(() => {
    const broome = unitById("brm-adult-secure");
    if (!broome) throw new Error("brm-adult-secure is missing from the sample network");
    saved = { allocatable: broome.allocatable, allocatableLocked: broome.allocatableLocked };
    broome.forensic = true;
    broome.allocatable = { ...broome.allocatable, value: 1 };
    broome.allocatableLocked = 1;
  });
  afterAll(() => {
    const broome = unitById("brm-adult-secure");
    if (!broome || !saved) return;
    broome.forensic = false;
    broome.allocatable = saved.allocatable;
    broome.allocatableLocked = saved.allocatableLocked;
  });
}
