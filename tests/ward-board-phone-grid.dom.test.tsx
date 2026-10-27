import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WF_PHONE_QUERY } from "@/components/wf/use-is-phone";

/**
 * Change 10 (D-77, 21 Oct 2026): the phone Stays and discharges screen shows every bed, above the
 * day figures, and a tapped bed opens its record in a sheet. Desktop keeps the side panel.
 */
const UNIT_ID = "rph-adult-secure";

function stubPhone(phone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: phone && query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={UNIT_ID} />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("phone bed grid", () => {
  it("puts every bed above the day figures, with the filters", () => {
    stubPhone(true);
    renderBoard();
    const beds = screen.getByTestId("ward-board-beds");
    const figures = screen.getByTestId("ward-board-triage");
    expect(beds.compareDocumentPosition(figures) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(beds).getAllByRole("button").length).toBeGreaterThan(0);
    // One row: a Show drop-down and the order select as a sort button, not the chip group.
    expect(screen.queryByRole("group", { name: "Narrow stays and discharges" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Order the beds" })).toBeInTheDocument();
    // No side panel on a phone until a bed is chosen.
    expect(screen.queryByTestId("ward-board-detail")).toBeNull();
  });

  it("narrows the beds from the Show drop-down, with each option carrying its count", () => {
    stubPhone(true);
    renderBoard();
    const show = screen.getByRole<HTMLSelectElement>("combobox", { name: "Show" });
    const before = within(screen.getByTestId("ward-board-beds")).getAllByRole("button").length;
    const ready = [...show.options].find((option) => option.value === "ready")!;
    expect(ready.textContent).toMatch(/^Ready · (\d+|none)$/);
    fireEvent.change(show, { target: { value: "ready" } });
    expect(show.value).toBe("ready");
    const after = within(screen.getByTestId("ward-board-beds")).getAllByRole("button").length;
    expect(after).toBeLessThan(before);
  });

  it("opens the bed's record in a sheet and closes it again", () => {
    stubPhone(true);
    renderBoard();
    const tile = within(screen.getByTestId("ward-board-beds")).getAllByRole("button")[0]!;
    fireEvent.click(tile);
    const sheet = screen.getByTestId("ward-board-detail-sheet");
    expect(within(sheet).getByTestId("ward-board-detail")).toBeInTheDocument();
    // The sheet is titled with the card's own line, here the surname and initial.
    const title = tile.querySelector('[data-testid$="-name"]')?.textContent ?? "";
    expect(title).not.toBe("");
    expect(within(sheet).getAllByRole("heading", { level: 2 })[0]).toHaveTextContent(title);
    fireEvent.click(within(sheet).getByRole("button", { name: "Close bed record" }));
    expect(screen.queryByTestId("ward-board-detail-sheet")).toBeNull();
  });

  it("opens a person's bed tall and an empty bed's two lines at their own height (WARD-16)", () => {
    stubPhone(true);
    renderBoard();
    const heights = new Set<string | null>();
    for (const tile of within(screen.getByTestId("ward-board-beds")).getAllByRole("button")) {
      fireEvent.click(tile);
      const sheet = screen.getByTestId("ward-board-detail-sheet");
      const named = tile.querySelector('[data-testid$="-name"]') !== null;
      if (named) expect(sheet).toHaveAttribute("data-height", "tall");
      heights.add(sheet.getAttribute("data-height"));
      fireEvent.click(within(sheet).getByRole("button", { name: "Close bed record" }));
    }
    expect(heights).toEqual(new Set(["tall", "content"]));
  });

  it("leaves the sheet open when Escape only dismisses a select inside it", () => {
    stubPhone(true);
    renderBoard();
    const tiles = within(screen.getByTestId("ward-board-beds")).getAllByRole("button");
    // Open beds in turn until one's record holds a select.
    const select = tiles.reduce<HTMLSelectElement | null>((found, tile) => {
      if (found !== null) return found;
      fireEvent.click(tile);
      return screen.queryByTestId("ward-board-detail-sheet")?.querySelector("select") ?? null;
    }, null);
    if (select === null) throw new Error("no bed record with a select");
    fireEvent.keyDown(select, { key: "Escape" });
    expect(screen.getByTestId("ward-board-detail-sheet")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Close bed record" }), { key: "Escape" });
    expect(screen.queryByTestId("ward-board-detail-sheet")).toBeNull();
  });

  it("keeps the side panel beside the grid on a larger screen", () => {
    stubPhone(false);
    renderBoard();
    expect(screen.getByTestId("ward-board-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-board-detail-sheet")).toBeNull();
    const figures = screen.getByTestId("ward-board-triage");
    const beds = screen.getByTestId("ward-board-beds");
    expect(figures.compareDocumentPosition(beds) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
