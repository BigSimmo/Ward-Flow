// tests/ward-contention.test.ts
import { describe, expect, it } from "vitest";

import { contention } from "../src/components/ward-management/ward-contention";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { type Movement, type Unit } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/*
 * Fixtures are built by `Object.assign` from a REAL seeded movement and a REAL seeded unit, the
 * same idiom `tests/ward-derivations.test.ts` uses — `{ ...base, ...Partial<T> }` widens every
 * overridden field back to optional under TypeScript's spread-merge rules even though every field
 * is present at runtime.
 */
const baseMovement = wardMovements.find((movement) => movement.id === "WF-002");
if (!baseMovement) throw new Error("Fixture movement WF-002 is required as a template for ward-contention tests");

const baseUnit = allUnits()[0];
if (!baseUnit) throw new Error("At least one seeded unit is required as a template for ward-contention tests");

function movementFrom(id: string, overrides: Partial<Movement>): Movement {
  return Object.assign({}, baseMovement, { id, closure: undefined }, overrides) as Movement;
}

function unitFrom(id: string, allocatable: number, empty: number): Unit {
  return Object.assign({}, baseUnit, {
    id,
    name: `Unit ${id}`,
    allocatable: { ...baseUnit.allocatable, value: allocatable },
    empty: { ...baseUnit.empty, value: empty },
  }) as Unit;
}

function forUnit(map: ReturnType<typeof contention>, unitId: string) {
  const found = map.units.find((unit) => unit.unitId === unitId);
  if (!found) throw new Error(`contention() returned no row for unit ${unitId}, which it was given`);
  return found;
}

