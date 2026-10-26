import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  usePathname: () => "/ward-flow/people/WF-009",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { useWardFlow, WardFlowProvider, WardFlowOverride } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { clock } from "@/components/ward-management/patients/patient-now-records";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

function ControlledCommands({
  children,
  control,
}: {
  children: ReactNode;
  control: { deferred?: boolean; refuse?: boolean; calls: WardFlowEvent[]; finish?: () => void };
}) {
  const flow = useWardFlow();
  const dispatch = (event: WardFlowEvent) => {
    if (event.type !== "BOOK_TRANSPORT" && event.type !== "RECORD_MOVEMENT_MEDICAL_CLEARANCE")
      return flow.dispatch(event);
    control.calls.push(event);
    const record = () => flow.dispatch(control.refuse ? { ...event, movementId: "WF-SYNTHETIC-MISSING" } : event);
    if (!control.deferred) return record();
    return new Promise<WardCommandOutcome>((resolve) => {
      control.finish = () => {
        void Promise.resolve(record()).then((outcome) => {
          if (outcome) resolve(outcome);
        });
      };
    });
  };
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

function answerBookingFacts(form: HTMLElement) {
  fireEvent.change(within(form).getByTestId("ward-patient-select-provider"), {
    target: { value: "Patient transport service" },
  });
  fireEvent.click(within(form).getByTestId("ward-patient-escort-no"));
}

/** A34: the one booking form takes a clock time; the +30m quick time fills it. Returns the time it filled. */
function pickEta(form: HTMLElement) {
  fireEvent.click(within(within(form).getByTestId("ward-patient-eta-presets")).getByRole("button", { name: "+30m" }));
  return (within(form).getByTestId("ward-patient-input-eta") as HTMLInputElement).value;
}

function pressSave(form: HTMLElement) {
  fireEvent.click(within(form).getByTestId("ward-patient-confirm-transport-btn"));
}

function RecordTransportFixture({ estimatedAt = NOW_ANCHOR + 30 }: { estimatedAt?: number }) {
  const { dispatch } = useWardFlow();
  return (
    <button
      onClick={() =>
        dispatch({
          type: "BOOK_TRANSPORT",
          role: "ed",
          now: NOW_ANCHOR,
          movementId: "WF-004",
          provider: "Ambulance service",
          escortRequired: false,
          cadNumber: "CAD-84920",
          transportLegalStatus: "involuntary",
          estimatedAt,
        })
      }
    >
      Record synthetic transport booking
    </button>
  );
}

// Device audit 11 Oct 2026 (owner pick A): transport dispatch and the arrival plan left the Now tab
// and open as the Transport sheet from the Transport row, so each case opens that sheet first.
function openTransportSheet() {
  fireEvent.click(screen.getByTestId("ward-patient-transport-row"));
}

describe("Patient Transport & Transfer Coordination section", () => {
  it("shows absence without placement or booking claims for a patient-only record", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId="PT-005" />
      </WardFlowProvider>,
    );
    const nowPanel = document.getElementById("pnpane-now")!;
    expect(nowPanel).toHaveTextContent("No linked movement is displayed.");
    expect(nowPanel).not.toHaveTextContent("Placement request active across network wards.");
    expect(screen.getByRole("heading", { name: "Record at a glance" })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-transport-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-book-transport-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-transport-form")).not.toBeInTheDocument();
  });

  it("hides an open booking form when navigating to a patient-only record", () => {
    const { rerender } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-004" />
      </WardFlowProvider>,
    );
    openTransportSheet();
    fireEvent.click(screen.getByTestId("ward-patient-book-transport-btn"));
    expect(screen.getByTestId("ward-patient-transport-form")).toBeInTheDocument();
    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId="PT-005" />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("heading", { name: "Record at a glance" })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-transport-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-transport-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-book-transport-btn")).not.toBeInTheDocument();
  });

  it("displays the recorded transport, CAD number, provider and quoted ETA for WF-004", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordTransportFixture />
        <PatientNowScreen initialExampleId="WF-004" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record synthetic transport booking" }));
    openTransportSheet();
    const section = screen.getByTestId("ward-patient-transport-section");
    expect(section).toBeInTheDocument();

    const badge = within(section).getByTestId("ward-patient-transport-badge");
    expect(badge).toHaveAttribute("data-booked", "true");
    expect(badge).toHaveTextContent(/transport booked/i);

    const cadNumber = within(section).getByTestId("ward-patient-cad-number");
    expect(cadNumber).toHaveTextContent("CAD-84920");

    const eta = within(section).getByTestId("ward-patient-transport-eta");
    expect(eta).toHaveTextContent(`${clock(NOW_ANCHOR + 30)} AWST`);

    const provider = within(section).getByTestId("ward-patient-transport-provider");
    expect(provider).toHaveTextContent("Ambulance service");
  });

  it("does not invent a booking for WF-004 when no transport is recorded", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen initialExampleId="WF-004" />
      </WardFlowProvider>,
    );
    openTransportSheet();
    const section = screen.getByTestId("ward-patient-transport-section");
    expect(within(section).getByTestId("ward-patient-transport-badge")).toHaveAttribute("data-booked", "false");
    expect(within(section).queryByTestId("ward-patient-cad-number")).not.toBeInTheDocument();
    expect(within(section).queryByTestId("ward-patient-transport-eta")).not.toBeInTheDocument();
  });

  it("displays only the live movement booking details", () => {
    const movement = wardMovements.find((item) => item.transport)!;
    expect(movement).toBeDefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId={movement.id} />
      </WardFlowProvider>,
    );

    openTransportSheet();
    const section = screen.getByTestId("ward-patient-transport-section");
    expect(section).toBeInTheDocument();

    const badge = within(section).getByTestId("ward-patient-transport-badge");
    expect(badge).toHaveAttribute("data-booked", "true");
    expect(badge).toHaveTextContent(/transport booked/i);

    const cadNumber = within(section).getByTestId("ward-patient-cad-number");
    expect(cadNumber).toHaveTextContent(movement.transport!.cadNumber ?? "Not recorded");

    const eta = within(section).getByTestId("ward-patient-transport-eta");
    expect(eta).toHaveTextContent(
      movement.transport!.estimatedAt !== undefined ? `${clock(movement.transport!.estimatedAt)} AWST` : "Not recorded",
    );

    const provider = within(section).getByTestId("ward-patient-transport-provider");
    expect(provider).toHaveTextContent(movement.transport!.provider);
  });

  it("explains the supported cancel and rebook path instead of offering an edit on an active job", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordTransportFixture />
        <PatientNowScreen initialExampleId="WF-004" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record synthetic transport booking" }));
    openTransportSheet();
    const section = screen.getByTestId("ward-patient-transport-section");
    expect(within(section).queryByRole("button", { name: "Update Booking Details" })).not.toBeInTheDocument();
    expect(within(section).queryByTestId("ward-patient-book-transport-btn")).not.toBeInTheDocument();
    expect(section).toHaveTextContent("Booking details cannot be edited");
    expect(section).toHaveTextContent("cancel the active job");
    expect(section).toHaveTextContent("Ask the flow coordinator or booking team");
    expect(within(section).getByTestId("ward-patient-cad-number")).toHaveTextContent("CAD-84920");
  });

  it("requires explicit provider and escort answers for a new booking", () => {
    const control = { calls: [] as WardFlowEvent[] };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ControlledCommands control={control}>
          <PatientNowScreen movementId="WF-004" />
        </ControlledCommands>
      </WardFlowProvider>,
    );
    openTransportSheet();
    fireEvent.click(screen.getByTestId("ward-patient-book-transport-btn"));
    const form = screen.getByTestId("ward-patient-transport-form");
    expect(within(form).getByTestId("ward-patient-select-provider")).toHaveValue("");
    expect(within(form).getByTestId("ward-patient-escort-yes")).not.toBeChecked();
    expect(within(form).getByTestId("ward-patient-escort-no")).not.toBeChecked();
    fireEvent.change(within(form).getByTestId("ward-patient-input-cad"), { target: { value: "CAD-SYNTHETIC-7" } });
    pickEta(form);
    pressSave(form);
    expect(within(form).getByTestId("ward-patient-book-transport-left")).toHaveTextContent(
      "2 answers left: provider, escort answer",
    );
    expect(control.calls).toHaveLength(0);
    fireEvent.change(within(form).getByTestId("ward-patient-select-provider"), {
      target: { value: "Patient transport service" },
    });
    pressSave(form);
    expect(control.calls).toHaveLength(0);
    fireEvent.click(within(form).getByTestId("ward-patient-escort-no"));
    pressSave(form);
    expect(control.calls).toEqual([
      expect.objectContaining({ provider: "Patient transport service", escortRequired: false }),
    ]);
    expect(screen.queryByTestId("ward-patient-transport-form")).not.toBeInTheDocument();
  });

  it.each([false, true])(
    "keeps the transport draft until the real deferred command completes (refused=%s)",
    async (refuse) => {
      const control = {
        calls: [] as WardFlowEvent[],
        deferred: true,
        refuse,
        finish: undefined as (() => void) | undefined,
      };
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <ControlledCommands control={control}>
            <PatientNowScreen movementId="WF-004" />
          </ControlledCommands>
        </WardFlowProvider>,
      );
      openTransportSheet();
      fireEvent.click(screen.getByTestId("ward-patient-book-transport-btn"));
      const form = screen.getByTestId("ward-patient-transport-form");
      answerBookingFacts(form);
      fireEvent.change(within(form).getByTestId("ward-patient-input-cad"), { target: { value: "CAD-SYNTHETIC-7" } });
      const eta = pickEta(form);
      pressSave(form);
      pressSave(form);
      expect(control.calls).toHaveLength(1);
      expect(form).toHaveAttribute("aria-busy", "true");
      expect(within(form).getByTestId("ward-patient-confirm-transport-btn")).toHaveAttribute("aria-disabled", "true");
      expect(within(screen.getByTestId("ward-patient-transport-section")).getByRole("status")).toHaveTextContent(
        "Saving transport booking",
      );
      await act(async () => {
        control.finish!();
      });
      if (refuse) {
        expect(form).toBeInTheDocument();
        expect(within(form).getByTestId("ward-patient-input-cad")).toHaveValue("CAD-SYNTHETIC-7");
        expect(within(form).getByTestId("ward-patient-input-eta")).toHaveValue(eta);
        expect(within(form).getByTestId("ward-patient-select-provider")).toHaveValue("Patient transport service");
        expect(within(form).getByTestId("ward-patient-escort-no")).toBeChecked();
        expect(screen.getByRole("alert")).toHaveTextContent("Booking was not recorded: no movement found");
        expect(within(form).getByTestId("ward-patient-confirm-transport-btn")).not.toHaveAttribute("aria-disabled");
      } else {
        expect(screen.queryByTestId("ward-patient-transport-form")).not.toBeInTheDocument();
        expect(screen.getByTestId("ward-patient-cad-number")).toHaveTextContent("CAD-SYNTHETIC-7");
      }
    },
  );

  it.each([false, true])(
    "keeps the clearance draft until the real deferred command completes (refused=%s)",
    async (refuse) => {
      const control = {
        calls: [] as WardFlowEvent[],
        deferred: true,
        refuse,
        finish: undefined as (() => void) | undefined,
      };
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <ControlledCommands control={control}>
            <PatientNowScreen movementId="WF-004" />
          </ControlledCommands>
        </WardFlowProvider>,
      );
      fireEvent.click(
        within(screen.getByTestId("ward-patient-gate-clearance")).getByRole("button", { name: /clearance/i }),
      );
      const dialog = screen.getByRole("dialog", { name: "Record treating-team medical clearance" });
      fireEvent.change(within(dialog).getByLabelText("Treating-team clearance outcome"), {
        target: { value: "cleared" },
      });
      fireEvent.click(within(dialog).getByRole("checkbox"));
      const save = within(dialog).getByRole("button", { name: "Save clearance outcome" });
      fireEvent.click(save);
      fireEvent.click(save);
      expect(control.calls).toHaveLength(1);
      expect(save).toHaveAttribute("aria-disabled", "true");
      expect(within(dialog).getByRole("status")).toHaveTextContent("Saving clearance outcome");
      await act(async () => {
        control.finish!();
      });
      if (refuse) {
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByLabelText("Treating-team clearance outcome")).toHaveValue("cleared");
        expect(within(dialog).getByRole("checkbox")).toBeChecked();
        expect(within(dialog).getByRole("alert")).toHaveTextContent("Clearance was not recorded");
        expect(save).not.toHaveAttribute("aria-disabled", "true");
      } else
        expect(
          screen.queryByRole("dialog", { name: "Record treating-team medical clearance" }),
        ).not.toBeInTheDocument();
    },
  );

  it("names the day on a quoted ETA that falls on another day", () => {
    // A bare clock face would read as today, and past midnight it showed an hour above 23.
    const tomorrow = NOW_ANCHOR + 1440 + 30;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordTransportFixture estimatedAt={tomorrow} />
        <PatientNowScreen initialExampleId="WF-004" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record synthetic transport booking" }));
    openTransportSheet();
    const eta = within(screen.getByTestId("ward-patient-transport-section")).getByTestId("ward-patient-transport-eta");
    expect(eta).toHaveTextContent(`${formatInstantWithDay(tomorrow, NOW_ANCHOR)} AWST`);
    expect(eta).toHaveTextContent(/ tomorrow AWST/);
  });

  it("does not offer a booking before a bed is accepted, so no booking can appear to succeed", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen initialExampleId="WF-009" />
      </WardFlowProvider>,
    );

    // Gate board: while a bed is still being found, transport says why. UX review 24 Oct 2026: Log
    // booking is greyed with its reason rather than repeating the Bed cell's Ask wards, and the
    // booking record is still not on Now at all.
    const gate = screen.getByTestId("ward-patient-gate-transport");
    expect(gate).toHaveTextContent("Not booked");
    expect(gate).toHaveTextContent("Needs an accepted bed");
    expect(within(gate).queryByRole("button", { name: /^Ask wards/ })).not.toBeInTheDocument();
    const logBooking = within(gate).getByRole("button", { name: "Log booking" });
    expect(logBooking).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(logBooking);
    expect(screen.queryByRole("dialog", { name: "Destination and placement" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-transport-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-transport-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-cad-number")).not.toBeInTheDocument();
  });
});
