import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/PT-001",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-38 on the Patient page: On leave reads the stay's leave bed, Absent without leave its recorded
 * absence and steps, and On a CTO the patient record's order. Each is driven through the reducer.
 */
const seed = seedWardFlowState();
const legalStatusOf = (patientId: string | null) => seed.patients.find((p) => p.id === patientId)?.legalStatus;
const occupiedWith = (status: (legal: string | undefined) => boolean) =>
  seed.admissions.find(
    (a) =>
      a.state === "occupied" &&
      a.patientId &&
      a.awayAtEmergencyDepartmentSince == null &&
      !seed.leaveBeds.some((bed) => bed.admissionId === a.id) &&
      !seed.movements.some((m) => m.admissionId === a.id || (m.patientId === a.patientId && !m.closure)) &&
      status(legalStatusOf(a.patientId)),
  )!;
// A3-13: absent without leave is for a person on an order, so the main case is involuntary.
const occupied = occupiedWith((legal) => legal === "Involuntary inpatient");
const inBedPatientId = occupied.patientId!;
const voluntaryStay = occupiedWith((legal) => legal === "Voluntary");

/** Starts leave the way the ward board does, through the reducer. */
function LeaveProbe({ stay = occupied }: { stay?: typeof occupied }) {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "RECORD_LEAVE_BED",
          role: "ward",
          now: NOW_ANCHOR,
          unitId: stay.unitId,
          actingUnitId: stay.unitId,
          admissionId: stay.id,
          expectedReturn: NOW_ANCHOR + 180,
        })
      }
    >
      Start synthetic leave
    </button>
  );
}

function renderPatient(patientId: string, stay = occupied) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientNowScreen patientId={patientId} />
      <LeaveProbe stay={stay} />
    </WardFlowProvider>,
  );
  return screen.getByTestId("ward-person-screen");
}

describe("leave, absent without leave and CTO modes (D-38)", () => {
  it("shows On leave from the stay's leave bed, then starts the missing person steps from it", () => {
    const root = renderPatient(inBedPatientId);
    expect(root).toHaveAttribute("data-patient-mode", "ward");
    fireEvent.click(screen.getByRole("button", { name: "Start synthetic leave" }));
    expect(root).toHaveAttribute("data-patient-mode", "leave");
    expect(screen.getByTestId("ward-patient-mode-pill")).toHaveTextContent("On leave");
    expect(
      within(screen.getByTestId("ward-patient-gate-due-back")).getByRole("button", { name: "Record return" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: /^If not back by \d{2}:\d{2}$/ })).toBeVisible();

    fireEvent.click(within(screen.getByTestId("ward-patient-leave-card")).getByRole("button", { name: "Mark absent" }));
    expect(root).toHaveAttribute("data-patient-mode", "awol");
    expect(screen.getByTestId("ward-patient-status-verdict")).toHaveTextContent("Absent without leave");
    expect(screen.getByRole("img", { name: "0 of 6 steps done" })).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId("ward-patient-step-searched")).getByRole("button", {
        name: "Record Ward and grounds searched",
      }),
    );
    fireEvent.click(
      within(screen.getByTestId("ward-patient-step-police_notified")).getByRole("button", {
        name: "Record Police notified",
      }),
    );
    expect(screen.getByRole("img", { name: "2 of 6 steps done" })).toBeInTheDocument();
    expect(within(screen.getByTestId("ward-patient-step-searched")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("ward-patient-who-to-call")).getByText("Police")).toBeVisible();

    fireEvent.click(
      within(screen.getByTestId("ward-patient-last-seen")).getByRole("button", { name: "Record return" }),
    );
    expect(root).toHaveAttribute("data-patient-mode", "ward");
  });

  it("reads Not back from leave for a voluntary patient, with the same missing person steps (A3-13)", () => {
    const root = renderPatient(voluntaryStay.patientId!, voluntaryStay);
    fireEvent.click(screen.getByRole("button", { name: "Start synthetic leave" }));
    const leaveCard = screen.getByTestId("ward-patient-leave-card");
    expect(leaveCard).toHaveTextContent("Treat as not back from leave");
    expect(leaveCard).not.toHaveTextContent("absent without leave");
    fireEvent.click(within(leaveCard).getByRole("button", { name: "Mark absent" }));
    expect(root).toHaveAttribute("data-patient-mode", "awol");
    expect(screen.getByTestId("ward-patient-status-verdict")).toHaveTextContent("Not back from leave");
    expect(screen.getByTestId("ward-patient-mode-pill")).toHaveTextContent("Not back from leave");
    expect(screen.getByRole("img", { name: "0 of 5 steps done" })).toBeInTheDocument();
    // No return order is prompted for a person who is not on one.
    expect(screen.getByTestId("ward-patient-last-seen")).not.toHaveTextContent("Return order");
  });

  it("prompts the return order question for an involuntary patient (S-5)", () => {
    renderPatient(inBedPatientId);
    fireEvent.click(within(screen.getByTestId("ward-patient-gate-leave")).getByRole("button", { name: "Mark absent" }));
    expect(screen.getByTestId("ward-patient-last-seen")).toHaveTextContent("Return order");
  });

  it("marks absent straight from the ward, holding the bed", () => {
    const root = renderPatient(inBedPatientId);
    fireEvent.click(within(screen.getByTestId("ward-patient-gate-leave")).getByRole("button", { name: "Mark absent" }));
    expect(root).toHaveAttribute("data-patient-mode", "awol");
    expect(screen.getByTestId("ward-person-identity")).toHaveTextContent("Bed held");
  });

  it("records and ends a community treatment order on a record with nothing open", () => {
    const root = renderPatient("PT-005");
    expect(root).toHaveAttribute("data-patient-mode", "idle");
    // Not active still names the recorded GP under Who to call.
    expect(within(screen.getByTestId("ward-patient-who-to-call")).getByText("GP")).toBeVisible();
    fireEvent.click(within(screen.getByTestId("ward-patient-gate-legal")).getByRole("button", { name: "Record CTO" }));
    expect(root).toHaveAttribute("data-patient-mode", "cto");
    expect(screen.getByTestId("ward-patient-status-verdict")).toHaveTextContent("Not active, on a CTO");
    const cto = screen.getByTestId("ward-patient-gate-cto");
    expect(cto).toHaveTextContent("Form 5A in force");
    expect(cto).toHaveTextContent("No lapse time shown");
    expect(within(screen.getByTestId("ward-patient-legal-now")).getByText("Form 5A")).toBeVisible();
    fireEvent.click(within(cto).getByRole("button", { name: "Record ended" }));
    expect(root).toHaveAttribute("data-patient-mode", "idle");
  });
});
