import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { HealthService } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const scope = vi.hoisted(() => ({ service: null as HealthService | null }));
vi.mock("@/components/ward-management/shell/ward-service-store", async (importOriginal) => ({
  ...(await importOriginal()),
  useServiceScope: () => scope.service,
}));

function renderCapacity() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

describe("capacity review corrections", () => {
  beforeEach(() => {
    scope.service = null;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("Space and Enter activate summary shortcuts, retain all wards and move focus to the table", async () => {
    const user = userEvent.setup();
    renderCapacity();
    const table = screen.getByTestId("ward-capacity-network-table");
    const before = table.querySelectorAll('[data-testid^="ward-capacity-network-row-"]').length;
    expect(before).toBeGreaterThan(0);
    const available = screen.getByRole("button", { name: /Available.*Ready/u });
    expect(available.tagName).toBe("BUTTON");
    available.focus();
    await user.keyboard(" ");
    expect(available).toHaveAttribute("aria-pressed", "true");
    expect(document.getElementById("capacity-wards")).toHaveFocus();
    expect(within(table).getAllByText("Matches this filter").length).toBeGreaterThan(0);
    expect(table.querySelectorAll('[data-testid^="ward-capacity-network-row-"]')).toHaveLength(before);
    const all = screen.getByRole("button", { name: /^Wards/u });
    all.focus();
    await user.keyboard("{Enter}");
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(within(table).queryByText("Matches this filter")).toBeNull();
  });

  it("counts only North Metro wards in the scoped table header and highlight controls", () => {
    scope.service = "North Metro";
    renderCapacity();
    const wards = screen.getByRole("region", { name: "Wards" });
    expect(wards).toHaveTextContent("4 wards in North Metro, 4 matching");
    expect(within(wards).getByRole("button", { name: /^All/u })).toHaveTextContent("4");
    expect(within(wards).getByRole("button", { name: /^Has a bed ready/u })).toHaveTextContent("3");
    expect(within(wards).getByRole("button", { name: /^Has a locked bed ready/u })).toHaveTextContent("1");
    expect(within(wards).getByRole("button", { name: /^Needs confirming/u })).toHaveTextContent("1");
  });

  it("reports an empty service with zero matching wards and zero highlight counts", () => {
    scope.service = "CAHS";
    renderCapacity();
    const wards = screen.getByRole("region", { name: "Wards" });
    expect(wards).toHaveTextContent("0 wards in CAHS, 0 matching");
    for (const button of within(wards).getAllByRole("button", {
      name: /^(All|Has a bed ready|Has a locked bed ready|Needs confirming)/u,
    })) {
      expect(button).toHaveTextContent("0");
    }
  });

  it("shows a compact-table scroll cue only while the table actually overflows", () => {
    let resize: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    renderCapacity();
    const table = screen.getByTestId("ward-capacity-network-table");
    expect(screen.queryByText("Scroll sideways to see more ward details.")).toBeNull();
    Object.defineProperties(table, {
      clientWidth: { value: 600, configurable: true },
      scrollWidth: { value: 1200, configurable: true },
    });
    act(resize);
    expect(screen.getByText("Scroll sideways to see more ward details.")).toBeInTheDocument();
    expect(table).toHaveAttribute("data-overflowing", "true");
    Object.defineProperty(table, "clientWidth", { value: 1400, configurable: true });
    act(resize);
    expect(screen.queryByText("Scroll sideways to see more ward details.")).toBeNull();
    expect(table).not.toHaveAttribute("data-overflowing");
  });
});