describe("contention", () => {
  it("reports a unit nobody has claimed as uncontended, with its own allocatable figure untouched", () => {
    const unit = unitFrom("u-quiet", 4, 4);

    const row = forUnit(contention([], [unit], NOW_ANCHOR), "u-quiet");

    expect(row.claims).toEqual([]);
    expect(row.unreflectedClaims).toBe(0);
    expect(row.uncommittedAllocatable).toBe(4);
  });

  it("records an accepted movement as a claim the ward's own allocatable figure cannot yet see", () => {
    const unit = unitFrom("u-accepted", 2, 2);
    const accepted = movementFrom("WF-ACC", {
      stage: "accepted_awaiting_bed",
      acceptedUnitId: "u-accepted",
      referredUnitIds: [],
    });

    const row = forUnit(contention([accepted], [unit], NOW_ANCHOR), "u-accepted");

    expect(row.claims).toEqual([{ movementId: "WF-ACC", kind: "accepted", reflectedInAllocatable: false }]);
    expect(row.unreflectedClaims).toBe(1);
    expect(row.uncommittedAllocatable).toBe(1);
  });

  it("records a pulled movement as a claim the allocatable figure HAS already absorbed", () => {
    // `PULL_PATIENT` decrements `unit.allocatable.value` as it fires, so this unit's figure of 1
    // is what a ward with 2 staffed beds looks like AFTER the pull. Counting the pull again here
    // would subtract the same bed twice — which is the single arithmetic error this whole model
    // exists to avoid making.
    const unit = unitFrom("u-pulled", 1, 2);
    const pulled = movementFrom("WF-PULL", {
      stage: "pulled",
      acceptedUnitId: "u-pulled",
      referredUnitIds: [],
      // `PULL_PATIENT` writes this in the same object literal that decrements `allocatable`, so a
      // pulled movement without it is a state the reducer cannot produce.
      pullExpiresAt: NOW_ANCHOR + 60,
    });

    const row = forUnit(contention([pulled], [unit], NOW_ANCHOR), "u-pulled");

    expect(row.claims).toEqual([{ movementId: "WF-PULL", kind: "pulled", reflectedInAllocatable: true }]);
    expect(row.unreflectedClaims).toBe(0);
    expect(row.uncommittedAllocatable).toBe(1);
  });

  it("still counts a STEPPED-BACK pull as reflected, because the reducer does not give the bed back", () => {
    /*
     * ⚠️ **THE STAGE IS NOT THE SIGNAL, AND READING IT AS ONE INVENTED SCARCITY.**
     *
     * `STEP_BACK_STAGE` moves a movement's stage backwards out of `pulled` while deliberately
     * leaving `acceptedUnitId`, `pullExpiresAt` AND `unit.allocatable.value` untouched — the
     * reducer says so in capitals at its own site and `tests/ward-movement-step-back-reducer.test.ts`
     * pins it as *"does not release the bed"*. So after a step-back the ward's figure is STILL net
     * of that pull.
     *
     * A model keyed on `stage` called this claim "accepted", counted it as unreflected, and
     * subtracted the same bed a second time — reporting a ward as oversubscribed when it has room.
     *
     * The honest predicate is `pullExpiresAt`, which `PULL_PATIENT` sets as it decrements and the
     * pull-release unwind clears as it restores. Those are the only two writers in the reducer.
     */
    const unit = unitFrom("u-stepped-back", 1, 2);
    const steppedBack = movementFrom("WF-STEP", {
      stage: "destination_review",
      acceptedUnitId: "u-stepped-back",
      referredUnitIds: [],
      pullExpiresAt: NOW_ANCHOR + 60,
    });

    const row = forUnit(contention([steppedBack], [unit], NOW_ANCHOR), "u-stepped-back");

    expect(row.claims).toEqual([{ movementId: "WF-STEP", kind: "pulled", reflectedInAllocatable: true }]);
    expect(row.unreflectedClaims).toBe(0);
    expect(row.uncommittedAllocatable).toBe(1);
  });

  it("does not treat an EXPIRED pull as released, because nothing in the reducer releases it", () => {
    // `pullExpiresAt` in the past. No event acts on expiry: the only writer that restores
    // `allocatable` is the pull-release unwind, and it clears the field as it does so. So an
    // expired-but-unreleased pull is still subtracted from the ward's figure, and the PRESENCE of
    // the field is the signal — never its value.
    // Stepped back AND expired, deliberately: at stage `pulled` the stage half of the rule would
    // carry this case on its own and the assertion would not discriminate. Here only the marker
    // half can answer, so an expiry check added to it goes red.
    const unit = unitFrom("u-expired", 1, 2);
    const expired = movementFrom("WF-EXP", {
      stage: "destination_review",
      acceptedUnitId: "u-expired",
      referredUnitIds: [],
      pullExpiresAt: NOW_ANCHOR - 600,
    });

    const row = forUnit(contention([expired], [unit], NOW_ANCHOR), "u-expired");

    expect(row.claims[0]?.reflectedInAllocatable).toBe(true);
    expect(row.unreflectedClaims).toBe(0);
  });

  it("counts a SEEDED pulled-stage movement carrying no pull marker as reflected", () => {
    /*
     * ⚠️ **THE OTHER HALF OF THE DISJUNCTION, AND IT IS NOT HYPOTHETICAL.** Eight of the fifteen
     * seeded movements standing at a pulled stage carry no `pullExpiresAt` — hand-authored states
     * `PULL_PATIENT` could not have produced, because it writes the field in the same literal that
     * decrements the bed. Keying on the marker alone moved the fixture from 15 reserved claims to
     * 7 and three oversubscribed wards to five, silently.
     */
    const unit = unitFrom("u-seeded-pull", 1, 2);
    const seeded = movementFrom("WF-SEEDED", {
      stage: "moving",
      acceptedUnitId: "u-seeded-pull",
      referredUnitIds: [],
      pullExpiresAt: undefined,
    });

    const row = forUnit(contention([seeded], [unit], NOW_ANCHOR), "u-seeded-pull");

    expect(row.claims).toEqual([{ movementId: "WF-SEEDED", kind: "pulled", reflectedInAllocatable: true }]);
    expect(row.unreflectedClaims).toBe(0);
  });

  it("counts three referrals to one bed as three claims, and reports the shortfall without resolving it", () => {
    // The case the whole model exists for. `PARALLEL_REFERRAL_CAP` is 3, so one bed carrying three
    // live referrals is a reachable state rather than a contrived one.
    const unit = unitFrom("u-scarce", 1, 1);
    const movements = ["WF-R1", "WF-R2", "WF-R3"].map((id) =>
      movementFrom(id, { stage: "destination_review", acceptedUnitId: undefined, referredUnitIds: ["u-scarce"] }),
    );

    const row = forUnit(contention(movements, [unit], NOW_ANCHOR), "u-scarce");

    expect(row.claims.map((claim) => claim.movementId).sort()).toEqual(["WF-R1", "WF-R2", "WF-R3"]);
    expect(row.claims.every((claim) => claim.kind === "referred")).toBe(true);
    expect(row.unreflectedClaims).toBe(3);
    // NEGATIVE, and never clamped to zero: two of these three cannot be honoured, and a floor of
    // zero would report the same number as a ward with exactly enough beds.
    expect(row.uncommittedAllocatable).toBe(-2);
  });

  it("keeps allocatable and empty apart when they diverge, rather than collapsing to one number", () => {
    // The reservation/physical split: `PULL_PATIENT` bounds `allocatable`, `PATIENT_ARRIVED`
    // bounds `empty`, and `CONFIRM_CAPACITY` can raise `allocatable` back above `empty` after
    // arrivals have consumed the physically empty beds. A model that reported one figure would
    // contradict a pinned reducer invariant.
    const unit = unitFrom("u-diverged", 3, 0);

    const row = forUnit(contention([], [unit], NOW_ANCHOR), "u-diverged");

    expect(row.allocatable).toBe(3);
    expect(row.empty).toBe(0);
  });

  it("gives one movement referred to three units a claim on each, and never two on one", () => {
    const units = [unitFrom("u-a", 1, 1), unitFrom("u-b", 1, 1), unitFrom("u-c", 1, 1)];
    const spread = movementFrom("WF-SPREAD", {
      stage: "destination_review",
      acceptedUnitId: undefined,
      referredUnitIds: ["u-a", "u-b", "u-c"],
    });

    const map = contention([spread], units, NOW_ANCHOR);

    for (const unitId of ["u-a", "u-b", "u-c"]) {
      const claims = forUnit(map, unitId).claims.filter((claim) => claim.movementId === "WF-SPREAD");
      expect(claims).toHaveLength(1);
    }
  });

  it("gives a movement holding both an acceptance and a stale referral to the same unit ONE claim, the stronger", () => {
    // `ACCEPT_REFERRAL` clears `referredUnitIds`, so the reducer cannot produce this state — but a
    // hand-authored seed movement can, and a duplicate claim would overstate the pressure on a
    // ward by exactly the number of movements it has accepted.
    const unit = unitFrom("u-both", 2, 2);
    const both = movementFrom("WF-BOTH", {
      stage: "accepted_awaiting_bed",
      acceptedUnitId: "u-both",
      referredUnitIds: ["u-both"],
    });

    const row = forUnit(contention([both], [unit], NOW_ANCHOR), "u-both");

    expect(row.claims).toEqual([{ movementId: "WF-BOTH", kind: "accepted", reflectedInAllocatable: false }]);
    expect(row.unreflectedClaims).toBe(1);
  });

  it("holds no claim for a closed movement", () => {
    const unit = unitFrom("u-closed", 2, 2);
    const closed = movementFrom("WF-CLOSED", {
      stage: "accepted_awaiting_bed",
      acceptedUnitId: "u-closed",
      referredUnitIds: [],
      closure: { at: NOW_ANCHOR, outcome: "arrived", reason: "Patient arrived at the accepting unit" },
    });

    expect(forUnit(contention([closed], [unit], NOW_ANCHOR), "u-closed").claims).toEqual([]);
  });

  describe("against the seeded fixture", () => {
    // ⚠️ FLOOR THE POPULATION WALKED, NEVER THE RESULT. "At least N contended units" breaks the
    // day somebody edits the seed; "every unit I was given came back exactly once" cannot.
    const units = allUnits();
    const map = contention(wardMovements, units, NOW_ANCHOR);

    it("returns exactly one row per unit it was given, and invents none", () => {
      expect(map.units.map((row) => row.unitId).sort()).toEqual(units.map((unit) => unit.id).sort());
    });

    it("never attributes a claim to a movement that is closed or arrived", () => {
      const openIds = new Set(wardMovements.filter(isOpen).map((movement) => movement.id));
      const claimed = map.units.flatMap((row) => row.claims.map((claim) => claim.movementId));

      // Anti-vacuity: this assertion is worthless if the fixture produced no claims at all.
      expect(claimed.length).toBeGreaterThan(0);
      expect(claimed.filter((id) => !openIds.has(id))).toEqual([]);
    });

    it("never gives one movement two claims on the same unit", () => {
      for (const row of map.units) {
        const ids = row.claims.map((claim) => claim.movementId);
        expect(ids).toEqual([...new Set(ids)]);
      }
    });

    it("derives uncommittedAllocatable from the two numbers it reports, on every row it walked", () => {
      expect(map.units.length).toBe(units.length);
      for (const row of map.units) {
        expect(row.uncommittedAllocatable).toBe(row.allocatable - row.unreflectedClaims);
        expect(row.unreflectedClaims).toBe(row.claims.filter((claim) => !claim.reflectedInAllocatable).length);
      }
    });
  });
});
