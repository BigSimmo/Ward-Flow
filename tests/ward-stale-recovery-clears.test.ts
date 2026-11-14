import { expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { COMMAND_RECOVERY_KEY } from "../src/components/ward-management/ward-command-recovery";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

const state = seedWardFlowStateAt(0);
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-11-04T00:00:00Z", startedAt: "2026-11-04T10:00:00Z" },
});

it("clears 'A previous uncertain save was not applied' once a later save is accepted (A1-1)", async () => {
  const data = new Map([
    [
      COMMAND_RECOVERY_KEY,
      JSON.stringify({
        version: 2,
        entries: [
          {
            commandId: "11111111-1111-4111-8111-111111111111",
            receiptScope: "desk",
            expiresAt: Date.now() + 60_000,
            phase: "sent",
          },
        ],
      }),
    ],
  ]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://synthetic.invalid",
    token: async () => "synthetic-token",
    recoveryStorage: storage,
    manageDrafts: false,
    commandId: () => crypto.randomUUID(),
    changed: (next) => {
      view = next;
    },
    fetch: async (url, options) => {
      const path = String(url);
      if (path.includes("/receipt?")) return Response.json({ receipt: { outcome: "refused", commandRevision: 3 } });
      if (options?.body) return Response.json({ snapshot: snapshot(4), commandRevision: 4, outcome: "accepted" });
      return Response.json({ snapshot: snapshot(3), receiptScope: "desk", accessUntil: Date.now() + 60_000 });
    },
  });
  try {
    await client.refresh();
    expect(view?.recovery).toMatch(/not applied/i);
    await client.dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: state.units[0]!.id });
    expect(view?.status).toBe("ready");
    expect(view?.recovery).toBeUndefined();
  } finally {
    client.dispose();
  }
});

it("names the ward, never its code, in the status line (R-BEDS-19)", async () => {
  const { sharedDeskLabel } = await import("../src/components/ward-management/shell/ward-access-labels");
  const units = [{ id: "dn-rph-older", name: "Royal Perth Older Adult" }] as never;
  const label = sharedDeskLabel({ role: "ward", scope: { kind: "ward", unitIds: ["dn-rph-older"] } }, units);
  expect(label).toBe("Nurse in charge, Royal Perth Older Adult");
});
