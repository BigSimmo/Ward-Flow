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
  it("opens patient admission record detail when clicking anywhere on an admission row", () => {
    renderBoard();

    // Switch to Admission records population
    fireEvent.click(screen.getByRole("button", { name: /Admission records/ }));

    // Find the first admission record row
    const tbody = document.querySelector("table tbody");
    expect(tbody).not.toBeNull();
    const rows = within(tbody as HTMLElement).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(0);
    const firstRow = rows[0];

    // Click on a non-button cell (e.g. Timing cell or Ward cell text)
    const timingCell = within(firstRow).getByText(/Sat, 26 Sept|Mon, 28 Sept|Tue, 29 Sept|Wed, 30 Sept|Thu, 1 Oct/);
    fireEvent.click(timingCell);

    // Detail drawer should now be open with the patient record
    const details = screen.getByRole("region", { name: "Selected discharge details" });
    expect(details).toBeInTheDocument();
    expect(within(details).getByRole("heading", { level: 3 })).toHaveTextContent(/Ironbrook, Barnaby|Ferrowmoor/);
    expect(within(details).getByText(/UMRN UM\d+/)).toBeInTheDocument();
  });

  it("renders linked patient bridge and allows navigating to full admission record from release view", () => {
    renderBoard();

    // In default Anonymous releases view, find a release row with a button
    const firstReleaseButton = screen.getAllByRole("button", { name: /Dabakarn|Moodjar|Mental Health Unit/ })[0];
    fireEvent.click(firstReleaseButton);

    // Detail drawer opens with release info and the linked patient bridge
    const details = screen.getByRole("region", { name: "Selected discharge details" });
    expect(details).toBeInTheDocument();

    const bridgeButton = within(details).getByRole("button", { name: /View patient discharge record →/ });
    expect(bridgeButton).toBeInTheDocument();

    // Click the bridge button to navigate to the full admission record
    fireEvent.click(bridgeButton);

    // Population should now have switched to Admission records and rendered full record
    expect(screen.getByRole("button", { name: /Admission records/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(details).getByText("Expected discharge")).toBeInTheDocument();
    expect(within(details).getByText("Date recorded")).toBeInTheDocument();
  });

  it("supports keyboard activation on admission rows using Enter and Space", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /Admission records/ }));

    const tbody = document.querySelector("table tbody");
    const rows = within(tbody as HTMLElement).getAllByRole("row");
    const secondRow = rows[1];

    // Trigger keyboard Enter on row
    fireEvent.keyDown(secondRow, { key: "Enter" });

    const details = screen.getByRole("region", { name: "Selected discharge details" });
    expect(within(details).getByText(/UMRN UM\d+/)).toBeInTheDocument();
  });
});
