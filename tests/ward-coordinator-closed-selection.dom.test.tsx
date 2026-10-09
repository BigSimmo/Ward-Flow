import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WF-22 — **A CLOSED MOVEMENT STAYS SELECTED ON THE COORDINATOR SCREEN.**
 *
 * `coordinator-screen.tsx`'s `selectedMovement` used to resolve against ALL movements, closed
 * included — `movements.find((movement) => movement.id === selectedMovementId)`, with no `isOpen`
 * gate — even though the FIRST-RENDER restore two lines above it already carries one (`focusMovementId`
 * carried across a role switch is only honoured `isOpen`). Select a patient, dispatch an event that
 * closes their movement (a referrer withdrawal, a decline — anything the reducer can reach mid-
 * session), and `FlowDiagram` and `ShortlistPanel` went on being fed a movement nobody could act on
 * any more.
 *
 * ⚠️ **THE PROVIDER IS REAL, NOT MOCKED — this defect only exists once a dispatch has actually run
 * against live state**, so a mocked `useWardFlow` returning a frozen snapshot could not reach it.
 *
 * ⚠️ **`sessionStorage`/`localStorage` ARE CLEARED BEFORE EVERY CASE.** `WardFlowProvider` persists
 * its state keyed on the clock anchor (`ward-flow-provider.tsx`'s `tryReadDemoState`), and every
 * case here pins the same `NOW_ANCHOR` — without clearing, a later case in this file could rehydrate
 * the CLOSED movement a previous case left in storage instead of starting from the fresh seed, and
 * "closes during the test" would stop being true of what actually happened.
 */

const NOW = NOW_ANCHOR;

/** Found, not hardcoded: the real seed's first OPEN movement that has never been accepted and
 *  still holds a live referral — the one shape `WITHDRAW_REFERRAL` closes in a single dispatch
 *  without first needing an ACCEPT_IN_PRINCIPLE to set up the post-acceptance path. */
const seeded = seedWardFlowState();
const TARGET = seeded.movements.find(
  (movement) => isOpen(movement) && movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0,
);

/** Exposes the shared `dispatch` and a live read of whether `TARGET` is still open, the same
 *  "echo live state via a rendered element" technique `PatientCount`/`ClockAdvancer` use elsewhere,
 *  rather than reaching into the reducer directly. */
function Probe() {
  const { dispatch, movements } = useWardFlow();
  const target = movements.find((movement) => movement.id === TARGET!.id);
  return (
    <>
      <button
        type="button"
        data-testid="withdraw-referral"
        onClick={() => dispatch({ type: "WITHDRAW_REFERRAL", role: "ed", now: NOW, movementId: TARGET!.id })}
      >
        withdraw referral
      </button>
      <span data-testid="target-is-open">{String(target !== undefined && isOpen(target))}</span>
    </>
  );
}

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <CoordinatorScreen />
      <Probe />
    </WardFlowProvider>,
  );
}

function queueRow(movementId: string) {
  return screen.getByTestId(`ward-queue-row-${movementId}`);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("the coordinator screen never keeps a closed movement selected (WF-22)", () => {
  it("has a real, open, unaccepted movement with a live referral to withdraw — or every assertion below is vacuous", () => {
    expect(
      TARGET,
      "the seed carries no open, unaccepted movement with a live referral — this suite's premise is wrong",
    ).toBeDefined();
    expect(isOpen(TARGET!)).toBe(true);
    expect(TARGET!.acceptedUnitId).toBeUndefined();
    expect(TARGET!.referredUnitIds.length).toBeGreaterThan(0);
  });

  it("selects the movement, closes it mid-session, and drops the selection rather than keeping it", () => {
    renderScreen();

    // Select an open movement's queue row, and the shortlist names it.
    fireEvent.click(queueRow(TARGET!.id));
    const shortlist = screen.getByLabelText("Placement");
    expect(
      within(shortlist).getByTestId(`ward-shortlist-${TARGET!.id}`),
      "selecting the queue row must open the shortlist for that exact movement",
    ).toBeInTheDocument();

    // A real dispatch, not a hand-built fixture: closes TARGET via the one-step path it qualifies
    // for (see the anti-vacuity case above), read back through the reducer's own state rather than
    // assumed.
    fireEvent.click(screen.getByTestId("withdraw-referral"));
    expect(
      screen.getByTestId("target-is-open"),
      "TARGET must actually be closed after the dispatch, or this test proves nothing about a closed movement",
    ).toHaveTextContent("false");

    // The shortlist region is gone, or no longer names the movement — either reading closes the
    // gap, so both are checked: no region by that name survives, and nothing anywhere still
    // carries TARGET's own shortlist body.
    expect(screen.queryByLabelText("Placement")).not.toBeInTheDocument();
    expect(screen.queryByTestId(`ward-shortlist-${TARGET!.id}`)).not.toBeInTheDocument();

    // No other movement is silently selected — the queue must show no row claiming selection.
    // TARGET's own row is gone too (`queueOrder` drops it once closed), which is the non-vacuity
    // floor for this assertion: there is a real population of rows to check, not zero.
    const queueRows = screen.getAllByTestId(/^ward-queue-row-/);
    expect(queueRows.length, "the queue rendered no rows at all, so this assertion proves nothing").toBeGreaterThan(0);
    expect(queueRows.some((row) => row.getAttribute("aria-pressed") === "true")).toBe(false);
    expect(screen.queryByTestId(`ward-queue-row-${TARGET!.id}`)).not.toBeInTheDocument();

    // Focus lands on a queue control or the queue container, never on the page at large.
    const regionGrid = screen.getByTestId("ward-coordinator-region-grid");
    expect(
      document.activeElement !== null &&
        document.activeElement !== document.body &&
        regionGrid.contains(document.activeElement),
      `focus must move to a control inside the queue region rather than fall back to the page; ` +
        `document.activeElement was ${document.activeElement?.tagName ?? "null"}`,
    ).toBe(true);
  });
});
