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
  usePathname: () => "/mockups/ward-flow/people/WF-009",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { clock } from "@/components/ward-management/patients/patient-now-records";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function RecordTransportFixture() {
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
          estimatedAt: NOW_ANCHOR + 30,
        })
      }
    >
      Record synthetic transport booking
    </button>
  );
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

  it("does not display a successful booking when the reducer refuses the movement", () => {
    // Restored after #147 dropped it: a second booking over a standing job is refused by the
    // reducer (cancel first), so the page must say so and keep showing the first booking.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordTransportFixture />
        <PatientNowScreen initialExampleId="WF-004" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record synthetic transport booking" }));
    const section = screen.getByTestId("ward-patient-transport-section");
    fireEvent.click(within(section).getByTestId("ward-patient-book-transport-btn"));
    const form = within(section).getByTestId("ward-patient-transport-form");
    fireEvent.change(within(form).getByTestId("ward-patient-input-cad"), { target: { value: "CAD-99210" } });
    fireEvent.change(within(form).getByTestId("ward-patient-input-eta"), {
      target: { value: `${clock(NOW_ANCHOR + 60)} AWST` },
    });
    fireEvent.click(within(form).getByTestId("ward-patient-confirm-transport-btn"));

    expect(within(section).getByRole("alert")).toHaveTextContent("Booking was not recorded");
    expect(within(section).getByTestId("ward-patient-cad-number")).toHaveTextContent("CAD-84920");
    expect(within(section).getByTestId("ward-patient-cad-number")).not.toHaveTextContent("CAD-99210");
  });

  it("does not offer a booking before a bed is accepted, so no booking can appear to succeed", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen initialExampleId="WF-009" />
      </WardFlowProvider>,
    );

    // Gate board: while a bed is still being found, transport is a dashed, unavailable gate that
    // says why, and the booking record is not on Now at all.
    const gate = screen.getByTestId("ward-patient-gate-transport");
    expect(gate).toHaveTextContent("Not booked");
    const logBooking = within(gate).getByRole("button", { name: "Log booking" });
    expect(logBooking).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(logBooking);
    expect(screen.queryByTestId("ward-patient-transport-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-transport-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-cad-number")).not.toBeInTheDocument();
  });
});
