import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { MovementWorkflowActions } from "@/components/ward-management/movements/movement-workflow-actions";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { RELEASE_PULL_REASONS } from "@/components/ward-management/ward-change-reasons";
function Workspace() {
  const { movements } = useWardFlow();
  const [id] = useState(() => movements.find((m) => !m.closure && !m.expectFlag)!.id);
  const movement = movements.find((m) => m.id === id)!;
  return <MovementWorkflowActions movement={movement} />;
}
describe("previously unexposed workflow commands", () => {
  it("raises and clears a review flag through the real provider", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Workspace />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Raise expectation review flag" }));
    expect(screen.getByRole("button", { name: "Clear expectation review flag" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear expectation review flag" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("records a typed country extension without calculating a legal interval", () => {
    const state = seedWardFlowState();
    const m = state.movements.find((m) => !m.closure && m.legalForm?.dueAt !== undefined)!;
    const due = m.legalForm!.dueAt! + 1;
    const next = wardFlowReducer(state, {
      type: "RECORD_COUNTRY_EXTENSION",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: m.id,
      paperExpiresAt: due,
    });
    expect(next.movements.find((x) => x.id === m.id)?.legalForm?.dueAt).toBe(due);
    expect(next.movements.find((x) => x.id === m.id)?.legalFormExpiryHistory?.at(-1)).toMatchObject({
      dueAt: due,
      basis: "extension",
    });
  });
  it("allows release and reopening after a cancelled transport job", () => {
    const state = seedWardFlowState();
    const m = state.movements.find((m) => m.stage === "pulled")!;
    const job = state.movements.find((m) => m.transport)!.transport!;
    m.transport = { ...job, cancelledAt: NOW_ANCHOR };
    const next = wardFlowReducer(state, {
      type: "RELEASE_AND_REOPEN_SEARCH",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: m.id,
      actingUnitId: m.acceptedUnitId!,
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(next.rejections).toEqual([]);
    expect(next.movements.find((x) => x.id === m.id)).toMatchObject({
      stage: "placement_requested",
      referredUnitIds: [],
    });
  });
  it("refuses a claimed legal mismatch when the current placement has none", () => {
    const state = seedWardFlowState();
    const m = state.movements[0];
    m.legalStatus = "Voluntary";
    const u = state.units.find((u) => u.beds > u.lockedBeds)!;
    const next = wardFlowReducer(state, {
      type: "FLAG_LEGAL_MISMATCH",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: m.id,
      unitId: u.id,
      kind: "involuntary_on_voluntary_ward",
    });
    expect(next.movements).toBe(state.movements);
    expect(next.rejections).toHaveLength(1);
  });
});
