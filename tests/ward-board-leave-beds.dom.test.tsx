import { cleanup, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * 🔴 **THE BOARD PRINTS AN "ON LEAVE" FIGURE AND USED TO COUNT IT OVER AN EMPTY ARRAY.**
 *
 * Owner ruling D-23. `ward-board.tsx` declared `const leaveBeds = [] as const` and passed it into
 * three derivations. **Two of the three never read it** — `headlineAvailable` and
 * `constraintSentence` both reduce to `capacityBreakdown(...).availableNow`, which is
 * `min(allocatable, empty)` and touches no leave bed. **The third does:** `capacityBreakdown`'s
 * `onLeave` is `leave.filter((bed) => bed.unitId === unit.id).length`, and the board renders it as
 * a labelled figure. So the board announced **On leave: 0** on every ward, always.
 *
 * ⚠️ **AND IT WAS FALSE THE DAY IT WAS WRITTEN, NOT MERELY LATENT.** The seed carries two leave beds
 * — `WL-001` on `rph-adult-secure` and `WL-002` on `scgh-older-adult`. Measured from the fixture
 * before this was built, because the ruling turned on it: had the seed carried none, the figure
 * would have been right for all data that exists and a sentence saying leave is not modelled would
 * have been the honest answer. It carries two, so the sentence would have been a excuse for a wrong
 * number.
 *
 * 🔴 **THE ANTI-VACUITY CASE BELOW IS NOT CEREMONY — WITHOUT IT THIS WHOLE FILE PASSES ON THE BUG.**
 * The interesting assertion compares the rendered figure against the provider's own count. **In the
 * defective state both sides are 0 and the comparison holds.** A property whose two operands
 * coincide exactly when the code is broken cannot fail. So the count is asserted non-zero FIRST,
 * from provider state, and every comparison after it is meaningful only because that passed.
 *
 * ⚠️ **POPULATION.** Two seeded wards in jsdom at one viewport. Says nothing about layout, about
 * what a browser paints, or about the other twenty-one wards.
 */

/** Has a seeded leave bed (`WL-001`). */
const UNIT_WITH_LEAVE = "rph-adult-secure";

type Probe = ReturnType<typeof useWardFlow>;
const probeRef: { current: Probe | null } = { current: null };

function ProviderProbe() {
  const flow = useWardFlow();
  useLayoutEffect(() => {
    probeRef.current = flow;
  });
  return null;
}

function renderBoard(unitId: string) {
  probeRef.current = null;
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <ProviderProbe />
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

/** The provider's own leave beds for one unit — the live state the board is supposed to be reading,
 *  never the frozen fixture, so both sides of every comparison come from the same place. */
function leaveBedsInProviderFor(unitId: string): number {
  const probe = probeRef.current;
  if (!probe) throw new Error("the provider probe never rendered");
  return probe.leaveBeds.filter((bed) => bed.unitId === unitId).length;
}

function renderedOnLeaveFigure(): number {
  const figure = screen.getByTestId("ward-board-figure-onLeave");
  const value = figure.querySelector("dd")?.textContent ?? "";
  return Number.parseInt(value, 10);
}

describe("the bed board's On leave figure counts real leave beds", () => {
  it("🔴 ANTI-VACUITY — the chosen ward really does have a leave bed in live state", () => {
    renderBoard(UNIT_WITH_LEAVE);
    expect(
      leaveBedsInProviderFor(UNIT_WITH_LEAVE),
      `${UNIT_WITH_LEAVE} has no leave bed in provider state, so every comparison in this file ` +
        "would be 0 against 0 — passing on exactly the defect it exists to catch. Pick a ward that has one.",
    ).toBeGreaterThan(0);
  });

  it("renders the ward's real leave-bed count, not a hard zero", () => {
    renderBoard(UNIT_WITH_LEAVE);
    const expected = leaveBedsInProviderFor(UNIT_WITH_LEAVE);

    expect(
      renderedOnLeaveFigure(),
      "the board's On leave figure disagrees with the leave beds the provider holds for this ward — " +
        "it is counting over a list that is not live state",
    ).toBe(expected);
  });

  it("still says zero for a ward that genuinely has none, so the fix is not a constant either", () => {
    // Render once to read live state, then TEAR DOWN before rendering again. Without the cleanup
    // both boards stay mounted and `getByTestId` finds two `onLeave` figures — which is how the
    // first draft of this case failed, on its own defect rather than the board's.
    renderBoard(UNIT_WITH_LEAVE);
    const probe = probeRef.current;
    if (!probe) throw new Error("the provider probe never rendered");
    const unitsWithLeave = new Set(probe.leaveBeds.map((bed) => bed.unitId));
    const without = probe.units.find((unit) => !unitsWithLeave.has(unit.id));
    if (!without) throw new Error("every unit has a leave bed — this case cannot discriminate");
    cleanup();

    renderBoard(without.id);
    expect(
      renderedOnLeaveFigure(),
      `${without.name} has no leave bed and the board still reports one — the figure has become a constant`,
    ).toBe(0);
  });
});
