import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
    </WardFlowProvider>,
  );
}

describe("discharges board patient detail and navigation bridge", () => {
  it("opens a recorded discharge's detail when clicking anywhere on its row", () => {
    renderBoard();

    // Recorded (DC4, 3 Nov 2026) lists the departed admission records of the last 7 days.
    fireEvent.click(screen.getByRole("button", { name: /^Recorded/ }));

    const tbody = document.querySelector("table tbody");
    expect(tbody).not.toBeNull();
    const rows = within(tbody as HTMLElement).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(0);
    const firstRow = rows[0];
    const name = within(firstRow).getByRole("button").textContent ?? "";
    expect(name.length).toBeGreaterThan(0);

    // Click a non-button cell: the Left time, not the patient button.
    const leftCell = within(firstRow).getByText(/\d{1,2}:\d{2}/);
    expect(leftCell.closest("button")).toBeNull();
    fireEvent.click(leftCell);

    // Detail drawer should now be open with that patient's record (drawer review, 6 Nov 2026: the
    // kit drawer's head names the person).
    const details = screen.getByTestId("ward-discharge-detail");
    expect(details).toBeInTheDocument();
    expect(within(details).getByRole("heading", { level: 2 })).toHaveTextContent(name);
    expect(within(details).getByText(/UMRN UM\d+/)).toBeInTheDocument();
  });

  it("renders linked patient bridge and allows navigating to full admission record from release view", () => {
    renderBoard();

    // Open release rows until one has a linked record (drawer review, 6 Nov 2026: the hidden resting
    // panel's Blocked shortcuts are gone, so the rows themselves open the drawer).
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    const openers = within(worklist)
      .getAllByRole("row")
      .flatMap((row) => within(row).queryAllByRole("button").slice(0, 1));
    const linked = openers.find((opener) => {
      fireEvent.click(opener);
      return screen.queryByRole("button", { name: /^Discharge record/ }) !== null;
    });
    expect(linked, "no release row opens with a linked discharge record").toBeDefined();

    // Detail drawer opens with release info; its foot carries the Discharge record bridge
    expect(screen.getByTestId("ward-discharge-detail")).toBeInTheDocument();

    const bridgeButton = screen.getByRole("button", { name: /^Discharge record/ });
    expect(bridgeButton).toBeInTheDocument();

    // Click the bridge button to navigate to the full admission record
    fireEvent.click(bridgeButton);

    // Population should now have switched to Admission records and rendered full record
    expect(screen.getByRole("button", { name: /^Recorded/ })).toHaveAttribute("aria-pressed", "true");
    const details = screen.getByTestId("ward-discharge-detail");
    expect(within(details).getByText("Expected discharge")).toBeInTheDocument();
    expect(within(details).getByText("Date recorded")).toBeInTheDocument();
  });

  it("supports keyboard activation on recorded discharge rows using Enter and Space", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /^Recorded/ }));

    const tbody = document.querySelector("table tbody");
    const rows = within(tbody as HTMLElement).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1);
    for (const [row, key] of [
      [rows[1], "Enter"],
      [rows[0], " "],
    ] as const) {
      const name = within(row).getByRole("button").textContent ?? "";
      fireEvent.keyDown(row, { key });
      const details = screen.getByTestId("ward-discharge-detail");
      expect(within(details).getByRole("heading", { level: 2 })).toHaveTextContent(name);
      expect(within(details).getByText(/UMRN UM\d+/)).toBeInTheDocument();
    }
  });
});
