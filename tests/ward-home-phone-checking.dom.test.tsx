import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

vi.mock("@/components/ward-management/coordinator/home-layout", () => ({ useHomeLayout: () => "phone" }));

/**
 * P109 (27 Oct 2026): phone Home dropped the hero's Checking strip, so a stale bed count or a ward
 * not reporting was invisible on a phone. It now shows as a collapsed strip whose summary carries
 * both counts; opening it shows the full Checking list.
 */
describe("phone Home Checking strip", () => {
  it("shows the stale-count summary collapsed, with the full Checking list inside", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <CoordinatorScreen />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const summary = screen.getByText(/^Checking: \d+ stale bed counts?, \d+ wards? not reporting$/);
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(details).toContainElement(screen.getByTestId("wf-checking-foot"));
  });
});
