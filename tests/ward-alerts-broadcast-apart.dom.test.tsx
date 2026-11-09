import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * P017 (UI audit, 27 Oct 2026): on a phone, Broadcast sat right beside Next alert, so a thumb aiming
 * for the next alert could start a statewide broadcast. Q153 (Josh, 1 Nov 2026): the phone hero shows
 * one action, Next alert. Page tops (Josh, 9 Nov 2026): Next alert is the act row's one button, and
 * Broadcast is a quiet chip on its own row below it that opens the composer, never a send.
 */
afterEach(() => installMatchMediaStub(false));

describe("phone Alerts hero: one action, Broadcast apart from it", () => {
  it("shows Next alert as the act row's only action and keeps Broadcast on the chip row", () => {
    installMatchMediaStub(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    const act = screen.getByTestId("ward-alerts-next");
    expect(Array.from(act.querySelectorAll("button")).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Next alert",
    ]);
    const broadcast = screen.getByTestId("ward-alerts-broadcast");
    expect(act.contains(broadcast)).toBe(false);
    expect(broadcast.closest("ul")).toHaveAccessibleName("Alert actions");
    fireEvent.click(broadcast);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
