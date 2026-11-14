// H2 (mechanics and clock audit, 14 Nov 2026): one save pressed offline, then a reload, no longer
// holds saving for the rest of the sign-in. The client keeps the save "queued" while the browser
// says it is offline, and the server records a save its receipt check cannot find as not applied
// (under the workspace lock), so the check gives a final answer and a late arrival is refused
// (the store's side: backend/ward-flow/adversarial-receipt-recovery.test.mjs).
// H1: every save carries the board minute it was pressed at, beside the command.
import { afterEach, expect, it, vi } from "vitest";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { COMMAND_RECOVERY_KEY } from "../src/components/ward-management/ward-command-recovery";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const care = (admissionId: string) =>
  ({
    type: "RECORD_ADMISSION_FOLLOW_UP",
    role: "ward",
    now: 642,
    admissionId,
    patientId: `synthetic-patient-${admissionId}`,
  }) as unknown as WardFlowEvent;
const snapshot = (): SharedSnapshot => ({
  dataMode: "prototype",
  revision: 1,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-11-10T00:00:00Z", startedAt: "2026-11-10T10:00:00Z" },
});
const settle = async () => {
  for (let turn = 0; turn < 8; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function harness() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  // A server that keeps receipts and, on a recovery check (`settle=1`), records an unknown save as not applied.
  const server = { received: [] as Record<string, unknown>[], receipts: new Map<string, "accepted" | "refused">() };
  const make = (link: { online: boolean }) => {
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://synthetic.invalid",
      token: async () => "synthetic-token",
      manageDrafts: false,
      recoveryStorage: storage,
      changed: (next) => void (view = next),
      fetch: async (url, options) => {
        if (!link.online) throw new TypeError("offline");
        const path = String(url);
        if (path.includes("/receipt?")) {
          const id = new URL(path).searchParams.get("commandId")!;
          if (!server.receipts.has(id) && new URL(path).searchParams.get("settle") === "1")
            server.receipts.set(id, "refused");
          const outcome = server.receipts.get(id);
          return Response.json({ receipt: outcome ? { outcome, commandRevision: 1 } : null });
        }
        if (options?.body) {
          const body = JSON.parse(String(options.body)) as Record<string, unknown>;
          server.received.push(body);
          if (server.receipts.get(body.commandId as string) === "refused")
            return Response.json({ outcome: "denied", error: "Not applied.", snapshot: snapshot() }, { status: 422 });
          server.receipts.set(body.commandId as string, "accepted");
          return Response.json({ outcome: "accepted", commandRevision: 2, snapshot: { ...snapshot(), revision: 2 } });
        }
        return Response.json({
          snapshot: snapshot(),
          serverTime: Date.parse("2026-11-10T10:42:20Z"),
          receiptScope: "desk",
          accessUntil: Date.now() + 12 * 3_600_000,
        });
      },
    });
    return { client, view: () => view };
  };
  return { data, server, make };
}

it("a save pressed offline then a reload is answered as not sent, and saving works again", async () => {
  const { data, server, make } = harness();
  const link = { online: true };
  const tab = make(link);
  await tab.client.refresh();
  link.online = false;
  const held = await tab.client.dispatch(care("adm-synthetic-9"));
  expect(held.status).toBe("failed");
  expect(data.get(COMMAND_RECOVERY_KEY)).toBeDefined();
  tab.client.dispose();

  link.online = true;
  const reloaded = make(link);
  for (let poll = 0; poll < 4; poll++) {
    await reloaded.client.refresh();
    await settle();
  }
  expect(reloaded.view()?.recovering).toBe(false);
  expect(reloaded.view()?.recovery).not.toContain("still unresolved");
  const attempt = await reloaded.client.dispatch(care("adm-synthetic-10"));
  expect(attempt.status).toBe("accepted");
  // The held save never reached the server, and its id is now answered "not applied".
  expect(server.received).toHaveLength(1);
  expect([...server.receipts.values()]).toEqual(["refused", "accepted"]);
  reloaded.client.dispose();
});

it("keeps a save queued, never sent, while the browser says it is offline", async () => {
  const { data, server, make } = harness();
  const link = { online: true };
  const tab = make(link);
  await tab.client.refresh();
  vi.stubGlobal("navigator", { onLine: false });
  const held = await tab.client.dispatch(care("adm-synthetic-11"));
  expect(held.status).toBe("failed");
  const journal = JSON.parse(data.get(COMMAND_RECOVERY_KEY)!) as { entries: { phase: string }[] };
  expect(journal.entries.map((entry) => entry.phase)).toEqual(["queued"]);
  expect(server.received).toEqual([]);
  tab.client.dispose();
});

it("sends the board minute the save was pressed at beside the command (H1)", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(Date.parse("2026-11-10T10:42:30Z"));
    const { server, make } = harness();
    const tab = make({ online: true });
    await tab.client.refresh();
    // The server answered at 10:42:20, 20 s into board minute 642; 50 s later the board reads 643.
    vi.setSystemTime(Date.parse("2026-11-10T10:43:20Z"));
    const sent = await tab.client.dispatch(care("adm-synthetic-12"));
    expect(sent.status).toBe("accepted");
    expect(server.received[0]).toMatchObject({ actedAt: 643, event: { type: "RECORD_ADMISSION_FOLLOW_UP" } });
    expect(server.received[0].event).not.toHaveProperty("actedAt");
    tab.client.dispose();
  } finally {
    vi.useRealTimers();
  }
});
