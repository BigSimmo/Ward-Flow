import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardAuthError } from "@/components/ward-management/ward-supabase-auth";

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event: WardFlowEvent = {
  type: "REQUEST_CAPACITY_REFRESH",
  role: "coordinator",
  now: 642,
  unitId: "synthetic-ward",
};
const clients: SharedWorkspaceClient[] = [];

function setup(fetch: typeof globalThis.fetch, token: () => Promise<string> = async () => "synthetic-token") {
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token,
    fetch,
    changed: (next) => {
      view = next;
    },
  });
  clients.push(client);
  return { client, view: () => view };
}

/** The browser supplies the dialog's text; cancellation is the observable contract here. */
function reloadIsGuarded() {
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  return unload.defaultPrevented;
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
  vi.restoreAllMocks();
});

describe("shared commands protect their tab-memory recovery from reload", () => {
  it("does not guard a read, but guards a command queued behind that read and its in-flight save", async () => {
    const heldRead = deferredResponse();
    const heldSave = deferredResponse();
    let reads = 0;
    let writes = 0;
    const { client, view } = setup(async (_url, init) => {
      if (init?.body) {
        writes++;
        return heldSave.promise;
      }
      return ++reads === 1 ? Response.json({ snapshot: snapshot(1) }) : heldRead.promise;
    });
    await client.refresh();
    expect(reloadIsGuarded()).toBe(false);
    const refresh = client.refresh();
    await vi.waitFor(() => expect(reads).toBe(2));
    expect(reloadIsGuarded()).toBe(false);
    const save = client.dispatch(event);
    expect(view()?.unconfirmedSave).toBe(true);
    expect(reloadIsGuarded()).toBe(true);
    heldRead.resolve(Response.json({ snapshot: snapshot(1) }));
    await refresh;
    await vi.waitFor(() => expect(writes).toBe(1));
    expect(reloadIsGuarded()).toBe(true);
    heldSave.resolve(Response.json({ snapshot: snapshot(2) }));
    await expect(save).resolves.toMatchObject({ status: "accepted" });
    expect(view()?.unconfirmedSave).toBe(false);
    expect(reloadIsGuarded()).toBe(false);
  });

  it.each([false, true])(
    "keeps the warning after a lost response (server committed: %s), then clears after same-ID Retry",
    async (committedBeforeLoss) => {
      const bodies: string[] = [];
      let commits = 0;
      const { client, view } = setup(async (_url, init) => {
        if (!init?.body) return Response.json({ snapshot: snapshot(1) });
        bodies.push(String(init.body));
        if (bodies.length === 1) {
          if (committedBeforeLoss) commits++;
          throw new Error("Synthetic lost response");
        }
        if (!committedBeforeLoss) commits++;
        return Response.json({ snapshot: snapshot(2), replayed: committedBeforeLoss });
      });
      await client.refresh();
      await expect(client.dispatch(event)).resolves.toMatchObject({ status: "failed" });
      expect(view()?.unconfirmedSave).toBe(true);
      expect(reloadIsGuarded()).toBe(true);
      await client.refresh();
      expect(view()?.status).toBe("unavailable");
      expect(reloadIsGuarded()).toBe(true);
      await client.retry();
      expect(bodies).toHaveLength(2);
      expect(bodies[1]).toBe(bodies[0]);
      expect(commits).toBe(1);
      expect(view()?.snapshot?.revision).toBe(2);
      expect(view()?.unconfirmedSave).toBe(false);
      expect(reloadIsGuarded()).toBe(false);
    },
  );

  it.each([409, 422, 401])("removes the warning after a definite HTTP %i refusal", async (status) => {
    const heldSave = deferredResponse();
    const refusal = () =>
      Response.json({ error: "Synthetic refusal", ...(status === 401 ? {} : { snapshot: snapshot(1) }) }, { status });
    let writes = 0;
    // A 401 is asked once more with a fresh token (Audit 4 A4-03); the second answer is refused too.
    const { client, view } = setup(async (_url, init) =>
      init?.body ? (++writes === 1 ? heldSave.promise : refusal()) : Response.json({ snapshot: snapshot(1) }),
    );
    await client.refresh();
    const save = client.dispatch(event);
    expect(reloadIsGuarded()).toBe(true);
    heldSave.resolve(refusal());
    await expect(save).resolves.toMatchObject({ status: "refused" });
    expect(view()?.unconfirmedSave).toBe(false);
    expect(reloadIsGuarded()).toBe(false);
  });

  it("does not keep guarding an accepted revision-only reply when its follow-up board read fails", async () => {
    let reads = 0;
    const { client, view } = setup(async (_url, init) => {
      if (init?.body) return Response.json({ outcome: "accepted", commandRevision: 2 });
      if (++reads === 1) return Response.json({ snapshot: snapshot(1) });
      throw new Error("Synthetic board read failure");
    });
    await client.refresh();
    await expect(client.dispatch(event)).resolves.toMatchObject({ status: "accepted" });
    await vi.waitFor(() => expect(view()?.status).toBe("unavailable"));
    expect(view()?.unconfirmedSave).toBe(false);
    expect(reloadIsGuarded()).toBe(false);
  });

  it.each([200, 503])(
    "clears a definitely accepted command before its permissions reconciliation finishes (HTTP %i)",
    async (readStatus) => {
      const heldSave = deferredResponse();
      const heldRead = deferredResponse();
      let reads = 0;
      let writes = 0;
      const { client, view } = setup(async (url) => {
        if (String(url).endsWith("/commands")) {
          writes++;
          return heldSave.promise;
        }
        if (String(url).endsWith("/break-glass")) return Response.json({ snapshot: snapshot(1) });
        return ++reads === 1 ? Response.json({ snapshot: snapshot(1) }) : heldRead.promise;
      });
      await client.refresh();
      const save = client.dispatchConfirmed(event);
      await vi.waitFor(() => expect(writes).toBe(1));
      await client.breakGlass("synthetic-record", "handover");
      expect(reloadIsGuarded()).toBe(true);
      heldSave.resolve(Response.json({ outcome: "accepted", snapshot: snapshot(2) }));
      await expect(save).resolves.toMatchObject({ status: "accepted" });
      await vi.waitFor(() => expect(reads).toBe(2));
      expect(view()?.unconfirmedSave).toBe(false);
      expect(reloadIsGuarded()).toBe(false);
      heldRead.resolve(Response.json({ snapshot: snapshot(2) }, { status: readStatus }));
      await vi.waitFor(() => expect(view()?.status).toBe(readStatus === 200 ? "ready" : "unavailable"));
      expect(view()?.unconfirmedSave).toBe(false);
      expect(reloadIsGuarded()).toBe(false);
    },
  );

  it("clears the warning when token refresh ends the old account's uncertain save", async () => {
    let expired = false;
    const { client, view } = setup(
      async (_url, init) => {
        if (init?.body) throw new Error("Synthetic lost response");
        return Response.json({ snapshot: snapshot(1) });
      },
      async () => {
        if (expired) throw new WardAuthError("session", "Synthetic session ended");
        return "synthetic-token";
      },
    );
    await client.refresh();
    await expect(client.dispatch(event)).resolves.toMatchObject({ status: "failed" });
    expect(reloadIsGuarded()).toBe(true);
    expired = true;
    await client.retry();
    expect(view()?.status).toBe("not-authorised");
    expect(view()?.unconfirmedSave).toBe(false);
    expect(reloadIsGuarded()).toBe(false);
  });

  it("does not carry an old desk's warning into a role change", async () => {
    const { client, view } = setup(async (_url, init) => {
      if (init?.body) throw new Error("Synthetic lost response");
      return Response.json({ snapshot: snapshot(1) });
    });
    await client.refresh();
    await expect(client.dispatch(event)).resolves.toMatchObject({ status: "failed" });
    expect(reloadIsGuarded()).toBe(true);
    client.switchRole();
    expect(reloadIsGuarded()).toBe(false);
    expect(view()?.unconfirmedSave).toBe(false);
  });

  it("removes its listener on disposal while leaving another client's warning intact", async () => {
    const fetch: typeof globalThis.fetch = async (_url, init) => {
      if (init?.body) throw new Error("Synthetic lost response");
      return Response.json({ snapshot: snapshot(1) });
    };
    const first = setup(fetch).client;
    const second = setup(fetch).client;
    await Promise.all([first.refresh(), second.refresh()]);
    await Promise.all([first.dispatch(event), second.dispatch(event)]);
    const remove = vi.spyOn(window, "removeEventListener");
    first.dispose();
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(reloadIsGuarded()).toBe(true);
    second.dispose();
    expect(reloadIsGuarded()).toBe(false);
  });
});
