import { act, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * CAN THIS BOARD TELL LIVE STATE FROM THE SEED? Nothing else in the suite can answer that.
 *
 * The board used to read `wardSites`, `wardAdmissions` and `WARD_ADMISSIONS_ANCHOR` as module
 * imports while every other screen read the provider, so its figures came from the un-mutated seed
 * and its clock was a hardcoded 10:42. The visible symptom was the board showing "Held 1" at 10:42
 * while the ward screen showed "Held 0" at 12:32 — same ward, same moment.
 *
 * ⚠️ **WHY THE EXISTING FILE CANNOT CATCH THE REGRESSION, which is the reason this one exists.**
 * `tests/ward-daily-sheet.dom.test.tsx` renders every case with `initialNow={WARD_ADMISSIONS_ANCHOR}`,
 * so seed and live state COINCIDE BY CONSTRUCTION and every comparison there is the seed against
 * itself. Its strongest bed-figure assertion computes its expectation from the seed at the anchor
 * — both sides of that equality would survive the board reverting entirely. It also asserts only
 * the clock and the absence of the fixed-example note, so the PARTIAL regression — clock rewired to
 * the provider, unit still read from `wardSites` — passes it green. That partial state is exactly
 * the half that produced the wrong Held count.
 *
 * **So this file never compares the seed to anything.** Both sides of every assertion come from
 * provider state, the render instant is deliberately NOT the anchor, and the figure is moved by a
 * dispatched event rather than merely read. A board wired to the seed cannot follow a dispatch, so
 * the assertion fails for the reason it exists rather than for a coincidence of fixtures.
 */

const UNIT_ID = "bty-adult-secure";

/**
 * Deliberately NOT `WARD_ADMISSIONS_ANCHOR`. At the anchor a seed-reading board and a
 * provider-reading board agree, which is precisely how the existing file's assertions pass against
 * both. 110 minutes is arbitrary and only has to be non-zero.
 */
const RENDER_AT = WARD_ADMISSIONS_ANCHOR + 110;

/**
 * A window into the SAME provider the board is reading. Both sides of every assertion below come
 * from here, so nothing in this file can accidentally compare the seed against the seed.
 */
type Probe = ReturnType<typeof useWardFlow>;
const probeRef: { current: Probe | null } = { current: null };

function ProviderProbe() {
  const flow = useWardFlow();
  useLayoutEffect(() => {
    probeRef.current = flow;
  });
  return null;
}

function renderBoardWithProbe() {
  probeRef.current = null;
  return render(
    <WardFlowProvider initialNow={RENDER_AT}>
      <ProviderProbe />
      <WardBoard unitId={UNIT_ID} />
    </WardFlowProvider>,
  );
}

function currentProbe(): Probe {
  if (!probeRef.current) throw new Error("the provider probe never rendered");
  return probeRef.current;
}

function unitFromProviderState(): Unit {
  const unit = currentProbe().units.find((candidate) => candidate.id === UNIT_ID);
  if (!unit) throw new Error(`no unit ${UNIT_ID} in provider state`);
  return unit;
}

/** The board's headline count of beds it says can be filled today. */
function headlineValue(): number {
  const headline = screen.getByTestId("ward-board-headline");
  const digits = headline.textContent?.match(/\d+/);
  if (!digits) throw new Error(`no number in the board headline: ${headline.textContent}`);
  return Number(digits[0]);
}

/** Restate this unit's allocatable count through the reducer, as the ward itself. */
function confirmCapacity(value: number) {
  act(() => {
    currentProbe().dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: RENDER_AT,
      unitId: UNIT_ID,
      actingUnitId: UNIT_ID,
      expectedRevision: unitFromProviderState().allocatable.revision ?? 0,
      value,
    });
  });
}

/*
 * 🔴 **THE BOARD MUST NOT CLAIM IT IS FROZEN — ASSERTED AS A PROPERTY, NOT AS A TEST ID.**
 *
 * ⚠️ **This used to read `expect(screen.queryByTestId("ward-board-fixed-note")).toBeNull()`, and it
 * could not fail.** DB-11 (2026-08-30) dropped the frozen view outright and `eec6e08fa4` deleted that
 * element; `ward-board.tsx` says so in its own words — *"Nothing renders a fixed-example note now,
 * because there is no fixed example."* **So the id named nothing, and a `queryByTestId` /
 * `toBeNull` pair reads identically when the element is deleted, when it is renamed, and when it
 * never existed: three states, one green.**
 *
 * ⚠️ **The plan's remedy — "re-point it at the element that actually carries the frozen note" — cannot
 * be carried out, because by owner decision there is no such element and there must not be.** The
 * defect was never the dangling id. It was that a frozen note RETURNING under any other id would keep
 * this green.
 *
 * ✅ **So the claim is what is forbidden, not the element.** The pattern below is the deleted note's
 * own wording — *"This board is a fixed snapshot and does not advance while you watch"* — which is
 * what a re-introduction would most plausibly say again. **Positively controlled: that paragraph was
 * put back by hand and both suites reddened, then it was removed.**
 */
const A_FROZEN_CLAIM = /fixed snapshot|does not advance|frozen/iu;

describe("the ward board reads live state, not the seed", () => {
  it("moves its headline when the reducer changes the unit's allocatable count", () => {
    renderBoardWithProbe();

    // A precondition, asserted rather than assumed: with no physically empty bed the headline is
    // pinned at zero whatever allocatable says, and the test below would pass vacuously against a
    // seed-reading board. Fail loudly here instead.
    const seedUnit = unitFromProviderState();
    expect(seedUnit.empty.value).toBeGreaterThan(0);

    // Raise allocatable to the ward's whole bed count. `available` is min(allocatable, empty), so
    // the headline must now be bounded by the empty beds rather than by allocatable.
    confirmCapacity(seedUnit.beds);
    expect(unitFromProviderState().allocatable.value).toBe(seedUnit.beds);
    const headlineWhenOffering = headlineValue();

    // Then withdraw every bed. available = min(0, empty) = 0, so the headline must read zero.
    confirmCapacity(0);
    expect(unitFromProviderState().allocatable.value).toBe(0);
    const headlineWhenOfferingNone = headlineValue();

    // The two assertions that a seed-reading board cannot satisfy: the figure must have MOVED, and
    // it must have moved TO the value provider state now implies.
    expect(headlineWhenOfferingNone).toBe(0);
    expect(headlineWhenOffering).toBeGreaterThan(headlineWhenOfferingNone);
  });

  it("does not claim to be a frozen example, because it is not showing one", () => {
    const { container } = renderBoardWithProbe();
    expect(
      container.textContent ?? "",
      "the board has started telling the reader it does not advance. DB-11 dropped the frozen view: " +
        "this board is live, and a note saying otherwise is false on the screen a coordinator trusts",
    ).not.toMatch(A_FROZEN_CLAIM);
  });
});
