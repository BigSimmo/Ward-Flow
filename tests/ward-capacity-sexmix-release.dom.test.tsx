import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-06, AFTER THE SIGNAL IT ASKS FOR WAS BUILT.**
 *
 * This file rendered `<WardModeWorkspace mode="capacity" />`. MERGE 02 replaced that mode, so it
 * has been protecting a test rather than a user — the last of the seven files
 * `ward-mode-workspace-reachability.test.ts` reported.
 *
 * **The clinical property is unchanged and is Ward Lead's ruling of 2026-09-05.** `RELEASE_BED`
 * raises `allocatable.value` and `empty.value` together (`ward-flow-reducer.ts` 2335-2343, read
 * rather than recalled) and **never touches `sexMix`** — the model cannot know which sex left, and
 * guessing a decrement would invent a fact about a person. So for a moment a ward's recorded
 * male/female total and its occupancy disagree, and `allocatable` — which is what `ready` reads —
 * has just moved. The screen must say the figure may not have settled.
 *
 * ⚠️ **THE SIGNAL, NEVER THE DATA, AND THE THIRD CASE BELOW ENFORCES THAT.** The old version
 * asserted a rendered sex mix ("Female 9 · Male 9") because the retired board showed one. This
 * screen shows none, and whether those counts belong on a network view is still an open question
 * for the owner. A test that demanded them here would prejudge it — so instead this pins that no
 * such figure leaks onto the screen along with the warning.
 *
 * 🔴 **CHANGED 25 SEPTEMBER 2026: THE PREMISE ABOVE WAS RULED THE OTHER WAY.** Owner ruling: a bed
 * release names the patient whose bed it is, and the bed frees when that person leaves.
 * `departAdmission` moves occupancy AND the leaver's own `sexMix` bucket in the same write (counts
 * follow the leaver's gender), and `RELEASE_BED` now moves no count at all. So the model DOES know
 * who left, the figure is no longer invented when it moves, and no ordinary action leaves the pair
 * disagreeing. The cases below now pin the new truth: a person leaving moves the sex register with
 * occupancy and no ward claims to be mid-update. The caution is still on the screen for data that
 * disagrees; its placement and scope assertions moved, unchanged in intent, to
 * `ward-sexmix-caution-placement.dom.test.tsx`, which builds that disagreement directly.
 */
const SUBJECT = "rph-adult-secure";

/** Someone in a bed on the subject ward with no linked movement, so recording that they left is
 *  not refused as in transit. The destination used below never trips the involuntary-discharge
 *  boundary, so a patient link is fine (the seed links every person since D-14). */
const LEAVER = wardAdmissions.find((a) => a.unitId === SUBJECT && a.state === "occupied" && a.movementId === null);

function RecordLeaving() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "RECORD_LEAVING",
          role: "ward",
          now,
          admissionId: LEAVER!.id,
          actingUnitId: SUBJECT,
          leavingDestination: "transferred-to-another-psychiatric-ward",
        })
      }
    >
      record leaving
    </button>
  );
}

function sexMixTotal(text: string | null | undefined): number {
  const match = /Female (\d+) · Male (\d+)/u.exec(text ?? "");
  if (!match) throw new Error(`no sex mix figure in "${text}"`);
  return Number(match[1]) + Number(match[2]);
}

function renderBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
      <RecordLeaving />
    </WardFlowProvider>,
  );
}

