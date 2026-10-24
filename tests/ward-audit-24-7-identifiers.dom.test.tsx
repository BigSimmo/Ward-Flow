import "@testing-library/jest-dom/vitest";
import { createRef, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/people/WF-012",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { CommunityScreenNoteModal } from "@/components/ward-management/community/community-screen-modals";
import { deriveEdScreen } from "@/components/ward-management/ed/ed-screen-derivations";
import {
  WardArrivalsCorridor,
  PULL_SECOND_TAP_GUARD_MS,
} from "@/components/ward-management/ward/ward-arrivals-corridor";
import { GENDER_PLACEMENT_REASONS, RELEASE_PULL_REASONS } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement } from "@/components/ward-management/ward-model";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * Audit 24-1 (B-05, B-09) and Audit 24-7 (CT-19 to CT-22): consequential controls name the patient
 * and UMRN, the ED search folds like the header search, the crisis card says it is synthetic, and a
 * double tap on Pull a bed never lands on Release. Synthetic seed data only.
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function IdentityProbe() {
  const { movements, patients, referrals } = useWardFlow();
  const m = movements.find((row) => row.id === "WF-012")!;
  return (
    <>
      <output data-testid="probe-identity">
        {patientIdentityLine(resolveSubjectPatient(m, { patients, referrals, movements }))}
      </output>
      <output data-testid="live-stage">{m.stage}</output>
    </>
  );
}

function openPlacementSheet() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <PatientNowScreen movementId="WF-012" />
        <IdentityProbe />
      </ToastProvider>
    </WardFlowProvider>,
  );
  fireEvent.click(within(screen.getByTestId("ward-patient-gate-bed")).getByRole("button"));
  return screen.getByTestId("probe-identity").textContent!;
}

function askOneWard() {
  const shortlist = screen.getByRole("region", { name: "Ask wards" });
  fireEvent.click(
    within(shortlist)
      .getAllByRole("checkbox")
      .find((box) => !box.hasAttribute("disabled"))!,
  );
  fireEvent.change(screen.getByLabelText("Ward placement reason"), { target: { value: GENDER_PLACEMENT_REASONS[0] } });
  fireEvent.click(screen.getByLabelText("Placement checked with the ward"));
  fireEvent.click(screen.getByRole("button", { name: "Ask 1 ward" }));
}

