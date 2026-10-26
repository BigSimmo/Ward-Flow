import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/movements/WF-011",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { clock } from "@/components/ward-management/patients/patient-now-records";
import {
  buildPatientStatus,
  PatientStatusCard,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Audit fixes, 13 Oct 2026 (transport group): the booking form, the officer's Collected, Handover. */

const realMatchMedia = window.matchMedia;
function asPhone() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width") && !query.includes("min-width"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
});

function openBooking() {
  fireEvent.click(screen.getByTestId("ward-patient-transport-row"));
  fireEvent.click(screen.getByTestId("ward-patient-book-transport-btn"));
  return screen.getByTestId("ward-patient-transport-form");
}

function Booked({ id }: { id: string }) {
  const { movements } = useWardFlow();
  const job = movements.find((movement) => movement.id === id)?.transport;
  return <output data-testid="booked-job">{job ? JSON.stringify(job) : "none"}</output>;
}

describe("Log booking (A4-7, A4-6, A4-2, A4-5)", () => {
  it("takes the transport status from Legal now, warns a late ETA, and says why an empty ETA is not saved", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-011" />
        <Booked id="WF-011" />
      </WardFlowProvider>,
    );
    const form = openBooking();
    fireEvent.change(within(form).getByTestId("ward-patient-select-provider"), {
      target: { value: "Ambulance service" },
    });
    fireEvent.click(within(form).getByTestId("ward-patient-escort-no"));
    // A4-7 (A34 form): filled in from the form in force (Form 4C), and the other answer stays open.
    expect(within(form).getByTestId("ward-patient-legal-involuntary")).toBeChecked();
    expect(within(form).getByTestId("ward-patient-legal-voluntary")).not.toBeChecked();
    expect(form).toHaveTextContent("Legal now: Involuntary inpatient, Form 4C. Filled in from Legal now.");

    // A4-6: Save with no ETA says what is left and records nothing.
    fireEvent.change(within(form).getByTestId("ward-patient-input-cad"), { target: { value: "CAD-SYN-7" } });
    fireEvent.click(within(form).getByTestId("ward-patient-confirm-transport-btn"));
    expect(within(form).getByTestId("ward-patient-book-transport-left")).toHaveTextContent(
      "1 answer left: estimated time",
    );
    expect(within(form).getByTestId("ward-patient-confirm-transport-btn")).toHaveAttribute(
      "title",
      expect.stringMatching(/enter the estimated time/),
    );
    expect(screen.getByTestId("booked-job")).toHaveTextContent("none");

    // A4-2: an ETA after the hold ends is warned at once, with the hold end.
    fireEvent.change(within(form).getByTestId("ward-patient-input-eta"), {
      target: { value: clock(NOW_ANCHOR + 120) },
    });
    expect(within(form).getByTestId("ward-patient-eta-after-hold")).toHaveTextContent(
      /Arrives after the pull time limit ends at \d\d:\d\d\. Extend the pull or rebook\./,
    );

    // A4-5: Save is the shared primary button, so it carries its own colours in the sheet.
    expect(within(form).getByTestId("ward-patient-confirm-transport-btn").className).toMatch(/pri/);

    fireEvent.click(within(form).getByTestId("ward-patient-confirm-transport-btn"));
    const job = JSON.parse(screen.getByTestId("booked-job").textContent!);
    expect(job.transportLegalStatus).toBe("involuntary");
    expect(job.exceptions).toBeUndefined();
  });

  it("asks for a reason when the status is changed away from Legal now, and records it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-011" />
        <Booked id="WF-011" />
      </WardFlowProvider>,
    );
    const form = openBooking();
    fireEvent.change(within(form).getByTestId("ward-patient-select-provider"), {
      target: { value: "Ambulance service" },
    });
    fireEvent.click(within(form).getByTestId("ward-patient-escort-no"));
    fireEvent.change(within(form).getByTestId("ward-patient-input-cad"), { target: { value: "CAD-SYN-8" } });
    fireEvent.click(within(within(form).getByTestId("ward-patient-eta-presets")).getByRole("button", { name: "+30m" }));
    fireEvent.click(within(form).getByTestId("ward-patient-legal-voluntary"));
    expect(form).toHaveTextContent("Differs from Legal now (Involuntary inpatient, Form 4C). Record why.");
    fireEvent.click(within(form).getByTestId("ward-patient-confirm-transport-btn"));
    expect(within(form).getByTestId("ward-patient-book-transport-needs")).toHaveTextContent(
      "Needs the reason it differs",
    );
    expect(screen.getByTestId("booked-job")).toHaveTextContent("none");

    fireEvent.change(within(form).getByTestId("ward-patient-legal-reason"), {
      target: { value: "treating_team_confirmed" },
    });
    fireEvent.click(within(form).getByTestId("ward-patient-confirm-transport-btn"));
    const job = JSON.parse(screen.getByTestId("booked-job").textContent!);
    expect(job.transportLegalStatus).toBe("voluntary");
    expect(job.exceptions[0]).toMatchObject({ gaps: ["legal_status_differs"], reason: "treating_team_confirmed" });
    expect(screen.getByTestId("ward-patient-transport-legal-clash")).toHaveTextContent(
      "Involuntary inpatient, Form 4C, differs from the booking",
    );
  });
});

