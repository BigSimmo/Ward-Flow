import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/PT-001",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
import { PatientDetailsTab } from "@/components/ward-management/patients/patient-details-tab";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isEdOriginJourney } from "@/components/ward-management/ward-ed-presence";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";
import { WardArrivalsCorridor } from "@/components/ward-management/ward/ward-arrivals-corridor";

/**
 * D-187 (Josh, 13 Nov 2026): item 1 (two legal statuses named plainly, with a warning when they
 * differ), item 4's corridor half (the word "involuntary" only from the recorded status) and item
 * 16's absent Undo message. Synthetic seed data only.
 */
const seed = seedWardFlowState();

describe("D-187 item 1 (Q19): both legal statuses, named plainly, with a warning when they differ", () => {
  const edStay = seed.movements.find((movement) => isOpen(movement) && isEdOriginJourney(movement));
  if (!edStay) throw new Error("the seed no longer carries an open ED-origin movement");
  const patient: Patient = {
    ...seed.patients[0]!,
    sex: edStay.sex,
    gender: edStay.gender,
    legalStatus: edStay.legalStatus,
  };
  const pane = (movement: Movement, who: Patient) => {
    render(<PatientDetailsTab patient={who} movement={movement} displayName="Synthetic Person" />);
    return within(screen.getByRole("region", { name: "Patient details" }));
  };

  it("names the two 'This ED stay' and 'Patient record' and warns that they differ", () => {
    const other = edStay.legalStatus === "Voluntary" ? "Involuntary inpatient" : "Voluntary";
    const view = pane(edStay, { ...patient, legalStatus: other });
    expect(view.getByText("This ED stay")).toBeInTheDocument();
    expect(view.getByText("Patient record")).toBeInTheDocument();
    expect(view.getByText(edStay.legalStatus)).toBeInTheDocument();
    expect(view.getByText(other)).toBeInTheDocument();
    expect(view.getByTestId("ward-person-legal-differs")).toHaveTextContent(
      "These two legal statuses differ. Check which is current.",
    );
  });

  it("shows one legal status and no warning when they agree", () => {
    const view = pane(edStay, patient);
    expect(view.getByText("Legal status")).toBeInTheDocument();
    expect(view.queryByText("This ED stay")).not.toBeInTheDocument();
    expect(view.queryByTestId("ward-person-legal-differs")).not.toBeInTheDocument();
  });

  it("calls a move that did not start in an ED 'This move', never an ED stay", () => {
    const wardMove: Movement = { ...edStay, originEdId: undefined };
    const other = edStay.legalStatus === "Voluntary" ? "Involuntary inpatient" : "Voluntary";
    const view = pane(wardMove, { ...patient, legalStatus: other });
    expect(view.getByText("This move")).toBeInTheDocument();
    expect(view.queryByText("This ED stay")).not.toBeInTheDocument();
    expect(view.getByTestId("ward-person-legal-differs")).toBeInTheDocument();
  });
});

describe("D-187 item 4 (Q25): the arrivals corridor never reads 'involuntary' from a form", () => {
  const withForm = wardMovements.find((movement) => movement.legalForm !== undefined);
  if (!withForm) throw new Error("the ward movements no longer carry one with a legal form");

  function card(overrides: Partial<Movement>) {
    const movement = { ...withForm!, ...overrides };
    render(
      <WardArrivalsCorridor
        unit={allUnits()[0]!}
        accepted={[movement]}
        now={NOW_ANCHOR}
        resolvePatientIdentity={() => ({ displayName: "Synthetic Person" }) as ResolvedPatientInfo}
        releaseOpenFor={undefined}
        toggleRelease={() => undefined}
        releaseReason={undefined}
        setReleaseReason={() => undefined}
        submitRelease={() => undefined}
        lastActionRejection={undefined}
        dispatch={() => undefined}
        setCheckToken={() => undefined}
        priorRejectionCountRef={createRef<number>() as React.MutableRefObject<number>}
        rejections={[]}
        overrideReasonForm={() => null}
      />,
    );
    return screen.getByTestId(`ward-accepted-${movement.id}`);
  }

  it("a Voluntary person with a form on file shows the form and 'Voluntary'", () => {
    const shown = card({ legalStatus: "Voluntary" });
    expect(shown).toHaveTextContent(`Form ${withForm.legalForm!.code}, Voluntary`);
    expect(shown).not.toHaveTextContent(/involuntary/iu);
  });

  it("a referred person with a form reads as referred, not involuntary", () => {
    const shown = card({ legalStatus: "Referred for psychiatric examination" });
    expect(shown).toHaveTextContent(`Form ${withForm.legalForm!.code}, Referred for psychiatric examination`);
    expect(shown).not.toHaveTextContent(/involuntary/iu);
  });

  it("an involuntary inpatient reads as recorded", () => {
    expect(card({ legalStatus: "Involuntary inpatient" })).toHaveTextContent(
      `Form ${withForm.legalForm!.code}, Involuntary inpatient`,
    );
  });
});

describe("D-187 item 16 (Q38): the Mark absent Undo says what it restores", () => {
  const legalStatusOf = (patientId: string | null) => seed.patients.find((p) => p.id === patientId)?.legalStatus;
  const stay = seed.admissions.find(
    (a) =>
      a.state === "occupied" &&
      a.patientId &&
      a.awayAtEmergencyDepartmentSince == null &&
      !seed.leaveBeds.some((bed) => bed.admissionId === a.id) &&
      !seed.movements.some((m) => m.admissionId === a.id || (m.patientId === a.patientId && !m.closure)) &&
      legalStatusOf(a.patientId) === "Involuntary inpatient",
  )!;

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

  function renderPatient() {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientNowScreen patientId={stay.patientId!} />
          <LeaveProbe />
        </WardFlowProvider>
      </ToastProvider>,
    );
    return screen.getByTestId("ward-person-screen");
  }

  it("marked absent from the ward: Undo says 'Back on the ward'", async () => {
    const root = renderPatient();
    fireEvent.click(
      within(screen.getByTestId("ward-patient-change-card")).getByRole("button", { name: "Mark absent" }),
    );
    expect(root).toHaveAttribute("data-patient-mode", "awol");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    });
    expect(root).toHaveAttribute("data-patient-mode", "ward");
    expect(await screen.findByText("Undone. Back on the ward.")).toBeInTheDocument();
    expect(screen.queryByText("Undone. Back on leave.")).not.toBeInTheDocument();
  });

  it("marked absent from leave: Undo still says 'Back on leave'", async () => {
    const root = renderPatient();
    fireEvent.click(screen.getByRole("button", { name: "Start synthetic leave" }));
    fireEvent.click(within(screen.getByTestId("ward-patient-leave-card")).getByRole("button", { name: "Mark absent" }));
    expect(root).toHaveAttribute("data-patient-mode", "awol");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    });
    expect(root).toHaveAttribute("data-patient-mode", "leave");
    expect(await screen.findByText("Undone. Back on leave.")).toBeInTheDocument();
  });
});
