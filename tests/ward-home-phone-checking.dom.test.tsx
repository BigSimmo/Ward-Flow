import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

vi.mock("@/components/ward-management/coordinator/home-layout", () => ({ useHomeLayout: () => "phone" }));
// Phone Home's "More for this list" menu opens Alerts history through the app router.
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

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
    // The hero foot does not wrap, so the summary carries the class that lets it wrap on a narrow phone.
    expect(details?.className).toMatch(/checkingPhone/);
    expect(details).toContainElement(screen.getByTestId("wf-checking-foot"));
  });
});
