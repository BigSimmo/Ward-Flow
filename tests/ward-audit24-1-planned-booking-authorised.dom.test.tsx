// tests/ward-audit24-1-planned-booking-authorised.dom.test.tsx
//
// Audit 24-1 CS2-19: the booking form asked for an override reason when the chosen ward was not
// authorised for the chosen legal status. D-189 items 8(a) and 9(a) (Josh, 13 Nov 2026): every
// ward's authorisation is "not stated" until Q42 is signed, so the form never asks and books at once.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { PLANNED_ADMISSION_REASONS } from "@/components/ward-management/ward-admissions";
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
  it("books an involuntary person on a flagged ward without asking for a reason", () => {
    renderPanel();
    openInvoluntaryBooking(UNAUTHORISED);
    expect(screen.queryByTestId("ward-planned-override-reason")).toBeNull();
    const submit = screen.getByTestId("ward-planned-submit");
    expect(submit).not.toHaveAttribute("aria-disabled");
    fireEvent.click(submit);
    expect(screen.getByTestId("ward-planned-PA-01")).toBeInTheDocument();
  });

  it("does not ask on any ward, for any legal status", () => {
    renderPanel();
    openInvoluntaryBooking("scgh-adult-open");
    expect(screen.queryByTestId("ward-planned-override-reason")).toBeNull();
    fireEvent.change(screen.getByTestId("ward-planned-unit"), { target: { value: UNAUTHORISED } });
    expect(screen.queryByTestId("ward-planned-override-reason")).toBeNull();
    fireEvent.change(screen.getByTestId("ward-planned-legal"), { target: { value: "Voluntary" } });
    expect(screen.queryByTestId("ward-planned-override-reason")).toBeNull();
  });
});
