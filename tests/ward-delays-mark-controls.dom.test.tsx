import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DELAY_CAUSE_COPY, delayGroups, ownerOf } from "@/components/ward-management/delays/delays-derivations";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The Delays redesign (PR 48) opens on the "Action Runway" overview; the owner cards, the duration
 * band and the measured-none sentence these tests read live in the "Summary Cards" view, unchanged.
 */
function showSummaryCards() {
  fireEvent.click(screen.getByRole("button", { name: "Summary Cards" }));
}

/**
 * WF-27 — THREE MARK SOURCES (a chip, an owner card, a cause row) ALL WRITE ONE HEADER FIGURE, AND
 * TWO OF THE THREE COULD LEAVE ANOTHER STANDING WHILE MARKING NOTHING.
 *
 * `marked()` in `delays-screen.tsx` checks `markedCause`, then `markedOwner`, then the chip, in that
 * order — so pressing an owner card or a cause already correctly cleared the OTHER of those two
 * (`setMarkedCause(null)` / `setMarkedOwner(null)`). What it never touched was `delayFilterId`: the
 * chip bar's own `onChange` only ever called `setDelayFilterId`, never clearing the owner or cause
 * marks it was about to be outranked by. So a chip could sit `aria-pressed="true"` — highlighted,
 * looking like the thing driving the board — while an owner or cause mark silently decided who was
 * actually marked instead. This file proves the repair: an owner or cause click also resets the chip
 * to "waiting" (the neutral, always-true pill), and the chip's own `onChange` clears both marks back,
 * so at most one control ever claims to be the reason anybody is marked.
 *
 * A second, narrower defect sits beside the first: `markedCause` is state that outlives the cause it
 * names. `delayGroups` drops a cause the moment nobody is in it (`groups.filter(g =>
 * g.movements.length > 0)`), but nothing told `markedCause` when that happened — so the cause button
 * could vanish from the middle panel while the header kept citing its title over a mark that no
 * longer highlights anything real. The fix reads `groups` at render time rather than syncing state in
 * an effect: `markedCause` only counts as the EFFECTIVE mark while `groups` still carries that cause.
 */

const seededMovements = seedWardFlowState().movements;
const OPEN = seededMovements.filter(isOpen);
const UNITS = allUnits();
const GROUPS_AT_ANCHOR = delayGroups(seededMovements, UNITS, NOW_ANCHOR);

function ownerPeople(ownerId: string): number {
  return GROUPS_AT_ANCHOR.filter((group) => ownerOf(group.cause) === ownerId).reduce(
    (sum, group) => sum + group.movements.length,
    0,
  );
}

function causeTitle(cause: string): string {
  const entry = DELAY_CAUSE_COPY.find((candidate) => candidate.cause === cause);
  expect(entry, `"${cause}" has no entry in DELAY_CAUSE_COPY — the fixture or the ranking moved`).toBeDefined();
  return entry!.title;
}

/**
 * A tiny dispatch surface, in the same shape `ward-delays-legal-deadline.dom.test.tsx`'s own
 * `AdvanceClock` uses: a button whose click fires one real `WardFlowEvent` through the provider's own
 * reducer, never a shortcut around it. `movementId` is passed in rather than hard-coded so the same
 * probe serves both real closing/recategorising events this file needs.
 */
function WithdrawReferralProbe({ movementId }: { movementId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-withdraw-referral"
      onClick={() => dispatch({ type: "WITHDRAW_REFERRAL", role: "coordinator", now, movementId })}
    >
      withdraw referral
    </button>
  );
}

function ClearUrgentFlagProbe({ movementId }: { movementId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-clear-urgent-flag"
      onClick={() => dispatch({ type: "CLEAR_MOVEMENT_URGENT_FLAG", role: "coordinator", now, movementId })}
    >
      clear urgent flag
    </button>
  );
}

