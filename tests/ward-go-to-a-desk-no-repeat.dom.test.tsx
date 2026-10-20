// shell-14 (13 Oct 2026): on the coordinator's desk, the Go to a desk sheet showed the coordinator
// twice (a "You are here" row above the same desk's tile). The tile alone stays; a ward desk keeps
// its "You are here" row.
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const route = { pathname: "/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/persona-sync";
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
    renderSheet("/ward-flow");
    expect(screen.queryByRole("region", { name: "Your desk" })).toBeNull();
    const tile = screen.getByTestId("workstation-open-coordinator");
    expect(tile).toHaveAttribute("aria-current", "page");
  });

  it("keeps the desk row on a ward desk, viewed as the coordinator when opened by its link", () => {
    renderSheet("/ward-flow/ward/rph-adult-secure");
    // Overall review (20 Oct 2026): nobody chose this desk, so it is not "You are here, Nurse in charge".
    const row = screen.getByRole("region", { name: "Your desk" });
    expect(row).toHaveTextContent("You are viewing this desk as Bed coordinator");
    expect(row).not.toHaveTextContent("Nurse in charge");
  });

  it("says You are here once the ward desk is the one chosen", () => {
    act(() => dispatchPersonaSyncForRole("ward"));
    renderSheet("/ward-flow/ward/rph-adult-secure");
    expect(screen.getByRole("region", { name: "Your desk" })).toHaveTextContent("You are here, Nurse in charge");
    act(() => dispatchPersonaSyncForRole("coordinator"));
  });
});
