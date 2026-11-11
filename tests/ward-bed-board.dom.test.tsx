// v10 pass 3 (Josh, 10 Oct 2026): the ward page's Bed board, opened from Ward home since 27 Oct 2026. Pick up and place on the shared
// engine (`PLACE_IN_BED`, `ACCEPT_REFERRAL` with a bed number), and Undo on the toast reverses both
// the bed and the referral (build guide acceptance check "Place then Undo returns the referral and
// the bed to their first state").
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { WardSharedSaveContext } from "@/components/ward-management/shell/ward-shared-save-context";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedFits, whyBedDoesNotFit, type BoardPick } from "@/components/ward-management/ward/ward-bed-board-logic";
import { layoutBedNumbers } from "@/components/ward-management/ward/ward-bed-layout";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { getBedStep } from "./helpers/ward-bed-steps";

const UNIT = "scgh-adult-open";

/** Sends `events` once, on mount, through the real provider. */
function Seed({ events }: { events: WardFlowEvent[] }) {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    events.forEach((event) => dispatch(event));
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderBoard(events: WardFlowEvent[] = []) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Seed events={events} />
        <WardScreen unitId={UNIT} />
      </ToastProvider>
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-open-bed-board"));
  return within(screen.getByTestId("ward-bed-board-plan"));
}

const cellText = (bed: number) => screen.getByTestId(`ward-board-bed-${bed}`).getAttribute("aria-label") ?? "";
const firstBed = (predicate: (label: string) => boolean) =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")).find((cell) =>
    predicate(cell.getAttribute("aria-label") ?? ""),
  )!;
const bedNo = (cell: HTMLElement) => Number(cell.dataset.testid?.replace("ward-board-bed-", ""));

// D-151 (PR #1626 review): the Bed board's tile says "Waiting to save" too, as the bed list does.
describe("Ward Bed board — a save waiting on this page", () => {
  it("marks only the bed the waiting save changes", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <WardSharedSaveContext.Provider
            value={{ unconfirmedSave: true, status: "ready", error: null, retry: () => {}, waitingBeds: [`${UNIT}:3`] }}
          >
            <WardScreen unitId={UNIT} />
          </WardSharedSaveContext.Provider>
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    expect(screen.getByTestId("ward-board-bed-3")).toHaveAttribute("data-waiting-save", "true");
    expect(cellText(3)).toMatch(/Waiting to save/);
    expect(screen.getByTestId("ward-board-bed-4")).not.toHaveAttribute("data-waiting-save");
  });
});

