import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { waitingSplit } from "@/components/ward-management/delays/delays-derivations";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE DELAYS SCREEN CRASHED ON THE BEST DAY IT COULD HAVE, AND THIS IS THE STATE ITSELF.**
 *
 * `waitingSplit` returns its three bands all at zero whenever no movement is open, and `WardBar`
 * throws on an all-zero total — deliberately, because an empty rail reads as a loading state. The
 * screen rendered the bar with no guard, so when nobody was waiting in any emergency department the
 * page went blank. Every other state this screen can be in is worse than that one, and it was the
 * only state that killed it.
 *
 * ⚠️ **UNTIL TODAY THIS TEST COULD NOT HAVE BEEN WRITTEN.** `DelaysScreen` read every movement from
 * the provider, whose seed always has people waiting, so the failing state was unreachable from a
 * test — the screen most exposed to the defect was the one whose empty state could not be rendered.
 * The strongest guard available was `ward-bar-zero-is-reachable.test.ts`, which scans the source for
 * a guard's PRESENCE and cannot tell a correct guard from a wrong one. That file still earns its
 * place — it walks every call site, so it catches the next screen to forget one — but this is the
 * one that renders the crash.
 *
 * **Both are kept deliberately.** The scan covers screens whose empty state is still unreachable;
 * this covers whether the guard actually works. Neither subsumes the other.
 *
 * ⚠️ **AND IT ASSERTS THE KIND OF ZERO, NOT JUST THE ABSENCE OF A CRASH.** Ward Lead's ruling of
 * 2026-09-06: a MEASURED none is stated in a plain word; the absence sentence is reserved for a
 * figure nothing could produce. Not crashing is satisfied by writing "nothing here can say how many
 * are waiting" — which would be false over a real, running count. So the wrong sentence is failed
 * as explicitly as the crash is.
 */

const NOW = NOW_ANCHOR;

function renderWith(movements: Movement[]) {
  const result = render(
    <WardFlowProvider initialNow={NOW}>
      <DelaysScreen movements={movements} />
    </WardFlowProvider>,
  );
  return result;
}

describe("the delays screen when nobody is waiting", () => {
  it("renders at all — this is the state that used to throw", () => {
    // Anti-vacuity: the fixture must actually produce the all-zero split that WardBar refuses, or
    // this test is rendering some other empty state and proving nothing about the crash.
    const split = waitingSplit([], NOW);
    expect(split.length, "waitingSplit no longer returns segments; this fixture proves nothing").toBeGreaterThan(1);
    expect(
      split.reduce((sum, segment) => sum + segment.value, 0),
      "waitingSplit over no open movements no longer sums to zero, so this render no longer reaches the crash path",
    ).toBe(0);

    expect(() => renderWith([])).not.toThrow();
    expect(screen.getByTestId("ward-delays-page")).not.toBeNull();
  });

  it("says nobody is waiting as a measured none, not as something it could not measure", () => {
    renderWith([]);
    const text = (screen.getByTestId("ward-delays-nobody-waiting").textContent ?? "").replace(/\s+/gu, " ").trim();

    // The measured half: the reader is told the count ran and found none.
    expect(
      /nobody is waiting|no one is waiting|none/iu.test(text),
      `the empty state reads "${text}" and does not say plainly that nobody is waiting`,
    ).toBe(true);

    /*
     * ⚠️ **THE OTHER HALF OF THE RULING, ASSERTED AS A POSITIVE — AND THE FIRST DRAFT OF IT BANNED
     * A PHRASE AND WENT RED ON THIS PAGE'S OWN HONEST SENTENCE.** It forbade "could not"; the copy
     * reads "...not a figure this screen could not produce", which uses the phrase precisely to
     * DENY the unknown reading. That is the third time today a guard of mine would have red-lighted
     * the correct text, and the reflex on a red is to change the sentence rather than the guard.
     *
     * So it asserts what must be TRUE instead of what must be absent: the sentence has to say the
     * count RAN. A sentence saying a count ran over a named population is not an absence sentence,
     * whatever else it contains — and no phrase ban is needed to tell them apart.
     */
    expect(
      /measured|counted|count over|every open movement/iu.test(text),
      `the empty state reads "${text}". It does not say the count RAN, so a reader cannot tell this ` +
        "from a figure the screen was unable to produce. Ward Lead's ruling of 2026-09-06: a measured " +
        "none is stated plainly as one, and the absence sentence belongs only to a measure nothing derives.",
    ).toBe(true);
  });

  it("draws no duration facts when there is nobody to count", () => {
    renderWith([]);
    expect(screen.queryByLabelText("People waiting by duration")).toBeNull();
  });

  it("states all four derived duration facts when somebody is waiting", () => {
    /*
     * The other direction, and the reason it is here: the cheapest way to stop the empty state
     * crashing is to remove the aggregate entirely. That passes every assertion above and silently
     * removes the four facts showing everyone at once.
     */
    /*
     * Real seeded movements rather than hand-built ones. My first version invented two objects and
     * they crashed a derivation four modules away on a missing `cohort` — a fixture thin enough to
     * fail is also thin enough to pass for the wrong reason.
     */
    const waiting = wardMovements.filter(isOpen).slice(0, 2) as Movement[];
    expect(waiting, "the seed has no open movements, so this direction cannot be tested").toHaveLength(2);

    const waited = (movement: Movement) => NOW - movement.openedAt;
    const under8 = waiting.filter((movement) => waited(movement) < 8 * 60).length;
    const eightTo12 = waiting.filter((movement) => waited(movement) >= 8 * 60 && waited(movement) < 12 * 60).length;
    const twelveTo24 = waiting.filter((movement) => waited(movement) >= 12 * 60 && waited(movement) < 24 * 60).length;
    const over24 = waiting.filter((movement) => waited(movement) >= 24 * 60).length;
    expect(
      under8 + eightTo12 + twelveTo24 + over24,
      "this fixture produces no open movements, so it cannot prove the duration facts survive a non-empty state",
    ).toBe(waiting.length);

    renderWith(waiting);
    expect(screen.queryByTestId("ward-delays-nobody-waiting")).toBeNull();
    // The four "whose move" tiles partition everyone waiting, so their band bars sum to the whole.
    const tiles = screen.getByRole("region", { name: "Whose move" });
    const totals = [0, 0, 0, 0];
    for (const bar of within(tiles).getAllByRole("img", { name: /^Under 8h:/u })) {
      const counts = [...(bar.getAttribute("aria-label") ?? "").matchAll(/: (\d+)/gu)].map((match) => Number(match[1]));
      expect(counts, "a band bar no longer names all four bands").toHaveLength(4);
      counts.forEach((n, index) => (totals[index] += n));
    }
    expect(totals).toEqual([under8, eightTo12, twelveTo24, over24]);
  });
});
