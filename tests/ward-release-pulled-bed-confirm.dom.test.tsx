import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart/movements/patient",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { EdReferredPanel } from "@/components/ward-management/ed/ed-screen-referred";
import type { EdScreenContext } from "@/components/ward-management/ed/ed-screen-context";
import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";
import { DIVERSION_REASONS, TRANSPORT_WHEREABOUTS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardArrivalsCorridor } from "@/components/ward-management/ward/ward-arrivals-corridor";

/**
 * Audit 24-7 (CT-07): releasing a diverted or stopped journey's pulled bed asks first, naming the
 * person and the ward, and Cancel records nothing. Synthetic seed data only.
 */
const NOW = NOW_ANCHOR;

/** A seeded journey walked to collection, then diverted or stopped, so its bed is still pulled. */
function journeySteps(ending: "diverted" | "stopped"): { movementId: string; unitId: string; steps: WardFlowEvent[] } {
  const seed = seedWardFlowState();
  const open = seed.movements.find(
    (candidate) =>
      candidate.referredUnitIds.length > 0 &&
      !candidate.acceptedUnitId &&
      !candidate.closure &&
      (seed.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
  )!;
  const movementId = open.id;
  const unitId = open.referredUnitIds[0]!;
  const steps = [
    {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId,
      unitId,
      actingUnitId: unitId,
      overrideReason: "The bed information is known to be out of date",
    },
    { type: "PULL_PATIENT", role: "ward", movementId, unitId, actingUnitId: unitId },
    {
      type: "BOOK_TRANSPORT",
      role: "ed",
      movementId,
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "CAD-DOM-1",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    },
    { type: "HANDOVER_READY", role: "ed", movementId },
    { type: "TRANSPORT_ACCEPTED", role: "officer", movementId },
    { type: "TRANSPORT_EN_ROUTE", role: "officer", movementId },
    { type: "PATIENT_COLLECTED", role: "officer", movementId },
    ending === "diverted"
      ? {
          type: "RECORD_DIVERSION",
          role: "officer",
          movementId,
          reason: DIVERSION_REASONS[0],
          place: TRANSPORT_WHEREABOUTS[1],
        }
      : {
          type: "STOP_TRANSPORT",
          role: "coordinator",
          movementId,
          reason: "The examination made no order",
          whereabouts: "At another emergency department",
        },
  ].map((step, index) => ({ ...step, now: NOW + index + 1 }) as unknown as WardFlowEvent);
  return { movementId, unitId, steps };
}

function reduce(steps: WardFlowEvent[]): WardFlowState {
  const state = steps.reduce(wardFlowReducer, seedWardFlowState());
  expect(state.rejections, state.rejections.at(-1)?.reason).toHaveLength(0);
  return state;
}

const identity = () => ({
  displayName: "Synthetic patient",
  formalName: "PATIENT, Synthetic",
  initials: "SP",
  umrn: "UM000001",
});

/**
 * Simplification R1 (26 Nov 2026): every door that gives a pulled bed back opens the one shared
 * "Release pulled bed" sheet. It still asks first, names the person with the record number, states why
 * the bed is being released, and records nothing until its final button, which names the patient again
 * (CT-19). The release now comes back from the toast's Undo, so "cannot be undone" is gone. The sheet
 * dispatches through the provider, so these cases hand the provider a recording dispatch.
 */
function Recording({
  dispatch,
  rejections,
  children,
}: {
  dispatch: (event: WardFlowEvent) => unknown;
  rejections?: unknown[];
  children: ReactNode;
}) {
  const state = useWardFlow();
  const value = { ...state, dispatch, ...(rejections ? { rejections } : {}) } as unknown as typeof state;
  return <WardFlowOverride value={value}>{children}</WardFlowOverride>;
}

const releaseButton = () => screen.getByRole("button", { name: /^Release pulled bed for / });

describe("release a diverted journey's pulled bed asks first (CT-07)", () => {
  function renderCorridor(dispatch: (event: WardFlowEvent) => unknown, options: { earlierRejection?: boolean } = {}) {
    const { movementId, unitId, steps } = journeySteps("diverted");
    const state = reduce(steps);
    const movement = state.movements.find((m) => m.id === movementId)!;
    const unit = state.units.find((u) => u.id === unitId)!;
    const earlier = options.earlierRejection
      ? { id: "earlier", at: NOW, movementId, attempted: "PULL_BED", reason: "Bed not ready." }
      : undefined;
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW}>
          <Recording dispatch={dispatch} rejections={earlier ? [earlier] : undefined}>
            <WardArrivalsCorridor
              unit={unit}
              accepted={[movement]}
              now={NOW}
              resolvePatientIdentity={identity}
              releaseOpenFor={undefined}
              toggleRelease={vi.fn()}
              releaseReason={undefined}
              setReleaseReason={vi.fn()}
              submitRelease={vi.fn()}
              lastActionRejection={earlier}
              dispatch={dispatch as never}
              setCheckToken={vi.fn()}
              priorRejectionCountRef={{ current: 0 }}
              rejections={earlier ? [earlier] : []}
              overrideReasonForm={() => null}
            />
          </Recording>
        </WardFlowProvider>
      </ToastProvider>,
    );
    return { movementId, unitId, unit };
  }

  it("on the ward arrivals corridor: names the person and ward, Keep as is records nothing", async () => {
    const dispatch = vi.fn();
    const { movementId, unitId, unit } = renderCorridor(dispatch);
    fireEvent.click(screen.getByTestId(`ward-release-diverted-bed-${movementId}`));
    expect(dispatch).not.toHaveBeenCalled();
    const sheet = await screen.findByTestId("ward-release-pulled-bed-sheet");
    expect(sheet).toHaveTextContent(`Bed pulled at ${unit.name}`);
    expect(sheet).toHaveTextContent("Releasing the bed also closes the journey");
    expect(screen.getByTestId("ward-release-pulled-bed-sheet-who")).toHaveTextContent("Synthetic patient");
    expect(screen.getByTestId("ward-release-pulled-bed-sheet-who")).toHaveTextContent("UM000001");
    expect(releaseButton()).toHaveAccessibleName("Release pulled bed for Synthetic patient");
    // Closing the sheet without the final button records nothing.
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("ward-release-pulled-bed-sheet")).toBeNull());
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`ward-release-diverted-bed-${movementId}`));
    await screen.findByTestId("ward-release-pulled-bed-sheet");
    fireEvent.click(releaseButton());
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: "RELEASE_DIVERTED_BED",
      movementId,
      actingUnitId: unitId,
    });
  });

  it("on the ward arrivals corridor: a release the save refuses is said (Q93)", async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve({ commandId: "c-1", status: "refused" as const, message: "This record changed." }),
    );
    const { movementId } = renderCorridor(dispatch);
    fireEvent.click(screen.getByTestId(`ward-release-diverted-bed-${movementId}`));
    await screen.findByTestId("ward-release-pulled-bed-sheet");
    fireEvent.click(releaseButton());
    expect(dispatch).toHaveBeenCalledTimes(1);
    // The shared sheet says a refusal on its toast, naming the engine's reason.
    expect(await screen.findByText(/Not recorded: .*This record changed\./u)).toBeInTheDocument();
  });

  it("on the ward arrivals corridor: an earlier rejection never hides a new release failure", async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve({ commandId: "c-2", status: "refused" as const, message: "This record changed." }),
    );
    const { movementId } = renderCorridor(dispatch, { earlierRejection: true });
    fireEvent.click(screen.getByTestId(`ward-release-diverted-bed-${movementId}`));
    await screen.findByTestId("ward-release-pulled-bed-sheet");
    fireEvent.click(releaseButton());
    expect(await screen.findByText(/Not recorded: .*This record changed\./u)).toBeInTheDocument();
  });

  it("on the ED Referred list: asks first and dispatches only after confirming", async () => {
    const { movementId, unitId, steps } = journeySteps("diverted");
    const state = reduce(steps);
    const movement = state.movements.find((m) => m.id === movementId)!;
    const unit = state.units.find((u) => u.id === unitId)!;
    const raise = vi.fn();
    const dispatch = vi.fn();
    const ctx = {
      now: NOW,
      department: { name: "Synthetic ED" },
      raise,
      movements: state.movements,
      units: state.units,
      referrals: state.referrals,
      registryPatients: state.patients,
      departmentListTab: "referred",
      setArrivalPlanOpenFor: vi.fn(),
      genderRecordDraft: {},
      setGenderRecordDraft: vi.fn(),
      outbox: [movement],
      answeredAll: [],
      answered: [],
    } as unknown as EdScreenContext;
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW}>
          <Recording dispatch={dispatch}>
            <EdReferredPanel ctx={ctx} />
          </Recording>
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-ed-release-diverted-bed-${movementId}`));
    expect(dispatch).not.toHaveBeenCalled();
    const sheet = await screen.findByTestId("ward-ed-release-diverted-sheet");
    expect(sheet).toHaveTextContent(`Bed pulled at ${unit.name}`);
    expect(screen.getByTestId("ward-ed-release-diverted-sheet-who")).toHaveTextContent(/UM\d+/u);
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("ward-ed-release-diverted-sheet")).toBeNull());
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`ward-ed-release-diverted-bed-${movementId}`));
    await screen.findByTestId("ward-ed-release-diverted-sheet");
    fireEvent.click(releaseButton());
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: "RELEASE_DIVERTED_BED", role: "ed", movementId });
  });
});

describe("the movement cockpit asks before releasing a pulled bed (CT-07)", () => {
  function renderCockpit(ending: "diverted" | "stopped") {
    const { movementId, steps } = journeySteps(ending);
    function Drive() {
      const { dispatch, movements } = useWardFlow();
      const m = movements.find((candidate) => candidate.id === movementId);
      return (
        <>
          <button type="button" data-testid="test-drive" onClick={() => steps.forEach((step) => dispatch(step))} />
          <output data-testid="live-closed">{m?.closure ? "closed" : "open"}</output>
          <output data-testid="live-held">{m?.admissionId === undefined ? "released" : "held"}</output>
        </>
      );
    }
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW}>
          <Drive />
          <MovementWorkspaceCockpit movementId={movementId as never} />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId("test-drive"));
    return movementId;
  }

  it("diverted: closing records nothing; confirming releases the bed and closes the journey", async () => {
    renderCockpit("diverted");
    fireEvent.click(screen.getByTestId("ward-console-release-diverted-bed"));
    const sheet = await screen.findByTestId("ward-console-release-bed-sheet");
    expect(sheet).toHaveTextContent("Releasing the bed also closes the journey");
    expect(screen.getByTestId("ward-console-release-bed-sheet-who")).toHaveTextContent(/UM\d+/u);
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("ward-console-release-bed-sheet")).toBeNull());
    expect(screen.getByTestId("live-held")).toHaveTextContent("held");
    fireEvent.click(screen.getByTestId("ward-console-release-diverted-bed"));
    await screen.findByTestId("ward-console-release-bed-sheet");
    fireEvent.click(releaseButton());
    await waitFor(() => expect(screen.getByTestId("live-held")).toHaveTextContent("released"));
    expect(screen.getByTestId("live-closed")).toHaveTextContent("closed");
  });

  it("stopped: closing records nothing; confirming releases the held bed", async () => {
    renderCockpit("stopped");
    fireEvent.click(screen.getByTestId("ward-console-release-held-bed"));
    const sheet = await screen.findByTestId("ward-console-release-bed-sheet");
    expect(sheet).toHaveTextContent("Transport was stopped after collection");
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("ward-console-release-bed-sheet")).toBeNull());
    expect(screen.getByTestId("live-held")).toHaveTextContent("held");
    fireEvent.click(screen.getByTestId("ward-console-release-held-bed"));
    await screen.findByTestId("ward-console-release-bed-sheet");
    fireEvent.click(releaseButton());
    await waitFor(() => expect(screen.getByTestId("live-held")).toHaveTextContent("released"));
  });
});

// Untested-537 INV-ACTION-146/147 (14 Nov 2026): the site bed manager may not release a stopped or
// diverted journey's pulled bed (EVENT_ROLE), so the ward corridor no longer opens the release for it.
describe("the ward corridor's bed releases follow the desk's own role", () => {
  it.each(["diverted", "stopped"] as const)(
    "a %s journey: the site bed manager's release is greyed and asks nothing",
    (ending) => {
      cleanup();
      setDeskRole("bed_manager", "/bedchart/movements/patient");
      const { movementId, unitId, steps } = journeySteps(ending);
      const state = reduce(steps);
      const movement = state.movements.find((m) => m.id === movementId)!;
      const unit = state.units.find((u) => u.id === unitId)!;
      const dispatch = vi.fn();
      render(
        <WardArrivalsCorridor
          unit={unit}
          accepted={ending === "diverted" ? [movement] : []}
          heldAfterStop={ending === "stopped" ? [movement] : []}
          now={NOW}
          resolvePatientIdentity={identity}
          releaseOpenFor={undefined}
          toggleRelease={vi.fn()}
          releaseReason={undefined}
          setReleaseReason={vi.fn()}
          submitRelease={vi.fn()}
          lastActionRejection={undefined}
          dispatch={dispatch}
          setCheckToken={vi.fn()}
          priorRejectionCountRef={{ current: 0 }}
          rejections={[]}
          overrideReasonForm={() => null}
        />,
      );
      const release = screen.getByTestId(
        ending === "diverted" ? `ward-release-diverted-bed-${movementId}` : `ward-release-stopped-bed-${movementId}`,
      );
      expect(release).toBeDisabled();
      fireEvent.click(release);
      expect(screen.queryByRole("button", { name: "Keep as is" })).toBeNull();
      expect(dispatch).not.toHaveBeenCalled();
      cleanup();
    },
  );
});
