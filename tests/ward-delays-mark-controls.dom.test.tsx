import { renderAllDelays, inspectDelayPerson, showEveryDelayRow } from "./helpers/delays-interactions";
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DELAY_CAUSE_COPY, delayGroups, ownerOf } from "@/components/ward-management/delays/delays-derivations";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { catchmentName } from "@/components/ward-management/delays/delays-board-model";
import { edHealthService } from "@/components/ward-management/ward-service-scope";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE DELAYS BOARD'S FILTERS NEVER LEAVE A STALE ONE PRESSED, AND THE COUNT IS ALWAYS HONEST.
 *
 * The approved Delays page mockup (October 2026) replaced the old "mark but never hide" controls
 * with filters that narrow the table and say so: the table header reads "N of M", every active
 * filter shows as a removable chip, and Clear resets them all. These cases carry the old file's two
 * defects across to the new controls:
 *
 *   - a control must not read pressed while it is not what is narrowing the table (WF-27), and
 *   - a filter on a cause that has emptied must stop applying and stop naming itself, rather than
 *     leave the table showing nobody under a chip for a cause the board no longer has.
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
  expect(entry, `"${cause}" has no entry in DELAY_CAUSE_COPY`).toBeDefined();
  return entry!.title;
}

function shownCount(): string {
  return screen.getByTestId("delays-shown-count").textContent ?? "";
}

