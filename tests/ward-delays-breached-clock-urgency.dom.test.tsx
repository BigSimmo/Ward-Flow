import { renderAllDelays, inspectDelayPerson } from "./helpers/delays-interactions";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **A PATIENT WHOSE LEGAL AUTHORITY HAD ALREADY LAPSED GOT A CALMER CLOCK THAN ONE WHOSE
 * AUTHORITY WAS STILL RUNNING. This file exists so that cannot come back.**
 *
 * The audit split the old single `legal_expiring` cause into `legal_breached` (ALREADY LAPSED) and
 * `legal_expiring` (under an hour, not yet lapsed). `SEVERE_CAUSES` was updated with it and a long
 * comment was written above `isSevere` explaining the shape — *"every predicate that names the old
 * member by hand is a caller, and the compiler cannot find them because a string union still
 * typechecks."*
 *
 * ⚠️ **Forty lines further down the same file, `DelayRow`'s clock still read
 * `urgent: cause === "legal_expiring"`.** The diagnosis was written, correctly, and the sweep it
 * described was never run. **A written diagnosis does not sweep** — the comment proves somebody
 * understood the shape once; it never claimed to have found every instance, and it was read back
 * for two days as though it had.
 *
 * ⚠️ **WHY NO TEST CAUGHT IT.** No movement in the seed is breached at `NOW_ANCHOR`, so
 * `legal_breached` is an empty group and the inversion is latent — it fires the first time a real
 * deadline passes. **A defect that only appears once the data gets worse is exactly the one a
 * fixture cannot show you**, which is why every case below advances the clock rather than trusting
 * the seed.
 *
 * ⚠️ **WHAT THIS FILE DOES NOT ASSERT.** It does not claim the ED clock is the RIGHT figure to
 * redden for a legal fact. It is not — the clock is `now - openedAt`, and the legal deadline has
 * its own state chip carrying the number and the direction. Whether either legal cause should
 * redden this clock at all is with the owner. **This file pins only the ordering: the worse case is
 * never quieter than the lesser one.** That property survives whichever way he rules.
 */

/**
 * Moves `now` WITHOUT moving the world. A pinned `initialNow` re-seeds every `dueAt` at the same
 * offset, so a deadline 90 minutes away stays 90 minutes away however far the pin is pushed — the
 * trap `ward-delays-legal-deadline.dom.test.tsx` records. `ADVANCE_CLOCK` adds to
 * `clockOffsetMinutes` instead, which is the only mechanism in this app that can cross a statutory
 * deadline.
 */
function AdvanceClock({ minutes }: { minutes: number }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-advance-clock"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}
    >
      advance clock
    </button>
  );
}

function renderAdvancedBy(minutes: number) {
  renderAllDelays(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AdvanceClock minutes={minutes} />
      <DelaysScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("test-advance-clock"));
}

/** How far the clock must move before at least one movement is genuinely breached. */
const ADVANCE_MINUTES = 12 * 60;

function causesAfterAdvance(minutes: number): Set<string> {
  const now = NOW_ANCHOR + minutes * 60_000;
  return new Set(delayGroups(wardMovements, allUnits(), now).map((group) => group.cause));
}

/**
 * Every movement classified `legal_breached` at the given offset — the population the "every"
 * property below actually ranges over. Read from the same `delayGroups` the screen itself calls,
 * never hand-picked, so the set cannot drift from what the screen would classify.
 */
function breachedMovementIds(minutes: number): string[] {
  const now = NOW_ANCHOR + minutes * 60_000;
  return delayGroups(wardMovements, allUnits(), now)
    .filter((group) => group.cause === "legal_breached")
    .flatMap((group) => group.movements.map((movement) => movement.id));
}

