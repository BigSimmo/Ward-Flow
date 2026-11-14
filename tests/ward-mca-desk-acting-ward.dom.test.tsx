import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { deskActingWard } from "@/components/ward-management/ward-desk-acting-ward";
import { ExtendHoldControl } from "@/components/ward-management/ward-extend-hold";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * M9 (mechanics and clock audit, 14 Nov 2026): screens copied the acting ward from the record, so a
 * ward desk looking at a journey accepted at another ward was offered that ward's bed steps, and the
 * local demo recorded them against the wrong ward. The acting ward now comes from the desk, as Pull
 * the bed does, and the step is not offered when the bed is elsewhere. Offline, synthetic seed.
 */
const desk = vi.hoisted(() => ({ access: { role: "ward", scope: { kind: "ward", unitIds: [] as string[] } } }));
vi.mock("@/components/ward-management/ward-role-gate", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-role-gate")>()),
  useRouteRole: () => "ward",
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => desk.access,
}));

afterEach(cleanup);

const wardDesk = (...unitIds: string[]): WardAccess => ({ role: "ward", scope: { kind: "ward", unitIds } });

describe("M9: deskActingWard", () => {
  it("acts as the bed's ward only when it is one of the desk's own", () => {
    expect(deskActingWard(wardDesk("a", "b"), "b")).toBe("b");
    expect(deskActingWard(wardDesk("a"), "b")).toBeNull();
    expect(deskActingWard(wardDesk("a"), undefined)).toBeNull();
    // A demonstration desk with no ward scope acts as the ward holding the bed, as Pull the bed does.
    expect(deskActingWard({ role: "coordinator", scope: { kind: "statewide" } }, "b")).toBe("b");
  });
});

describe("M9: Extend pull on a ward desk", () => {
  const state = seedWardFlowState();
  const pulled = state.movements.find(
    (movement) =>
      movement.stage === "pulled" &&
      movement.acceptedUnitId !== undefined &&
      movement.pullExpiresAt !== undefined &&
      movement.pullExpiresAt > NOW_ANCHOR + 60 &&
      !movement.closure,
  )!;
  const other = state.units.find((unit) => unit.id !== pulled.acceptedUnitId)!;

  it("is not offered for a bed at another ward", () => {
    desk.access = wardDesk(other.id);
    const dispatch = vi.fn();
    render(<ExtendHoldControl movement={pulled} dispatch={dispatch} rejections={[]} now={NOW_ANCHOR} />);
    expect(screen.queryByRole("button", { name: "Extend pull" })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("acts as the desk's own ward for a bed there", () => {
    desk.access = wardDesk(other.id, pulled.acceptedUnitId!);
    const dispatch = vi.fn();
    render(<ExtendHoldControl movement={pulled} dispatch={dispatch} rejections={[]} now={NOW_ANCHOR} />);
    fireEvent.click(screen.getByRole("button", { name: "Extend pull" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^\+\d h$/ })[0]!);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "EXTEND_PULL", role: "ward", actingUnitId: pulled.acceptedUnitId }),
    );
  });
});
