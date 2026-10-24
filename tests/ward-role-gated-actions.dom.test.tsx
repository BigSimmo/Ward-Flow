import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The role is the route: each test sets the path the gate reads.
const navigation = vi.hoisted(() => ({ pathname: "/ward-flow" }));
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
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

afterEach(() => {
  cleanup();
  navigation.pathname = "/ward-flow";
});

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
  const ctx = {
    bookingRejection: undefined,
    transportPending: false,
    transportSaveError: undefined,
    displayCadNumber: undefined,
    displayEscort: undefined,
    displayEta: undefined,
    displayLegalStatus: "Not recorded",
    displayProvider: "Not recorded",
    draftHoldEnd: undefined,
    gate,
    handleSaveTransportBooking: (event: React.FormEvent) => {
      event.preventDefault();
      save();
    },
    isTransportBooked: false,
    legalNowStatus: undefined,
    liveMovement: seedWardFlowState().movements[0],
    mode: "held",
    now: NOW_ANCHOR,
    openTransportForm: noop,
    setShowTransportForm: noop,
    setTransportCadDraft: noop,
    setTransportEscortDraft: noop,
    setTransportEtaDraft: noop,
    setTransportFormErrors: noop,
    setTransportLegalChanging: noop,
    setTransportLegalDraft: noop,
    setTransportLegalReason: noop,
    setTransportProviderDraft: noop,
    showTransportForm: true,
    transportCadDraft: "",
    transportEscortDraft: undefined,
    transportEtaDraft: "",
    transportFormErrors: {},
    transportLegalChanging: false,
    transportLegalChoice: undefined,
    transportLegalClash: false,
    transportLegalReason: "",
    transportProviderDraft: "",
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
    expect(save).toBeDisabled();
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
    expect(screen.getByTestId("ward-patient-confirm-transport-btn")).toBeEnabled();
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