describe("the Capacity screen says when a ward's bed records are mid-update", () => {
  it("fixture precondition: every ward's recorded sex mix matches its occupancy at seed", () => {
    /*
     * ⚠️ The anti-vacuity floor, and it runs in the harder direction. If any ward already
     * disagreed at seed, the "silent before" case below would be asserting an absence that was
     * never there to lose, and the "present after" case could pass on a screen that warned
     * unconditionally.
     */
    const disagreeing = networkWardRows(allUnits(), NOW_ANCHOR, bedReleases)
      .filter((row) => row.bedRecordsMidUpdate)
      .map((row) => row.unit.id);
    expect(disagreeing, "a seeded ward already disagrees, so both cases below are weakened").toEqual([]);
    expect(allUnits().length, "no units to check").toBeGreaterThan(1);
    expect(LEAVER, `the seed has nobody on ${SUBJECT} who can simply be recorded as leaving`).toBeDefined();
  });

  it("says nothing on a settled board", () => {
    renderBoard();
    expect(
      screen.queryByTestId(`ward-capacity-mid-update-${SUBJECT}`),
      "a caution shown on a settled board would be ignored within a day and make every figure look doubtful",
    ).not.toBeInTheDocument();
  });

  // CHANGED 25 September 2026 (see the file header): was "warns on the ward whose bed was
  // released, and on no other ward". The bed now frees when the person leaves, and that write moves
  // the sex register with occupancy, so the honest claim is that NO ward, this one included, claims
  // to be mid-update, while this ward's figure really did move (so the silence is not vacuous).
  it("a person leaving moves the ward's sex register with its occupancy, and no ward claims to be mid-update", () => {
    renderBoard();
    const totalBefore = sexMixTotal(screen.getByTestId(`ward-capacity-sexmix-${SUBJECT}`).textContent);

    fireEvent.click(screen.getByRole("button", { name: "record leaving" }));

    expect(
      sexMixTotal(screen.getByTestId(`ward-capacity-sexmix-${SUBJECT}`).textContent),
      "the person who left is still counted in the ward's sex mix",
    ).toBe(totalBefore - 1);
    for (const unit of allUnits()) {
      expect(
        screen.queryByTestId(`ward-capacity-mid-update-${unit.id}`),
        `${unit.id} claims to be mid-update, but the departure moved its sex register and occupancy together`,
      ).not.toBeInTheDocument();
    }
  });

  /**
   * 🔴 **RE-POINTED 2026-09-06 BECAUSE THE RULING CHANGED, NOT BECAUSE THE GUARD WAS WRONG.**
   *
   * This case previously read *"carries the signal without putting any sex-mix figure on the
   * screen"* and asserted that no `Female`/`Male` figure reached the row. **That was correct under
   * the ruling in force when it was written** - carry the SIGNAL, never the DATA, pending the owner.
   *
   * **The owner ruled the other way on 2026-09-06: sex mix and specialling headroom go on the
   * capacity board, per ward, as figures.** What decided it is that `ward-eligibility.ts` reads
   * `unit.sexMix[movement.sex]` at two sites and `ward-flow-reducer.ts` refuses `PULL_PATIENT` when
   * `remainingSpeciallingCapacity(unit, admissions) <= 0` - **hard refusals a coordinator was being
   * asked to plan against while the screen concealed them.**
   *
   * WARNING **RE-POINTED RATHER THAN DELETED, DELIBERATELY.** Deleting it would have made the suite
   * green and left nothing standing over the relationship between the signal and the figures, which
   * is the pair that now has to stay coherent. **A guard whose subject was ruled the other way is
   * re-pointed; only a guard whose subject no longer exists is retired, and then on the record.**
   */
  it("shows the ward's own recorded sex mix, and it moves by one when a person leaves", () => {
    renderBoard();
    const unit = allUnits().find((candidate) => candidate.id === SUBJECT);
    expect(unit, "the fixture no longer carries the subject ward").toBeDefined();
    const before = `Female ${unit!.sexMix.Female} · Male ${unit!.sexMix.Male}`;

    /*
     * 🔴 **THE ALL-ZERO FLOOR, AND IT EXISTS BECAUSE THIS TEST ONCE PASSED ON A BOARD READING
     * "Female 0 · Male 0" ON EVERY WARD.** The first version of the cell used `sexMix.female ?? 0`
     * — lower case, where the keys are `Female`/`Male` — so every figure was zero. **This test built
     * its expected string from the SAME wrong expression, so it agreed with the screen perfectly.**
     * A comparison whose two sides are computed the same way cannot see a fault in the way.
     *
     * The floor is over the DATA, not over this row: at least one ward on the board must show a
     * non-zero mix. A wrong key zeroes all of them at once, which is exactly the shape this catches
     * and the equality above cannot.
     */
    const allCells = allUnits().map((u) => screen.queryByTestId(`ward-capacity-sexmix-${u.id}`)?.textContent ?? "");
    const nonZero = allCells.filter((t) => /[1-9]/u.test(t)).length;
    /*
     * ⚠️ **THE FAILURE MESSAGE CARRIES THE POPULATION WALKED, AND THAT IS NOT DECORATION.** The first
     * version read `expected 0 to be greater than 0` — a message with nothing in it that came from
     * the seed. **A destroyed or emptied fixture produces that exact red**, so the control could not
     * distinguish "the screen reads a key the model does not use" from "there was nothing to read".
     * Naming the denominator fixes it: `0 of 23` says the walk found twenty-three wards and every one
     * of them reported nothing, which is a statement about the CODE. `0 of 0` would be a statement
     * about the fixture, and a different problem.
     */
    expect(
      `${nonZero} of ${allCells.length} wards report a non-zero sex mix`,
      "every ward on the board reports a sex mix of zero — the figures are almost certainly being " +
        "read off a key the model does not use, which renders as a confident false statement rather " +
        "than as an error",
    ).not.toMatch(/^0 of [1-9]/u);
    expect(allCells.length, "no ward rows were walked at all — this floor measured nothing").toBeGreaterThan(10);

    // Sourced from the unit rather than hand-written here, so a fixture change cannot leave this
    // asserting a figure the ward no longer holds.
    expect(screen.getByTestId(`ward-capacity-sexmix-${SUBJECT}`)).toHaveTextContent(before);

    fireEvent.click(screen.getByRole("button", { name: "record leaving" }));

    /*
     * CHANGED 25 September 2026 (see the file header). This used to pin that the figure must NOT
     * move, because a bed release did not know whose bed it was. It now does: the bed frees when a
     * named person leaves, and their own recorded gender bucket goes down by one in the same write.
     * So the figure moves by exactly one, the screen shows what the ward now records, and the
     * mid-update caution stays away because the pair still agree. The caution's placement (in the
     * sex-mix cell, never under Ready) is kept in `ward-sexmix-caution-placement.dom.test.tsx`.
     */
    const after = screen.getByTestId(`ward-capacity-sexmix-${SUBJECT}`);
    expect(sexMixTotal(after.textContent), "the sex mix did not move when the person left").toBe(
      unit!.sexMix.Female + unit!.sexMix.Male - 1,
    );
    expect(after).not.toHaveTextContent(before);
    expect(
      screen.queryByTestId(`ward-capacity-mid-update-${SUBJECT}`),
      "the ward claims to be mid-update although its sex register and occupancy moved together",
    ).not.toBeInTheDocument();
  });
});
