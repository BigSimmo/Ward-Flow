// shell-14 (13 Oct 2026): on the coordinator's desk, the Go to a desk sheet showed the coordinator
// twice (a "You are here" row above the same desk's tile). The tile alone stays; a ward desk keeps
// its "You are here" row.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const route = { pathname: "/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { dispatchPersonaSyncForRole, useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
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
    act(() => dispatchPersonaSyncForRole("ward", "rph-adult-secure"));
    renderSheet("/ward-flow/ward/rph-adult-secure");
    expect(screen.getByRole("region", { name: "Your desk" })).toHaveTextContent("You are here, Nurse in charge");
    act(() => dispatchPersonaSyncForRole("coordinator"));
  });

  it("does not call another ward of the same role 'here' (PR #489 review)", () => {
    act(() => dispatchPersonaSyncForRole("ward", "rph-adult-secure"));
    renderSheet("/ward-flow/ward/bty-adult-secure");
    const row = screen.getByRole("region", { name: "Your desk" });
    expect(row).toHaveTextContent("You are viewing this desk as Nurse in charge");
    expect(row).not.toHaveTextContent("You are here");
    act(() => dispatchPersonaSyncForRole("coordinator"));
  });

  it("does not call a ward 'here' after a switch that chose only the ward role", () => {
    act(() => dispatchPersonaSyncForRole("ward"));
    renderSheet("/ward-flow/ward/rph-adult-secure");
    expect(screen.getByRole("region", { name: "Your desk" })).toHaveTextContent(
      "You are viewing this desk as Nurse in charge",
    );
    act(() => dispatchPersonaSyncForRole("coordinator"));
  });
});

describe("a service coordinator desk resets the person (PR #489 review)", () => {
  function PersonaProbe() {
    return <output data-testid="persona">{useShellPersonaRole()}</output>;
  }

  it("goes back to the coordinator, as the statewide coordinator tile does", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => dispatchPersonaSyncForRole("ed", "rph-ed"));
    try {
      route.pathname = "/ward-flow";
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PersonaProbe />
          <OperatorSwitcherModal isOpen onClose={() => {}} />
        </WardFlowProvider>,
      );
      expect(screen.getByTestId("persona")).toHaveTextContent("ed");
      // Each health service folds to one summary row (31 Oct 2026); open the first to reach its desk.
      const service = screen
        .getAllByRole("button", { expanded: false })
        .find((head) => head.parentElement?.tagName === "SECTION")!;
      fireEvent.click(service);
      fireEvent.click(screen.getAllByTestId(/^workstation-open-service-/u)[0]);
      expect(screen.getByTestId("persona")).toHaveTextContent("coordinator");
    } finally {
      act(() => setWardFeatureFlagOnDevice("role-access", null));
      resetWardAccessStoreForTests();
      act(() => dispatchPersonaSyncForRole("coordinator"));
    }
  });
});
