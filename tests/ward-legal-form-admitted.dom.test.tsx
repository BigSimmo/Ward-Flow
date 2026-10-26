import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Walk-through WT-03 (26 Oct 2026): after a person on a Form 1A arrived, the form dropped off Legal
 * forms and no one could record the inpatient order. Josh's yes (26 Oct): the person stays on Legal
 * forms and the ward records the next form from the paper. Synthetic seed journey WF-016, pulled on
 * a Form 1A.
 */
const MOVEMENT_ID = "WF-016";
const seeded = seedWardFlowState().movements.find((movement) => movement.id === MOVEMENT_ID);

function Arrive() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() => {
        dispatch({ type: "RECORD_TRANSPORT_NEED", role: "coordinator", now, movementId: MOVEMENT_ID, needed: false });
        dispatch({
          type: "PATIENT_ARRIVED",
          role: "coordinator",
          now,
          movementId: MOVEMENT_ID,
          actingUnitId: seeded!.acceptedUnitId!,
        });
      }}
    >
      drive arrival
    </button>
  );
}

function Probe() {
  const { movements, rejections } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === MOVEMENT_ID);
  return (
    <>
      <output data-testid="form">{`${movement?.closure?.outcome ?? "open"}|${movement?.legalForm?.code ?? ""}`}</output>
      <output data-testid="rejections">{rejections.map((entry) => entry.reason).join(" / ")}</output>
    </>
  );
}

afterEach(() => setDeskRole("coordinator"));

describe("a person admitted on a form stays on Legal forms (WT-03)", () => {
  it("fixture precondition: WF-016 is pulled on a Form 1A", () => {
    expect(seeded?.stage).toBe("pulled");
    expect(seeded?.legalForm?.code).toBe("1A");
    expect(seeded?.admissionId).toBeDefined();
  });

  it("lists the admitted person with the form still to record, and the ward records Form 6A", () => {
    setDeskRole("ward");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Arrive />
        <Probe />
        <LegalFormsScreen />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-legal-forms-admitted")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "drive arrival" }));
    expect(screen.getByTestId("rejections").textContent).toBe("");
    expect(screen.getByTestId("form")).toHaveTextContent("arrived|1A");

    const admitted = screen.getByTestId("ward-legal-forms-admitted");
    expect(within(admitted).getByText("Form 6A not recorded (Form 1A ended at arrival)")).toBeInTheDocument();
    fireEvent.click(within(admitted).getByRole("button", { name: /^Record a form for / }));

    const sheet = screen.getByTestId("ward-legal-record");
    fireEvent.change(within(sheet).getByLabelText("Form type"), { target: { value: "6A" } });
    expect(within(sheet).getByLabelText("Movement")).toHaveValue(MOVEMENT_ID);
    fireEvent.change(within(sheet).getByLabelText("Time on form"), { target: { value: "00:05" } });
    fireEvent.click(screen.getByTestId("ward-legal-forms-register-confirm"));

    expect(screen.getByTestId("rejections")).toHaveTextContent(/^$/u);
    expect(screen.getByTestId("form")).toHaveTextContent("arrived|6A");
    expect(within(screen.getByTestId("ward-legal-forms-admitted")).getByText("Form 6A recorded")).toBeInTheDocument();
  });
});
