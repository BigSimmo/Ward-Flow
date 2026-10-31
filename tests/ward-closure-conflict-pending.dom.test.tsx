import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";

import { WardClosurePanel } from "@/components/ward-management/capacity/ward-closure-panel";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardSharedSaveContext } from "@/components/ward-management/shell/ward-shared-save-context";
import { SharedWorkspaceClient } from "@/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Unit } from "@/components/ward-management/ward-model";

it("does not resend a pending reopen from the close-conflict recovery control", async () => {
  const state = seedWardFlowStateAt(0);
  const unit = state.units[0]!;
  const closed: Unit = {
    ...unit,
    isClosed: true,
    admissionsClosure: { reason: "infection_outbreak", at: NOW_ANCHOR, by: "Coordinator" },
  };
  const snapshot = {
    dataMode: "prototype",
    revision: 1,
    now: NOW_ANCHOR,
    payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  };
  const sent: { commandId: string; event: { type: string } }[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic",
    changed: () => {},
    manageDrafts: false,
    fetch: async (_url, init) => {
      if (init?.body) {
        sent.push(JSON.parse(String(init.body)));
        throw new Error("Synthetic lost response");
      }
      return Response.json({ snapshot, accessUntil: Date.now() + 60_000 });
    },
  });
  try {
    await client.refresh();
    const tree = (shownUnit: Unit, pending: boolean) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardSharedSaveContext.Provider
          value={{
            unconfirmedSave: pending,
            status: pending ? "unavailable" : "ready",
            error: null,
            retry: client.retry,
          }}
        >
          <WardClosurePanel unit={shownUnit} now={NOW_ANCHOR} actor={{ role: "coordinator" }} />
        </WardSharedSaveContext.Provider>
      </WardFlowProvider>
    );
    const view = render(tree(unit, false));
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    view.rerender(tree(closed, false));
    expect(screen.getByTestId("ward-closure-alert").textContent).toContain("was closed first");

    const outcome = await client.dispatch({
      type: "REOPEN_WARD_TO_ADMISSIONS",
      role: "coordinator",
      unitId: unit.id,
      now: NOW_ANCHOR,
    });
    expect(outcome.status).toBe("failed");
    expect(sent).toHaveLength(1);
    view.rerender(tree(closed, true));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(sent).toHaveLength(1);
    expect(screen.getByTestId("ward-closure-alert")).toBeTruthy();

    // Pending-command recovery keeps its own explicit control and command identity.
    await client.retry();
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.event.type).toBe("REOPEN_WARD_TO_ADMISSIONS");
    expect(sent[1]!.commandId).toBe(sent[0]!.commandId);
  } finally {
    client.dispose();
  }
});
