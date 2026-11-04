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
 * P109 (27 Oct 2026): a stale bed count or a ward not reporting must stay visible on a phone.
 * Plan 2i (Josh, 4 Nov 2026, question 5): the phone hero folds to its title and next step, so the
 * Checking line now sits under the step, and the hero foot is not drawn on a phone.
 */
describe("phone Home Checking line", () => {
  it("shows both stale counts under the next step, once", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <CoordinatorScreen />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const line = screen.getByText(/^Checking: \d+ stale bed counts?, \d+ wards? not reporting$/);
    expect(line).toHaveAttribute("data-testid", "home-next-checking");
    expect(line.closest("[data-wf-hero-next]")).not.toBeNull();
    expect(screen.queryByTestId("wf-checking-foot")).not.toBeInTheDocument();
  });
});
