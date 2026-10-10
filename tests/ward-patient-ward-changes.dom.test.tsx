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
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";

/**
 * The ward's changes from the Patient page (10 Oct 2026): start leave with a typed return time,
 * record them gone to ED (the At ED mode) and back, and set the expected discharge date. Past ward
 * stays are listed in History.
 */
const seed = seedWardFlowState();
const occupied = seed.admissions.find(
  (a) =>
    a.state === "occupied" &&
    a.patientId &&
    a.awayAtEmergencyDepartmentSince === null &&
    !seed.leaveBeds.some((bed) => bed.admissionId === a.id),
)!;
const startOfToday = Math.floor(NOW_ANCHOR / MINUTES_PER_DAY) * MINUTES_PER_DAY;

function StayProbe() {
  const { admissions, leaveBeds } = useWardFlow();
  const stay = admissions.find((a) => a.id === occupied.id);
  const bed = leaveBeds.find((b) => b.admissionId === occupied.id);
  return (
    <>
      <output data-testid="probe-discharge">{stay?.expectedDischargeAt ?? "none"}</output>
      <output data-testid="probe-leave">{bed ? `${bed.kind} ${bed.expectedReturn}` : "none"}</output>
    </>
  );
}

function renderPatient() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientNowScreen patientId={occupied.patientId!} />
      <StayProbe />
    </WardFlowProvider>,
  );
  return screen.getByTestId("ward-person-screen");
}

function changeCard() {
  return screen.getByTestId("ward-patient-change-card");
}

describe("ward changes from the Patient page", () => {
  it("starts leave with a typed return time on a later day, then records the return", () => {
    const root = renderPatient();
    expect(root).toHaveAttribute("data-patient-mode", "ward");
    fireEvent.click(within(changeCard()).getByRole("button", { name: "Start leave" }));
    fireEvent.click(within(changeCard()).getByRole("button", { name: "Medical trip" }));
    fireEvent.change(within(changeCard()).getByLabelText("Day"), { target: { value: "1" } });
    fireEvent.change(within(changeCard()).getByLabelText("Expected back time"), { target: { value: "09:30" } });
    fireEvent.click(within(changeCard()).getByRole("button", { name: "Record leave" }));

    expect(root).toHaveAttribute("data-patient-mode", "leave");
    expect(screen.getByTestId("probe-leave")).toHaveTextContent(
      `medical_trip ${startOfToday + MINUTES_PER_DAY + 9 * 60 + 30}`,
    );
    expect(screen.getByTestId("ward-patient-gate-due-back")).toHaveTextContent("09:30 tomorrow");
    fireEvent.click(
      within(screen.getByTestId("ward-patient-gate-due-back")).getByRole("button", { name: "Record return" }),
    );
    expect(root).toHaveAttribute("data-patient-mode", "ward");
  });

  it("will not take a time that has already passed", () => {
    renderPatient();
    fireEvent.click(within(changeCard()).getByRole("button", { name: "Start leave" }));
    fireEvent.change(within(changeCard()).getByLabelText("Expected back time"), { target: { value: "00:05" } });
    expect(within(changeCard()).getByText("That time has already passed")).toBeVisible();
    expect(within(changeCard()).getByRole("button", { name: "Record leave" })).toBeDisabled();
    expect(screen.getByTestId("probe-leave")).toHaveTextContent("none");
  });

  it("records them gone to ED with the bed kept, then back on the ward", () => {
    const root = renderPatient();
    fireEvent.click(within(changeCard()).getByRole("button", { name: "Gone to ED" }));
    expect(root).toHaveAttribute("data-patient-mode", "ed");
    expect(screen.getByTestId("ward-patient-mode-pill")).toHaveTextContent("At ED");
    expect(screen.getByTestId("ward-patient-status-verdict")).toHaveTextContent("At ED, bed kept");
    // Leave cannot be started from ED: the change card is only offered on the ward.
    expect(screen.queryByTestId("ward-patient-change-card")).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByTestId("ward-patient-gate-return")).getByRole("button", { name: "Record return from ED" }),
    );
    expect(root).toHaveAttribute("data-patient-mode", "ward");
  });

  it("sets an expected discharge date more than a week out from the status card", () => {
    renderPatient();
    const discharge = screen.getByTestId("ward-patient-gate-discharge");
    fireEvent.click(within(discharge).getByRole("button", { name: /discharge date$/ }));
    fireEvent.change(within(changeCard()).getByLabelText("Day"), { target: { value: "9" } });
    fireEvent.change(within(changeCard()).getByLabelText("Expected discharge time"), { target: { value: "11:00" } });
    fireEvent.click(within(changeCard()).getByRole("button", { name: "Save date" }));
    expect(screen.getByTestId("probe-discharge")).toHaveTextContent(
      String(startOfToday + 9 * MINUTES_PER_DAY + 11 * 60),
    );
  });

  it("lists the current ward stay in History", () => {
    renderPatient();
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    const stays = screen.getByTestId("ward-patient-ward-stays");
    expect(within(stays).getByText("Current")).toBeVisible();
    expect(within(stays).getByText(seed.units.find((u) => u.id === occupied.unitId)!.name)).toBeVisible();
  });
});