describe("Mark handover ready once 3 of 3 are clear (A4-9)", () => {
  const ready = {
    id: "WF-X",
    stage: "pulled",
    pullExpiresAt: NOW_ANCHOR + 30,
    medicalClearance: { cleared: true, at: NOW_ANCHOR - 5 },
    transport: { id: "t", provider: "Ambulance service", escortRequired: false, cadNumber: "CAD-1" },
  } as unknown as Movement;
  const onHandoverReady = vi.fn();
  const context = {
    movement: ready,
    acceptedUnitName: "Synthetic ward",
    hasBedHold: true,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    onOpenPlacement: () => undefined,
    onClearance: () => undefined,
    onBookTransport: () => undefined,
    onArrivalTime: () => undefined,
    onRecordReturn: () => undefined,
    onMarkAbsent: () => undefined,
    onAbsenceStep: () => undefined,
    onRecordCto: () => undefined,
    onEndCto: () => undefined,
    onHandoverReady,
  } satisfies PatientStatusContext;

  it("offers the next step only when every gate is clear, greyed with a reason for a role that cannot", () => {
    const status = buildPatientStatus("held", context);
    expect(status.verdict).toBe("Ready to move");
    expect(status.next).toMatchObject({ kind: "button", label: "Mark handover ready" });
    expect(
      buildPatientStatus("held", { ...context, movement: { ...ready, medicalClearance: undefined } }).next,
    ).toBeUndefined();
    expect(buildPatientStatus("held", { ...context, roleLimit: () => "ED only" }).next).toEqual({
      kind: "unavailable",
      label: "Mark handover ready",
      reason: "ED only",
    });
  });

  it("pins it as the phone's one primary", () => {
    asPhone();
    render(<PatientStatusCard mode="held" context={context} />);
    const bar = screen.getByTestId("ward-patient-phone-action-bar");
    fireEvent.click(within(bar).getByRole("button", { name: "Mark handover ready" }));
    expect(onHandoverReady).toHaveBeenCalledTimes(1);
  });
});

describe("Officer Collected with an open check (A4-11, S-2) and Need forms (A4-12)", () => {
  it("warns, records the reason, and still collects", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );
    const select = screen.queryByTestId("ward-officer-select-WF-005");
    if (select) fireEvent.click(select);
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-officer-enroute-WF-005"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-officer-collect-WF-005"));
    });
    const check = screen.getByTestId("ward-officer-collect-check");
    expect(check).toHaveTextContent("Fit to travel not recorded");
    // Nothing is recorded until a reason is chosen; Cancel leaves the job as it was.
    fireEvent.change(screen.getByTestId("ward-officer-collect-check-reason"), { target: { value: "paper_sighted" } });
    await act(async () => {
      fireEvent.click(within(check).getByRole("button", { name: "Collected, record reason" }));
    });
    expect(screen.queryByTestId("ward-officer-collect-check")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-officer-exception-WF-005")).toHaveTextContent("Paper copy sighted");
    expect(screen.getByTestId("ward-officer-stepper-WF-005")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/^Transport stage: Collected/),
    );
  });
});

describe("Handover (A4-28, A4-26, S-31)", () => {
  it("shows the UMRN on every phone row", () => {
    asPhone();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );
    const rows = screen.getAllByTestId("ward-handover-phone-row");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toHaveTextContent(/UM\d+|UMRN/);
  });

  it("never says every feed is current while a ward's counts are stale, and signs off with one short toast", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR + 6 * 60}>
          <HandoverPage />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const checks = screen.getByTestId("ward-handover-sign-off-checks");
    expect(checks).not.toHaveTextContent("Every ward feed is current");
    expect(checks).toHaveTextContent(/counts are stale|wards with stale counts/);
    fireEvent.click(screen.getByTestId("ward-handover-sign-off-button"));
    expect(screen.getAllByText("Handover signed off.")).toHaveLength(1);
  });
});
