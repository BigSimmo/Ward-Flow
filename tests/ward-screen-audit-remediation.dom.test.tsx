import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { hasOpenSheet } from "@/components/ui/sheet-focus";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardIndex } from "@/components/ward-management/wards/ward-index";

const RPH_ADULT_SECURE = "rph-adult-secure";

describe("WardScreen & WardIndex audit remediation", () => {
  it("persists discharge blocker on an occupied bed without a pre-existing PendingBedRelease and allows clearing it", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    const everyBed = document.getElementById("bed-capacity")!;
    // Find an occupied bed tile that currently has no blocker recorded ("Held up" not in label)
    const occupiedTiles = within(everyBed)
      .getAllByRole("button", { name: /^Bed \d{2},/ })
      .filter((tile) => {
        const label = tile.getAttribute("aria-label") ?? "";
        return (
          !label.includes("Free") &&
          !label.includes("Ready") &&
          !label.includes("Closed") &&
          !label.includes("Pulled") &&
          !label.includes("Inbound") &&
          !label.includes("Held up") &&
          !label.includes("Due out") &&
          !label.includes("Past date")
        );
      });
    expect(occupiedTiles.length).toBeGreaterThan(0);

    fireEvent.click(occupiedTiles.at(-1)!);

    const drawer = await screen.findByTestId("bed-telemetry-drawer");
    fireEvent.click(within(drawer).getByRole("tab", { name: "Plan to leave" }));
    expect(drawer).toHaveTextContent(/Blocker\s*None recorded/i);

    fireEvent.click(within(drawer).getByRole("button", { name: "Record blocker" }));
    const select = within(drawer).getByRole("combobox", { name: "Discharge blocker" });
    fireEvent.change(select, { target: { value: "Awaiting accommodation" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Save blocker" }));

    expect(drawer).toHaveTextContent(/Blocker\s*Awaiting accommodation/i);

    const clearBtn = within(drawer).getByRole("button", { name: "Clear blocker" });
    fireEvent.click(clearBtn);
    expect(drawer).toHaveTextContent(/Blocker\s*None recorded/i);
  });

  it("restores focus to the currently selected bed trigger after stepping from Bed 01 to Bed 02 and closing", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    const everyBed = document.getElementById("bed-capacity")!;
    const bed01 = within(everyBed).getByRole("button", { name: /^Bed 01,/ });
    const bed02 = within(everyBed).getByRole("button", { name: /^Bed 02,/ });

    bed01.focus();
    fireEvent.click(bed01);

    const drawer = await screen.findByTestId("bed-telemetry-drawer");
    expect(hasOpenSheet()).toBe(true);

    const nextBedBtn = within(drawer).getByRole("button", { name: "Next bed" });
    fireEvent.click(nextBedBtn);
    expect(drawer).toHaveTextContent(/Bed 02/i);

    fireEvent.click(within(drawer).getByRole("button", { name: "Close bed drawer" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(document.activeElement).toBe(bed02);
  });

  it("registers Confirm capacity figures modal with pushSheet, uses singular 1 bed grammar, and supports roving tabIndex + focus return on WardNotificationCenter", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    const noticesBtn = screen.getByTestId("ward-notifications-toggle-btn");
    noticesBtn.focus();
    fireEvent.click(noticesBtn);

    const center = await screen.findByTestId("ward-notification-center");
    const allTab = within(center).getByRole("tab", { name: /^All/ });
    const buzzesTab = within(center).getByRole("tab", { name: /^Buzzes/ });
    expect(allTab).toHaveAttribute("tabindex", "0");
    expect(buzzesTab).toHaveAttribute("tabindex", "-1");

    allTab.focus();
    fireEvent.keyDown(allTab, { key: "ArrowRight" });
    expect(buzzesTab).toHaveAttribute("aria-selected", "true");
    expect(buzzesTab).toHaveAttribute("tabindex", "0");
    expect(document.activeElement).toBe(buzzesTab);

    fireEvent.keyDown(center, { key: "Escape" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(screen.queryByTestId("ward-notification-center")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(noticesBtn);

    // Open Confirm capacity figures modal
    const confirmBtns = screen.getAllByRole("button", { name: /Confirm (today's )?numbers/i });
    fireEvent.click(confirmBtns[0]!);

    const dialog = screen.getByRole("dialog", { name: /Confirm capacity figures/i });
    expect(hasOpenSheet()).toBe(true);
    // Dabakarn has 1 Confirmed free, 1 Ready Vacant, 1 Pulled, 1 Closed — none should say "1 beds"
    expect(dialog.textContent).not.toMatch(/\b1 beds\b/);
    expect(dialog).toHaveTextContent(/1 bed vacant/i);

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(hasOpenSheet()).toBe(false);
  });

  it("renders WardIndex h1 with a space between the ready bed count and beds ready now", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/All wards, \d+ beds? ready/i);
  });
});
