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
  usePathname: () => "/ward-flow/ed",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { NeedsTransportCard } from "@/components/ward-management/officer/officer-needs-transport";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { EdBoardRedesign } from "@/components/ward-redesign/ed-board/ed-board-redesign";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { TRANSPORT_EXCEPTION_GAP_LABELS } from "@/components/ward-management/ward-transport-checks";

/**
 * The held clinical PR's leftover items (13 Nov 2026), driven through the real screens on the
 * synthetic seed:
 * - The officer's Needs transport row reads the one paperwork rule's words, not "No Form 4A recorded".
 * - The officer's job names a Mark handover ready exception "Handover ready", not "Booked".
 * - The redesigned ED board's Handover ready asks for the fit to travel reason, as the live board does
 *   (D-187 item 10: asked every time when no medical clearance is recorded; never a block).
 * - The ward page's footer names the sample observation mix.
 */

afterEach(cleanup);

/** A held bed, not voluntary, with no Form 4A or 4C on file, so the order notice applies. */
function heldBedWithoutOrder(): Movement {
  const movement = seedWardFlowState().movements.find(
    (candidate) =>
      candidate.stage === "pulled" &&
      candidate.transport === undefined &&
      candidate.legalStatus !== "Voluntary" &&
      !["4A", "4C"].includes(candidate.legalForm?.code ?? ""),
  );
  expect(movement, "the seed holds a held bed with no transport order on file").toBeDefined();
  return movement!;
}

describe("Needs transport names the paperwork gap in the one rule's words", () => {
  it("shows the transport order label, never a form number", () => {
    const movement = heldBedWithoutOrder();
    render(
      <NeedsTransportCard
        needing={[movement]}
        now={NOW_ANCHOR}
        isPhone={false}
        bookingId={undefined}
        nameFor={() => "Synthetic Person"}
        umrnFor={() => undefined}
        originShortFor={() => "ED"}
        destinationLabelFor={() => "Ward"}
        units={seedWardFlowState().units}
        onLog={() => undefined}
      />,
    );
    const row = screen.getByTestId(`ward-officer-need-${movement.id}`);
    expect(row).toHaveTextContent(TRANSPORT_EXCEPTION_GAP_LABELS.transport_order_missing);
    expect(row).not.toHaveTextContent("Form 4A");
  });
});

/** Books WF-011 and marks it handover ready with a recorded fit to travel exception. */
function SetUpHandoverException({ id }: { id: string }) {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="setup-handover"
      onClick={() => {
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
          exception: { gaps: ["fit_to_travel_missing"], reason: "urgent_to_follow" },
        });
        dispatch({
          type: "HANDOVER_READY",
          role: "ed",
          now: NOW_ANCHOR + 1,
          movementId: id,
          exception: { gaps: ["fit_to_travel_missing"], reason: "paper_sighted" },
        });
      }}
    >
      set up
    </button>
  );
}

function Probe({ id }: { id: string }) {
  const { movements, rejections } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === id);
  return (
    <>
      <output data-testid="probe-stage">{movement?.stage}</output>
      <output data-testid="probe-rejections">{rejections.length}</output>
      <output data-testid="probe-exceptions">
        {(movement?.transport?.exceptions ?? [])
          .map((exception) => `${exception.step}:${exception.gaps.join(",")}:${exception.reason}`)
          .join("|")}
      </output>
    </>
  );
}

describe("a transport exception names its own step on the officer's job", () => {
  it("reads Handover ready for the Mark handover ready exception and Booked for the booking's", async () => {
    const id = "WF-011";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SetUpHandoverException id={id} />
        <Probe id={id} />
        <OfficerScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("setup-handover"));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("handover_ready");
    expect(screen.getByTestId("probe-exceptions")).toHaveTextContent(
      "booked:fit_to_travel_missing:urgent_to_follow|handover_ready:fit_to_travel_missing:paper_sighted",
    );
    const showAll = screen.queryByRole("button", { name: /^Show all \d+ jobs$/u });
    if (showAll && !screen.queryByTestId(`ward-officer-select-${id}`)) fireEvent.click(showAll);
    await act(async () => {
      fireEvent.click(screen.getByTestId(`ward-officer-select-${id}`));
    });
    const rows = screen.getAllByTestId(`ward-officer-exception-${id}`).map((row) => row.textContent ?? "");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(/^Booked /u);
    expect(rows[1]).toMatch(/^Handover ready /u);
    expect(rows[1]).toContain("Paper copy sighted");
  });

  it("reads the same steps on the patient page", () => {
    const id = "WF-011";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SetUpHandoverException id={id} />
        <PatientNowScreen movementId={id} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("setup-handover"));
    fireEvent.click(screen.getByTestId("ward-patient-transport-row"));
    const rows = screen.getAllByTestId("ward-patient-transport-exception").map((row) => row.textContent ?? "");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(/^Booked /u);
    expect(rows[1]).toMatch(/^Handover ready /u);
  });
});

