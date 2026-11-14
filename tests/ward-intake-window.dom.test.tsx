import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as the sibling ward-screen dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CapacityIntakeWindowsCard } from "@/components/ward-management/capacity/capacity-intake-windows-card";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderWard(unitId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("tonight's intake hours on the ward hero (feature item 13)", () => {
  it("shows a seeded window", () => {
    renderWard("rgh-adult-secure");
    expect(screen.getByTestId("ward-intake-window-line").textContent).toBe("Tonight: admit 21:00 to 02:00");
  });

  it("starts empty, and saves two typed times", () => {
    renderWard("rph-older-adult");
    expect(screen.getByTestId("ward-intake-window-line").textContent).toBe("Tonight: not set");
    fireEvent.click(screen.getByRole("button", { name: /^Edit tonight's intake hours for / }));
    const from = screen.getByTestId("ward-intake-window-from") as HTMLInputElement;
    const to = screen.getByTestId("ward-intake-window-to") as HTMLInputElement;
    // Nothing pre-filled.
    expect(from.value).toBe("");
    expect(to.value).toBe("");
    fireEvent.change(from, { target: { value: "2200" } });
    fireEvent.change(to, { target: { value: "03:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByTestId("ward-intake-window-line").textContent).toBe("Tonight: admit 22:00 to 03:00");
  });
});

describe("Tonight's intake windows card", () => {
  it("lists the seeded windows and folds the rest into one count line", () => {
    const units = seedWardFlowState().units;
    render(<CapacityIntakeWindowsCard units={units} now={NOW_ANCHOR} />);
    const card = screen.getByRole("region", { name: "Tonight's intake windows" });
    const rows = within(within(card).getByRole("list", { name: "Wards with intake hours tonight" })).getAllByRole(
      "listitem",
    );
    expect(rows).toHaveLength(3);
    expect(within(card).getByTestId("capacity-intake-windows-not-set").textContent).toContain(
      `${units.length - 3} wards haven't set a window.`,
    );
  });
});
