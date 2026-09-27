// tests/ward-origin-department-absence.test.ts
//
// `Movement.originEdId` is a REQUIRED string. So an origin id is ALWAYS recorded, and a screen that
// cannot resolve it is looking at a lookup miss, not at a missing record.
//
// ⚠️ THE DEFECT. `ward-management-console.tsx` rendered "No origin department is recorded on this
// movement." — and, fifteen lines from a row repaired earlier the same night, "no origin department
// is recorded". Both reported the wrong absence: they send a reader to look for an unrecorded field
// when what actually happened is that a recorded id matched nothing. Five sibling surfaces already
// rendered the honest form; this file was the sixth and disagreed with all of them, twice.
//
// ⚠️ THAT "five sibling surfaces render it independently" IS NO LONGER TRUE, AND ITS PASSING IS THE
// POINT. As of 2026-09-12 every surface imports one helper (`ward-absence-labels.ts`), so the
// phrase has one source and this test pins that source. ⚠️ An earlier version of this note said
// EVERY SURFACE, and Delays and Officer were not swept at the time — corrected 2026-09-12. Six independent copies of one sentence is
// precisely what made Ward Lead's 2026-09-11 ruling un-appliable: no single copy could move without
// disagreeing with the other five, so nobody moved any of them.
//
// ⚠️ WHY THIS DRIVES A FUNCTION RATHER THAN RENDERING THE PAGE, STATED BECAUSE IT IS A LIMIT.
// The branch is unreachable through the app's own fixture: every seeded movement's `originEdId`
// resolves, so no rendered page can exercise it. A DOM test would walk the resolved branch on every
// movement and pass against the defect. The wording is therefore driven directly, and the second
// test below pins the premise that makes that necessary — if the fixture ever gains an unresolvable
// movement, that test goes red and this file should grow a rendering assertion.

import { describe, expect, it } from "vitest";

import { unresolvedOriginDepartment } from "../src/components/ward-management/ward-management-console";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { allEmergencyDepartments } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";

const departmentIds = new Set(allEmergencyDepartments().map((department) => department.id));

describe("what a ward surface says when an origin department will not resolve", () => {
  it("walks a fixture with movements to reason about at all", () => {
    expect(wardMovements.length, "no seeded movements, so nothing below means anything").toBeGreaterThan(0);
  });

  it("names the id that failed to resolve", () => {
    const movement = { ...wardMovements[0], originEdId: "ed-that-does-not-exist" } as Movement;
    const said = unresolvedOriginDepartment(movement);

    expect(
      said,
      "a reader can only act on this if it tells them WHICH id matched nothing — that is the whole " +
        "difference between a data-entry gap and a broken reference",
    ).toContain("ed-that-does-not-exist");
  });

  it("never claims the origin department was not recorded", () => {
    const movement = { ...wardMovements[0], originEdId: "ed-that-does-not-exist" } as Movement;
    const said = unresolvedOriginDepartment(movement).toLowerCase();

    // The precise falsehood: `originEdId` is required, so something WAS recorded.
    expect(
      said,
      "`Movement.originEdId` is a required string, so an origin id is always recorded; saying it is " +
        "not recorded states the opposite of what the record holds",
    ).not.toContain("is recorded");
    expect(said).not.toContain("not recorded");
    expect(said).not.toContain("none recorded");
  });

  /**
   * 🔴 **THIS EXPECTATION IS A RULING, DATED, AND NOT A PREFERENCE — Ward Lead, 2026-09-11,
   * re-affirmed with its true population 2026-09-12.**
   *
   * **The ruling: a sentence about an id that will not resolve must blame the RECORD, not the
   * NETWORK.** Saying that no such department exists sends a coordinator to chase the network; the
   * truth is that this movement points somewhere we cannot follow. **They call for different
   * actions and only one of them is true.**
   *
   * ⚠️ **WHAT THIS EXPECTATION USED TO PIN, DESCRIBED AND DELIBERATELY NOT QUOTED.** It previously
   * held the network-blaming form, and its own note called that wording the thing "five sibling
   * surfaces render independently" — accurate when written. 🔴 **So this guard reddened on anybody
   * applying the ruling, and the ruling could not be applied anywhere without it.**
   *
   * **The old phrase is not written out here on purpose:** a search for it must return the sites
   * that still carry it, never this note explaining that it is gone. **That exact trap has been hit
   * three times on this project.**
   *
   * ✅ **AND THIS IS NOT A MONUMENT.** If a future ruling reverses the wording, this expectation
   * changes again — what must survive is the PROPERTY, which the assertions below now state
   * separately from the sentence: the id is named, the record is blamed, the network is not.
   */
  it("says what the ruling requires — the record named as the fault, with its id", () => {
    const movement = { ...wardMovements[0], originEdId: "peel-ed-typo" } as Movement;
    expect(unresolvedOriginDepartment(movement)).toBe('a department we cannot find: "peel-ed-typo"');
  });

  /**
   * ⚠️ **THE PROPERTY, ASSERTED APART FROM THE SENTENCE.** The pin above is exact and will be
   * rewritten by any future wording ruling. **These two survive it**, and they are what the guard is
   * actually for — so a rewording that quietly reintroduced network-blame would still be caught.
   */
  it("does not tell a coordinator that no such department exists", () => {
    const movement = { ...wardMovements[0], originEdId: "peel-ed-typo" } as Movement;
    const said = unresolvedOriginDepartment(movement).toLowerCase();

    /*
     * 🔴 A PLAIN SUBSTRING, NOT A WORD-BOUNDARY REGEX, AND THE REASON IS A DEFECT THIS FILE CARRIED.
     * This assertion was written as a word-boundary regex, and both escapes became RAW 0x08
     * BACKSPACE BYTES in the source. The pattern then demanded a string containing control
     * characters, which nothing can produce — so the negated match passed unconditionally and the
     * network-blame half of this guard was protected by nothing.
     *
     * 🔴 AND IT HAPPENED A SECOND TIME IN THE COMMENT EXPLAINING IT. Writing the escape down to
     * describe it reproduced it, one line below the fix. The escape sequence is therefore NAMED IN
     * WORDS here and never typed — the same discipline this project already applies to quoting a
     * forbidden phrase in the note that removes it.
     *
     * Invisible in review; survives lint, typecheck and Prettier.
     * `tests/ward-no-control-characters.test.ts` is what caught both.
     */
    expect(
      said,
      "the sentence asserts that nothing matches this id, which reads as 'there is no such " +
        "department' — a claim about the network, when the fault is in this movement's own record",
    ).not.toContain("matches");
    expect(
      said,
      "the sentence no longer says the thing cannot be FOUND, so it has stopped naming the record " +
        "as the thing holding a reference we cannot follow",
    ).toMatch(/cannot find/u);
  });

  /**
   * THE PREMISE, PINNED. The branch above cannot be reached by rendering any seeded movement, which
   * is why the tests drive the function instead. If that stops being true, a rendering test becomes
   * both possible and necessary, and this failure is where somebody finds that out.
   */
  it("has no seeded movement whose origin department fails to resolve", () => {
    const unresolvable = wardMovements.filter((movement) => !departmentIds.has(movement.originEdId));
    expect(
      unresolvable.map((movement) => `${movement.id} -> ${movement.originEdId}`),
      "a seeded movement now reaches the unresolved branch, so this file should assert over the " +
        "rendered page rather than over the helper alone",
    ).toEqual([]);
  });
});
