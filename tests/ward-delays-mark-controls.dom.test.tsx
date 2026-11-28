import {
  filterIsOn,
  inspectDelayPerson,
  renderAllDelays,
  showEveryDelayRow,
  toggleFilter,
} from "./helpers/delays-interactions";
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELAY_CAUSE_COPY, delayGroups, ownerOf } from "@/components/ward-management/delays/delays-derivations";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { catchmentName } from "@/components/ward-management/delays/delays-board-model";
import { edHealthService } from "@/components/ward-management/ward-service-scope";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";

// r10: the person drawer is the shared movement drawer, which reads the App Router.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

/**
 * THE DELAYS BOARD'S FILTERS NEVER LEAVE A STALE ONE PRESSED, AND THE COUNT IS ALWAYS HONEST.
 *
 * The approved Delays page mockup (October 2026) replaced the old "mark but never hide" controls
 * with filters that narrow the table and say so: the table header reads "N of M", every active
 * filter shows as a removable chip, and Clear resets them all. These cases carry the old file's two
 * defects across to the new controls:
 *
 *   - a control must not read pressed while it is not what is narrowing the table, and
 *   - a filter on a cause that has emptied must stop applying and stop naming itself, rather than
 *     leave the table showing nobody under a chip for a cause the board no longer has.
 */

const seededMovements = seedWardFlowState().movements;
const OPEN = seededMovements.filter(isOpen);
const UNITS = allUnits();
const GROUPS_AT_ANCHOR = delayGroups(seededMovements, UNITS, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);

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

/** The list head names "N of M" only while the list is narrowed (audit four item 54); unnarrowed it reads all. */
function shownCount(): string {
  return screen.queryByTestId("delays-shown-count")?.textContent ?? `${OPEN.length} of ${OPEN.length}`;
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

/**
 * The redesign opens on Longest wait, grouped in wait bands, with Under 8 hours folded. A user opens
 * each folded band, then every blocker group and "Show N more", so every live row is listed.
 */
function showEveryRow(): void {
  const waiting = screen.queryByRole("region", { name: "Waiting" });
  if (waiting === null) return;
  for (const band of within(waiting).queryAllByTestId(/^delays-band-/u)) {
    if (band.getAttribute("aria-expanded") === "false") fireEvent.click(band);
  }
  showEveryDelayRow();
}

function inspect(id: string): HTMLElement {
  showEveryRow();
  return inspectDelayPerson(id);
}

function renderBoard(extra?: React.ReactNode) {
  const result = renderAllDelays(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
      {extra}
    </WardFlowProvider>,
  );
  showEveryRow();
  return result;
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

  it("an owner tile and a Filters item narrow together, and both read as on", () => {
    const lockedWards = GROUPS_AT_ANCHOR.filter((group) => ownerOf(group.cause) === "wards")
      .flatMap((group) => group.movements)
      .filter((movement) => movement.security === "Secure");
    expect(lockedWards.length, "no locked-bed person under Wards, so the intersection proves nothing").toBeGreaterThan(
      0,
    );
    renderBoard();

    toggleFilter(/^Locked bed/u);
    fireEvent.click(screen.getByTestId("delays-owner-wards"));
    showEveryRow();

    // Simplification mock-up: Locked bed is ticked in the Filters menu and the whose-move tile shows its
    // own pressed state, so neither repeats as a chip.
    expect(filterIsOn(/^Locked bed/u)).toBe(true);
    expect(screen.getByTestId("delays-owner-wards")).toHaveAttribute("aria-pressed", "true");
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
    expect(screen.queryByTestId("delays-shown-count"), "a count is drawn with nothing narrowed").toBeNull();
  });

  it("draws no tile for an owner nothing can map to, rather than a permanent zero", () => {
    renderBoard();
    expect(screen.queryByTestId("delays-owner-ed")).toBeNull();
    const tiles = within(screen.getByRole("region", { name: "Whose move" })).getAllByRole("button");
    const total = tiles.reduce((sum, tile) => sum + Number(tile.querySelector("b")?.textContent ?? "0"), 0);
    expect(total, "the tiles no longer partition everyone waiting").toBe(OPEN.length);
  });

  it("Show everyone resets every filter at once", () => {
    renderBoard();
    toggleFilter(/^Locked bed/u);
    fireEvent.click(screen.getByTestId("delays-owner-yours"));
    // The Filters menu's own "Show everyone" clears every filter at once.
    fireEvent.click(screen.getByTestId("delays-filters"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Show everyone" }));
    expect(shownCount()).toBe(`${OPEN.length} of ${OPEN.length}`);
    expect(screen.getByTestId("delays-owner-yours")).toHaveAttribute("aria-pressed", "false");
    expect(filterIsOn(/^Locked bed/u)).toBe(false);
  });

  it("closes the selected patient's panel when their movement closes", () => {
    renderBoard(<WithdrawReferralProbe movementId="WF-002" />);
    inspect("WF-002");
    expect(screen.getByTestId("delays-detail-WF-002")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("test-withdraw-referral"));

    expect(screen.queryByTestId("delays-detail-WF-002")).toBeNull();
    expect(screen.queryByTestId("delays-select-WF-002")).toBeNull();
  });

  it("a blocker filter whose cause empties stops applying and stops naming itself", () => {
    const wf018 = seededMovements.find((movement) => movement.id === "WF-018")!;
    const origin = edHealthService(wf018.originEdId);
    expect(origin, "WF-018 has no recorded service, so the matrix cannot reach it").toBeDefined();
    renderBoard(<ClearUrgentFlagProbe movementId="WF-018" />);

    fireEvent.click(screen.getByRole("tab", { name: "Where and whose move" }));
    fireEvent.click(screen.getByRole("button", { name: "Held up by" }));
    const cell = screen.getByRole("button", {
      name: new RegExp(`^${catchmentName(origin!)}, Family: 1 waiting`, "u"),
    });
    fireEvent.click(cell);

    const title = causeTitle("patient_or_family");
    expect(screen.getByRole("button", { name: `Remove filter ${title}` })).toBeInTheDocument();
    expect(shownCount()).toBe(`1 of ${OPEN.length}`);

    fireEvent.click(screen.getByTestId("test-clear-urgent-flag"));
    // Simplification mock-up: one list, longest wait first; there are no blocker groups to open.
    showEveryRow();

    expect(
      screen.queryByRole("button", { name: `Remove filter ${title}` }),
      "the chip still names a cause that emptied and was dropped from the board",
    ).toBeNull();
    expect(
      screen.getByTestId("delays-select-WF-018"),
      "WF-018 must stay listed: clearing its flag recategorised it, it did not close it",
    ).toBeInTheDocument();
  });
});
