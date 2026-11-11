import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Performance audit WF-27 (11 November 2026): the Movements page added a new Back (popstate)
// listener on every movements change. It now adds one for the page's life and still reads the
// latest movements when Back fires. Synthetic seed data only.

const openMovement = seedWardFlowState().movements.find(isOpen)!;

let dispatchRef: ReturnType<typeof useWardFlow>["dispatch"] | undefined;
function DispatchProbe() {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatchRef = dispatch;
  }, [dispatch]);
  return null;
}

function popstateAdds(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter(([type]) => type === "popstate").length;
}

afterEach(() => {
  vi.restoreAllMocks();
  dispatchRef = undefined;
});

describe("Movements page Back listener (WF-27)", () => {
  it("is added once, not again when the movements change, and still opens the latest movement", () => {
    const add = vi.spyOn(window, "addEventListener");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DispatchProbe />
        <MovementsScreen />
      </WardFlowProvider>,
    );
    const before = popstateAdds(add);
    expect(before).toBeGreaterThan(0);

    for (const contact of ["Synthetic desk one", "Synthetic desk two"]) {
      act(() =>
        dispatchRef!({
          type: "RECORD_ESCALATION",
          role: "coordinator",
          now: NOW_ANCHOR,
          movementId: openMovement.id,
          triedUnitIds: [],
          contact,
        }),
      );
    }
    expect(popstateAdds(add)).toBe(before);

    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { wardMovementDetail: openMovement.id } })));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { wardMovementDetail: "missing" } })));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
