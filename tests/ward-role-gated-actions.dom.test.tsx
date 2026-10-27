import "@testing-library/jest-dom/vitest";
import { legalNowTransportStatus } from "@/components/ward-management/ward-transport-checks";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The role is the route: each test sets the path the gate reads.
const navigation = vi.hoisted(() => ({ pathname: "/ward-flow" }));
const senderMode = vi.hoisted(() => ({ required: false, summary: undefined as unknown }));
vi.mock("@/components/ward-management/ward-sender-presentation", () => ({
  useSenderPresentation: () => ({
    required: senderMode.required,
    movementFor: () => senderMode.summary,
    referralFor: () => undefined,
  }),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { commandRefusal, parseAccess, seedWorld } from "../backend/ward-flow/engine";
import {
  renderTransportSection,
  type PatientTransportSectionContext,
} from "@/components/ward-management/patients/patient-now-transport-section";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { useRoleGate, setDeskRole } from "@/components/ward-management/ward-role-gate";
import { StageRow } from "@/components/ward-management/movements/movements-stage-row";
import { MovementWorkflowActions } from "@/components/ward-management/movements/movement-workflow-actions";
import { causeOf } from "@/components/ward-management/movements/movements-screen-helpers";
import { attentionItems } from "@/components/ward-management/movements/movement-workspace-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

afterEach(() => {
  cleanup();
  navigation.pathname = "/ward-flow";
  senderMode.required = false;
  senderMode.summary = undefined;
});

describe("movement sender presentation and existing action roles", () => {
  it("uses sender progress in grouping and attention without inferring a no-bed cause from masked arrays", () => {
    const state = seedWardFlowState();
    const movement = {
      ...state.movements[0],
      stage: "destination_review" as const,
      referredUnitIds: [],
      declines: [],
      acceptedUnitId: undefined,
      escalation: undefined,
      closure: undefined,
      transport: undefined,
    };
    const presentation = { kind: "sender", progress: "escalated", nextStep: "wait" } as const;
    expect(causeOf(movement, NOW_ANCHOR, new Map([[movement.id, "no_eligible_bed"]]), presentation)).toBe(
      "progress_escalated",
    );
    const attention = attentionItems({
      movement,
      units: state.units,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      destination: undefined,
      open: true,
      blockerIsActive: false,
      presentation,
    });
    expect(attention.find((item) => item.key === "sender-progress")?.chip).toBe("Escalated");
    expect(attention.some((item) => item.key === "stalled" || item.key === "escalation")).toBe(false);
    expect(causeOf(movement, NOW_ANCHOR, new Map(), { kind: "unavailable" })).toBe("progress_unavailable");
  });

  function renderRow(progress: "escalated" | "none_found" | null) {
    const state = seedWardFlowState();
    const movement = {
      ...state.movements[0],
      stage: "destination_review" as const,
      referredUnitIds: [],
      declines: [],
      withdrawnReferrals: [],
      acceptedUnitId: undefined,
      escalation: undefined,
      closure: undefined,
    };
    senderMode.required = true;
    senderMode.summary =
      progress === null
        ? null
        : {
            id: movement.id,
            kind: "sender",
            visibleUntil: null,
            destinationStatus: "none_found",
            progress,
            nextStep: progress === "escalated" ? "wait" : "escalate",
          };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ul>
          <StageRow
            movement={movement}
            now={NOW_ANCHOR}
            units={state.units}
            accessTargetMinutes={1440}
            reveal={null}
            consumeReveal={() => false}
            onOpenDetail={() => {}}
            onFocusMovement={() => {}}
            marked={false}
            selected={false}
          />
        </ul>
      </WardFlowProvider>,
    );
  }

  it("shows actual sender escalation instead of inventing a not-requested referral from masked arrays", () => {
    renderRow("escalated");
    expect(screen.getAllByText("Escalated").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Ask wards" })).not.toBeInTheDocument();
    expect(screen.queryByText("No ward asked yet")).not.toBeInTheDocument();
  });

  it("keeps the existing escalation navigation for a genuine no-acceptance sender outcome", () => {
    renderRow("none_found");
    expect(screen.getByRole("link", { name: "Escalate" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ask wards" })).not.toBeInTheDocument();
  });

  it("shows required missing progress explicitly rather than offering inferred refer advice", () => {
    renderRow(null);
    expect(screen.getAllByText("Progress unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Ask wards" })).not.toBeInTheDocument();
  });

  it("does not let a bed manager borrow coordinator identity for a movement write", () => {
    setDeskRole("bed_manager", navigation.pathname);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementWorkflowActions movement={seedWardFlowState().movements[0]} />
        <RejectionCount />
      </WardFlowProvider>,
    );
    const flag = screen.getByRole("button", { name: "Raise expectation review flag" });
    expect(flag).toBeDisabled();
    const before = screen.getByTestId("probe").textContent;
    fireEvent.click(flag);
    expect(screen.getByTestId("probe").textContent).toBe(before);
  });

  it.each(["ward", "coordinator"] as const)("preserves an allowed expectation review for the %s desk", (role) => {
    setDeskRole(role, navigation.pathname);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementWorkflowActions movement={seedWardFlowState().movements[0]} />
        <WorkflowFlagProbe />
      </WardFlowProvider>,
    );
    const flag = screen.getByRole("button", { name: "Raise expectation review flag" });
    expect(flag).toBeEnabled();
    fireEvent.click(flag);
    expect(screen.getByTestId("movement-flag")).toHaveTextContent("0:set");
  });

  it("preserves the bed manager's explicitly permitted ward capacity request", () => {
    setDeskRole("bed_manager", navigation.pathname);
    const state = seedWardFlowState();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementWorkflowActions movement={{ ...state.movements[0], acceptedUnitId: state.units[0].id }} />
        <RejectionCount />
      </WardFlowProvider>,
    );
    const request = screen.getByRole("button", { name: "Request ward capacity review" });
    expect(request).toBeEnabled();
    fireEvent.click(request);
    expect(screen.getByTestId("probe")).toHaveTextContent("0:unset");
  });
});

function WorkflowFlagProbe() {
  const { rejections, movements } = useWardFlow();
  return (
    <output data-testid="movement-flag">
      {rejections.length}:{movements[0].expectFlag ? "set" : "unset"}
    </output>
  );
}

function RejectionCount() {
  const { rejections, movements } = useWardFlow();
  return (
    <output data-testid="probe">
      {rejections.length}:{movements[0]?.arrivalDetails ? "set" : "unset"}
    </output>
  );
}

function renderModal() {
  const movement = seedWardFlowState().movements[0];
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ArrivalTimeModal isOpen onClose={vi.fn()} movement={movement} role="ward" />
      <RejectionCount />
    </WardFlowProvider>,
  );
  return screen.getByTestId("save-arrival-plan-button");
}

describe("actions limited by the route's role (feature 11)", () => {
  it("disables an action the route's role may not take, with a short visible reason", () => {
    navigation.pathname = "/ward-flow/transport/officer";
    const save = renderModal();
    expect(save).toBeDisabled();
    const reason = screen.getByText("Coordinator, ED, ward or community team only");
    expect(save.getAttribute("aria-describedby")).toBe(reason.closest("[id]")?.id);
    const before = screen.getByTestId("probe").textContent;
    fireEvent.submit(save.closest("form")!);
    // Nothing is dispatched, so nothing is recorded or refused.
    expect(screen.getByTestId("probe").textContent).toBe(before);
  });

  it("leaves the same action available on a route whose role may take it", () => {
    navigation.pathname = "/ward-flow/ward/rph-adult-secure";
    const save = renderModal();
    expect(save).toBeEnabled();
    expect(save.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByText("Coordinator, ED, ward or community team only")).toBeNull();
  });
});

// The gate's `disabled` must survive the button's own pending state: a later `disabled={saving}`
// once replaced it, re-enabling Save for roles that may not act whenever nothing was saving.
function TransportForm({ save }: { save: () => void }) {
  const gate = useRoleGate();
  const noop = () => undefined;
  const liveMovement = seedWardFlowState().movements[0];
  const ctx = {
    bookingRejection: undefined,
    transportPending: false,
    transportSaveError: undefined,
    displayCadNumber: undefined,
    displayEscort: undefined,
    displayEta: undefined,
    displayLegalStatus: "Not recorded",
    displayProvider: "Not recorded",
    displayName: "Synthetic patient",
    gate,
    isTransportBooked: false,
    liveMovement,
    mode: "held",
    now: NOW_ANCHOR,
    openTransportForm: noop,
    saveTransportBooking: save,
    setShowTransportForm: noop,
    setTransportAnswers: noop,
    setTransportLegalReason: noop,
    showTransportForm: true,
    // Every answer in (A34 form), so only the role decides whether Save is available.
    transportAnswers: {
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "CAD-48213",
      transportLegalStatus: legalNowTransportStatus(liveMovement) ?? "involuntary",
      estimatedTime: "23:30",
      estimatedDay: "today",
    },
    transportLegalReason: "",
  } satisfies PatientTransportSectionContext;
  return <>{renderTransportSection(ctx)}</>;
}

describe("gated Save buttons stay disabled while nothing is saving", () => {
  it("keeps Save transport booking disabled, with its reason, for a role that may not book", () => {
    navigation.pathname = "/mockups/ward-flow/transport/officer";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <TransportForm save={vi.fn()} />
      </WardFlowProvider>,
    );
    const save = screen.getByTestId("ward-patient-confirm-transport-btn");
    expect(save).toHaveAttribute("aria-disabled", "true");
    const describedBy = save.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(/only/);
  });

  it("leaves Save transport booking enabled for a role that may book", () => {
    navigation.pathname = "/mockups/ward-flow/ward/rph-adult-secure";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <TransportForm save={vi.fn()} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-patient-confirm-transport-btn")).not.toHaveAttribute("aria-disabled");
  });
});

