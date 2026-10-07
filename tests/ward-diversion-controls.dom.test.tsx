/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DIVERSION_REASONS, TRANSPORT_WHEREABOUTS } from "../src/components/ward-management/ward-change-reasons";
import { OfficerScreen } from "../src/components/ward-management/officer/officer-screen";
import {
  STAGE_TRANSITION_BLOCKERS,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

vi.mock("../src/components/ward-management/ward-flow-provider", () => ({
  useWardFlow: vi.fn(),
  useWardFlowClock: () => NOW + 10,
}));

import { useWardFlow } from "../src/components/ward-management/ward-flow-provider";

const mockedUseWardFlow = vi.mocked(useWardFlow);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function collectedState(): { state: WardFlowState; movementId: string } {
  const seed = seedWardFlowState();
  const open = seed.movements.find(
    (candidate) =>
      candidate.referredUnitIds.length > 0 &&
      !candidate.acceptedUnitId &&
      !candidate.closure &&
      (seed.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
  );
  if (!open) throw new Error("no open referral with capacity");
  const unitId = open.referredUnitIds[0]!;
  let state = wardFlowReducer(seed, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now: NOW,
    movementId: open.id,
    unitId,
    overrideReason: "The bed information is known to be out of date",
  });
  state = wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW + 1,
    movementId: open.id,
    unitId,
  });
  state = wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: NOW + 2,
    movementId: open.id,
    provider: "Ambulance service",
    escortRequired: false,
    cadNumber: "CAD-DOM-1",
    transportLegalStatus: "voluntary",
    estimatedAt: 0,
  });
  state = wardFlowReducer(state, { type: "HANDOVER_READY", role: "ed", now: NOW + 3, movementId: open.id });
  state = wardFlowReducer(state, { type: "TRANSPORT_ACCEPTED", role: "officer", now: NOW + 4, movementId: open.id });
  state = wardFlowReducer(state, { type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 5, movementId: open.id });
  state = wardFlowReducer(state, { type: "PATIENT_COLLECTED", role: "officer", now: NOW + 6, movementId: open.id });
  expect(state.rejections).toHaveLength(0);
  return { state, movementId: open.id };
}

describe("officer diversion control — T4b", () => {
  it("stays aria-disabled until reason and place are chosen, then dispatches RECORD_DIVERSION", async () => {
    const user = userEvent.setup();
    const { state, movementId } = collectedState();
    const dispatch = vi.fn();
    mockedUseWardFlow.mockReturnValue({
      ...state,
      dispatch,
      rejections: state.rejections,
    } as unknown as ReturnType<typeof useWardFlow>);

    render(<OfficerScreen />);
    await user.click(screen.getByTestId(`ward-officer-select-${movementId}`));
    // v6: the diversion form opens from the job panel's Divert button.
    await user.click(screen.getByTestId(`ward-officer-divert-${movementId}`));
    const button = screen.getByTestId(`ward-officer-record-diversion-${movementId}`);
    expect(button).toHaveAttribute("aria-disabled", "true");

    await user.selectOptions(screen.getByTestId(`ward-officer-diversion-reason-${movementId}`), DIVERSION_REASONS[0]);
    await user.selectOptions(
      screen.getByTestId(`ward-officer-diversion-place-${movementId}`),
      TRANSPORT_WHEREABOUTS[1],
    );
    expect(button).not.toHaveAttribute("aria-disabled");

    await user.click(button);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RECORD_DIVERSION",
        role: "officer",
        movementId,
        reason: DIVERSION_REASONS[0],
        place: TRANSPORT_WHEREABOUTS[1],
      }),
    );
  });

  it("hides the diversion form once diverted and shows the recorded fact", async () => {
    const { state, movementId } = collectedState();
    const diverted = wardFlowReducer(state, {
      type: "RECORD_DIVERSION",
      role: "officer",
      now: NOW + 7,
      movementId,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[1],
    });
    expect(diverted.rejections).toHaveLength(0);
    expect(diverted.movements.find((m) => m.id === movementId)?.blocker).toBe(
      STAGE_TRANSITION_BLOCKERS.divertedAwaitingRelease,
    );

    mockedUseWardFlow.mockReturnValue({
      ...diverted,
      dispatch: vi.fn(),
      rejections: diverted.rejections,
    } as unknown as ReturnType<typeof useWardFlow>);

    render(<OfficerScreen />);
    await userEvent.setup().click(screen.getByTestId(`ward-officer-select-${movementId}`));
    expect(screen.queryByTestId(`ward-officer-record-diversion-${movementId}`)).toBeNull();
    expect(screen.getByTestId(`ward-officer-diverted-${movementId}`)).toHaveTextContent(DIVERSION_REASONS[0]);
  });
});
