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

function RejectionCount({ movementId }: { movementId: string }) {
  const { rejections, movements } = useWardFlow();
  return (
    <output data-testid="probe">
      {rejections.length}:{movements.find((m) => m.id === movementId)?.arrivalDetails ? "set" : "unset"}
    </output>
  );
}

function renderModal(actingUnitId?: string, movementIndex = 0) {
  const movement = seedWardFlowState().movements[movementIndex];
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ArrivalTimeModal isOpen onClose={vi.fn()} movement={movement} role="ward" actingUnitId={actingUnitId} />
      <RejectionCount movementId={movement.id} />
    </WardFlowProvider>,
  );
  return screen.getByTestId("save-arrival-plan-button");
}

describe("actions limited by the route's role (feature 11)", () => {
  it("disables an action the route's role may not take, with a short visible reason", () => {
    navigation.pathname = "/mockups/ward-flow/transport/officer";
    const save = renderModal();
    expect(save).toBeDisabled();
    const reason = screen.getByText("Coordinator, ED or ward only");
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
    expect(screen.queryByText("Coordinator, ED or ward only")).toBeNull();
  });

  // Review finding A1-8 (Gitar, 13 Oct 2026): the modal used to fill in the movement's own ward when
  // the caller named none, so the reducer's scope check could never refuse it. It now sends only the
  // ward the caller states.
  it("does not invent the acting ward: a ward caller that names none is refused", () => {
    navigation.pathname = "/mockups/ward-flow/ward/rph-adult-secure";
    const index = seedWardFlowState().movements.findIndex(
      (m) => m.acceptedUnitId && !m.closure && m.stage === "pulled",
    );
    const save = renderModal(undefined, index);
    fireEvent.submit(save.closest("form")!);
    expect(screen.getByTestId("probe").textContent).toBe("1:unset");
  });

  it("records the arrival plan when the caller names the receiving ward", () => {
    navigation.pathname = "/mockups/ward-flow/ward/rph-adult-secure";
    const seeded = seedWardFlowState().movements;
    const index = seeded.findIndex((m) => m.acceptedUnitId && !m.closure && m.stage === "pulled");
    const save = renderModal(seeded[index]!.acceptedUnitId, index);
    fireEvent.submit(save.closest("form")!);
    expect(screen.getByTestId("probe").textContent).toBe("0:set");
  });
});
