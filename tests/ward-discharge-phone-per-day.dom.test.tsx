import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => true,
}));

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

/**
 * Codex review of PR #1581 (9 Nov 2026): the page tops removed the phone's Per day card, and the
 * day chart only showed on wider screens, so a phone could not pick a day (or reach releases due in
 * 2+ days, which only a chosen day shows). The Per day chip in the hero opens the day chart again.
 */
describe("discharges on a phone: Per day", () => {
  it("opens the day chart from the hero chip, and choosing a day highlights it and closes the sheet", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const chip = screen.getByTestId("ward-discharge-phone-per-day");
    expect(chip).toHaveAccessibleName(/^Per day, \d+ overdue, \d+ today\. Expected discharges per day/);
    fireEvent.click(chip);

    const sheet = screen.getByTestId("ward-discharge-phone-chart-sheet");
    const chart = within(sheet).getByTestId("ward-discharge-day-chart");
    // A day two or more ahead: its releases only show once the day is chosen.
    const days = within(chart).getAllByRole("button", { pressed: false });
    const due = (button: HTMLElement) => /: [1-9]\d* due/.test(button.getAttribute("aria-label") ?? "");
    // Columns run Overdue, Today, tomorrow, then two or more days ahead.
    const later = days.slice(3).find(due) ?? days.find(due) ?? days[0]!;
    const name = later.getAttribute("aria-label")!;
    fireEvent.click(later);

    expect(screen.queryByTestId("ward-discharge-phone-chart-sheet")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-discharge-highlight-note")).toBeInTheDocument();

    // Reopened, the chosen day reads as pressed.
    fireEvent.click(screen.getByTestId("ward-discharge-phone-per-day"));
    const reopened = within(screen.getByTestId("ward-discharge-phone-chart-sheet")).getByRole("button", { name });
    expect(reopened).toHaveAttribute("aria-pressed", "true");
  });
});
