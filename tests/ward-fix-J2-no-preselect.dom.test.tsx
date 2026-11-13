import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { patientNextStep } from "@/components/ward-management/patients/patient-now-ward";
import {
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { PatientWardChangeCard } from "@/components/ward-management/patients/patient-ward-change-card";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Audit 9, approved by Josh 13 Nov 2026 (Questions for Josh item 2: no clinical choice starts
 * selected, and item 3: the card's words match what the app does until Josh rules on order).
 * A9-15: Start leave opens with no kind and no return time chosen. A9-14 is guarded in
 * `ward-stable-beds.dom.test.tsx` (the discharge destination starts unchosen and the record waits).
 */
function renderLeave() {
  const onRecordLeave = vi.fn();
  render(
    <PatientWardChangeCard
      now={NOW_ANCHOR}
      dayZero={new Date(0)}
      form="leave"
      onFormChange={() => {}}
      onRecordLeave={onRecordLeave}
      onGoneToEd={() => {}}
      onSaveDischarge={() => {}}
      roleLimit={() => undefined}
    />,
  );
  return { card: screen.getByTestId("ward-patient-change-card"), onRecordLeave };
}

describe("A9-15: Start leave starts empty", () => {
  it("chooses no kind of leave and no time, and Record leave waits for both", () => {
    const { card, onRecordLeave } = renderLeave();
    const kinds = within(within(card).getByRole("group", { name: "Kind of leave" })).getAllByRole("button");
    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of kinds) expect(kind).toHaveAttribute("aria-pressed", "false");
    expect(within(card).getByLabelText("Expected back time")).toHaveValue("");
    const save = within(card).getByRole("button", { name: "Record leave" });
    expect(save).toBeDisabled();

    fireEvent.change(within(card).getByLabelText("Day"), { target: { value: "1" } });
    fireEvent.change(within(card).getByLabelText("Expected back time"), { target: { value: "09:30" } });
    // A time alone is not enough: the kind of leave is a clinical choice the nurse makes.
    expect(within(card).getByRole("button", { name: "Record leave" })).toBeDisabled();
    fireEvent.click(within(card).getByRole("button", { name: "Medical trip" }));
    fireEvent.click(within(card).getByRole("button", { name: "Record leave" }));
    expect(onRecordLeave).toHaveBeenCalledWith(expect.any(Number), "medical_trip", undefined);
  });

  it("does not say a return time was typed, since it may be chosen from a list", () => {
    const step = patientNextStep(
      "leave",
      {
        now: NOW_ANCHOR,
        dayZero: new Date(0),
        leaveBed: { expectedReturn: NOW_ANCHOR + 120 },
        onRecordReturn: () => {},
      } as unknown as PatientStatusContext,
      { voluntary: true },
    );
    expect(step?.detail).toMatch(/^Due back .+, recorded by the ward\.$/);
    expect(step?.detail).not.toContain("typed");
  });
});

describe("A9-09: the fit to travel card says only what the app does", () => {
  it("does not say clearance is needed before transport, which the app does not hold back", () => {
    const movement = { ...seedWardFlowState().movements[0], medicalClearance: undefined };
    const noop = () => {};
    const status = buildPatientStatus("find", {
      movement,
      hasBedHold: true,
      now: NOW_ANCHOR,
      dayZero: new Date(0),
      onOpenPlacement: noop,
      onClearance: noop,
      onBookTransport: noop,
    } as unknown as PatientStatusContext);
    const cell = status.cells.find((candidate) => candidate.key === "clearance")!;
    expect(cell.value).toBe("Not recorded");
    expect(cell.sub).toBe("Not yet stated by the treating team");
  });
});
