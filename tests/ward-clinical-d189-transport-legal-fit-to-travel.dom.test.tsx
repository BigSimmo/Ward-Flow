import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/people/WF-012",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import {
  BLANK_TRANSPORT_BOOKING,
  TransportBookingForm,
  transportBookingTestId,
} from "@/components/ward-management/transport/transport-booking-form";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { Movement, TransportExceptionReason } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";

/**
 * D-187 item 10 and D-189 item 9(e) (Josh, 13 Nov 2026): with no medical clearance recorded, booking
 * transport and Mark handover ready ask for a reason, on the ED board and on the patient page. Neither
 * is blocked: going on without a reason works and records none (review question 1, built as recorded).
 * Synthetic seed records only.
 */

afterEach(cleanup);

function Probe({ id }: { id: string }) {
  const { movements } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === id)!;
  return (
    <>
      <output data-testid="probe-stage">{movement.stage}</output>
      <output data-testid="probe-exceptions">
        {(movement.transport?.exceptions ?? []).map((e) => `${e.step}:${e.gaps.join("+")}:${e.reason}`).join(",")}
      </output>
    </>
  );
}

describe("the booking form asks for a reason when fit to travel is not recorded", () => {
  function Harness({
    record,
    onSubmit,
  }: {
    record: Pick<Movement, "legalStatus" | "legalForm" | "medicalClearance">;
    onSubmit: (value: unknown) => void;
  }) {
    const [answers, setAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
    const [reason, setReason] = useState<TransportExceptionReason | "">("");
    return (
      <TransportBookingForm
        answers={answers}
        onAnswers={setAnswers}
        legalReason={reason}
        onLegalReason={setReason}
        record={record}
        patientName="Synthetic Person"
        now={NOW_ANCHOR}
        testIds={{ prefix: "t", suffix: "WF-1" }}
        onSubmit={onSubmit}
      />
    );
  }
  const id = (part: Parameters<typeof transportBookingTestId>[1], option?: string) =>
    transportBookingTestId({ prefix: "t", suffix: "WF-1" }, part, option);

  function answerTheCall() {
    fireEvent.change(screen.getByTestId(id("provider")), { target: { value: "Ambulance (St John)" } });
    fireEvent.click(screen.getByTestId(id("escort", "no")));
    fireEvent.click(screen.getByTestId(id("legal", "voluntary")));
  }

  it("names the open check and asks for a reason, but saves without one and records none", () => {
    const onSubmit = vi.fn();
    render(<Harness record={{ legalStatus: "Voluntary", legalForm: undefined }} onSubmit={onSubmit} />);
    answerTheCall();
    expect(screen.getByText(/Fit to travel not recorded/)).toBeInTheDocument();
    expect(screen.getByTestId(id("legal-reason"))).toHaveValue("");
    expect(screen.getByTestId(id("left"))).toHaveTextContent("Every required answer given");
    expect(screen.getByTestId(id("confirm"))).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty("exception");
  });

  it("records a chosen reason with the booking", () => {
    const onSubmit = vi.fn();
    render(<Harness record={{ legalStatus: "Voluntary", legalForm: undefined }} onSubmit={onSubmit} />);
    answerTheCall();
    fireEvent.change(screen.getByTestId(id("legal-reason")), { target: { value: "treating_team_confirmed" } });
    fireEvent.click(screen.getByTestId(id("confirm")));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        exception: { gaps: ["fit_to_travel_missing"], reason: "treating_team_confirmed" },
      }),
    );
  });

  it("asks nothing once clearance is recorded as cleared", () => {
    render(
      <Harness
        record={{ legalStatus: "Voluntary", legalForm: undefined, medicalClearance: { cleared: true, at: 0 } }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByTestId(id("legal-reason"))).toBeNull();
  });
});

