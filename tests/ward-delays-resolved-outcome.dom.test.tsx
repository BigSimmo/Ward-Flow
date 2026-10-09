import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { dayOf } from "@/components/ward-management/ward-clock";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **"RESOLVED TODAY" SAID A PATIENT WHO SELF-DISCHARGED FROM ED WAS IN A BED.**
 *
 * The panel filtered on the EXISTENCE of a `closure` and never on `closure.outcome`, which is
 * `"arrived" | "did_not_proceed"` (`ward-model.ts:563`). Two closures fall on `dayOf(NOW_ANCHOR)` in
 * the seed — one `arrived`, and one `did_not_proceed` whose own reason reads *"Patient
 * self-discharged from ED before transport was arranged"*. The panel therefore rendered
 * **"2 people who were on this screen earlier are now placed"** on an untouched load.
 *
 * ⚠️ **NOTHING WENT RED FOR IT.** `tests/ward-delays-screen.dom.test.tsx` asserts the panel exists
 * and shows a count; the count was correct — two people did leave the screen. **It was the sentence
 * that was false**, and a test that checks a number cannot see a sentence that misdescribes it.
 * 36 assertions across three delays suites passed either side of the repair.
 *
 * **The property pinned here is the one that failed: nobody may be described as PLACED who did not
 * arrive.** It is derived from the fixture rather than typed, so a seed change moves the expectation
 * instead of breaking the test for the wrong reason.
 */

/**
 * ⚠️ **RE-POINTED 2026-09-07 — "RESOLVED TODAY" IS NOW A TAB, NOT A STANDING PANEL.** It lives inside
 * the panel titled "Registers", beside an "Escalations" tab, and its sentences are not in the
 * document until this tab is selected — "Escalations" renders first. Every assertion below is
 * unchanged in what it checks; this only opens the tab that now gates it.
 */
function openResolvedTab() {
  fireEvent.click(screen.getByRole("tab", { name: /^Resolved/u }));
}

/** The fixture's own answer, so the expectation cannot drift from the world the screen renders. */
function closuresToday(now: number) {
  const closed = wardMovements.filter(
    (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now),
  );
  return {
    closed,
    arrived: closed.filter((movement) => movement.closure?.outcome === "arrived"),
    didNotProceed: closed.filter((movement) => movement.closure?.outcome === "did_not_proceed"),
  };
}

describe("the delays screen never calls a patient placed who did not arrive", () => {
  it("floors the fixture: a did-not-proceed closure exists today, or every assertion below is vacuous", () => {
    /*
     * ⚠️ The anti-vacuity check, and without it this whole file passes on a seed where the defect
     * cannot occur. The original bug is only VISIBLE when a `did_not_proceed` closure shares a
     * `dayOf` with an `arrived` one — remove either and the wrong code and the right code render
     * the identical sentence.
     */
    const { closed, arrived, didNotProceed } = closuresToday(NOW_ANCHOR);
    expect(closed.length, "no movement closed today — the panel renders its empty state").toBeGreaterThan(0);
    expect(arrived.length, "no arrival today, so 'placed' wording is never exercised").toBeGreaterThan(0);
    expect(
      didNotProceed.length,
      "no did-not-proceed closure today — the defect this file exists for cannot occur on this seed",
    ).toBeGreaterThan(0);
  });

  it("counts only ARRIVALS as placed, never every closure", () => {
    const { arrived } = closuresToday(NOW_ANCHOR);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    openResolvedTab();
    const expected =
      arrived.length === 1
        ? "One person who was on this screen earlier is now placed."
        : `${arrived.length} people who were on this screen earlier are now placed.`;
    expect(
      screen.getAllByText((content) => content.includes(expected)).length,
      `the panel does not state exactly the ${arrived.length} arrival(s) as placed`,
    ).toBeGreaterThan(0);
  });

  it("🔴 never states the FULL closed count as placed — the exact sentence that was false", () => {
    const { closed, arrived } = closuresToday(NOW_ANCHOR);
    expect(closed.length, "closed and arrived are equal on this seed, so this case discriminates nothing").not.toBe(
      arrived.length,
    );
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    openResolvedTab();
    // The precise wording the screen used to emit, rebuilt from the fixture rather than quoted, so
    // it stays a real trap if the count changes.
    const wasFalse = `${closed.length} people who were on this screen earlier are now placed.`;
    expect(
      screen.queryByText((content) => content.includes(wasFalse)),
      "every closure is being described as placed, including patients who never arrived",
    ).toBeNull();
  });

  it("says a did-not-proceed patient did not proceed, rather than dropping them", () => {
    /*
     * Dropping them would trade a false claim for a missing one. The panel's own explanation is
     * "so a shift handing over can see what moved", and a patient who self-discharged from ED has
     * moved — losing them from the handover is the worse of the two failures.
     */
    const { didNotProceed } = closuresToday(NOW_ANCHOR);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    openResolvedTab();
    const expected =
      didNotProceed.length === 1 ? "One person did not proceed." : `${didNotProceed.length} people did not proceed.`;
    expect(
      screen.getAllByText((content) => content.includes(expected)).length,
      "the patients who did not proceed have vanished from the handover entirely",
    ).toBeGreaterThan(0);
  });
});
