import { describe, expect, it } from "vitest";

import { networkHasCohort } from "@/components/ward-management/ward-referrals";
import { allUnits } from "@/components/ward-management/ward-sites";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * ═══ THE ONE CASE `networkHasCohort` KNOWINGLY GETS WRONG, AND HOW CLOSE IT IS ═══
 *
 * `networkHasCohort` answers the STRUCTURAL question a coordinator needs before the operational
 * one: does any unit anywhere run this referral's age band at all? Its own doc comment records a
 * limit rather than fixing it:
 *
 * > "This counts a FORENSIC unit as satisfying the age band, and D7 says a forensic bed is never
 * > offered to anyone. So a cohort whose only unit were forensic would read as an operational
 * > shortage ('No unit accepts this referral right now') for a bed that will never be offered at
 * > all … The fix is one clause (`&& !unit.forensic`), but it changes which banner a coordinator
 * > reads on a clinical surface, so it is left for the owner to authorise rather than taken here."
 *
 * ⚠️ **THAT DEFERRAL IS CORRECT AND THIS FILE DOES NOT TOUCH IT.** The clause is not added here.
 * What is added is the thing the deferral lacked: **a way for the limit to stop being latent
 * loudly.**
 *
 * 🔴 **THE COMMENT SAYS "NOT REACHABLE ON THE SHIPPED FIXTURE", WHICH IS TRUE AND UNDERSTATES IT.**
 * Measured 2026-09-06: 23 units, exactly ONE forensic (Mabu Liyan / Broome Mental Health Unit), and its cohort (Adult)
 * holds 16 units — so the case cannot arise today. But **Youth holds exactly one unit**. The
 * distance between "not reachable" and "a coordinator reads the wrong banner for a youth referral"
 * is **one boolean on one row**, and nothing anywhere would report it.
 *
 * An unreachable defect and a fixed one look identical from the outside. This is what tells them
 * apart.
 */

const units: Unit[] = allUnits();

/** Cohorts present in the network, and how many of each cohort's units are forensic. */
function cohortCounts(): Map<string, { total: number; forensic: number; forensicNames: string[] }> {
  const counts = new Map<string, { total: number; forensic: number; forensicNames: string[] }>();
  for (const unit of units) {
    const cohort = String(unit.cohort);
    const entry = counts.get(cohort) ?? { total: 0, forensic: 0, forensicNames: [] };
    entry.total += 1;
    if (unit.forensic) {
      entry.forensic += 1;
      entry.forensicNames.push(unit.name);
    }
    counts.set(cohort, entry);
  }
  return counts;
}

describe("the network's structural cohort answer", () => {
  it("walks a real network, so the checks below are not ranging over nothing", () => {
    /*
     * ⚠️ The floor is on the POPULATION, and set well below it rather than at it. 23 units and 3
     * cohorts on 2026-09-06; a floor pinned at those numbers would go red on any legitimate change
     * to the fixture, which teaches people to edit the floor.
     */
    expect(units.length, "the unit network is empty, so every assertion below passes over nothing").toBeGreaterThan(10);
    expect(cohortCounts().size, "no cohorts were found, so no cohort could be checked").toBeGreaterThan(1);
  });

  it("🔴 has no cohort whose only units are forensic — the state that activates the known limit", () => {
    /*
     * When this goes red, the limit has stopped being latent: `networkHasCohort` will return `true`
     * for the named cohort, the match view will say "No unit accepts this referral right now", and
     * that is an operational shortage claim about a bed D7 says is never offered to anybody.
     *
     * **The fix is NOT to edit this test.** It is `&& !unit.forensic` in `networkHasCohort`, and
     * that clause changes which banner a coordinator reads on a clinical surface — so it needs the
     * owner's authorisation, exactly as that function's own comment says.
     *
     * 🔴 **AS OF 2026-09-06 THAT AUTHORISATION DOES NOT EXIST, AND ONE DOCUMENT LOOKS LIKE IT DOES.**
     * `docs/ward-flow/assignment-register.md` carries a row reading
     * `Forensic clause … | Builder Two | authorised 2026-09-06`. **That row is in the ASSIGNMENTS
     * table, not the "Closed by ruling" table, and "authorised" there is the register-keeper's own
     * word — no owner quote, no owner attribution.** Ward Lead searched every ward document and
     * found zero occurrences of a forensic ruling, then said so in writing. Compare the row two
     * lines above it, which names an owner ruling explicitly, and the `CANCEL_TRANSPORT` row in the
     * rulings table, which carries the owner's actual words.
     *
     * **So do not read that row as the authorisation this test asks for.** Whether a forensic bed
     * can be offered to a patient is not a clause to infer from a task list. It is with the owner
     * as an open question.
     */
    const forensicOnly = [...cohortCounts().entries()]
      .filter(([, counts]) => counts.total > 0 && counts.total === counts.forensic)
      .map(([cohort, counts]) => `${cohort} (only ${counts.forensicNames.join(", ")})`);

    expect(
      forensicOnly,
      "a cohort's every unit is now forensic, so networkHasCohort reports a structural gap as an " +
        "operational shortage. Do not edit this test: the fix is the `&& !unit.forensic` clause in " +
        "networkHasCohort, which needs the owner's authorisation because it changes a clinical banner.",
    ).toEqual([]);
  });

  it("⚠️ names every cohort standing on a single unit — one field away from the case above", () => {
    /*
     * NOT an assertion that single-unit cohorts are wrong; the network genuinely has one youth
     * unit. This exists so the margin is written down rather than recalled. If a cohort here ever
     * gains `forensic: true` on its only row, the test above goes red — and this is the list of
     * rows where that is one edit rather than several.
     */
    const single = [...cohortCounts().entries()]
      .filter(([, counts]) => counts.total === 1)
      .map(([cohort]) => cohort)
      .sort();

    // Measured 2026-09-06. If this changes, the margin has changed and the note above is stale.
    expect(single).toEqual(["Youth"]);
  });

  it("control: the function still discriminates, so the green above means something", () => {
    /*
     * ⚠️ **WITHOUT THIS, EVERY ASSERTION ABOVE WOULD PASS AGAINST A `networkHasCohort` THAT
     * ALWAYS RETURNED THE SAME ANSWER.** The tests above never call it; they check the fixture
     * condition under which it misleads. This checks it answers at all.
     */
    const someCohort = units[0]?.cohort;
    expect(someCohort, "no unit to read a cohort from").toBeDefined();
    expect(networkHasCohort({ ageBand: someCohort } as never, units)).toBe(true);
    expect(networkHasCohort({ ageBand: "a cohort no unit runs" } as never, units)).toBe(false);
  });
});
