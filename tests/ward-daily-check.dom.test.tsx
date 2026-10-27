import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  MissedRequestsPanel,
  markAllLabel,
  missedCheckCountLine,
} from "@/components/ward-management/coordinator/missed-requests-panel";
import { WardFlowClockContext, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Overall review (20 Oct 2026): the daily check's tick on screen. P027 (Josh, 27 Oct 2026): the
 * words say what is being checked ("5 bed requests to check (missed or sent twice)"), the button
 * names the count ("Mark all 5 checked") and the done line reads "All checked · {by} at {time}".
 */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const MARK_ALL = /^Mark all (?:\d+ )?checked$/u;

describe("Daily check: Mark all checked", () => {
  it("names the count on the button from 2, and reads Mark all checked for 0 or 1", () => {
    expect(markAllLabel(0)).toBe("Mark all checked");
    expect(markAllLabel(1)).toBe("Mark all checked");
    expect(markAllLabel(2)).toBe("Mark all 2 checked");
    expect(markAllLabel(5)).toBe("Mark all 5 checked");
  });

  it("says 1 bed request to check in the singular, and bed requests for 2 or more", () => {
    expect(missedCheckCountLine(1)).toBe("1 bed request to check (missed or sent twice)");
    expect(missedCheckCountLine(2)).toBe("2 bed requests to check (missed or sent twice)");
    expect(missedCheckCountLine(5)).toBe("5 bed requests to check (missed or sent twice)");
  });

  it("says how many bed requests to check, and the button names the same count", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MissedRequestsPanel />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("ward-missed-check");
    const meta = /(\d+) bed requests? to check \(missed or sent twice\)/u.exec(card.textContent ?? "");
    expect(meta, "the card names the count of bed requests to check").not.toBeNull();
    expect(card).not.toHaveTextContent("to confirm: missed or doubled bed requests");
    expect(screen.getByRole("button", { name: markAllLabel(Number(meta![1])) })).toBeInTheDocument();
  });

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
    fireEvent.click(screen.getByRole("button", { name: MARK_ALL }));

    expect(screen.queryByTestId("ward-missed-check-done")).toBeNull();
    expect(confirmation).toHaveTextContent(`All checked · Bed coordinator at ${formatInstant(NOW_ANCHOR)}`);
    expect(screen.getByTestId("ward-missed-check")).toHaveTextContent("Daily check");
  });

  it("will not record the tick before the list has been shown", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MissedRequestsPanel />
      </WardFlowProvider>,
    );
    const done = screen.getByRole("button", { name: MARK_ALL });
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
  const tick = () => screen.getByRole("button", { name: MARK_ALL });

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