describe("the gated commands are refused below the UI too", () => {
  it.each(["BOOK_TRANSPORT", "SET_ARRIVAL_DETAILS"] as const)(
    "the reducer refuses %s raised by a role it does not permit",
    (type) => {
      const state = seedWardFlowState();
      for (const role of ["officer", "executive", "bed_manager"] as const) {
        const next = wardFlowReducer(state, {
          type,
          role,
          now: NOW_ANCHOR,
          movementId: state.movements[0].id,
        } as Parameters<typeof wardFlowReducer>[1]);
        expect(next.rejections.length).toBe(state.rejections.length + 1);
        expect(next.rejections.at(-1)?.reason).toMatch(new RegExp(`${type} requires role .* raised by role ${role}`));
        expect(next.movements).toEqual(state.movements);
      }
    },
  );

  it.each(["BOOK_TRANSPORT", "SET_ARRIVAL_DETAILS"] as const)(
    "the shared engine refuses %s from a transport officer desk, even under a borrowed role",
    (type) => {
      const at = new Date("2026-10-07T10:00:00Z");
      const world = seedWorld(at);
      // A granted officer names its health service (D-80 item 7).
      const officer = parseAccess("officer", { kind: "jobs", service: HEALTH_SERVICES[0] });
      expect(officer).not.toBeNull();
      for (const role of ["officer", "ward", "ed"]) {
        expect(commandRefusal(world, officer!, { type, role, movementId: world.state.movements[0].id }, at)).toBe(
          "This change is not part of your role.",
        );
      }
    },
  );
});