/**
 * The rendered ED clock of every row that carries one.
 *
 * ⚠️ **THE FIRST VERSION OF THIS HELPER FOUND THE WRONG ELEMENT AND THE TEST FAILED SAYING "every
 * legal cause is rendering as calm".** It searched for the first `<span>` whose `textContent`
 * mentioned "in ED" — but `textContent` is recursive, so the outer `.line` wrapper matched first and
 * carries no `data-urgent`. **A selector bug reported itself as a defect in the screen**, in the
 * screen's own words, and would have been quoted as one. The clock is found here by its `<small>`
 * subtitle's PARENT, which is the element that actually carries the flag.
 *
 * ⚠️ **RE-POINTED 2026-09-07.** The screen no longer renders every row's full clock at once — only
 * the SELECTED patient's, inside the detail panel. This now returns the one clock rendered there
 * (or `undefined` if nobody is selected), so the caller selects a patient first and reads one clock
 * at a time rather than scanning the whole document for all of them.
 *
 * ⚠️ **RENAMED, task D1.** That panel is titled "The person you have chosen" no longer — the
 * drawing (`delays-third-edition.html`) draws "Nobody selected" or "Why this person is waiting"
 * depending on state, so the lookup below matches either rather than one fixed string, which is
 * what actually lets the doc comment's "or `undefined` if nobody is selected" claim stay true.
 */
function selectedClock(): { text: string; urgent: boolean } | undefined {
  const panel = screen.getByRole("region", { name: /Nobody selected|Why this person is waiting/u });
  const row = panel.querySelector('[data-ward-primitive="record-row"]');
  if (row === null) return undefined;
  const sub = [...row.querySelectorAll("small")].find((small) => small.textContent?.trim() === "in ED");
  const clock = sub?.parentElement;
  return clock == null
    ? undefined
    : { text: clock.textContent ?? "", urgent: clock.getAttribute("data-urgent") === "true" };
}

describe("a lapsed legal authority is never quieter than one still running", () => {
  /**
   * ⚠️ **THE FLOOR IS ON THE POPULATION, NOT ON THE MATCHES.** Every assertion below is of the form
   * "the breached rows are urgent". **A clock advance that produced no breached movement would
   * satisfy all of them perfectly**, and the seed produces none at `NOW_ANCHOR` — so this case is
   * the only thing standing between a real guard and a vacuous one.
   */
  it("the advanced clock actually produces a breached movement, or nothing below asserts anything", () => {
    const before = causesAfterAdvance(0);
    const after = causesAfterAdvance(ADVANCE_MINUTES);
    expect(before.has("legal_breached"), "the seed is already breached, so the advance proves nothing").toBe(false);
    expect(after.has("legal_breached"), `no movement is breached after ${ADVANCE_MINUTES} minutes`).toBe(true);
  });

  it("every rendered clock on a breached row is marked urgent", () => {
    renderAdvancedBy(ADVANCE_MINUTES);
    const breached = breachedMovementIds(ADVANCE_MINUTES);
    expect(
      breached.length,
      "no movement classified legal_breached at this offset — the derivation, not the screen, produced nothing",
    ).toBeGreaterThan(0);
    /*
     * ⚠️ **GENUINELY UNIVERSAL, NOT "AT LEAST ONE".** Only one patient's clock is ever on screen at
     * once now, so the population is walked by selecting each breached patient in turn rather than
     * scanning one page that used to hold every row simultaneously — but the property itself is
     * unchanged and stays over ALL of them: every breached row's clock is urgent, not merely one.
     */
    for (const id of breached) {
      inspectDelayPerson(id);
      const clock = selectedClock();
      expect(
        clock,
        `${id}: no ED clock rendered once selected — the selector, not the screen, is what failed`,
      ).toBeDefined();
      expect(
        clock?.urgent,
        `${id}: not urgent after its deadline has passed — the breached cause is rendering as calm`,
      ).toBe(true);
    }
  });

  /**
   * The ordering property itself, stated over the derivation rather than the DOM so it holds
   * whatever the owner decides about which figure carries the urgency.
   */
  it("breached outranks expiring in the cause ordering, not merely alongside it", () => {
    const now = NOW_ANCHOR + ADVANCE_MINUTES * 60_000;
    const groups = delayGroups(wardMovements, allUnits(), now);
    const breached = groups.findIndex((group) => group.cause === "legal_breached");
    const expiring = groups.findIndex((group) => group.cause === "legal_expiring");
    expect(breached, "no breached group to rank").toBeGreaterThanOrEqual(0);
    if (expiring >= 0) {
      expect(breached, "a lapsed authority is ranked below one that has not lapsed").toBeLessThan(expiring);
    }
  });
});
