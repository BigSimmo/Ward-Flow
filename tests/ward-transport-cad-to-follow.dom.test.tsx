import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSyncExternalStore } from "react";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { TransportCadToFollow } from "@/components/ward-management/transport/transport-cad-to-follow";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * CAD to follow (Josh, 27 Oct 2026): a dispatched job booked without its CAD number warns, and the
 * officer adds the number later. Synthetic seed only.
 */

afterEach(cleanup);

const MOVEMENT = "WF-004";

function Harness() {
  const raise = useWardRaise("coordinator");
  const { movements } = useWardFlow();
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
            cadNumber: "",
            transportLegalStatus: "involuntary",
            estimatedAt: NOW_ANCHOR + 30,
          })
        }
      >
        Book
      </button>
      <button
        type="button"
        data-testid="cancel"
        onClick={() => raise("CANCEL_TRANSPORT", { movementId: MOVEMENT, reason: "provider_unavailable" })}
      >
        Cancel
      </button>
      <output data-testid="job">{transport?.id ?? "none"}</output>
      <output data-testid="cancelled">{transport?.cancelledAt === undefined ? "active" : "cancelled"}</output>
      <output data-testid="cad">{transport?.cadNumber ?? "none"}</output>
      <TransportCadToFollow
        movementId={MOVEMENT}
        transportId={transport?.id ?? "unbooked"}
        role="officer"
        testId="cad-follow"
      />
    </>
  );
}

