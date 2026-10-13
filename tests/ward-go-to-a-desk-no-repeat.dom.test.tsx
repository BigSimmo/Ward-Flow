// shell-14 (13 Oct 2026): on the coordinator's desk, the Go to a desk sheet showed the coordinator
// twice (a "You are here" row above the same desk's tile). The tile alone stays; a ward desk keeps
// its "You are here" row.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const route = { pathname: "/mockups/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderSheet(pathname: string) {
  route.pathname = pathname;
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OperatorSwitcherModal isOpen onClose={() => {}} />
    </WardFlowProvider>,
  );
}

describe("Go to a desk names the current desk once", () => {
  it("drops the You are here row on the coordinator desk; the coordinator tile stays as the current page", () => {
    renderSheet("/mockups/ward-flow");
    expect(screen.queryByRole("region", { name: "Your desk" })).toBeNull();
    const tile = screen.getByTestId("workstation-open-coordinator");
    expect(tile).toHaveAttribute("aria-current", "page");
  });

  it("keeps the You are here row on a ward desk", () => {
    renderSheet("/mockups/ward-flow/ward/rph-adult-secure");
    expect(screen.getByRole("region", { name: "Your desk" })).toHaveTextContent("You are here");
  });
});