beforeEach(() => {
  // The provider persists demo state to sessionStorage (`ward-flow-provider.tsx`) and every render
  // in this file pins `initialNow`, which never reads that persisted state back — but every test here
  // dispatches a real, permanent event (a withdrawal, a flag clear), so the storage is cleared anyway
  // rather than relying on that pinning holding forever.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("the Delays screen's three mark sources never leave a stale one pressed", () => {
  it("fixture sanity: the populations every case below depends on actually exist", () => {
    const locked = OPEN.filter((movement) => movement.security === "Secure");
    const escalated = OPEN.filter((movement) => movement.escalation !== undefined);
    expect(locked.length, "no locked-bed movement in the fixture").toBeGreaterThan(0);
    expect(locked.length, "every open movement needs a locked bed").toBeLessThan(OPEN.length);
    expect(escalated.length, "no escalated movement in the fixture").toBeGreaterThan(0);
    expect(escalated.length, "every open movement is escalated").toBeLessThan(OPEN.length);
    expect(ownerPeople("wards"), "the 'wards' owner has nobody under it").toBeGreaterThan(0);
    expect(ownerPeople("yours"), "the 'yours' owner has nobody under it").toBeGreaterThan(0);
    expect(ownerPeople("ed"), "the 'ed' owner is not empty — case 4 below proves nothing").toBe(0);
    const wf018 = seededMovements.find((movement) => movement.id === "WF-018");
    expect(wf018, "WF-018 missing from the fixture").toBeDefined();
    expect(wf018!.flaggedUrgent, "WF-018 is no longer the fixture's one flagged patient — case 6 needs it").toBe(true);
    expect(isOpen(wf018!), "WF-018 is not open — case 6 needs it on the board").toBe(true);
    const wf002 = seededMovements.find((movement) => movement.id === "WF-002");
    expect(wf002, "WF-002 missing from the fixture").toBeDefined();
    expect(isOpen(wf002!), "WF-002 is not open — case 5 needs it on the board").toBe(true);
    expect(
      wf002!.acceptedUnitId,
      "WF-002 has already been accepted — WITHDRAW_REFERRAL takes a different path",
    ).toBeUndefined();
    expect(wf002!.referredUnitIds.length, "WF-002 holds no live referral to withdraw").toBeGreaterThan(0);
  });

  it("pressing an owner card after a chip resets the chip to 'People waiting', so no chip reads pressed while marking nothing", () => {
    const locked = OPEN.filter((movement) => movement.security === "Secure");

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    showSummaryCards();

    const lockedChip = screen.getByRole("button", { name: `Needs a locked bed ${locked.length}` });
    fireEvent.click(lockedChip);
    expect(lockedChip).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("delays-owner-wards"));

    expect(
      screen.getByRole("button", { name: `Needs a locked bed ${locked.length}` }),
      "the locked chip still reads pressed after an owner card took over marking",
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: `People waiting ${OPEN.length}` }),
      "the neutral chip must read pressed once an owner card is marking instead of any filter",
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("delays-owner-wards")).toHaveAttribute("aria-pressed", "true");
  });

  it("pressing a chip after an owner card unpresses the owner card, and marks exactly the chip's own population", () => {
    const escalated = OPEN.filter((movement) => movement.escalation !== undefined);

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    showSummaryCards();

    const ownerCard = screen.getByTestId("delays-owner-yours");
    fireEvent.click(ownerCard);
    expect(ownerCard).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: `Escalated ${escalated.length}` }));

    expect(
      screen.getByTestId("delays-owner-yours"),
      "the owner card still reads pressed after a chip took over marking",
    ).toHaveAttribute("aria-pressed", "false");

    const region = screen.getByRole("region", { name: "Waiting" });
    const rows = Array.from(region.querySelectorAll('[data-ward-primitive="record-row"]'));
    expect(rows.length, "the board lost rows when a chip was pressed — a chip must mark, never hide").toBe(OPEN.length);

    const escalatedIds = new Set<string>(escalated.map((movement) => movement.id));
    let markedRows = 0;
    for (const row of rows) {
      const id = row.getAttribute("data-record-key") ?? "";
      const saysMarked = (row.textContent ?? "").includes("Marked: Escalated");
      if (escalatedIds.has(id)) {
        expect(saysMarked, `${id} is escalated and the pressed chip must name it as marked`).toBe(true);
        markedRows += 1;
      } else {
        expect(saysMarked, `${id} is NOT escalated and must not be marked`).toBe(false);
      }
    }
    expect(markedRows, "no row carried the mark — the chip is not driving it").toBe(escalated.length);
  });

  it("pressing a pressed owner card again clears the mark, and the panel count reads just the open population", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    showSummaryCards();

    const ownerCard = screen.getByTestId("delays-owner-yours");
    fireEvent.click(ownerCard);
    expect(ownerCard).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("delays-owner-yours"));
    expect(
      screen.getByTestId("delays-owner-yours"),
      "pressing a pressed owner card again must clear the mark",
    ).toHaveAttribute("aria-pressed", "false");

    const region = screen.getByRole("region", { name: "Waiting" });
    expect(
      region.querySelector("[data-ward-panel-count]")?.textContent,
      "an unmarked panel must state only the open population, never a stale 'of N marked'",
    ).toBe(`${OPEN.length}`);
  });

  it("an owner card with nobody under it reads '0 of N marked', and every row still shows", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    showSummaryCards();

    fireEvent.click(screen.getByTestId("delays-owner-ed"));

    const region = screen.getByRole("region", { name: "Waiting" });
    expect(region.querySelector("[data-ward-panel-count]")?.textContent).toBe(`0 of ${OPEN.length} marked · ED`);

    const rows = region.querySelectorAll('[data-ward-primitive="record-row"]');
    expect(rows.length, "an owner with nobody under it hid rows instead of marking nobody").toBe(OPEN.length);
  });

  it("closes the selected patient's detail panel when their movement closes", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
        <WithdrawReferralProbe movementId="WF-002" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("delays-select-WF-002"));
    expect(screen.getByRole("region", { name: "Why this person is waiting" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("test-withdraw-referral"));

    expect(screen.queryByRole("region", { name: "Why this person is waiting" })).toBeNull();
    expect(
      screen.queryByTestId("delays-select-WF-002"),
      "a closed movement must not still offer a select control in the open waiting list",
    ).toBeNull();
  });

  it("a marked cause that empties stops naming itself in the mark label, without closing the movement", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
        <ClearUrgentFlagProbe movementId="WF-018" />
      </WardFlowProvider>,
    );

    const causeButton = screen.getByTestId("delays-cause-patient_or_family");
    fireEvent.click(causeButton);
    expect(causeButton).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByRole("region", { name: "Waiting" }).querySelector("[data-ward-panel-count]")?.textContent).toBe(
      `1 of ${OPEN.length} marked · ${causeTitle("patient_or_family")}`,
    );

    fireEvent.click(screen.getByTestId("test-clear-urgent-flag"));

    // The cause emptied, so `delayGroups` drops it — same as every other cause dropped at nought —
    // and the middle panel offers no button for it any more.
    expect(
      screen.queryByTestId("delays-cause-patient_or_family"),
      "the emptied cause must not still be offered as a pressable heading",
    ).toBeNull();

    // WF-018 is still open and still on the board: only its cause changed (the flag it was marked
    // under no longer applies), so it must never disappear the way a closed movement does.
    expect(
      screen.getByTestId("delays-select-WF-018"),
      "WF-018 must stay on the waiting list — clearing its flag recategorised it, it did not close it",
    ).toBeInTheDocument();

    // The stale mark must fall back to the unmarked state rather than keep citing a cause that no
    // longer has a heading anywhere on this screen.
    expect(
      screen.getByRole("region", { name: "Waiting" }).querySelector("[data-ward-panel-count]")?.textContent,
      "the header still names a cause that emptied and was dropped from the board",
    ).toBe(`${OPEN.length}`);
  });
});
