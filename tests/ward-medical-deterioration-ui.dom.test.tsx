import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
afterEach(() => sessionStorage.clear());

const held = seedWardFlowState().movements.find(
  (m) => m.stage === "pulled" && m.transport === undefined && m.sourceAdmissionId === undefined,
)!;
function Probe() {
  const { movements, units, rejections, now, dispatch } = useWardFlow();
  return (
    <>
      <output data-testid="medical-state">
        {JSON.stringify({
          movement: movements.find((m) => m.id === held.id),
          unit: units.find((u) => u.id === held.acceptedUnitId),
          rejections,
        })}
      </output>
      <button onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 1 })}>
        Advance one synthetic minute
      </button>
    </>
  );
}
function openControls() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={held.originEdId} />
      <Probe />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId(`ward-ed-expand-${held.id}`));
  return screen.getByTestId(`ward-ed-medical-placement-${held.id}`);
}
function state() {
  return JSON.parse(screen.getByTestId("medical-state").textContent!);
}

describe("ED medical placement controls through the real provider", () => {
  it("requires confirmation, preserves cancellation, releases once and exposes the pause", () => {
    expect(held).toBeDefined();
    const controls = openControls();
    const before = state();
    fireEvent.click(within(controls).getByRole("button", { name: "Record medical deterioration" }));
    expect(state().movement.stage).toBe("pulled");
    fireEvent.click(within(controls).getByRole("button", { name: "Cancel" }));
    expect(state().unit.empty).toEqual(before.unit.empty);
    fireEvent.click(within(controls).getByRole("button", { name: "Record medical deterioration" }));
    fireEvent.click(within(controls).getByRole("button", { name: "Confirm deterioration and release reservation" }));
    const after = state();
    expect(after.movement.medicalDeterioration.resumedAt).toBeUndefined();
    expect(after.movement.acceptedUnitId).toBeUndefined();
    expect(after.unit.allocatable.value).toBe(before.unit.allocatable.value + 1);
    expect(after.unit.empty).toEqual(before.unit.empty);
    expect(within(controls).getByRole("status")).toHaveTextContent("Allocation cancelled; referral paused");
    expect(within(controls).queryByRole("button", { name: "Record medical deterioration" })).not.toBeInTheDocument();
  });

  it("reports premature re-clearance refusal and requires a new placement after fresh clearance", () => {
    const controls = openControls();
    fireEvent.click(within(controls).getByRole("button", { name: "Record medical deterioration" }));
    fireEvent.click(within(controls).getByRole("button", { name: "Confirm deterioration and release reservation" }));
    const clear = () => {
      fireEvent.click(within(controls).getByRole("button", { name: "Record medically cleared" }));
      fireEvent.click(within(controls).getByRole("button", { name: "Confirm medically cleared" }));
    };
    clear();
    expect(within(controls).getByRole("status")).toHaveTextContent("Re-clearance must be recorded after");
    expect(state().movement.medicalDeterioration.resumedAt).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Advance one synthetic minute" }));
    clear();
    expect(state().movement.medicalDeterioration.resumedAt).toBe(NOW_ANCHOR + 1);
    expect(state().movement.acceptedUnitId).toBeUndefined();
    expect(within(controls).getByRole("status")).toHaveTextContent("Recorded medically cleared");
    expect(screen.getByTestId(`ward-ed-medical-clearance-${held.id}`)).toHaveTextContent("Medical clearance: Yes");
  });
});
