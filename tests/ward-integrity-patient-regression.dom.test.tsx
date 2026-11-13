import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/synthetic",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

function Episode({ second = false, calls }: { second?: boolean; calls: WardFlowEvent[] }) {
  const flow = useWardFlow();
  const person = flow.patients[0]!;
  const original = {
    ...flow.movements.find((m) => m.id === "WF-004")!,
    patientId: person.id,
    referralId: undefined,
    admissionId: undefined,
  };
  const replacement = { ...original, id: "WF-SYNTHETIC-B" as const, openedAt: NOW_ANCHOR + 1 };
  const movements = second
    ? [
        { ...original, closure: { at: NOW_ANCHOR, outcome: "did_not_proceed" as const, reason: "Synthetic closure" } },
        replacement,
      ]
    : [original];
  return (
    <WardFlowOverride
      value={{
        ...flow,
        movements,
        admissions: [],
        dispatch: (event) => {
          calls.push(event);
          return { commandId: "synthetic", status: "accepted" };
        },
      }}
    >
      <PatientNowScreen patientId={person.id} />
    </WardFlowOverride>
  );
}

function openClearance() {
  fireEvent.click(
    within(screen.getByTestId("ward-patient-gate-clearance")).getByRole("button", { name: /clearance/i }),
  );
  return screen.getByRole("dialog", { name: "Record treating-team medical clearance" });
}