describe("Ward Bed board — pick up and place, with Undo", () => {
  // Josh, 3 Nov 2026 (WH7, reverses CRIT-07): three view tabs, Ward home, Referrals and Decisions.
  it("opens inside Ward home, leaves three view tabs and draws one cell per bed", () => {
    renderBoard();
    expect(screen.getByRole("heading", { name: "Bed board" })).toBeVisible();
    expect([...document.querySelectorAll('#mainTabList [role="tab"]')].map((tab) => tab.id)).toEqual([
      "tabBtn-attn",
      "tabBtn-referrals",
      "tabBtn-return",
    ]);
    expect(screen.getByRole("tab", { name: "Ward home (Worth Your Attention)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(document.querySelectorAll("[data-testid^='ward-board-bed-']")).toHaveLength(24);
  });

  it("moves a stay to a free bed, lights only fitting beds while picked, and Undo puts it back", () => {
    renderBoard();
    const occupied = firstBed((label) => !/ready|closed|pulled/i.test(label));
    const from = bedNo(occupied);
    const fromLabel = cellText(from);
    const free = firstBed((label) => /, Ready, Free to place$/.test(label));
    const to = bedNo(free);

    // Nothing picked: pressing an occupied bed opens its panel, which offers the move.
    fireEvent.click(occupied);
    fireEvent.click(getBedStep("Move to another bed"));
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Picked up .* from bed \d+\. \d+ beds? fits?/);
    expect(screen.getByTestId(`ward-board-bed-${to}`)).toHaveAttribute("data-fits", "true");
    // An occupied bed does not fit, and is dimmed by colour, not hidden.
    const other = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")).find(
      (cell) => !/ready|closed|pulled/i.test(cell.getAttribute("aria-label") ?? "") && bedNo(cell) !== from,
    )!;
    expect(other).toHaveAttribute("data-dim", "true");
    // P087: an unfit bed is announced as unavailable while picked; fitting beds and the source stay choosable.
    expect(other).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId(`ward-board-bed-${to}`)).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId(`ward-board-bed-${from}`)).not.toHaveAttribute("aria-disabled");
    fireEvent.click(other);
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/does not fit, it is taken\./);

    // WH8 (3 Nov 2026): choosing a lit bed asks one confirm; nothing moves until it is sent.
    fireEvent.click(screen.getByTestId(`ward-board-bed-${to}`));
    expect(screen.getByTestId("ward-board-confirm")).toHaveTextContent(/^Move .* from bed \d+ to bed \d+\?/);
    expect(cellText(to)).toMatch(/, Ready, [^,]+, fits$/);
    fireEvent.click(screen.getByTestId("ward-board-confirm-send"));
    expect(screen.queryByTestId("ward-board-confirm")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Moved .* to bed/);
    // The person now sits in the free bed, and the bed they left is free.
    // The name sits between the bed number and the quiet line (axe 4.14: the cell's words in order).
    const occupantName = fromLabel.replace(/^Bed \d+, /, "").replace(/, [^,]+$/, "");
    expect(cellText(to)).toContain(occupantName);
    expect(cellText(from)).toMatch(/, Ready, Free to place$/);
    expect(document.querySelector("[data-testid^='ward-board-bed-'][aria-disabled]")).toBeNull();

    const toast = screen.getByTestId("toast");
    fireEvent.click(within(toast).getByRole("button", { name: /^Undo/ }));
    expect(cellText(from)).toBe(fromLabel);
    expect(cellText(to)).toMatch(/, Ready, Free to place$/);
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Undone/);
  });

  it("Put down and Escape leave everything as it was", () => {
    renderBoard();
    const occupied = firstBed((label) => !/ready|closed|pulled/i.test(label));
    fireEvent.click(occupied);
    fireEvent.click(getBedStep("Move to another bed"));
    fireEvent.click(screen.getByRole("button", { name: "Put down" }));
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent("Put down. Nothing changed.");
    expect(screen.queryByRole("button", { name: "Put down" })).not.toBeInTheDocument();
  });

  it("places a waiting referral in a free bed (referral accepted, bed held) and Undo returns both", () => {
    const receive: WardFlowEvent = {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: UNIT,
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    } as WardFlowEvent;
    renderBoard([receive]);

    const chip = [...document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-pick-']")].find(
      (item) => !item.textContent?.includes("Accepted"),
    );
    expect(chip, "the received referral is waiting on the board").not.toBeNull();
    fireEvent.click(chip!);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    const free = firstBed((label) => /, Ready, [^,]+, fits$/.test(label));
    const to = bedNo(free);
    fireEvent.click(free);
    expect(screen.getByTestId("ward-board-confirm")).toHaveTextContent(/This accepts the referral\./);
    fireEvent.click(screen.getByTestId("ward-board-confirm-send"));

    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/Referral accepted\.$/);
    expect(cellText(to)).toMatch(/, Pulled, /);
    // The accepted arm can separately reassign its bed; acceptance still has its own Undo.
    expect(screen.getByTestId(chip!.dataset.testid!)).toHaveTextContent("Accepted");

    act(() => {
      fireEvent.click(within(screen.getByTestId("toast")).getByRole("button", { name: /^Undo/ }));
    });
    expect(cellText(to)).toMatch(/, Ready, Free to place$/);
    expect(document.querySelector("[data-testid^='ward-board-pick-']")).not.toBeNull();
  });
});

