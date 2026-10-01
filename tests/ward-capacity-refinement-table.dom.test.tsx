import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderCapacity() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

function wardRows() {
  return screen.getByTestId("ward-capacity-network-table").querySelectorAll("[data-ward-network-row-matches]");
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("Capacity table refinement", () => {
  it("keeps the current capacity HUD and full ward confirmation attribution", () => {
    renderCapacity();
    const hud = screen.getByTestId("ward-capacity-hud-island");
    for (const label of ["Mismatches", "Far Placements", "Unallocated", "Offline"]) {
      expect(within(hud).getByText(label)).toBeInTheDocument();
    }
    const stamps = within(screen.getByTestId("ward-capacity-network-table")).getAllByText(/Confirmed .* · NUM /u);
    expect(stamps.length).toBeGreaterThan(0);
    for (const stamp of stamps) {
      const row = stamp.closest("tr")!;
      const wardName = within(row).getByRole("button", { pressed: false }).textContent;
      expect(stamp).toHaveTextContent(`NUM ${wardName}`);
    }
  });

  it("explains the current columns and reversibly reveals the detail view", async () => {
    const user = userEvent.setup();
    renderCapacity();
    const table = screen.getByTestId("ward-capacity-network-table").querySelector("table")!;
    const more = screen.getByRole("button", { name: "More columns" });
    expect(more).toHaveAttribute("aria-pressed", "false");
    expect(more).toHaveAccessibleDescription(/8 key columns shown/u);
    expect(table.className).toContain("compactTable");
    await user.click(more);
    const key = screen.getByRole("button", { name: "Key columns" });
    expect(key).toHaveAttribute("aria-pressed", "true");
    expect(key).toHaveAccessibleDescription(/All 17 columns shown/u);
    expect(table.className).toContain("detailTable");
    await user.click(key);
    expect(table.className).toContain("compactTable");
    expect(screen.getByRole("button", { name: "More columns" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps every ward mounted, states matching rows in words and resets from Network", async () => {
    const user = userEvent.setup();
    renderCapacity();
    const table = screen.getByTestId("ward-capacity-network-table");
    const originalRows = table.querySelectorAll('[data-testid^="ward-capacity-network-row-"]');
    const shortcuts = screen.getByRole("group", { name: "Network shortcuts" });
    const ready = within(shortcuts).getByRole("button", { name: /^Ready wards/u });
    await user.click(ready);
    expect(ready).toHaveAttribute("aria-pressed", "true");
    expect(document.getElementById("capacity-wards")).toHaveFocus();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(wardRows()).toHaveLength(originalRows.length);
    const matches = Array.from(wardRows()).filter(
      (row) => row.getAttribute("data-ward-network-row-matches") === "true",
    );
    expect(matches.length).toBeGreaterThan(0);
    for (const row of matches) {
      expect(within(row as HTMLElement).getByText("Matches this filter")).toBeVisible();
    }
    await user.click(within(shortcuts).getByRole("button", { name: /^All wards/u }));
    expect(ready).toHaveAttribute("aria-pressed", "false");
    expect(within(shortcuts).getByRole("button", { name: /^All wards/u })).toHaveAttribute("aria-pressed", "true");
    expect(table.querySelectorAll('[data-testid^="ward-capacity-network-row-"]')).toHaveLength(originalRows.length);
    expect(wardRows()).toHaveLength(0);
    expect(within(table).queryByText("Matches this filter")).not.toBeInTheDocument();
  });

  it("contains keyboard focus in full screen and restores the opener on Escape", async () => {
    const user = userEvent.setup();
    renderCapacity();
    const opener = screen.getByRole("button", { name: "Full screen" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Ward capacity full screen" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    const first = within(dialog).getByRole("button", { name: "More columns" });
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(first).not.toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Ward capacity full screen" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
  });
});