describe("adding a CAD number that was to follow", () => {
  it("names why the save is greyed, refuses a placeholder, and clears the box only once saved", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("book"));
    expect(screen.getByTestId("cad")).toHaveTextContent("none");
    expect(screen.getByTestId("cad-follow-warning")).toHaveTextContent("CAD to follow");

    const save = screen.getByTestId("cad-follow-save");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("cad-follow")).toHaveTextContent("Type the CAD number from the provider first");

    const input = screen.getByTestId("cad-follow-input");
    fireEvent.change(input, { target: { value: "TBC" } });
    expect(screen.getByTestId("cad-follow-save")).toHaveAttribute("aria-disabled", "true");

    fireEvent.change(input, { target: { value: " CAD-SYN-4410 " } });
    fireEvent.click(screen.getByTestId("cad-follow-save"));
    expect(screen.getByTestId("cad")).toHaveTextContent("CAD-SYN-4410");
    expect(screen.getByTestId("cad-follow-input")).toHaveValue("");
  });
  it("does not carry an unfinished CAD number into a replacement booking on the same movement", () => {
    sessionStorage.clear();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("book"));
    const firstJob = screen.getByTestId("job").textContent;
    expect(firstJob).not.toBe("none");
    fireEvent.change(screen.getByTestId("cad-follow-input"), { target: { value: "CAD-SYN-OLD-4410" } });
    fireEvent.click(screen.getByTestId("cancel"));
    expect(screen.getByTestId("job")).toHaveTextContent("none");
    fireEvent.click(screen.getByTestId("book"));
    expect(screen.getByTestId("job").textContent).not.toBe(firstJob);
    expect(screen.getByTestId("cancelled")).toHaveTextContent("active");
    expect(screen.getByTestId("cad-follow-input")).toHaveValue("");
    expect(screen.getByTestId("cad-follow-save")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId("cad-follow-save"));
    expect(screen.getByTestId("cad")).toHaveTextContent("none");
    fireEvent.change(screen.getByTestId("cad-follow-input"), { target: { value: "CAD-SYN-NEW-5520" } });
    fireEvent.click(screen.getByTestId("cad-follow-save"));
    expect(screen.getByTestId("cad")).toHaveTextContent("CAD-SYN-NEW-5520");
    expect(screen.getByTestId("cad-follow-input")).toHaveValue("");
  });

  it("keeps cancellation and rebooking separate through the actual shared client and DOM", async () => {
    let state = seedWardFlowState();
    let revision = 1;
    let view: SharedView = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
    const listeners = new Set<() => void>();
    const sent: WardFlowEvent[] = [];
    let finishCad!: () => void;
    const cadAcknowledgement = new Promise<void>((resolve) => {
      finishCad = resolve;
    });
    const snapshot = (): SharedSnapshot => ({
      dataMode: "prototype",
      revision,
      now: NOW_ANCHOR,
      payload: { version: 1, state, dayZero: "2026-11-04T00:00:00Z", startedAt: "2026-11-04T10:00:00Z" },
    });
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic-token",
      changed: (next) => {
        view = next;
        listeners.forEach((listener) => listener());
      },
      fetch: async (_url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot() });
        const body = JSON.parse(String(options.body));
        const event = body.event as WardFlowEvent;
        sent.push(event);
        const previousRefusals = state.rejections.length;
        state = wardFlowReducer(state, event);
        expect(state.rejections).toHaveLength(previousRefusals);
        revision += 1;
        if (event.type === "RECORD_TRANSPORT_CAD") await cadAcknowledgement;
        return Response.json({ outcome: "accepted", commandRevision: revision, snapshot: snapshot() });
      },
    });
    function SharedHarness() {
      const current = useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => view,
      );
      const shared: WardSharedConnection = {
        ...current,
        enabled: true,
        signedIn: true,
        actorId: "synthetic-cad-account",
        access: { role: "coordinator", scope: { kind: "statewide" } },
        dispatch: (event) => client.dispatch(event),
        retry: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
      };
      return (
        <WardFlowProvider initialNow={NOW_ANCHOR} sharedConnection={shared}>
          <Harness />
        </WardFlowProvider>
      );
    }
    try {
      await client.refresh();
      render(<SharedHarness />);
      fireEvent.click(screen.getByTestId("book"));
      await waitFor(() => expect(screen.getByTestId("job")).not.toHaveTextContent("none"));
      const oldJob = screen.getByTestId("job").textContent;
      fireEvent.change(screen.getByTestId("cad-follow-input"), { target: { value: "CAD-SYN-OLD-4410" } });
      fireEvent.click(screen.getByTestId("cancel"));
      await waitFor(() => expect(screen.getByTestId("job")).toHaveTextContent("none"));
      fireEvent.click(screen.getByTestId("book"));
      await waitFor(() => expect(screen.getByTestId("job").textContent).not.toBe(oldJob));
      expect(screen.getByTestId("cad-follow-input")).toHaveValue("");
      fireEvent.click(screen.getByTestId("cad-follow-save"));
      expect(sent.filter((event) => event.type === "RECORD_TRANSPORT_CAD")).toHaveLength(0);
      fireEvent.change(screen.getByTestId("cad-follow-input"), { target: { value: "CAD-SYN-NEW-5520" } });
      fireEvent.click(screen.getByTestId("cad-follow-save"));
      await waitFor(() => expect(sent.filter((event) => event.type === "RECORD_TRANSPORT_CAD")).toHaveLength(1));
      expect(screen.getByTestId("cad-follow-input")).toBeDisabled();
      expect(screen.getByTestId("cad-follow-save").closest("[inert]")).not.toBeNull();
      // jsdom does not implement browser inert; the form's own pending lock must still reject
      // an explicitly dispatched duplicate click while the shared acknowledgement is held.
      fireEvent.click(screen.getByTestId("cad-follow-save"));
      expect(sent.filter((event) => event.type === "RECORD_TRANSPORT_CAD")).toHaveLength(1);
      await act(async () => {
        finishCad();
      });
      await waitFor(() => expect(screen.getByTestId("cad")).toHaveTextContent("CAD-SYN-NEW-5520"));
      expect(sent.map((event) => event.type)).toEqual([
        "BOOK_TRANSPORT",
        "CANCEL_TRANSPORT",
        "BOOK_TRANSPORT",
        "RECORD_TRANSPORT_CAD",
      ]);
      expect(state.movements.find((movement) => movement.id === MOVEMENT)?.transport?.cadNumber).toBe(
        "CAD-SYN-NEW-5520",
      );
    } finally {
      client.dispose();
    }
  });
});
