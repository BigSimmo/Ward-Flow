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

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("WardScreen Modal Focus Trapping and Restoration", () => {
  it("traps focus in Daily Sheet modal and restores focus on close button", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const trigger = screen.getByTestId("ward-open-daily-sheet-btn");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);

    const modal = screen.getByTestId("ward-daily-sheet-modal");
    expect(modal).toBeInTheDocument();
    expect(modal.contains(document.activeElement)).toBe(true);

    const closeBtn = within(modal).getByRole("button", { name: "Close daily sheet" });
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId("ward-daily-sheet-modal")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("restores focus to trigger on Escape key dismissal of Daily Sheet modal", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const trigger = screen.getByTestId("ward-open-daily-sheet-btn");
    trigger.focus();
    fireEvent.click(trigger);

    const modal = screen.getByTestId("ward-daily-sheet-modal");
    expect(modal).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByTestId("ward-daily-sheet-modal")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("traps focus in Capacity Confirmation modal and restores focus on Escape", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const trigger = screen.getByRole("button", { name: /Confirm today/i });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);

    const modal = screen.getByRole("dialog", { name: /Confirm capacity figures/i });
    expect(modal).toBeInTheDocument();
    expect(modal.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: /Confirm capacity figures/i })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens Bed Dossier Drawer on bed card click and restores focus to bed card on Escape", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Bed cards in beds tab or beds section
    const bedCards = screen.getAllByTestId(/^ward-bed-card-/);
    expect(bedCards.length).toBeGreaterThan(0);
    const bedCard = bedCards[0]!;

    bedCard.focus();
    fireEvent.click(bedCard);

    const drawer = screen.getByTestId("bed-telemetry-drawer");
    expect(drawer).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByTestId("bed-telemetry-drawer")).toBeNull();
    expect(document.activeElement).toBe(bedCard);
  });
});
