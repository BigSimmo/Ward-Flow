import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WardSharedAccess, type WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

/*
 * TE-05 (audit, 5 Nov 2026): "Review change" loads the activity panel's code on the tap. Offline that
 * load fails; the tap used to do nothing and raise an unhandled rejection. It now says so.
 */
vi.mock("@/components/ward-management/shell/ward-activity-panel-store", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

afterEach(() => {
  cleanup();
  resetWardLiveRegionForTests();
});

it("says the change could not open when its panel code fails to load", async () => {
  const seed = seedWardFlowStateAt(0);
  const connection = {
    enabled: true,
    signedIn: true,
    actorId: "synthetic-recovery-account",
    access: { role: "coordinator", scope: { kind: "statewide" } },
    status: "ready",
    unconfirmedSave: false,
    error: null,
    receivedAt: Date.now(),
    recoveryResults: [{ commandId: "00000000-0000-4000-8000-000000000001", outcome: "unknown" }],
    snapshot: {
      accessContext: "a".repeat(64),
      dataMode: "prototype",
      revision: 1,
      now: 642,
      payload: { version: 1, state: seed, dayZero: "2026-10-23T00:00:00Z", startedAt: "2026-10-23T10:00:00Z" },
    },
    dispatch: vi.fn(),
    retry: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
  } satisfies WardSharedConnection;
  render(
    <>
      <WardLiveRegion />
      <WardSharedAccess connection={connection}>
        <p>Board</p>
      </WardSharedAccess>
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Review change 1" }));
  await waitFor(() =>
    expect(document.body.textContent).toContain("The change could not open. Check the connection, then try again."),
  );
});
