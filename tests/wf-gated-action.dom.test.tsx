// R-STRUCT-2, D-192 item 5, D-223 (Josh, 14 Nov 2026): one control draws permit()'s answer. Hidden
// (no line in its place), disabled with its reason for "not now", or enabled. Synthetic seed only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/movements",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { GatedAction, GatedButton, permitFromRoleGate } from "@/components/wf/gated-action";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("GatedButton draws each permit() answer", () => {
  it("hides a step this desk can never take, with nothing in its place", () => {
    const { container } = render(
      <GatedButton permit={{ kind: "never", refusal: "This change is not part of your role." }} onPress={vi.fn()}>
        Book transport
      </GatedButton>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a step that is not possible now, disabled with its reason, and does not run it", () => {
    const onPress = vi.fn();
    render(
      <GatedButton
        permit={{ kind: "not-now", refusal: "x", reason: "Confirm beds first." }}
        onPress={onPress}
        data-testid="gated"
      >
        Record arrival
      </GatedButton>,
    );
    const button = screen.getByTestId("gated");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Confirm beds first.");
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("runs an allowed step", () => {
    const onPress = vi.fn();
    render(
      <GatedButton permit={{ kind: "allow" }} onPress={onPress} data-testid="gated">
        Confirm
      </GatedButton>,
    );
    fireEvent.click(screen.getByTestId("gated"));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("reads a useRoleGate() answer the same way", () => {
    expect(permitFromRoleGate({ allowed: true })).toEqual({ kind: "allow" });
    expect(permitFromRoleGate({ allowed: false, never: true, reason: "Coordinator only" })).toEqual({
      kind: "never",
      refusal: "Coordinator only",
    });
    expect(permitFromRoleGate({ allowed: false, reason: "Coordinator only" })).toEqual({
      kind: "not-now",
      refusal: "Coordinator only",
      reason: "Coordinator only",
    });
  });
});

describe("GatedAction asks permit() with the desk's records (R3-10)", () => {
  /** A journey the ward received from an ED: only the ED that sent it books its transport. */
  function receivedJourney() {
    const state = seedWardFlowState();
    const movement = state.movements.find(
      (candidate) => candidate.acceptedUnitId && candidate.originEdId && !candidate.closure,
    )!;
    return { movement, unitId: movement.acceptedUnitId! };
  }

  function renderAs(unitId: string, movementId: string) {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <GatedAction change={{ type: "BOOK_TRANSPORT", movementId }} onPress={vi.fn()} data-testid="book">
          Book transport
        </GatedAction>
        <GatedAction change={{ type: "PATIENT_ARRIVED", movementId }} onPress={vi.fn()} data-testid="arrived">
          Record arrival
        </GatedAction>
      </WardFlowProvider>,
    );
  }

  it("hides the transport booking from the ward that received the journey, and keeps its own step", () => {
    const { movement, unitId } = receivedJourney();
    renderAs(unitId, movement.id);
    expect(screen.queryByTestId("book")).toBeNull();
    expect(screen.getByTestId("arrived")).not.toHaveAttribute("aria-disabled");
  });
});
