import { render, screen, within } from "@testing-library/react";
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

function accessibleName(element: HTMLElement): string {
  return (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function visibleText(element: HTMLElement): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** P082 (label in name, WCAG 2.5.3): each discharge KPI button's name starts with what it shows. */
describe("discharge KPI buttons name what they show (P082)", () => {
  it("starts every KPI button's accessible name with its visible text", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const strip = screen.getByTestId("ward-discharge-kpi-strip");
    const buttons = within(strip).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      // Spacing between the count and the label is layout, so compare without it.
      const squash = (text: string) => text.replace(/\s+/g, "");
      expect(squash(accessibleName(button)).startsWith(squash(visibleText(button))), accessibleName(button)).toBe(true);
    }
  });
});
