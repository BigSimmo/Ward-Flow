import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startTraining, stopTraining } from "@/components/ward-management/demo-reset/ward-training-mode";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import type { SharedSnapshot } from "@/components/ward-management/ward-shared-client";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Feature 47, the training sandbox. Synthetic data only. While training is on, the provider must run
 * a local world seeded from the standard demo (never the shared snapshot), and no change, record view
 * or audit call may reach the shared connection.
 */

const MOVEMENT = "WF-004";
// A shared world the training world must never copy: its generation marks it.
const SHARED_GENERATION = 41;

afterEach(() => {
  act(() => stopTraining());
  cleanup();
});

function Harness() {
  const raise = useWardRaise("coordinator");
  const { movements, worldGeneration, shared } = useWardFlow();
  const session = useContext(SharedSessionContext);
  const transport = movements.find((movement) => movement.id === MOVEMENT)?.transport;
  return (
    <>
      <button
        type="button"
        data-testid="book"
        onClick={() =>
          raise("BOOK_TRANSPORT", {
            movementId: MOVEMENT,
            provider: "Ambulance (St John)",
            escortRequired: true,
            cadNumber: "CAD-SYN-TRAIN-0001",
            transportLegalStatus: "involuntary",
            estimatedAt: NOW_ANCHOR + 30,
          })
        }
      >
        Book
      </button>
      <button type="button" data-testid="view" onClick={() => void session?.logRecordView("P-SYN-1", "patient")}>
        View
      </button>
      <output data-testid="job">{transport?.id ?? "none"}</output>
      <output data-testid="generation">{worldGeneration}</output>
      <output data-testid="shared">{shared?.enabled ? "shared" : "local"}</output>
    </>
  );
}

function sharedConnection() {
  const state = { ...seedWardFlowState(), worldGeneration: SHARED_GENERATION };
  const snapshot: SharedSnapshot = {
    dataMode: "prototype",
    revision: 1,
    now: NOW_ANCHOR,
    payload: { version: 1, state, dayZero: "2026-11-04T00:00:00Z", startedAt: "2026-11-04T10:00:00Z" },
  };
  const dispatch = vi.fn<WardSharedConnection["dispatch"]>(() =>
    Promise.resolve({ commandId: "shared-1", status: "accepted" as const }),
  );
  const logRecordView = vi.fn(() => Promise.resolve(true));
  const signOut = vi.fn();
  const connection: WardSharedConnection = {
    snapshot,
    receivedAt: 1,
    status: "ready",
    error: null,
    eventLog: [],
    enabled: true,
    signedIn: true,
    actorId: "synthetic-training-account",
    access: { role: "coordinator", scope: { kind: "statewide" } },
    dispatch,
    logRecordView,
    retry: vi.fn(),
    signIn: vi.fn(),
    signOut,
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
  };
  return { connection, dispatch, logRecordView, signOut };
}

function renderWith(connection: WardSharedConnection) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR} sharedConnection={connection}>
      <Harness />
    </WardFlowProvider>,
  );
}

describe("training sandbox (feature 47)", () => {
  it("without training, a change goes to the shared workspace (control)", async () => {
    const { connection, dispatch } = sharedConnection();
    renderWith(connection);
    expect(screen.getByTestId("generation")).toHaveTextContent(String(SHARED_GENERATION));
    fireEvent.click(screen.getByTestId("book"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
  });

  it("with training on, seeds the synthetic demo world and keeps every change local", async () => {
    const { connection, dispatch, logRecordView, signOut } = sharedConnection();
    act(() => startTraining());
    renderWith(connection);
    // Seeded from the standard demo, not copied from the shared snapshot.
    expect(screen.getByTestId("generation")).not.toHaveTextContent(String(SHARED_GENERATION));
    expect(screen.getByTestId("shared")).toHaveTextContent("local");
    fireEvent.click(screen.getByTestId("book"));
    await waitFor(() => expect(screen.getByTestId("job")).not.toHaveTextContent("none"));
    // The routing point: nothing reached the shared connection, and opening a record logged nothing.
    fireEvent.click(screen.getByTestId("view"));
    expect(dispatch).not.toHaveBeenCalled();
    expect(logRecordView).not.toHaveBeenCalled();
    // Only the on/off flag is kept for this tab: no patient data.
    expect(window.sessionStorage.getItem("wf-training")).toBe("on");
    expect(Object.keys(window.sessionStorage).filter((key) => key.includes("training"))).toEqual(["wf-training"]);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("stopping discards the training world and returns to the shared one untouched", async () => {
    const { connection, dispatch } = sharedConnection();
    act(() => startTraining());
    renderWith(connection);
    fireEvent.click(screen.getByTestId("book"));
    await waitFor(() => expect(screen.getByTestId("job")).not.toHaveTextContent("none"));
    act(() => stopTraining());
    expect(screen.getByTestId("generation")).toHaveTextContent(String(SHARED_GENERATION));
    expect(screen.getByTestId("shared")).toHaveTextContent("shared");
    expect(screen.getByTestId("job")).toHaveTextContent("none");
    expect(dispatch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("wf-training")).toBeNull();
  });
});
