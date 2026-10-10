import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * v10 Network (pass 3): the hero figures highlight the bed flow. Pressing Ready now marks every ward
 * with a ready bed, dims the others by attribute (never hidden), says how many in a note, and a
 * second press or Clear ends it.
 */
function renderNetwork() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardModeWorkspace mode="network" />
    </WardFlowProvider>,
  );
}

function unitRows() {
  return screen.getAllByTestId(/^ward-network-bedflow-/u).map((button) => button.closest("tr")!);
}

describe("Network hero figures highlight the bed flow", () => {
  it("dims wards without a ready bed when Ready now is pressed, and keeps every row", () => {
    renderNetwork();
    const before = unitRows().length;
    expect(before).toBeGreaterThan(0);

    const ready = screen.getByRole("button", { name: /Ready now/u });
    fireEvent.click(ready);
    expect(ready).toHaveAttribute("aria-pressed", "true");

    const rows = unitRows();
    expect(rows).toHaveLength(before);
    const dimmed = rows.filter((row) => row.getAttribute("data-dim") === "true");
    const marked = rows.filter((row) => row.querySelector("td[data-hl='true']") !== null);
    expect(dimmed.length).toBeGreaterThan(0);
    expect(marked.length + dimmed.length).toBe(before);
    for (const row of marked) {
      expect(Number(row.querySelector("td[data-hl='true']")!.textContent)).toBeGreaterThan(0);
    }
    expect(screen.getByTestId("ward-network-highlight-note")).toHaveTextContent(
      `${marked.length} of ${before} units with a ready bed, all rows stay`,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByTestId("ward-network-highlight-note")).not.toBeInTheDocument();
    expect(unitRows().filter((row) => row.getAttribute("data-dim") === "true")).toHaveLength(0);
  });

  it("toggles off when the same figure is pressed again", () => {
    renderNetwork();
    const pulled = screen.getByRole("button", { name: /Pulled/u });
    fireEvent.click(pulled);
    expect(screen.getByTestId("ward-network-highlight-note")).toBeInTheDocument();
    fireEvent.click(pulled);
    expect(pulled).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("ward-network-highlight-note")).not.toBeInTheDocument();
  });
});