describe("A9-20(a): the patient page reads a referral waiting for triage", () => {
  const seed = seedWardFlowState();
  // Someone with no journey, no ward stay and no community episode: the page reads Not active.
  const person = seed.patients.find(
    (patient) =>
      !seed.movements.some((movement) => movement.patientId === patient.id) &&
      !seed.admissions.some((admission) => admission.patientId === patient.id) &&
      !recordExtrasFor(patient.id)?.community?.some((episode) => episode.status === "active"),
  )!;
  // A synthetic referral for them that asks no place yet and has not been triaged.
  const waiting = {
    ...seed.referrals.find((referral) => referral.triagedAt === undefined)!,
    id: "RF-SYN-A920",
    patientId: person.id,
    raisedAt: NOW_ANCHOR - 30,
    destinations: [],
  };

  function WithWaitingReferral() {
    const value = useWardFlow();
    return (
      <WardFlowOverride value={{ ...value, referrals: [...value.referrals, waiting] }}>
        <PatientNowScreen patientId={person.id} />
      </WardFlowOverride>
    );
  }

  it("reads Not active with no referral waiting", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId={person.id} />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText("Not active").length).toBeGreaterThan(0);
    expect(screen.queryByText("Referral waiting for triage")).toBeNull();
  });

  it("says Referral waiting for triage on both the status card and the state tag", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WithWaitingReferral />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-patient-status-verdict")).toHaveTextContent(/^Referral waiting for triage$/u);
    const said = screen.getAllByText("Referral waiting for triage");
    expect(
      said.filter((node) => node.closest('[data-testid="ward-patient-status-verdict"]') === null).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Not active")).toBeNull();
  });
});

describe("the redesigned ED board asks for the fit to travel reason at Handover ready", () => {
  function BookOnly({ id }: { id: string }) {
    const { dispatch } = useWardFlow();
    return (
      <button
        type="button"
        data-testid="setup-book"
        onClick={() => {
          // The board's next step is Handover ready once the examination is recorded and the job booked.
          dispatch({
            type: "RECORD_EXAMINATION",
            role: "ed",
            now: NOW_ANCHOR,
            movementId: id,
            outcome: "inpatient_order",
          });
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
          });
        }}
      >
        book
      </button>
    );
  }

  it("opens the reason dialog from the row's next step, then records handover ready with the reason", () => {
    const id = "WF-011";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdBoardRedesign edId="arm-ed" />
        <BookOnly id={id} />
        <Probe id={id} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("setup-book"));
    expect(screen.getByTestId("probe-rejections")).toHaveTextContent("0");
    const next = screen.getByTestId(`ward-ed-next-${id}`);
    expect(next).toHaveTextContent("Handover ready");
    fireEvent.click(next);
    const dialog = screen.getByTestId(`ward-ed-handover-check-${id}`);
    expect(dialog).toHaveTextContent("Fit to travel not recorded");
    // Nothing is recorded until the person goes on, with a reason or without one.
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("pulled");
    fireEvent.change(screen.getByTestId(`ward-ed-handover-check-${id}-reason`), {
      target: { value: "treating_team_confirmed" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark handover ready, record reason" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("handover_ready");
    expect(screen.getByTestId("probe-exceptions")).toHaveTextContent(
      "handover_ready:fit_to_travel_missing:treating_team_confirmed",
    );
  });

  it("lets the row's next step go on without a reason, recording none (D-189 item 9(e))", () => {
    const id = "WF-011";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdBoardRedesign edId="arm-ed" />
        <BookOnly id={id} />
        <Probe id={id} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("setup-book"));
    fireEvent.click(screen.getByTestId(`ward-ed-next-${id}`));
    const dialog = screen.getByTestId(`ward-ed-handover-check-${id}`);
    expect(dialog).toHaveTextContent("Fit to travel not recorded");
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue without a reason" }));
    expect(screen.getByTestId("probe-stage")).toHaveTextContent("handover_ready");
    expect(screen.getByTestId("probe-exceptions")).toBeEmptyDOMElement();
  });
});

describe("the ward page footer names the sample observation mix", () => {
  it("keeps the governance note and appends the observation levels label", () => {
    const unitId = "rph-adult-secure";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={unitId} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-unit-governance")).toHaveTextContent(
      `Scoped to ${unitById(unitId)!.name} · Bed decisions remain human-confirmed · Not approved for clinical use · Observation levels: ${SAMPLE_OBSERVATION_MIX_LABEL.toLowerCase()}`,
    );
  });
});
