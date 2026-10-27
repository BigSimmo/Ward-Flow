import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { MissedRequestsPanel } from "@/components/ward-management/coordinator/missed-requests-panel";
import { WardFlowClockContext, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Overall review (20 Oct 2026): the daily check's "Checked, all accounted for" tap on screen. */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("Daily check: Checked, all accounted for", () => {
  it("records who ticked it and when, and keeps the check itself on screen", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MissedRequestsPanel />
      </WardFlowProvider>,
    );
    const confirmation = screen.getByTestId("ward-missed-check-confirmation");
    // UX audit (21 Oct 2026): the tick waits until the list has been opened once.
    expect(screen.getByTestId("ward-missed-check-toggle")).toHaveTextContent("Show list");
    fireEvent.click(screen.getByTestId("ward-missed-check-toggle"));
    expect(screen.getByTestId("ward-missed-check-toggle")).toHaveTextContent("Hide list");
    fireEvent.click(screen.getByRole("button", { name: "Checked, all accounted for" }));

    expect(screen.queryByTestId("ward-missed-check-done")).toBeNull();
    expect(confirmation).toHaveTextContent(
      `Checked, all accounted for · Bed coordinator at ${formatInstant(NOW_ANCHOR)}`,
    );
    expect(screen.getByTestId("ward-missed-check")).toHaveTextContent("Daily check");
  });

  it("will not record the tick before the list has been shown", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MissedRequestsPanel />
      </WardFlowProvider>,
    );
    const done = screen.getByRole("button", { name: "Checked, all accounted for" });
    expect(done).toHaveAttribute("aria-disabled", "true");
    expect(done).toHaveAccessibleDescription("Open the list to confirm it");
    expect(screen.getByText("Open the list to confirm it")).toBeVisible();
    fireEvent.click(done);
    expect(screen.getByTestId("ward-missed-check-done")).toBeInTheDocument();
  });

  const at = (now: number) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardFlowClockContext.Provider value={now}>
        <MissedRequestsPanel />
      </WardFlowClockContext.Provider>
    </WardFlowProvider>
  );
  const tick = () => screen.getByRole("button", { name: "Checked, all accounted for" });

  it("asks for the list again when a folded list is left into the next day", () => {
    const { rerender } = render(at(NOW_ANCHOR));
    // Open then fold the list, so nothing is on screen when the day turns.
    fireEvent.click(screen.getByTestId("ward-missed-check-toggle"));
    fireEvent.click(screen.getByTestId("ward-missed-check-toggle"));
    expect(tick()).not.toHaveAttribute("aria-disabled", "true");

    rerender(at(NOW_ANCHOR + 24 * 60));
    expect(tick()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId("ward-missed-check-toggle"));
    expect(tick()).not.toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the tick available when the list stays open into the next day", () => {
    const { rerender } = render(at(NOW_ANCHOR));
    fireEvent.click(screen.getByTestId("ward-missed-check-toggle"));
    rerender(at(NOW_ANCHOR + 24 * 60));
    expect(tick()).not.toHaveAttribute("aria-disabled", "true");
  });
});
