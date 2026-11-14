// D-226 (Josh, 14 Nov 2026): on the patient page's continuation action, a continuation-type form
// after a Form 3E shows the refusal and, for the coordinator, records only with a listed reason.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { MovementWorkflowActions } from "@/components/ward-management/movements/movement-workflow-actions";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { AFTER_3E_REFUSAL } from "@/components/ward-management/ward-legal-after-3e";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { typeDate } from "./helpers/type-date-time";

const NOW = NOW_ANCHOR;
const id = seedWardFlowState().movements.find((m) => !m.closure && !m.expectFlag)!.id;

function Workspace() {
  const { movements, dispatch, dayZero } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      now: NOW,
      movementId: id,
      formCode: "3A",
      writtenAt: NOW - 300,
    });
    dispatch({
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      now: NOW,
      movementId: id,
      formCode: "3E",
      writtenAt: NOW - 200,
    });
  }, [dispatch]);
  const current = movements.find((x) => x.id === id)!;
  const stamp = new Date(dayZero.getTime() + (NOW - 60) * 60_000 + 8 * 3_600_000).toISOString().slice(0, 16);
  return (
    <>
      <output data-testid="stamp">{stamp}</output>
      <output data-testid="form-code">{current.legalForm?.code ?? ""}</output>
      <MovementWorkflowActions movement={current} />
    </>
  );
}

describe("D-226: continuation after a Form 3E on the patient page", () => {
  it("shows the refusal, needs a listed reason, then records with it", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <Workspace />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("form-code")).toHaveTextContent("3E");
    fireEvent.change(screen.getByRole("combobox", { name: "Continuation form" }), { target: { value: "6C" } });
    expect(screen.getByText(AFTER_3E_REFUSAL, { exact: false })).toBeInTheDocument();
    typeDate(screen.getByLabelText("Form written date and time"), screen.getByTestId("stamp").textContent!);
    const record = screen.getByRole("button", { name: "Record legal form continuation" });
    expect(record).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Paper checked: new order made" }));
    expect(record).not.toHaveAttribute("aria-disabled");
    fireEvent.click(record);
    expect(screen.getByTestId("form-code")).toHaveTextContent("6C");
  });
});