describe("patient record save identity and confirmation", () => {
  it("invalidates clearance and attestation when the same patient's movement changes", () => {
    const calls: WardFlowEvent[] = [];
    const { rerender } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Episode calls={calls} />
      </WardFlowProvider>,
    );
    const dialog = openClearance();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Medical clearance provided" }));
    fireEvent.click(within(dialog).getByRole("checkbox"));
    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Episode calls={calls} second />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("dialog", { name: "Record treating-team medical clearance" })).toBeNull();
    const fresh = openClearance();
    expect(within(fresh).getByRole("checkbox")).not.toBeChecked();
    expect(within(fresh).getByRole("radio", { name: "Medical clearance provided" })).not.toBeChecked();
    fireEvent.click(within(fresh).getByRole("button", { name: "Save clearance outcome" }));
    expect(calls).toEqual([]);
  });

  it.each([
    { uncertain: false, leave: false },
    { uncertain: true, leave: false },
    { uncertain: false, leave: true },
    { uncertain: true, leave: true },
  ])("keeps a ward-change draft until confirmed (uncertain=$uncertain, leave=$leave)", async ({ uncertain, leave }) => {
    const inputLabel = leave ? "Expected back time" : "Expected discharge time";
    const saveLabel = leave ? "Record leave" : "Save date";
    const control: { calls: WardFlowEvent[]; finish?: (outcome: WardCommandOutcome) => void } = { calls: [] };
    function Stay() {
      const flow = useWardFlow();
      const person = flow.patients[0]!;
      const stay = {
        ...flow.admissions[0]!,
        patientId: person.id,
        state: "occupied" as const,
        unitId: flow.units[0]!.id,
        movementId: null,
        referralId: null,
      };
      return (
        <WardFlowOverride
          value={{
            ...flow,
            movements: [],
            admissions: [stay],
            dispatch: (event) => {
              control.calls.push(event);
              return new Promise<WardCommandOutcome>((resolve) => {
                control.finish = resolve;
              });
            },
          }}
        >
          <PatientNowScreen patientId={person.id} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Stay />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: leave ? "Start leave" : "Discharge date" }));
    // A9-15 (Josh, 13 Nov 2026): no kind of leave starts chosen.
    if (leave) fireEvent.click(screen.getByRole("button", { name: "Off-ward leave" }));
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { value: "23:59" } });
    fireEvent.click(screen.getByRole("button", { name: saveLabel }));
    expect(screen.getByLabelText(inputLabel)).toHaveValue("23:59");
    expect(screen.getByLabelText(inputLabel)).toBeDisabled();
    expect(screen.getByLabelText("Day")).toBeDisabled();
    fireEvent.change(screen.getByLabelText(inputLabel), { target: { value: "22:00" } });
    expect(screen.getByLabelText(inputLabel)).toHaveValue("23:59");
    fireEvent.click(screen.getByRole("button", { name: saveLabel }));
    expect(control.calls).toHaveLength(1);
    let confirm: ((outcome: WardCommandOutcome) => void) | undefined;
    const confirmation = uncertain
      ? new Promise<WardCommandOutcome>((resolve) => {
          confirm = resolve;
        })
      : undefined;
    await act(async () =>
      control.finish!({
        commandId: "synthetic-failed",
        status: "failed",
        message: "Synthetic interrupted save",
        ...(confirmation ? { confirmation } : {}),
      }),
    );
    expect(screen.getByLabelText(inputLabel)).toHaveValue("23:59");
    if (uncertain) {
      expect(screen.getByLabelText(inputLabel)).toBeDisabled();
      expect(screen.getAllByRole("alert").some((node) => node.textContent?.includes("Not recorded:"))).toBe(false);
    } else expect(screen.getByLabelText(inputLabel)).not.toBeDisabled();
    expect(screen.getAllByRole("alert").some((node) => node.textContent?.includes("Synthetic interrupted save"))).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: saveLabel }));
    if (uncertain) {
      expect(control.calls).toHaveLength(1);
      await act(async () => confirm!({ commandId: "synthetic-failed", status: "accepted" }));
    } else {
      expect(control.calls).toHaveLength(2);
      await act(async () => control.finish!({ commandId: "synthetic-accepted", status: "accepted" }));
    }
    expect(screen.queryByLabelText(inputLabel)).toBeNull();
  });

  it("keeps a pending leave save in charge when the status card's discharge date is pressed", async () => {
    const control: { calls: WardFlowEvent[]; finish?: (outcome: WardCommandOutcome) => void } = { calls: [] };
    function Stay() {
      const flow = useWardFlow();
      const person = flow.patients[0]!;
      const stay = {
        ...flow.admissions[0]!,
        patientId: person.id,
        state: "occupied" as const,
        unitId: flow.units[0]!.id,
        movementId: null,
        referralId: null,
      };
      return (
        <WardFlowOverride
          value={{
            ...flow,
            movements: [],
            admissions: [stay],
            dispatch: (event) => {
              control.calls.push(event);
              return new Promise<WardCommandOutcome>((resolve) => {
                control.finish = resolve;
              });
            },
          }}
        >
          <PatientNowScreen patientId={person.id} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Stay />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start leave" }));
    fireEvent.click(screen.getByRole("button", { name: "Off-ward leave" }));
    fireEvent.change(screen.getByLabelText("Expected back time"), { target: { value: "23:59" } });
    fireEvent.click(screen.getByRole("button", { name: "Record leave" }));
    expect(control.calls).toHaveLength(1);
    // PT1 round 3: the discharge date opens from the ward's action row or the Next step button.
    const dischargeControls = screen.queryAllByRole("button", { name: /^((Set|Change|Update) )?discharge date$/i });
    expect(dischargeControls.length).toBeGreaterThan(0);
    for (const control of dischargeControls) fireEvent.click(control);
    expect(screen.getByLabelText("Expected back time")).toHaveValue("23:59");
    expect(screen.queryByLabelText("Expected discharge time")).toBeNull();
    await act(async () => control.finish!({ commandId: "synthetic-accepted", status: "accepted" }));
    expect(screen.queryByLabelText("Expected back time")).toBeNull();
  });

  it("keeps the ward-change form open and locked while a Gone to ED save is pending", async () => {
    const control: { calls: WardFlowEvent[]; finish?: (outcome: WardCommandOutcome) => void } = { calls: [] };
    function Stay() {
      const flow = useWardFlow();
      const person = flow.patients[0]!;
      const stay = {
        ...flow.admissions[0]!,
        patientId: person.id,
        state: "occupied" as const,
        unitId: flow.units[0]!.id,
        movementId: null,
        referralId: null,
      };
      return (
        <WardFlowOverride
          value={{
            ...flow,
            movements: [],
            admissions: [stay],
            dispatch: (event) => {
              control.calls.push(event);
              return new Promise<WardCommandOutcome>((resolve) => {
                control.finish = resolve;
              });
            },
          }}
        >
          <PatientNowScreen patientId={person.id} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Stay />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start leave" }));
    fireEvent.change(screen.getByLabelText("Expected back time"), { target: { value: "23:59" } });
    fireEvent.click(screen.getByRole("button", { name: "Gone to ED" }));
    expect(control.calls.map((event) => event.type)).toEqual(["RECORD_AWAY_AT_EMERGENCY_DEPARTMENT"]);
    expect(screen.getByLabelText("Expected back time")).toHaveValue("23:59");
    expect(screen.getByLabelText("Expected back time")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Gone to ED" }));
    fireEvent.click(screen.getByRole("button", { name: "Record leave" }));
    expect(control.calls).toHaveLength(1);
    await act(async () =>
      control.finish!({ commandId: "synthetic-failed", status: "failed", message: "Synthetic interrupted save" }),
    );
    expect(screen.getByLabelText("Expected back time")).toHaveValue("23:59");
    expect(screen.getAllByRole("alert").some((node) => node.textContent?.includes("Synthetic interrupted save"))).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Gone to ED" }));
    expect(control.calls).toHaveLength(2);
    await act(async () => control.finish!({ commandId: "synthetic-accepted", status: "accepted" }));
    expect(screen.queryByLabelText("Expected back time")).toBeNull();
  });

  it("waits for a pending Record return from ED and says why it was not confirmed", async () => {
    const control: { calls: WardFlowEvent[]; finish?: (outcome: WardCommandOutcome) => void } = { calls: [] };
    function AtEd() {
      const flow = useWardFlow();
      const person = flow.patients[0]!;
      const stay = {
        ...flow.admissions[0]!,
        patientId: person.id,
        state: "occupied" as const,
        unitId: flow.units[0]!.id,
        movementId: null,
        referralId: null,
        awayAtEmergencyDepartmentSince: NOW_ANCHOR - 60,
      };
      return (
        <WardFlowOverride
          value={{
            ...flow,
            movements: [],
            admissions: [stay],
            dispatch: (event) => {
              control.calls.push(event);
              return new Promise<WardCommandOutcome>((resolve) => {
                control.finish = resolve;
              });
            },
          }}
        >
          <PatientNowScreen patientId={person.id} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AtEd />
      </WardFlowProvider>,
    );
    const returnCell = () => screen.getByTestId("ward-patient-gate-return");
    fireEvent.click(within(returnCell()).getByRole("button", { name: "Record return from ED" }));
    expect(control.calls.map((event) => event.type)).toEqual(["RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT"]);
    fireEvent.click(within(returnCell()).getByRole("button", { name: "Record return" }));
    expect(control.calls).toHaveLength(1);
    await act(async () =>
      control.finish!({ commandId: "synthetic-failed", status: "failed", message: "Synthetic interrupted save" }),
    );
    expect(returnCell()).toHaveTextContent("Synthetic interrupted save");
    fireEvent.click(within(returnCell()).getByRole("button", { name: "Record return from ED" }));
    expect(control.calls).toHaveLength(2);
  });
});
