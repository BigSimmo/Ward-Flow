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
    expect(screen.queryByRole("group", { name: "Narrow Bed board" })).toBeNull();
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

  it("opens the bed's record in the kit drawer (a sheet from the foot) and closes it again", () => {
    stubPhone(true);
    renderBoard();
    const tile = within(screen.getByTestId("ward-board-beds")).getAllByRole("button")[0]!;
    fireEvent.click(tile);
    // Drawer review (6 Nov 2026): one kit drawer at every width; on a phone it rises from the foot.
    const sheet = screen.getByTestId("ward-board-detail");
    expect(sheet).toHaveAttribute("role", "dialog");
    // Titled with the person, never "Who is in this bed". The card's own line is the surname and
    // initial; the drawer names the person in full, so it starts with the card's surname.
    const cardLine = tile.querySelector('[data-testid$="-name"]')?.textContent ?? "";
    expect(cardLine).not.toBe("");
    const heading = within(sheet).getAllByRole("heading", { level: 2 })[0]!;
    expect(heading).not.toHaveTextContent("Who is in this bed");
    expect(heading.textContent ?? "").not.toBe("");
    fireEvent.click(within(sheet).getByRole("button", { name: "Close bed record" }));
    expect(screen.queryByTestId("ward-board-detail")).toBeNull();
  });

  it("opens each bed's record in the drawer and closes it again (WARD-16)", () => {
    stubPhone(true);
    renderBoard();
    // Redesign (Josh, 30 Oct 2026): a phone opens on the first 8 beds; Show more draws the rest.
    expect(within(screen.getByTestId("ward-board-beds")).getAllByRole("button")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ more beds?$/u }));
    // Drawer review (6 Nov 2026): the kit drawer sizes itself to its content on a phone, so the
    // old tall/content heights are gone; every bed still opens and closes.
    const kinds = new Set<string | null>();
    for (const tile of within(screen.getByTestId("ward-board-beds")).getAllByRole("button")) {
      fireEvent.click(tile);
      const sheet = screen.getByTestId("ward-board-detail");
      kinds.add(sheet.querySelector("[data-detail-kind]")?.getAttribute("data-detail-kind") ?? null);
      fireEvent.click(within(sheet).getByRole("button", { name: "Close bed record" }));
      expect(screen.queryByTestId("ward-board-detail")).toBeNull();
    }
    expect(kinds.has("occupied")).toBe(true);
    expect(kinds.size).toBeGreaterThan(1);
  });

  it("leaves the sheet open when Escape only dismisses a select inside it", () => {
    stubPhone(true);
    renderBoard();
    const tiles = within(screen.getByTestId("ward-board-beds")).getAllByRole("button");
    // Open beds in turn until one's record holds a select.
    const select = tiles.reduce<HTMLSelectElement | null>((found, tile) => {
      if (found !== null) return found;
      fireEvent.click(tile);
      return screen.queryByTestId("ward-board-detail")?.querySelector("select") ?? null;
    }, null);
    if (select === null) throw new Error("no bed record with a select");
    fireEvent.keyDown(select, { key: "Escape" });
    expect(screen.getByTestId("ward-board-detail")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Close bed record" }), { key: "Escape" });
    expect(screen.queryByTestId("ward-board-detail")).toBeNull();
  });

  it("opens no record by itself on a larger screen, where the beds take the full width", () => {
    stubPhone(false);
    renderBoard();
    // Drawer review (6 Nov 2026): no side column; the record opens in the kit drawer when chosen.
    expect(screen.queryByTestId("ward-board-detail")).toBeNull();
    const figures = screen.getByTestId("ward-board-triage");
    const beds = screen.getByTestId("ward-board-beds");
    expect(figures.compareDocumentPosition(beds) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
