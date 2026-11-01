import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/movements/patient",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { EdReferredPanel } from "@/components/ward-management/ed/ed-screen-referred";
import type { EdScreenContext } from "@/components/ward-management/ed/ed-screen-context";
import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";
import { DIVERSION_REASONS, TRANSPORT_WHEREABOUTS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
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
      overrideReason: "The bed information is known to be out of date",
    },
    { type: "PULL_PATIENT", role: "ward", movementId, unitId },
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
          reason: "The examination was revoked",
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

describe("release a diverted journey's pulled bed asks first (CT-07)", () => {
  it("on the ward arrivals corridor: names the person and ward, Cancel records nothing", () => {
    const { movementId, unitId, steps } = journeySteps("diverted");
    const state = reduce(steps);
    const movement = state.movements.find((m) => m.id === movementId)!;
    const unit = state.units.find((u) => u.id === unitId)!;
    const dispatch = vi.fn();
    render(
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
        lastActionRejection={undefined}
        dispatch={dispatch}
        setCheckToken={vi.fn()}
        priorRejectionCountRef={{ current: 0 }}
        rejections={[]}
        overrideReasonForm={() => null}
      />,
    );
    fireEvent.click(screen.getByTestId(`ward-release-diverted-bed-${movementId}`));
    expect(dispatch).not.toHaveBeenCalled();
    const dialog = screen.getByTestId("ward-release-diverted-confirm");
    expect(dialog).toHaveTextContent(`pulled at ${unit.name} for Synthetic patient`);
    expect(dialog).toHaveTextContent("cannot be undone");
    expect(screen.getByTestId("ward-release-diverted-identity")).toHaveTextContent(
      "Check: PATIENT, Synthetic · UM000001",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`ward-release-diverted-bed-${movementId}`));
    fireEvent.click(screen.getByRole("button", { name: "Release pulled bed" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: "RELEASE_DIVERTED_BED",
      movementId,
      actingUnitId: unitId,
    });
  });

  it("on the ward arrivals corridor: a release the save refuses is said on the card (Q93)", async () => {
    const { movementId, unitId, steps } = journeySteps("diverted");
    const state = reduce(steps);
    const movement = state.movements.find((m) => m.id === movementId)!;
    const unit = state.units.find((u) => u.id === unitId)!;
    const dispatch = vi.fn(() =>
      Promise.resolve({ commandId: "c-1", status: "refused" as const, message: "This record changed." }),
    );
    render(
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
        lastActionRejection={undefined}
        dispatch={dispatch}
        setCheckToken={vi.fn()}
        priorRejectionCountRef={{ current: 0 }}
        rejections={[]}
        overrideReasonForm={() => null}
      />,
    );
    fireEvent.click(screen.getByTestId(`ward-release-diverted-bed-${movementId}`));
    fireEvent.click(screen.getByRole("button", { name: "Release pulled bed" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId(`ward-release-failure-${movementId}`)).toHaveTextContent(
      "Release pulled bed not recorded: This record changed.",
    );
  });

  it("on the ward arrivals corridor: an earlier rejection never hides a new release failure", async () => {
    const { movementId, unitId, steps } = journeySteps("diverted");
    const state = reduce(steps);
    const movement = state.movements.find((m) => m.id === movementId)!;
    const unit = state.units.find((u) => u.id === unitId)!;
    const dispatch = vi.fn(() =>
      Promise.resolve({ commandId: "c-2", status: "refused" as const, message: "This record changed." }),
    );
    const earlier = { id: "earlier", at: NOW, movementId, attempted: "PULL_BED", reason: "Bed not ready." };
    render(
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
        dispatch={dispatch}
        setCheckToken={vi.fn()}
        priorRejectionCountRef={{ current: 0 }}
        rejections={[earlier]}
        overrideReasonForm={() => null}
      />,
    );
    fireEvent.click(screen.getByTestId(`ward-release-diverted-bed-${movementId}`));
    fireEvent.click(screen.getByRole("button", { name: "Release pulled bed" }));
    expect(await screen.findByTestId(`ward-release-failure-${movementId}`)).toHaveTextContent(
      "Release pulled bed not recorded: This record changed.",
    );
  });

  it("on the ED Referred list: asks first and raises only after confirming", () => {
    const { movementId, unitId, steps } = journeySteps("diverted");
    const state = reduce(steps);
    const movement = state.movements.find((m) => m.id === movementId)!;
    const unit = state.units.find((u) => u.id === unitId)!;
    const raise = vi.fn();
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
    render(<EdReferredPanel ctx={ctx} />);
    fireEvent.click(screen.getByTestId(`ward-ed-release-diverted-bed-${movementId}`));
    expect(raise).not.toHaveBeenCalled();
    const dialog = screen.getByTestId("ward-ed-release-diverted-confirm");
    expect(dialog).toHaveTextContent(`pulled at ${unit.name}`);
    expect(dialog).toHaveTextContent("cannot be undone");
    expect(screen.getByTestId("ward-ed-release-diverted-identity")).toHaveTextContent(/^Check: /);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(raise).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`ward-ed-release-diverted-bed-${movementId}`));
    fireEvent.click(screen.getByRole("button", { name: "Release pulled bed" }));
    expect(raise).toHaveBeenCalledExactlyOnceWith("RELEASE_DIVERTED_BED", { movementId });
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
      <WardFlowProvider initialNow={NOW}>
        <Drive />
        <MovementWorkspaceCockpit movementId={movementId as never} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("test-drive"));
    return movementId;
  }

  it("diverted: Cancel records nothing; confirming releases the bed and closes the journey", () => {
    renderCockpit("diverted");
    fireEvent.click(screen.getByTestId("ward-console-release-diverted-bed"));
    expect(screen.getByTestId("ward-console-release-bed-confirm")).toHaveTextContent("cannot be undone");
    expect(screen.getByTestId("ward-console-release-bed-identity")).toHaveTextContent(/^Check: /);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("live-held")).toHaveTextContent("held");
    fireEvent.click(screen.getByTestId("ward-console-release-diverted-bed"));
    fireEvent.click(screen.getByRole("button", { name: "Release pulled bed" }));
    expect(screen.getByTestId("live-held")).toHaveTextContent("released");
    expect(screen.getByTestId("live-closed")).toHaveTextContent("closed");
  });

  it("stopped: Cancel records nothing; confirming releases the held bed", () => {
    renderCockpit("stopped");
    fireEvent.click(screen.getByTestId("ward-console-release-held-bed"));
    expect(screen.getByTestId("ward-console-release-bed-confirm")).not.toHaveTextContent("cannot be undone");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("live-held")).toHaveTextContent("held");
    fireEvent.click(screen.getByTestId("ward-console-release-held-bed"));
    fireEvent.click(screen.getByRole("button", { name: "Release pulled bed" }));
    expect(screen.getByTestId("live-held")).toHaveTextContent("released");
  });
});
