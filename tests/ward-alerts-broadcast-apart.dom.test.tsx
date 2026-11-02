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
 * one action, Next alert, and Broadcast sits under "…", never a single tap from it.
 */
afterEach(() => installMatchMediaStub(false));

describe("phone Alerts hero: one action, Broadcast under the menu", () => {
  it("shows Next alert as the only hero action and keeps Broadcast in the menu", () => {
    installMatchMediaStub(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    const next = screen.getByTestId("ward-alerts-phone-next");
    const buttons = Array.from(next.parentElement!.querySelectorAll("button"));
    expect(buttons.map((button) => button.getAttribute("aria-label") ?? (button.textContent ?? "").trim())).toEqual([
      expect.stringMatching(/^Next alert, \d+ in turn$/u),
      "More alert actions",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "More alert actions" }));
    expect(screen.getByRole("menuitem", { name: /Broadcast alert/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Hold the list still/ })).toBeInTheDocument();
  });
});