describe("Mark handover ready asks for a reason on the ED board", () => {
  function BookFirst({ id }: { id: string }) {
    const { dispatch } = useWardFlow();
    return (
      <button
        type="button"
        data-testid="setup-book"
        onClick={() =>
          dispatch({
            type: "BOOK_TRANSPORT",
            role: "coordinator",
            now: NOW_ANCHOR,
            movementId: id,
            provider: "Ambulance service",
            escortRequired: true,
            cadNumber: "CAD-SYN-1",
            transportLegalStatus: "involuntary",
            estimatedAt: NOW_ANCHOR + 30,
          })
        }
      >
        book
      </button>
    );
  }

  function renderEdBoard(id: string) {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
        <BookFirst id={id} />
        <Probe id={id} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("setup-book"));
    fireEvent.click(screen.getByTestId(`ward-ed-handover-${id}`));
  }

  it("asks for a reason, and Continue without a reason records handover ready with none", () => {
    const id = "WF-011";
    renderEdBoard(id);
    const dialog = screen.getByTestId(`ward-ed-handover-check-${id}`);
    expect(dialog).toHaveTextContent("Fit to travel not recorded");
    expect(screen.getByTestId(`ward-ed-handover-check-${id}-reason`)).toHaveValue("");
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue without a reason" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("handover_ready");
    expect(screen.getByTestId("probe-exceptions")).toBeEmptyDOMElement();
  });

  it("opens the reason dialog, then records handover ready with the reason", () => {
    const id = "WF-011";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
        <BookFirst id={id} />
        <Probe id={id} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("setup-book"));
    fireEvent.click(screen.getByTestId(`ward-ed-handover-${id}`));
    const dialog = screen.getByTestId(`ward-ed-handover-check-${id}`);
    expect(dialog).toHaveTextContent("Fit to travel not recorded");
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("pulled");
    fireEvent.change(screen.getByTestId(`ward-ed-handover-check-${id}-reason`), {
      target: { value: "paper_sighted" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark handover ready, record reason" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("handover_ready");
    expect(screen.getByTestId("probe-exceptions")).toHaveTextContent(
      "handover_ready:fit_to_travel_missing:paper_sighted",
    );
  });
});

describe("Mark handover ready asks for a reason on the patient page", () => {
  function pullTheBed() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-012" />
        <Probe id="WF-012" />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-patient-gate-bed")).getByRole("button"));
    const shortlist = screen.getByRole("region", { name: "Ask wards" });
    fireEvent.click(
      within(shortlist)
        .getAllByRole("checkbox")
        .find((box) => !box.hasAttribute("disabled"))!,
    );
    fireEvent.change(screen.getByLabelText("Ward placement reason"), {
      target: { value: GENDER_PLACEMENT_REASONS[0] },
    });
    fireEvent.click(screen.getByLabelText("Placement checked with the ward"));
    fireEvent.click(screen.getByRole("button", { name: "Ask 1 ward" }));
    fireEvent.click(screen.getByRole("button", { name: /^Accept bed at / }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pull the bed" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("pulled");

    fireEvent.click(screen.getByRole("button", { name: "Record transport booking" }));
    fireEvent.change(screen.getByLabelText("Who is collecting"), { target: { value: "Ambulance (St John)" } });
    fireEvent.change(screen.getByLabelText("CAD transport number"), { target: { value: "CAD-SYNTHETIC-42" } });
    fireEvent.click(screen.getByRole("radio", { name: "Involuntary" }));
    fireEvent.click(screen.getByRole("radio", { name: "Escort required" }));
  }

  it("books and readies the handover without a reason: both ask, neither is held, none is recorded", () => {
    pullTheBed();
    expect(screen.getByRole("combobox", { name: "Reason" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Save transport booking" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("pulled");
    expect(screen.getByTestId("probe-exceptions")).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole("button", { name: "Mark handover ready · sending team" }));
    const check = screen.getByTestId("ward-patient-handover-check");
    expect(check).toHaveTextContent("Fit to travel not recorded");
    fireEvent.click(within(check).getByRole("button", { name: "Continue without a reason" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("handover_ready");
    expect(screen.getByTestId("probe-exceptions")).toBeEmptyDOMElement();
  });

  it("opens the reason dialog in the transit deck, and Cancel leaves the bed pulled", () => {
    pullTheBed();
    // Booking asks too (fit to travel is not recorded on this journey).
    fireEvent.change(screen.getByRole("combobox", { name: "Reason" }), { target: { value: "urgent_to_follow" } });
    fireEvent.click(screen.getByRole("button", { name: "Save transport booking" }));
    expect(screen.getByTestId("probe-exceptions")).toHaveTextContent("booked:fit_to_travel_missing:urgent_to_follow");

    fireEvent.click(screen.getByRole("button", { name: "Mark handover ready · sending team" }));
    const check = screen.getByTestId("ward-patient-handover-check");
    expect(check).toHaveTextContent("Fit to travel not recorded");
    expect(check).toHaveTextContent(/Mark handover ready for .+\?/);
    fireEvent.click(within(check).getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("pulled");

    fireEvent.click(screen.getByRole("button", { name: "Mark handover ready · sending team" }));
    fireEvent.change(screen.getByTestId("ward-patient-handover-check-reason"), {
      target: { value: "treating_team_confirmed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark handover ready, record reason" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("handover_ready");
    expect(screen.getByTestId("probe-exceptions")).toHaveTextContent(
      "handover_ready:fit_to_travel_missing:treating_team_confirmed",
    );
  });
});
