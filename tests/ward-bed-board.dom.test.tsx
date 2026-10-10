// v10 pass 3 (Josh, 10 Oct 2026): the ward page's Bed board tab. Pick up and place on the shared
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

import { ToastProvider } from "@/components/ui/toast";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedFits, whyBedDoesNotFit, type BoardPick } from "@/components/ward-management/ward/ward-bed-board-logic";
import { layoutBedNumbers } from "@/components/ward-management/ward/ward-bed-layout";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

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
  fireEvent.click(screen.getByRole("tab", { name: /^Bed board/ }));
  return within(screen.getByTestId("ward-bed-board-plan"));
}

const cellText = (bed: number) => screen.getByTestId(`ward-board-bed-${bed}`).getAttribute("aria-label") ?? "";
const firstBed = (predicate: (label: string) => boolean) =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")).find((cell) =>
    predicate(cell.getAttribute("aria-label") ?? ""),
  )!;
const bedNo = (cell: HTMLElement) => Number(cell.dataset.testid?.replace("ward-board-bed-", ""));

describe("Ward Bed board — pick up and place, with Undo", () => {
  it("opens as a third tab and draws one cell per bed", () => {
    renderBoard();
    expect(screen.getByRole("tab", { name: /^Bed board/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Home (Worth Your Attention)" })).toHaveAttribute("aria-selected", "false");
    expect(document.querySelectorAll("[data-testid^='ward-board-bed-']")).toHaveLength(24);
  });

  it("moves a stay to a free bed, lights only fitting beds while picked, and Undo puts it back", () => {
    renderBoard();
    const occupied = firstBed((label) => !/free|closed|pulled/.test(label));
    const from = bedNo(occupied);
    const fromLabel = cellText(from);
    const free = firstBed((label) => /, free$/.test(label));
    const to = bedNo(free);

    // Nothing picked: pressing an occupied bed opens its panel, which offers the move.
    fireEvent.click(occupied);
    fireEvent.click(screen.getByRole("button", { name: "Move to another bed" }));
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Picked up .* from bed \d+\. \d+ beds? fits?/);
    expect(screen.getByTestId(`ward-board-bed-${to}`)).toHaveAttribute("data-fits", "true");
    // An occupied bed does not fit, and is dimmed by colour, not hidden.
    const other = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")).find(
      (cell) => !/free|closed|pulled/.test(cell.getAttribute("aria-label") ?? "") && bedNo(cell) !== from,
    )!;
    expect(other).toHaveAttribute("data-dim", "true");
    fireEvent.click(other);
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/does not fit, it is taken\./);

    fireEvent.click(screen.getByTestId(`ward-board-bed-${to}`));
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Moved .* to bed/);
    // The person now sits in the free bed, and the bed they left is free.
    const occupantName = fromLabel.replace(/^Bed \d+, /, "");
    expect(cellText(to)).toContain(occupantName);
    expect(cellText(from)).toMatch(/, free$/);

    const toast = screen.getByTestId("toast");
    fireEvent.click(within(toast).getByRole("button", { name: /^Undo/ }));
    expect(cellText(from)).toBe(fromLabel);
    expect(cellText(to)).toMatch(/, free$/);
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Undone/);
  });

  it("Put down and Escape leave everything as it was", () => {
    renderBoard();
    const occupied = firstBed((label) => !/free|closed|pulled/.test(label));
    fireEvent.click(occupied);
    fireEvent.click(screen.getByRole("button", { name: "Move to another bed" }));
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

    const chip = document.querySelector<HTMLElement>("[data-testid^='ward-board-pick-']");
    expect(chip, "the received referral is waiting on the board").not.toBeNull();
    fireEvent.click(chip!);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    const free = firstBed((label) => /, free, fits$/.test(label));
    const to = bedNo(free);
    fireEvent.click(free);

    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/Referral accepted\.$/);
    expect(cellText(to)).toMatch(/held for/);
    // The referral has left the waiting list.
    expect(document.querySelector("[data-testid^='ward-board-pick-']")).toBeNull();

    act(() => {
      fireEvent.click(within(screen.getByTestId("toast")).getByRole("button", { name: /^Undo/ }));
    });
    expect(cellText(to)).toMatch(/, free$/);
    expect(document.querySelector("[data-testid^='ward-board-pick-']")).not.toBeNull();
  });
});

describe("Bed board layout and fit rules", () => {
  const items = (spec: string) =>
    spec.split("").map((kind, index) => ({
      free: kind === "r",
      stayAdmissionId: kind === "o" ? `a${index + 1}` : undefined,
    }));

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
