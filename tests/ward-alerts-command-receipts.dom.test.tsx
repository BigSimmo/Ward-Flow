import "@testing-library/jest-dom/vitest";
import { ConfirmHost } from "@/components/wf/confirm-dialog";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { PULL_NOW_LIVE_STAGES } from "@/components/ward-management/alerts/ward-broadcast-model";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({
  getElementError: () => new Error("Broadcast receipt query failed; record-bearing diagnostics suppressed."),
});

let recordBroadcast: WardCommandDispatch;
let recordStandDown: WardCommandDispatch | undefined;
let showStandDownFixtures = false;
let publishUnrelated: () => void;

function ReceiptBoundary({ children, scoped }: { children: ReactNode; scoped: boolean }) {
  const value = useWardFlow();
  const [extraLog, setExtraLog] = useState<EventLogEntry[]>([]);
  useEffect(() => {
    publishUnrelated = () =>
      setExtraLog([
        {
          sequence: 1_000_000,
          type: "DISPATCH_BROADCAST_ALERT",
          role: "coordinator",
          now: NOW_ANCHOR,
          accepted: true,
        },
      ]);
  }, []);
  const dispatch: WardCommandDispatch = (event) =>
    event.type === "DISPATCH_BROADCAST_ALERT"
      ? recordBroadcast(event)
      : event.type === "STAND_DOWN_BROADCAST_ALERT" && recordStandDown
        ? recordStandDown(event)
        : value.dispatch(event);
  const waiting = value.movements.find(
    (movement) => !movement.closure && PULL_NOW_LIVE_STAGES.includes(movement.stage),
  )!;
  const fixture: BroadcastAlert = {
    id: "synthetic-directive-A",
    kind: "directive",
    title: "Synthetic first directive",
    message: "Synthetic message",
    severity: "warning",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "Statewide first scope",
    durationMinutes: 60,
    dispatchedAt: NOW_ANCHOR,
    expiresAt: NOW_ANCHOR + 60,
    dispatchedByRole: "coordinator",
    dispatchedByName: "Synthetic coordinator",
    status: "active",
    acknowledgedUnits: [],
  };
  const fixtureAlerts: BroadcastAlert[] = [
    fixture,
    {
      ...fixture,
      id: "synthetic-pull-B",
      kind: "pull_now",
      title: "Synthetic second directive",
      targetScope: "regional_wachs",
      targetScopeLabel: "Synthetic second scope",
      movementId: waiting.id,
      stageChangesAtDispatch: waiting.stageChanges.length,
      targetUnitIds: [value.units[0]!.id],
    },
  ];
  return (
    <WardFlowOverride
      value={{
        ...value,
        ...(showStandDownFixtures ? { broadcastAlerts: fixtureAlerts } : {}),
        dispatch,
        eventLog: scoped ? [] : [...(value.eventLog ?? []), ...extraLog],
        shared: { enabled: true, status: "ready", error: null },
      }}
    >
      {children}
    </WardFlowOverride>
  );
}

