import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WardSharedAccess, type WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

/*
 * P172 (Josh, 28 Oct 2026): "The previous uncertain save was accepted. Review the refreshed board
 * before acting again." stays on the page with no way to put it away. It gets a Dismiss button,
 * except while the receipt is still being checked, when changes are disabled until it settles.
 */
const seed = seedWardFlowStateAt(0);
const snapshot = {
  dataMode: "prototype" as const,
  revision: 1,
  now: 642,
  payload: { version: 1 as const, state: seed, dayZero: "2026-10-23T00:00:00Z", startedAt: "2026-10-23T10:00:00Z" },
};
const ACCEPTED = "The previous uncertain save was accepted. Review the refreshed board before acting again.";

function connection(extra: Partial<WardSharedConnection> = {}): WardSharedConnection {
  return {
    enabled: true,
    signedIn: true,
    status: "ready",
    error: null,
    receivedAt: Date.now(),
    snapshot,
    dispatch: vi.fn(),
    retry: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
    ...extra,
  } as WardSharedConnection;
}

afterEach(cleanup);

describe("Dismiss on the uncertain-save outcome (view)", () => {
  it("offers Dismiss beside the outcome and calls the connection's dismissRecovery", () => {
    const dismissRecovery = vi.fn();
    render(
      <WardSharedAccess connection={connection({ recovery: ACCEPTED, dismissRecovery })}>
        <p>Board</p>
      </WardSharedAccess>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(ACCEPTED);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(dismissRecovery).toHaveBeenCalledTimes(1);
  });

  it("does not offer Dismiss while the receipt is still being checked", () => {
    render(
      <WardSharedAccess
        connection={connection({
          recovery: "Checking the previous uncertain save. Changes are disabled until its receipt is checked.",
          recovering: true,
          dismissRecovery: vi.fn(),
        })}
      >
        <p>Board</p>
      </WardSharedAccess>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Checking the previous uncertain save/);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("shows no alert, and no Dismiss, when there is nothing to read", () => {
    render(
      <WardSharedAccess connection={connection({ dismissRecovery: vi.fn() })}>
        <p>Board</p>
      </WardSharedAccess>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });
});

describe("dismissRecovery on the client", () => {
  const commandId = "11111111-1111-4111-8111-111111111111";
  const clients: SharedWorkspaceClient[] = [];
  afterEach(() => {
    for (const client of clients.splice(0)) client.dispose();
  });

  async function reloadedWithAcceptedReceipt(receiptGate?: Promise<void>) {
    const storage = new Map([
      [
        WARD_COMMAND_RECOVERY_KEY,
        JSON.stringify({ commandId, receiptScope: "current", expiresAt: Date.now() + 60_000 }),
      ],
    ]);
    let current: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: (next) => {
        current = next;
      },
      recoveryStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
      fetch: async (url) => {
        if (String(url).includes("/receipt?")) {
          await receiptGate;
          return Response.json({ receipt: { outcome: "accepted", commandRevision: 1 } });
        }
        return Response.json({ snapshot, receiptScope: "current", accessUntil: Date.now() + 60_000 });
      },
    });
    clients.push(client);
    return { client, view: () => current };
  }

  it("clears the settled outcome, and a later poll does not bring it back", async () => {
    const { client, view } = await reloadedWithAcceptedReceipt();
    await client.refresh();
    expect(view()?.recovery).toBe(ACCEPTED);

    client.dismissRecovery();
    expect(view()?.recovery).toBeUndefined();

    await client.refresh();
    expect(view()?.recovery).toBeUndefined();
  });

  it("ignores Dismiss while the receipt is still being checked", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { client, view } = await reloadedWithAcceptedReceipt(gate);
    const settled = client.refresh();
    await vi.waitFor(() => expect(view()?.recovering).toBe(true));
    const checking = view()?.recovery;
    expect(checking).toMatch(/Checking the previous uncertain save/);

    client.dismissRecovery();
    expect(view()?.recovery).toBe(checking);

    release();
    await settled;
    expect(view()?.recovery).toBe(ACCEPTED);
  });
});
