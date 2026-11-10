import { describe, expect, it } from "vitest";
import { COMMAND_RECOVERY_KEY } from "../src/components/ward-management/ward-command-recovery";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";

// Audit M10 (#1575): safe offline replay. Saves made offline wait in memory only (D-18, D-72 item 2)
// and are re-checked by the server when they send. A save whose record changed meanwhile is refused
// and the person sees what changed; nothing is merged silently (Josh, 10 Nov 2026). Synthetic data only.

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const care = (admissionId: string) =>
  ({
    type: "RECORD_ADMISSION_FOLLOW_UP",
    role: "ward",
    now: 642,
    admissionId,
    patientId: `synthetic-patient-${admissionId}`,
  }) as unknown as WardFlowEvent;

/**
 * One shared workspace: CS-19 as the server applies it. A command sent against an older revision
 * is refused when a record it names changed after that revision; otherwise it applies.
 */
function sharedServer(refuse: (admissionId: string) => boolean = () => false) {
  const server = { revision: 1, changedAt: new Map<string, number>(), applied: [] as string[] };
  const snapshot = (): SharedSnapshot => ({
    dataMode: "prototype",
    revision: server.revision,
    now: 642,
    payload: { version: 1, state, dayZero: "2026-11-10T00:00:00Z", startedAt: "2026-11-10T10:00:00Z" },
  });
  const answer = (path: string, body?: { commandId: string; expectedRevision: number; event: WardFlowEvent }) => {
    if (path.includes("/receipt?")) return Response.json({ receipt: null });
    if (!body)
      return Response.json({ snapshot: snapshot(), receiptScope: "desk", accessUntil: Date.now() + 3_600_000 });
    const record = (body.event as unknown as { admissionId: string }).admissionId;
    if ((server.changedAt.get(record) ?? 0) > body.expectedRevision)
      return Response.json(
        { error: "stale", code: "stale", recordType: "stay", desk: "Ward desk", snapshot: snapshot() },
        { status: 409 },
      );
    if (refuse(record))
      return Response.json({ error: "This stay has already ended", snapshot: snapshot() }, { status: 422 });
    server.revision += 1;
    server.changedAt.set(record, server.revision);
    server.applied.push(body.commandId);
    return Response.json({ outcome: "accepted", commandRevision: server.revision, snapshot: snapshot() });
  };
  return { server, answer };
}

function device(
  shared: ReturnType<typeof sharedServer>,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  const link = { online: true, sent: [] as { commandId: string; expectedRevision: number }[] };
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://synthetic.invalid",
    token: async () => "synthetic-token",
    manageDrafts: false,
    commandId: () => crypto.randomUUID(),
    ...(storage ? { recoveryStorage: storage } : {}),
    changed: (next) => {
      view = next;
    },
    fetch: async (url, options) => {
      if (!link.online) throw new TypeError("offline");
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;
      if (body) link.sent.push({ commandId: body.commandId, expectedRevision: body.expectedRevision });
      return shared.answer(String(url), body);
    },
  });
  return { client, link, view: () => view };
}

const settle = async () => {
  for (let turn = 0; turn < 6; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function reconnect(phone: ReturnType<typeof device>) {
  phone.link.online = true;
  await phone.client.refresh();
  await settle();
}

describe("safe offline replay (audit M10, #1575)", () => {
  it.each([
    ["A then B", 0],
    ["B then A", 1],
  ])(
    "two devices queue saves on the same stay offline; reconnecting %s, the second is refused and told",
    async (_order, firstIndex) => {
      const shared = sharedServer();
      const phones = [device(shared), device(shared)];
      for (const phone of phones) await phone.client.refresh();
      for (const phone of phones) phone.link.online = false;
      const outcomes = [];
      for (const phone of phones) {
        const held = await phone.client.dispatch(care("adm-synthetic-1"));
        expect(held.status).toBe("failed");
        outcomes.push(held);
      }
      // The later device also queued a save on another stay: the refusal must not stop it.
      const other = await phones[1 - firstIndex].client.dispatch(care("adm-synthetic-2"));
      expect(other.message).toContain("waiting on this page");
      const [first, second] = [phones[firstIndex], phones[1 - firstIndex]];

      await reconnect(first);
      expect((await outcomes[firstIndex].confirmation)?.status).toBe("accepted");
      await reconnect(second);

      const refused = await outcomes[1 - firstIndex].confirmation;
      expect(refused?.status).toBe("refused");
      // Checked against the board it was made on, never rebased onto the first device's save.
      expect(second.link.sent[0].expectedRevision).toBe(1);
      // What changed is shown on the board's message line, and stays shown after the next save lands.
      expect(second.view()?.error).toBe(
        "Ward desk changed this stay while you were offline. Your action was not applied. Check the latest details, then try again.",
      );
      expect(refused?.message).toBe(second.view()?.error);
      expect((await other.confirmation)?.status).toBe("accepted");
      expect(second.view()?.waiting).toBe(0);
      // Only the first device's save and the unrelated one were applied: nothing merged.
      expect(shared.server.applied).toEqual([outcomes[firstIndex].commandId, other.commandId]);
      for (const phone of phones) phone.client.dispose();
    },
  );

  it("one permanently refused waiting save does not stop the next unrelated one", async () => {
    const shared = sharedServer((admissionId) => admissionId === "adm-synthetic-ended");
    const phone = device(shared);
    await phone.client.refresh();
    phone.link.online = false;
    const doomed = await phone.client.dispatch(care("adm-synthetic-ended"));
    const next = await phone.client.dispatch(care("adm-synthetic-3"));
    expect(phone.view()?.waiting).toBe(2);
    await reconnect(phone);
    expect((await doomed.confirmation)?.status).toBe("refused");
    expect((await next.confirmation)?.status).toBe("accepted");
    expect(shared.server.applied).toEqual([next.commandId]);
    // The refusal is still in front of the person after the next save went through.
    expect(phone.view()?.error).toBe("This stay has already ended. Nothing was changed.");
    // And it is not sent again.
    await phone.client.refresh();
    await settle();
    expect(phone.link.sent.filter((sent) => sent.commandId === doomed.commandId)).toHaveLength(1);
    phone.client.dispose();
  });

  it("warns before closing with saves waiting and, after a reload, says plainly they were not sent", async () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
    const shared = sharedServer();
    const phone = device(shared, storage);
    await phone.client.refresh();
    phone.link.online = false;
    await phone.client.dispatch(care("adm-synthetic-4"));
    await phone.client.dispatch(care("adm-synthetic-5"));
    expect(phone.view()?.waiting).toBe(2);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    // Only command identities are kept for reload: no event, patient or typed content (D-18).
    const kept = data.get(COMMAND_RECOVERY_KEY) ?? "";
    expect(kept).not.toMatch(/synthetic-patient|adm-synthetic|RECORD_ADMISSION/);

    // The page reloads: the waiting saves were in memory only, so they are gone.
    phone.client.dispose();
    const reloaded = device(shared, storage);
    await reloaded.client.refresh();
    await settle();
    expect(reloaded.view()?.recovery).toContain(
      "1 waiting change was not sent. Its content was not retained after reload.",
    );
    expect(reloaded.link.sent).toEqual([]);
    expect(shared.server.applied).toEqual([]);
    reloaded.client.dispose();
  });
});
