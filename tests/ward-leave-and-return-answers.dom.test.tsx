import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/PT-001",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { PatientWardChangeCard } from "@/components/ward-management/patients/patient-ward-change-card";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOnOrder } from "@/components/ward-management/ward-stay-legal";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * Josh, 27 Oct 2026. #101: the leave sheet's authority tick reaches the leave event. #177: an
 * involuntary return's Form 4C and escort answers reach the saved return, and leaving them blank is
 * a warning, never a block. Synthetic seed only.
 */
describe("#101 Start leave carries the authority tick", () => {
  function renderCard(onOrder: boolean) {
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
        leaveLegal={{ form: onOrder ? "Form 6A" : "Voluntary", onOrder }}
      />,
    );
    const card = screen.getByTestId("ward-patient-change-card");
    fireEvent.change(within(card).getByLabelText("Day"), { target: { value: "1" } });
    fireEvent.change(within(card).getByLabelText("Expected back time"), { target: { value: "09:30" } });
    return { card, onRecordLeave };
  }
  const tomorrowAt930 = Math.floor(NOW_ANCHOR / MINUTES_PER_DAY) * MINUTES_PER_DAY + MINUTES_PER_DAY + 9 * 60 + 30;

  it("sends the tick when it is ticked", () => {
    const { card, onRecordLeave } = renderCard(true);
    fireEvent.click(screen.getByTestId("ward-patient-leave-authorised"));
    expect(screen.queryByTestId("ward-patient-leave-authorised-warning")).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Record leave" }));
    expect(onRecordLeave).toHaveBeenCalledWith(tomorrowAt930, "off_ward", true);
  });

  it("still records the leave when left unticked, sending false with the warning shown", () => {
    const { card, onRecordLeave } = renderCard(true);
    expect(screen.getByTestId("ward-patient-leave-authorised-warning")).toBeVisible();
    fireEvent.click(within(card).getByRole("button", { name: "Record leave" }));
    expect(onRecordLeave).toHaveBeenCalledWith(tomorrowAt930, "off_ward", false);
  });

  it("sends no answer when the person is not on an order and the question is not asked", () => {
    const { card, onRecordLeave } = renderCard(false);
    expect(screen.queryByTestId("ward-patient-leave-authorised")).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Record leave" }));
    expect(onRecordLeave).toHaveBeenCalledWith(tomorrowAt930, "off_ward", undefined);
  });
});

describe("#101 the Patient page saves the tick on the leave", () => {
  const seed = seedWardFlowState();
  // A synthetic seeded stay on an order, in a bed, not away and not already on leave.
  const onOrder = seed.admissions.find((a) => {
    if (a.state !== "occupied" || !a.patientId || a.awayAtEmergencyDepartmentSince !== null) return false;
    if (seed.leaveBeds.some((bed) => bed.admissionId === a.id)) return false;
    const movement = seed.movements.find((m) => m.patientId === a.patientId && m.closure === undefined);
    const patient = seed.patients.find((p) => p.id === a.patientId);
    return isOnOrder(movement?.legalStatus ?? patient?.legalStatus);
  })!;

  function Probe() {
    const { leaveBeds } = useWardFlow();
    const bed = leaveBeds.find((b) => b.admissionId === onOrder.id);
    return <output data-testid="probe-authorised">{bed ? String(bed.psychiatristAuthorised) : "none"}</output>;
  }

  it("records the leave with the ticked answer", () => {
    expect(onOrder).toBeDefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId={onOrder.patientId!} />
        <Probe />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("ward-patient-change-card");
    fireEvent.click(within(card).getByRole("button", { name: "Start leave" }));
    fireEvent.click(within(card).getByTestId("ward-patient-leave-authorised"));
    fireEvent.change(within(card).getByLabelText("Day"), { target: { value: "1" } });
    fireEvent.change(within(card).getByLabelText("Expected back time"), { target: { value: "09:30" } });
    fireEvent.click(within(card).getByRole("button", { name: "Record leave" }));
    expect(screen.getByTestId("probe-authorised")).toHaveTextContent("true");
  });
});

describe("#177 an involuntary return saves its Form 4C and escort answers", () => {
  const first = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR).entries[0]!;

  function fillInvoluntaryPlan() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OutOfAreaBoard admissions={wardAdmissions} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-home-hospital"), { target: { value: "RPH" } });
    fireEvent.click(within(screen.getByTestId("ward-out-of-area-repat-mode")).getByLabelText("Road"));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-provider"), {
      target: { value: "Ambulance (St John)" },
    });
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-cad"), { target: { value: "CAD-7788" } });
    fireEvent.click(within(screen.getByTestId("ward-out-of-area-repat-legal")).getByLabelText("Involuntary"));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-estimated-time"), { target: { value: "14:30" } });
  }

  it("opens both questions blank with a warning, and sends the plan anyway", () => {
    fillInvoluntaryPlan();
    for (const testId of ["ward-out-of-area-repat-form-4c", "ward-out-of-area-repat-escort"])
      for (const radio of within(screen.getByTestId(testId)).getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(screen.getByTestId("ward-out-of-area-repat-involuntary-warning")).toHaveTextContent(
      "Form 4C not confirmed and escort not answered",
    );
    const send = screen.getByTestId("ward-out-of-area-repat-send");
    expect(send).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(send);
    expect(screen.getByTestId("ward-out-of-area-recorded-form-4c")).toHaveTextContent("Not answered");
    expect(screen.getByTestId("ward-out-of-area-recorded-escort")).toHaveTextContent("Not answered");
  });

  it("saves the answers on the return and keeps them through the ward's agreement", () => {
    fillInvoluntaryPlan();
    fireEvent.click(within(screen.getByTestId("ward-out-of-area-repat-form-4c")).getByLabelText("Yes"));
    fireEvent.click(within(screen.getByTestId("ward-out-of-area-repat-escort")).getByLabelText("Escort required"));
    expect(screen.queryByTestId("ward-out-of-area-repat-involuntary-warning")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-out-of-area-repat-send"));

    expect(screen.getByTestId("ward-out-of-area-recorded-form-4c")).toHaveTextContent("Received");
    expect(screen.getByTestId("ward-out-of-area-recorded-escort")).toHaveTextContent("Escort required");
    fireEvent.click(screen.getByTestId("ward-out-of-area-mark-ward-agreed"));
    expect(screen.getByTestId("ward-out-of-area-recorded")).toHaveTextContent("Movement opened");
    expect(screen.getByTestId("ward-out-of-area-recorded-form-4c")).toHaveTextContent("Received");
    expect(screen.getByTestId("ward-out-of-area-recorded-escort")).toHaveTextContent("Escort required");
  });
});
