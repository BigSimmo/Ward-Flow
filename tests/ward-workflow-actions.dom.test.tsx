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
    m.legalForm = { ...m.legalForm!, code: "1A", region: "country" };
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

describe("checked paper continuation paths", () => {
  it.each(["3A", "3C", "4A", "5A"])("refuses a country extension on Form %s without changing paper facts", (code) => {
    const state = seedWardFlowState();
    const m = state.movements.find((m) => !m.closure)!;
    m.legalForm = { code, region: "country", dueAt: NOW_ANCHOR + 10 };
    const next = wardFlowReducer(state, {
      type: "RECORD_COUNTRY_EXTENSION",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: m.id,
      paperExpiresAt: NOW_ANCHOR + 20,
    });
    expect(next.movements).toBe(state.movements);
    expect(next.rejections.at(-1)?.reason).toContain("current Form 1A");
  });
  it("requires recorded country context and retains it when recording paper facts", () => {
    let state = seedWardFlowState();
    const m = state.movements.find((m) => !m.closure)!;
    m.legalForm = { code: "1A", region: "metro", dueAt: NOW_ANCHOR + 10 };
    m.legalClock = undefined;
    expect(
      wardFlowReducer(state, {
        type: "RECORD_COUNTRY_EXTENSION",
        role: "coordinator",
        now: NOW_ANCHOR,
        movementId: m.id,
        paperExpiresAt: NOW_ANCHOR + 20,
      }).movements,
    ).toBe(state.movements);
    state = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: m.id,
      formCode: "1A",
      writtenAt: NOW_ANCHOR,
      region: "country",
      paperExpiresAt: NOW_ANCHOR + 10,
    });
    expect(state.movements.find((x) => x.id === m.id)?.legalForm?.region).toBe("country");
    const next = wardFlowReducer(state, {
      type: "RECORD_COUNTRY_EXTENSION",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: m.id,
      paperExpiresAt: NOW_ANCHOR + 20,
    });
    expect(next.rejections).toEqual([]);
    expect(next.auditEvents.at(-1)?.outcome).toBe("accepted");
  });
  it.each(["5B", "3A"])("audits an accepted %s continuation as accepted", (formCode) => {
    const state = seedWardFlowState();
    const m = state.movements.find((m) => !m.closure)!;
    m.legalForm = { code: "5A", dueAt: NOW_ANCHOR + 10 };
    const next = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: m.id,
      formCode,
      startedAt: NOW_ANCHOR,
      paperExpiresAt: NOW_ANCHOR + 20,
    });
    expect(next.rejections).toEqual([]);
    expect(next.auditEvents.at(-1)?.outcome).toBe("accepted");
  });
  it("offers 5B for the current 5A and records it through the real continuation control", () => {
    const state = seedWardFlowState();
    const m = state.movements.find((m) => !m.closure && !m.expectFlag)!;
    m.legalForm = { code: "5A" };
    function PaperWorkspace() {
      const { movements, dayZero, dispatch } = useWardFlow();
      const current = movements.find((x) => x.id === m.id)!;
      const d = new Date(dayZero.getTime() + NOW_ANCHOR * 60_000);
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return (
        <>
          <button
            onClick={() =>
              dispatch({
                type: "RECORD_LEGAL_FORM_WRITTEN",
                role: "coordinator",
                now: NOW_ANCHOR,
                movementId: m.id,
                formCode: "5A",
                writtenAt: NOW_ANCHOR,
              })
            }
          >
            Set current 5A
          </button>
          <output data-testid="paper-time">{stamp}</output>
          <output data-testid="continuation-code">{current.legalForm?.continuedBy?.code}</output>
          <MovementWorkflowActions movement={current} />
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PaperWorkspace />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set current 5A" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Continuation form" }), { target: { value: "5B" } });
    fireEvent.change(screen.getByLabelText("Form written date and time"), {
      target: { value: screen.getByTestId("paper-time").textContent },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record legal form continuation" }));
    expect(screen.getByTestId("continuation-code")).toHaveTextContent("5B");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