describe("Bed board layout and fit rules", () => {
  const items = (spec: string) =>
    spec.split("").map((kind, index) => ({
      free: kind === "r",
      stayAdmissionId: kind === "o" ? `a${index + 1}` : undefined,
    }));

  it("shows every surname and given name in full, never cut with an ellipsis (Josh, 6 Nov 2026)", () => {
    // A narrow cell and a working text measure: the old fit cut any surname here to "F…".
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ font: "", measureText: (text: string) => ({ width: text.length * 8 }) } as never);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    try {
      renderBoard();
      const named = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")).filter(
        (cell) => !/ready|closed|pulled/i.test(cell.getAttribute("aria-label") ?? ""),
      );
      expect(named.length).toBeGreaterThan(0);
      for (const cell of named) {
        const label = cell.getAttribute("aria-label") ?? "";
        expect(cell.textContent).not.toContain("…");
        // axe 4.14: the visible surname and given name sit, whole and in order, in the accessible name.
        const shown = cell.querySelector("[class*='cellWord']")?.textContent ?? "";
        const given = (cell.querySelector("[class*='cellInitial']")?.textContent ?? "").replace(/^, /, "");
        expect(shown.length).toBeGreaterThan(1);
        expect(label).toContain(`, ${shown}, ${given}, `);
      }
    } finally {
      getContext.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("keeps every tile in its baseline bed when nothing is numbered", () => {
    expect(layoutBedNumbers(items("rrooo"), () => undefined)).toEqual([1, 2, 3, 4, 5]);
  });

  it("moves one person by swapping two beds and leaves the rest alone", () => {
    // a5 (baseline bed 5) recorded in bed 2: the free tile that sat in bed 2 takes bed 5.
    const bedOf = (id: string) => (id === "a5" ? 2 : undefined);
    expect(layoutBedNumbers(items("rrooo"), bedOf)).toEqual([1, 5, 3, 4, 2]);
  });

  it("keeps a held bed free, swapping in a free tile when the layout put a stay there", () => {
    expect(layoutBedNumbers(items("rrooo"), () => undefined, [4])).toEqual([1, 4, 3, 2, 5]);
  });

  it("gives every tile exactly one bed whatever the input", () => {
    const bedOf = (id: string) => ({ a3: 9, a4: 3, a5: 3 })[id];
    const numbers = layoutBedNumbers(items("rrooo"), bedOf, [0, 1, 7]);
    expect([...numbers].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("fits a free, unheld bed, and a locked one when a secure bed is needed on a mixed ward", () => {
    const pick: BoardPick = { kind: "referral", referralId: "r1", name: "A Person", secureBedNeeded: true };
    expect(bedFits({ bedNumber: 1, status: "ready", designation: "Locked" }, pick, true)).toBe(true);
    expect(bedFits({ bedNumber: 2, status: "ready", designation: "Open" }, pick, true)).toBe(false);
    expect(whyBedDoesNotFit({ bedNumber: 2, status: "ready", designation: "Open" }, pick, true)).toBe(
      "A Person needs a locked bed",
    );
    expect(bedFits({ bedNumber: 3, status: "ready", heldFor: "B" }, pick, false)).toBe(false);
    expect(bedFits({ bedNumber: 4, status: "occupied" }, pick, false)).toBe(false);
    expect(bedFits({ bedNumber: 5, status: "ready" }, null, false)).toBe(false);
  });
});

describe("Ward page on a phone — the round (Option B, 20 Oct 2026)", () => {
  it("lists every bed once in bed order, with what needs the ward above it and no chip row", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 46.4375rem)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardScreen unitId={UNIT} />
        </WardFlowProvider>,
      );
      // The round shows its first 8 beds, then Show more (redesign approved 31 Oct 2026).
      const list = within(screen.getByTestId("ward-phone-round-list"));
      expect(list.getAllByRole("button", { name: /^Bed / })).toHaveLength(8);
      fireEvent.click(screen.getByRole("button", { name: "Show 16 more beds" }));
      const rows = list.getAllByRole("button", { name: /^Bed / });
      // Each bed once, all 24, and in bed order: never grouped or re-sorted.
      expect(rows).toHaveLength(24);
      // The row is named by its own words (axe 4.14), so the bed number is read from its text.
      const numbers = rows.map((row) => Number(/^Bed (\d+)/.exec(row.textContent ?? "")?.[1]));
      expect(numbers.every(Number.isFinite), "every round row starts with its bed number").toBe(true);
      expect(numbers).toEqual([...numbers].sort((left, right) => left - right));
      expect(screen.queryByTestId("ward-phone-bed-groups")).toBeNull();
      // This shift and Ward flow are rows under My list, not chips above the tabs.
      expect(screen.getByRole("heading", { name: "My list" })).toBeInTheDocument();
      expect(screen.getByTestId("ward-phone-row-shift")).toBeInTheDocument();
      expect(screen.getByTestId("ward-phone-row-flow")).toBeInTheDocument();
      expect(screen.queryByTestId("ward-phone-chip-shift")).toBeNull();
      // A row opens that bed's card in the round; Close returns to the list.
      fireEvent.click(rows[0]);
      expect(screen.getByRole("button", { name: "Close, back to the round" })).toBeInTheDocument();
      expect(screen.queryByTestId("ward-phone-round-list")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Close, back to the round" }));
      expect(screen.getByTestId("ward-phone-round-list")).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});
