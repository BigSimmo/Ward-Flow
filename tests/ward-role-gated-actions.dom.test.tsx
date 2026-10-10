import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The role is the route: each test sets the path the gate reads.
const navigation = vi.hoisted(() => ({ pathname: "/mockups/ward-flow" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  navigation.pathname = "/mockups/ward-flow";
});

function RejectionCount() {
  const { rejections, movements } = useWardFlow();
  return (
    <output data-testid="probe">
      {rejections.length}:{movements[0]?.arrivalDetails ? "set" : "unset"}
    </output>
  );
}

function renderModal() {
  const movement = seedWardFlowState().movements[0];
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ArrivalTimeModal isOpen onClose={vi.fn()} movement={movement} role="ward" />
      <RejectionCount />
    </WardFlowProvider>,
  );
  return screen.getByTestId("save-arrival-plan-button");
}

describe("actions limited by the route's role (feature 11)", () => {
  it("disables an action the route's role may not take, with a short visible reason", () => {
    navigation.pathname = "/mockups/ward-flow/transport/officer";
    const save = renderModal();
    expect(save).toBeDisabled();
    const reason = screen.getByText("Coordinator, ED, ward or community team only");
    expect(save.getAttribute("aria-describedby")).toBe(reason.closest("[id]")?.id);
    const before = screen.getByTestId("probe").textContent;
    fireEvent.submit(save.closest("form")!);
    // Nothing is dispatched, so nothing is recorded or refused.
    expect(screen.getByTestId("probe").textContent).toBe(before);
  });

  it("leaves the same action available on a route whose role may take it", () => {
    navigation.pathname = "/mockups/ward-flow/ward/rph-adult-secure";
    const save = renderModal();
    expect(save).toBeEnabled();
    expect(save.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByText("Coordinator, ED, ward or community team only")).toBeNull();
  });
});
