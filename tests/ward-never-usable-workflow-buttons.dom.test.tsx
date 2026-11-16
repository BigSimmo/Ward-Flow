import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Untested-537 INV-ACTION-041 and INV-ACTION-161 (D-192 item 5): a signed-in desk that can never
// send Review leave bed warnings or Request ward capacity review is not shown a greyed button.
const navigation = vi.hoisted(() => ({ pathname: "/bedchart" }));
const desk = vi.hoisted(() => ({ role: "ward" as string }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: desk.role, scope: { kind: "statewide" } }),
}));

import { MovementWorkflowActions } from "@/components/ward-management/movements/movement-workflow-actions";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  navigation.pathname = "/bedchart";
});

function renderAs(role: "ward" | "ed" | "bed_manager" | "coordinator") {
  desk.role = role;
  setDeskRole(role, navigation.pathname);
  const state = seedWardFlowState();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementWorkflowActions movement={{ ...state.movements[0], acceptedUnitId: state.units[0].id }} />
    </WardFlowProvider>,
  );
}

describe("workflow buttons a desk can never use", () => {
  it.each(["ward", "ed"] as const)("the %s desk is not shown Request ward capacity review", (role) => {
    renderAs(role);
    expect(screen.queryByRole("button", { name: "Request ward capacity review" })).toBeNull();
  });

  it.each(["bed_manager", "ed"] as const)("the %s desk is not shown Review leave bed warnings", (role) => {
    renderAs(role);
    expect(screen.queryByRole("button", { name: "Review leave bed warnings" })).toBeNull();
  });

  it("a desk that may send them still sees both", () => {
    renderAs("coordinator");
    expect(screen.getByRole("button", { name: "Request ward capacity review" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Review leave bed warnings" })).toBeEnabled();
  });
});