function listedIds(): string[] {
  const waiting = screen.getByRole("region", { name: "Waiting" });
  return within(waiting)
    .queryAllByTestId(/^delays-select-/u)
    .map((button) => (button.getAttribute("data-testid") ?? "").replace("delays-select-", ""));
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

function renderBoard(extra?: React.ReactNode) {
  return renderAllDelays(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
      {extra}
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("the Delays board's filters never leave a stale one pressed", () => {
  it("fixture sanity: the populations every case below depends on actually exist", () => {
    const locked = OPEN.filter((movement) => movement.security === "Secure");
    expect(locked.length, "no locked-bed movement in the fixture").toBeGreaterThan(0);
    expect(locked.length, "every open movement needs a locked bed").toBeLessThan(OPEN.length);
    expect(ownerPeople("wards"), "the 'wards' owner has nobody under it").toBeGreaterThan(0);
    expect(ownerPeople("yours"), "the 'yours' owner has nobody under it").toBeGreaterThan(0);
    expect(ownerPeople("ed"), "no cause maps to 'ed', so the board must draw no 'ed' tile").toBe(0);
    const wf018 = seededMovements.find((movement) => movement.id === "WF-018");
    expect(wf018?.flaggedUrgent, "WF-018 is no longer the fixture's one flagged patient").toBe(true);
    expect(isOpen(wf018!), "WF-018 is not open").toBe(true);
    const wf002 = seededMovements.find((movement) => movement.id === "WF-002");
    expect(wf002 && isOpen(wf002), "WF-002 is not open").toBe(true);
    expect(wf002!.referredUnitIds.length, "WF-002 holds no live referral to withdraw").toBeGreaterThan(0);
  });

  it("starts unfiltered: every open person is listed and the count reads all of them", () => {
    renderBoard();
    expect(shownCount()).toBe(`${OPEN.length} of ${OPEN.length}`);
    expect(new Set(listedIds())).toEqual(new Set(OPEN.map((movement) => movement.id)));
  });

  it("an owner tile and a chip narrow together, both read pressed, and both show as removable", () => {
    const lockedWards = GROUPS_AT_ANCHOR.filter((group) => ownerOf(group.cause) === "wards")
      .flatMap((group) => group.movements)
      .filter((movement) => movement.security === "Secure");
    expect(lockedWards.length, "no locked-bed person under Wards, so the intersection proves nothing").toBeGreaterThan(
      0,
    );
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /^Locked bed \d+$/u }));
    fireEvent.click(screen.getByTestId("delays-owner-wards"));
    showEveryDelayRow();

    expect(screen.getByRole("button", { name: /^Locked bed \d+$/u })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("delays-owner-wards")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Remove filter Wards" })).toBeInTheDocument();
    expect(shownCount()).toBe(`${lockedWards.length} of ${OPEN.length}`);
    expect(new Set(listedIds())).toEqual(new Set(lockedWards.map((movement) => movement.id)));
  });

  it("pressing an owner tile moves the owner filter, so two tiles never read pressed at once", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("delays-owner-yours"));
    fireEvent.click(screen.getByTestId("delays-owner-wards"));
    expect(screen.getByTestId("delays-owner-yours")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("delays-owner-wards")).toHaveAttribute("aria-pressed", "true");
    expect(shownCount()).toBe(`${ownerPeople("wards")} of ${OPEN.length}`);
  });

  it("pressing a pressed owner tile again clears it, and the count reads the whole open population", () => {
    renderBoard();
    const tile = screen.getByTestId("delays-owner-yours");
    fireEvent.click(tile);
    expect(shownCount()).toBe(`${ownerPeople("yours")} of ${OPEN.length}`);
    fireEvent.click(screen.getByTestId("delays-owner-yours"));
    expect(screen.getByTestId("delays-owner-yours")).toHaveAttribute("aria-pressed", "false");
    expect(shownCount()).toBe(`${OPEN.length} of ${OPEN.length}`);
    expect(screen.queryByRole("button", { name: "Clear" }), "Clear is offered with nothing to clear").toBeNull();
  });

  it("draws no tile for an owner nothing can map to, rather than a permanent zero", () => {
    renderBoard();
    expect(screen.queryByTestId("delays-owner-ed")).toBeNull();
    const tiles = within(screen.getByRole("region", { name: "Whose move" })).getAllByRole("button");
    const total = tiles.reduce((sum, tile) => sum + Number(tile.querySelector("b")?.textContent ?? "0"), 0);
    expect(total, "the tiles no longer partition everyone waiting").toBe(OPEN.length);
  });

  it("Clear resets every filter at once, and Escape does the same", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /^Locked bed \d+$/u }));
    fireEvent.click(screen.getByTestId("delays-owner-yours"));
    fireEvent.click(screen.getAllByRole("button", { name: "Clear" })[0]);
    expect(shownCount()).toBe(`${OPEN.length} of ${OPEN.length}`);
    expect(screen.getByTestId("delays-owner-yours")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: /^Locked bed \d+$/u }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(shownCount()).toBe(`${OPEN.length} of ${OPEN.length}`);
  });

  it("closes the selected patient's panel when their movement closes", () => {
    renderBoard(<WithdrawReferralProbe movementId="WF-002" />);
    inspectDelayPerson("WF-002");
    expect(screen.getByRole("region", { name: "Why this person is waiting" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("test-withdraw-referral"));

    expect(screen.queryByRole("region", { name: "Why this person is waiting" })).toBeNull();
    expect(screen.queryByTestId("delays-select-WF-002")).toBeNull();
  });

  it("a blocker filter whose cause empties stops applying and stops naming itself", () => {
    const wf018 = seededMovements.find((movement) => movement.id === "WF-018")!;
    const origin = edHealthService(wf018.originEdId);
    expect(origin, "WF-018 has no recorded service, so the matrix cannot reach it").toBeDefined();
    renderBoard(<ClearUrgentFlagProbe movementId="WF-018" />);

    fireEvent.click(screen.getByRole("tab", { name: "Where and whose move" }));
    fireEvent.click(screen.getByRole("button", { name: "Blocker" }));
    const cell = screen.getByRole("button", {
      name: new RegExp(`^${catchmentName(origin!)}, Family: 1 waiting`, "u"),
    });
    fireEvent.click(cell);

    const title = causeTitle("patient_or_family");
    expect(screen.getByRole("button", { name: `Remove filter ${title}` })).toBeInTheDocument();
    expect(shownCount()).toBe(`1 of ${OPEN.length}`);

    fireEvent.click(screen.getByTestId("test-clear-urgent-flag"));
    showEveryDelayRow();

    expect(
      screen.queryByRole("button", { name: `Remove filter ${title}` }),
      "the chip still names a cause that emptied and was dropped from the board",
    ).toBeNull();
    expect(screen.queryByTestId("delays-cause-patient_or_family")).toBeNull();
    expect(
      screen.getByTestId("delays-select-WF-018"),
      "WF-018 must stay listed: clearing its flag recategorised it, it did not close it",
    ).toBeInTheDocument();
  });
});
