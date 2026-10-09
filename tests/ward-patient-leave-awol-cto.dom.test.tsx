import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/PT-001",
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
const occupied = seed.admissions.find(
  (a) => a.state === "occupied" && a.patientId && !seed.leaveBeds.some((bed) => bed.admissionId === a.id),
)!;
const inBedPatientId = occupied.patientId!;

/** Starts leave the way the ward board does, through the reducer. */
function LeaveProbe() {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "RECORD_LEAVE_BED",
          role: "ward",
          now: NOW_ANCHOR,
          unitId: occupied.unitId,
          actingUnitId: occupied.unitId,
          admissionId: occupied.id,
          expectedReturn: NOW_ANCHOR + 180,
        })
      }
    >
      Start synthetic leave
    </button>
  );
}

function renderPatient(patientId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientNowScreen patientId={patientId} />
      <LeaveProbe />
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
    expect(screen.getByRole("img", { name: "0 of 5 steps done" })).toBeInTheDocument();

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
    expect(screen.getByRole("img", { name: "2 of 5 steps done" })).toBeInTheDocument();
    expect(within(screen.getByTestId("ward-patient-step-searched")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("ward-patient-who-to-call")).getByText("Police")).toBeVisible();

    fireEvent.click(
      within(screen.getByTestId("ward-patient-last-seen")).getByRole("button", { name: "Record return" }),
    );
    expect(root).toHaveAttribute("data-patient-mode", "ward");
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