describe("patient page placement sheet names the patient (B-05, CT-19)", () => {
  it("shows Name · UMRN at the top of the sheet and on the withdraw confirm line", () => {
    const identity = openPlacementSheet();
    expect(identity).toMatch(/ · /);
    const sheet = screen.getByRole("dialog", { name: "Destination and placement" });
    expect(within(sheet).getByTestId("ward-transit-patient")).toHaveTextContent(identity);
    askOneWard();
    fireEvent.click(screen.getByText("Withdraw referral", { selector: "summary" }));
    expect(screen.getByLabelText(`Confirm this bed search is no longer required for ${identity}`)).toBeInTheDocument();
    expect(screen.getByTestId("ward-withdraw-referral-who")).toHaveTextContent(`For ${identity}`);
    expect(screen.getByRole("button", { name: /^Withdraw referral$/ })).toHaveAccessibleDescription(
      new RegExp(`^For ${identity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
  });

  it("puts Name · UMRN beside Release pull", () => {
    const identity = openPlacementSheet();
    askOneWard();
    fireEvent.click(screen.getByRole("button", { name: /^Accept bed at / }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pull the bed" }));
    expect(screen.getByTestId("live-stage")).toHaveTextContent("pulled");
    fireEvent.click(screen.getByText("Release bed pull"));
    expect(screen.getByTestId("ward-release-pull-who")).toHaveTextContent(`For ${identity}`);
    fireEvent.change(screen.getByLabelText("Release reason"), { target: { value: RELEASE_PULL_REASONS[0] } });
    expect(screen.getByRole("button", { name: "Release pull" })).toHaveAccessibleDescription(`For ${identity}`);
  });
});

describe("coordinator shortlist names the patient on unwind submits (CT-19)", () => {
  const state = seedWardFlowState();
  function panel(movement: Movement) {
    render(
      <ShortlistPanel
        movement={movement}
        now={NOW_ANCHOR}
        units={state.units}
        bedReleases={state.bedReleases}
        leaveBeds={state.leaveBeds}
        admissions={state.admissions}
        referrals={state.referrals}
        selectedUnitId={undefined}
        onSelectUnit={() => {}}
        dispatch={vi.fn()}
        parallelReferralCap={state.configuration.parallelReferralCap}
      />,
    );
  }
  const pulled = state.movements.find((row) => row.stage === "pulled" && row.transport === undefined);

  it("Release the pulled bed sits beside Name · UMRN", () => {
    expect(pulled, "the seed must hold a pulled bed with no transport").toBeDefined();
    panel(pulled!);
    fireEvent.click(screen.getByTestId("ward-release-pull-toggle"));
    const who = screen.getByTestId("ward-release-pull-who");
    expect(who.textContent).toMatch(/^For .+ · .+$/);
    expect(within(screen.getByTestId("ward-release-pull")).getByRole("button")).toHaveAccessibleDescription(
      expect.stringContaining(who.textContent!),
    );
  });

  it("Cancel transport sits beside Name · UMRN", () => {
    const job = state.movements.find(
      (row) =>
        row.transport &&
        row.transport.cancelledAt === undefined &&
        row.transport.collectedAt === undefined &&
        row.transport.arrivedAt === undefined,
    )!.transport!;
    panel({ ...state.movements.find((row) => row.stage === "pulled")!, transport: { ...job } });
    fireEvent.click(screen.getByTestId("ward-cancel-transport-toggle"));
    const who = screen.getByTestId("ward-cancel-transport-who");
    expect(who.textContent).toMatch(/^For .+ · .+$/);
    expect(within(screen.getByTestId("ward-cancel-transport")).getByRole("button")).toHaveAccessibleDescription(
      expect.stringContaining(who.textContent!),
    );
  });
});

describe("ED board search folds like the header search (CT-20)", () => {
  const noop = () => {};
  function board(state: WardFlowState, patientQuery: string) {
    return deriveEdScreen({
      movements: state.movements,
      units: state.units,
      referrals: state.referrals,
      registryPatients: state.patients,
      configuration: state.configuration,
      inboxSnoozes: state.inboxSnoozes,
      admissions: state.admissions,
      now: NOW_ANCHOR,
      accessTarget: state.configuration.edAccessTargetMinutes,
      thisEdId: "rph-ed",
      boardFilter: "all",
      patientQuery,
      patientSort: "longest",
      heroHighlight: null,
      selectedPatientId: null,
      arrivalPlanOpenFor: undefined,
      setSelectedPatientId: noop,
      setPhoneSheetFor: noop,
      setArrivalPlanOpenFor: noop,
      toggleBookTransport: noop,
      recordEdStep: noop,
    });
  }

  it("finds O'Quinn-Éclair from 'OQuinn' and 'oquinneclair', dims the rest, and keeps the order", () => {
    const seed = seedWardFlowState();
    const first = board(seed, "").visiblePatients[0]!;
    const patientId = resolveSubjectPatient(first, {
      patients: seed.patients,
      referrals: seed.referrals,
      movements: seed.movements,
    }).patient?.id;
    expect(patientId, "the first ED row must resolve to a registry patient").toBeDefined();
    const state: WardFlowState = {
      ...seed,
      patients: seed.patients.map((p) => (p.id === patientId ? { ...p, familyName: "O'Quinn-Éclair" } : p)),
    };
    const order = board(state, "").visiblePatients.map((m) => m.id);
    for (const query of ["OQuinn", "oquinneclair", "o’quinn-eclair"]) {
      const view = board(state, query);
      expect(view.isBoardRowDim(first), query).toBe(false);
      expect(view.boardMatchCount, query).toBeGreaterThanOrEqual(1);
      expect(
        view.visiblePatients.map((m) => m.id),
        query,
      ).toEqual(order);
    }
    expect(board(state, "zzz-no-such-person").isBoardRowDim(first)).toBe(true);
  });
});

describe("community crisis card is labelled synthetic (CT-21)", () => {
  function renderModal(activeModalType: "crisis" | "handover") {
    const view = {
      now: NOW_ANCHOR,
      team: { name: "Synthetic Team" },
      activeModalType,
      setActiveModalType: vi.fn(),
      contactRecord: null,
      contactSaveMessage: null,
      contactSaveDisabled: false,
      handleSaveClinicalContact: vi.fn(),
      noteModalRef: createRef<HTMLDivElement>(),
      noteModalOverlayRef: createRef<HTMLDivElement>(),
      teamConfig: { consultant: "Dr A. Example", campus: "Synthetic Campus", service: "Synthetic Service" },
      waitingReferrals: [],
      caseloadRows: [],
      recordedCtoCount: 0,
    };
    render(<CommunityScreenNoteModal view={view as never} />);
  }

  it("says synthetic, never live, and uses a fictional 0491 570 number", () => {
    renderModal("crisis");
    const dialog = document.getElementById("crisisModal")!;
    expect(screen.getByTestId("ward-community-crisis-synthetic")).toHaveTextContent("Synthetic example");
    expect(dialog).not.toHaveTextContent("Active in Field");
    expect(dialog).not.toHaveTextContent("Current Deployment");
    expect(dialog).not.toHaveTextContent("En-route");
    expect(dialog).toHaveTextContent("0491 570 110");
    expect(dialog).not.toHaveTextContent("0411 902 441");
  });

  it("names the three-count print for what it holds", () => {
    renderModal("handover");
    const dialog = document.getElementById("handoverModal")!;
    expect(dialog).toHaveTextContent("Print Catchment Counts");
    expect(dialog).toHaveTextContent("Synthetic Team · Catchment counts");
    expect(dialog).not.toHaveTextContent("MDT Summary");
  });
});

describe("ward arrivals card: a double tap on Pull never lands on Release (B-09, CT-22)", () => {
  function acceptedJourney() {
    const seed = seedWardFlowState();
    const open = seed.movements.find(
      (candidate) =>
        candidate.referredUnitIds.length > 0 &&
        !candidate.acceptedUnitId &&
        !candidate.closure &&
        (seed.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
    )!;
    const unitId = open.referredUnitIds[0]!;
    const accept = {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId: open.id,
      unitId,
      now: NOW_ANCHOR + 1,
      overrideReason: "The bed information is known to be out of date",
    } as unknown as WardFlowEvent;
    const state = wardFlowReducer(seed, accept);
    expect(state.rejections).toHaveLength(0);
    return { state, movementId: open.id, unitId };
  }

  it("moves focus to the status line and ignores a second tap inside the guard", () => {
    const { state: start, movementId, unitId } = acceptedJourney();
    const toggleRelease = vi.fn();
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    function Harness() {
      const [state, setState] = useState(start);
      const movement = state.movements.find((m) => m.id === movementId)!;
      return (
        <WardArrivalsCorridor
          unit={state.units.find((u) => u.id === unitId)!}
          accepted={[movement]}
          now={NOW_ANCHOR + 2}
          resolvePatientIdentity={() => ({
            displayName: "Synthetic patient",
            formalName: "PATIENT, Synthetic",
            initials: "SP",
            umrn: "UM000001",
          })}
          releaseOpenFor={undefined}
          toggleRelease={toggleRelease}
          releaseReason={undefined}
          setReleaseReason={vi.fn()}
          submitRelease={vi.fn()}
          lastActionRejection={undefined}
          dispatch={vi.fn()}
          setCheckToken={vi.fn()}
          priorRejectionCountRef={{ current: 0 }}
          rejections={[]}
          overrideReasonForm={() => null}
          onPullPatient={(id, unit) =>
            setState((s) =>
              wardFlowReducer(s, {
                type: "PULL_PATIENT",
                role: "ward",
                now: NOW_ANCHOR + 2,
                movementId: id,
                unitId: unit,
              } as unknown as WardFlowEvent),
            )
          }
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByTestId(`ward-pull-${movementId}`));
    const status = screen.getByTestId(`ward-pulled-status-${movementId}`);
    expect(status).toHaveTextContent("Bed pulled for PATIENT, Synthetic · UM000001.");
    fireEvent.click(screen.getByTestId(`ward-release-pull-toggle-${movementId}`));
    expect(toggleRelease).not.toHaveBeenCalled();
    clock += PULL_SECOND_TAP_GUARD_MS + 1;
    fireEvent.click(screen.getByTestId(`ward-release-pull-toggle-${movementId}`));
    expect(toggleRelease).toHaveBeenCalledExactlyOnceWith(movementId);
  });
});