function openComposer(role: "coordinator" | "bed_manager") {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(
      role === "bed_manager"
        ? { role, scope: { kind: "site", siteCode: "ARM" } }
        : { role, scope: { kind: "statewide" } },
    );
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReceiptBoundary scoped={role === "bed_manager"}>
        <AlertsScreen />
      </ReceiptBoundary>
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
  fireEvent.click(screen.getByRole("radio", { name: /Tell desks something/u }));
  fireEvent.click(screen.getByRole("button", { name: "Blank" }));
  fireEvent.click(screen.getByRole("button", { name: /^ED desks/u }));
  fireEvent.change(screen.getByLabelText(/^Title$/u), { target: { value: "Synthetic title" } });
  fireEvent.change(screen.getByLabelText(/^Message$/u), { target: { value: "Synthetic message" } });
  fireEvent.click(screen.getByLabelText(/^I'm authorised to send this to /u));
  fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
}

afterEach(() => {
  cleanup();
  recordStandDown = undefined;
  showStandDownFixtures = false;
  sessionStorage.clear();
  localStorage.clear();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("Broadcast own-command confirmation", () => {
  it("confirms a site bed manager's accepted broadcast without exposing a coordinator event log", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const completion = new Promise<WardCommandOutcome>((answer) => {
      resolve = answer;
    });
    recordBroadcast = vi.fn<WardCommandDispatch>(() => completion);
    openComposer("bed_manager");
    expect(recordBroadcast).toHaveBeenCalledWith(expect.objectContaining({ role: "bed_manager" }));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    await act(async () => {
      resolve({ commandId: "synthetic-broadcast", status: "accepted" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(/shown in this prototype/u.test(document.body.textContent ?? "")).toBe(true);
  });

  it("does not treat a different accepted broadcast log entry as this command's receipt", () => {
    recordBroadcast = vi.fn<WardCommandDispatch>(() => new Promise<WardCommandOutcome>(() => {}));
    openComposer("coordinator");
    act(() => {
      publishUnrelated();
    });
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(screen.getByLabelText(/^Title$/u)).toHaveValue("Synthetic title");
  });
  it("keeps a refused draft and blocks a second command while its original-id Retry is uncertain", async () => {
    recordBroadcast = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-refusal",
      status: "refused",
      message: "Synthetic refusal.",
    }));
    openComposer("bed_manager");
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(screen.getByLabelText(/^Title$/u)).toHaveValue("Synthetic title");
    expect(screen.getByRole("dialog")).toHaveTextContent("Synthetic refusal.");
    let confirm!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((answer) => {
      confirm = answer;
    });
    vi.mocked(recordBroadcast).mockReturnValue({
      commandId: "synthetic-broadcast-retry",
      status: "failed",
      confirmation,
    });
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
    expect(recordBroadcast).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    await act(async () => {
      confirm({ commandId: "synthetic-broadcast-retry", status: "accepted" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("an accepted receipt from an ended workspace leaves the draft open", () => {
    recordBroadcast = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-stale",
      status: "accepted",
      isCurrent: () => false,
    }));
    openComposer("bed_manager");
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(screen.getByLabelText(/^Title$/u)).toHaveValue("Synthetic title");
  });
  it.each(["pending", "uncertain"] as const)(
    "keeps the first %s stand-down target when a second visible target is clicked",
    async (mode) => {
      let resolve!: (outcome: WardCommandOutcome) => void;
      const completion = new Promise<WardCommandOutcome>((answer) => {
        resolve = answer;
      });
      recordStandDown = vi.fn<WardCommandDispatch>(() =>
        mode === "pending"
          ? completion
          : { commandId: "synthetic-first-stand-down", status: "failed", confirmation: completion },
      );
      showStandDownFixtures = true;
      act(() => {
        setWardFeatureFlagOnDevice("role-access", true);
        setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
      });
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <ReceiptBoundary scoped={false}>
            <AlertsScreen />
          </ReceiptBoundary>
          <ConfirmHost />
        </WardFlowProvider>,
      );
      // Each stand-down now asks for confirmation first (main's confirm dialog), so confirm the first
      // target, then try the second visible target while the first is still pending or uncertain.
      const confirmStandDown = async () => {
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      };
      fireEvent.click(screen.getByRole("button", { name: "Stand down this alert" }));
      await confirmStandDown();
      await waitFor(() => expect(recordStandDown).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: "Stand down" }));
      if (screen.queryByRole("alertdialog")) await confirmStandDown();
      expect(recordStandDown).toHaveBeenCalledTimes(1);
      expect(recordStandDown).toHaveBeenCalledWith(expect.objectContaining({ alertId: "synthetic-directive-A" }));
      await act(async () => {
        resolve({ commandId: "synthetic-first-stand-down", status: "accepted" });
      });
      expect(screen.getByRole("status", { name: "Broadcast feedback" })).toHaveTextContent(
        "Statewide broadcast directive stood down.",
      );
      expect(screen.getByRole("status", { name: "Broadcast feedback" })).not.toHaveTextContent(
        "Synthetic second scope",
      );
    },
  );
});
