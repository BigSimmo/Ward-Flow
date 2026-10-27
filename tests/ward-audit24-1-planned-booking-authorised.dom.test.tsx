// tests/ward-audit24-1-planned-booking-authorised.dom.test.tsx
//
// Audit 24-1 CS2-19: the booking form asks for an override reason, from the fixed list, when the
// chosen ward is not authorised for the chosen legal status, and books once one is picked.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { PLANNED_ADMISSION_REASONS } from "@/components/ward-management/ward-admissions";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const UNAUTHORISED = "sjgs-adult-open";

function renderPanel() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PlannedAdmissionsPanel now={NOW_ANCHOR} />
    </WardFlowProvider>,
  );
}

function openInvoluntaryBooking(unitId: string) {
  fireEvent.click(screen.getByTestId("ward-planned-book"));
  fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
  fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "cd" } });
  // The reason list opens blank (WT-13), so the first listed reason is chosen here.
  fireEvent.change(screen.getByTestId("ward-planned-reason"), { target: { value: PLANNED_ADMISSION_REASONS[0] } });
  fireEvent.change(screen.getByTestId("ward-planned-unit"), { target: { value: unitId } });
  fireEvent.change(screen.getByTestId("ward-planned-legal"), { target: { value: "Involuntary inpatient" } });
}

describe("Audit 24-1 CS2-19: booking form on a ward not authorised for the legal status", () => {
  it("asks for a listed override reason before booking, then books with it", () => {
    renderPanel();
    openInvoluntaryBooking(UNAUTHORISED);
    const select = screen.getByTestId("ward-planned-override-reason");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Choose reason", ...OVERRIDE_REASONS]);
    const submit = screen.getByTestId("ward-planned-submit");
    expect(submit).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(submit);
    expect(screen.queryByTestId("ward-planned-PA-01")).toBeNull();

    fireEvent.change(select, { target: { value: OVERRIDE_REASONS[0] } });
    expect(screen.getByTestId("ward-planned-submit")).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(screen.getByTestId("ward-planned-PA-01")).toBeInTheDocument();
  });

  it("does not ask on an authorised ward, or for a voluntary booking", () => {
    renderPanel();
    openInvoluntaryBooking("scgh-adult-open");
    expect(screen.queryByTestId("ward-planned-override-reason")).toBeNull();
    fireEvent.change(screen.getByTestId("ward-planned-unit"), { target: { value: UNAUTHORISED } });
    expect(screen.getByTestId("ward-planned-override-reason")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("ward-planned-legal"), { target: { value: "Voluntary" } });
    expect(screen.queryByTestId("ward-planned-override-reason")).toBeNull();
  });
});
