// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SharedWorkspaceClient } from "../src/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { clearReferralDraftSession } from "../src/components/ward-management/referrals/referral-draft-lifecycle";
import {
  keepReferralDraft,
  readKeptReferralDraft,
} from "../src/components/ward-management/referrals/referral-draft-cache";
import {
  draftSessionVersion,
  readSessionDraft,
  sessionDraftKey,
  setDraftAccount,
  writeSessionDraft,
} from "../src/components/ward-management/ward-session-drafts";

const clients: SharedWorkspaceClient[] = [];
const snapshot = (context: string, revision = 1) => ({
  dataMode: "prototype",
  revision,
  now: 642,
  accessContext: context.repeat(64),
  payload: {
    version: 1,
    state: JSON.parse(JSON.stringify(seedWardFlowStateAt(0))),
    dayZero: "2026-10-07T00:00:00Z",
    startedAt: "2026-10-07T10:00:00Z",
  },
});
function client(read: () => Response | Promise<Response>) {
  const instance = new SharedWorkspaceClient({
    baseUrl: "https://offline.example.test",
    token: async () => "synthetic",
    changed: () => {},
    fetch: async () => read(),
  });
  clients.push(instance);
  return instance;
}
function keep() {
  const key = sessionDraftKey("standard/0", "referral", "new");
  const owner = draftSessionVersion();
  keepReferralDraft({ activePatientKey: "patient:PT-023", clinicalSummary: "Synthetic previous desk" }, undefined, key);
  expect(readSessionDraft(key)).toContain("Synthetic previous desk");
  return { key, owner };
}
function expectRetired({ key, owner }: ReturnType<typeof keep>) {
  expect(readKeptReferralDraft(key)).toBeNull();
  expect(readSessionDraft(key)).toBeNull();
  expect(writeSessionDraft(key, "Synthetic late autosave", owner)).toBe(false);
}
beforeEach(() => {
  window.sessionStorage.clear();
  clearReferralDraftSession();
  setDraftAccount("synthetic-role-holder");
});
afterEach(() => {
  for (const instance of clients.splice(0)) instance.dispose();
  clearReferralDraftSession();
  vi.restoreAllMocks();
});

describe("shared draft access lifetime", () => {
  it("does not let a detached sign-out client's delayed role denial retire the next account's drafts", async () => {
    let answer!: (response: Response) => void;
    const cleanup = new SharedWorkspaceClient({
      baseUrl: "https://offline.example.test",
      token: async () => "synthetic-outgoing-account",
      changed: () => {},
      manageDrafts: false,
      workingAs: { get: () => "22222222-2222-4222-8222-222222222222", set: () => {} },
      fetch: async (url) =>
        String(url).endsWith("/push-unsubscribe")
          ? new Promise<Response>((resolve) => {
              answer = resolve;
            })
          : Response.json({ snapshot: snapshot("a") }),
    });
    clients.push(cleanup);
    const pending = cleanup.pushUnsubscribe("https://push.example.test/synthetic-outgoing-endpoint").catch(() => false);
    await vi.waitFor(() => expect(answer).toBeTypeOf("function"));
    setDraftAccount("synthetic-next-account");
    const current = client(() => Response.json({ snapshot: snapshot("b") }));
    await current.refresh();
    const retained = keep();
    answer(Response.json({ code: "no-role" }, { status: 403 }));
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readKeptReferralDraft(retained.key)).not.toBeNull();
    expect(readSessionDraft(retained.key)).toContain("Synthetic previous desk");
    expect(draftSessionVersion()).toBe(retained.owner);
  });

  it.each(["no-role", "old-snapshot"])(
    "ignores a disposed board client's late %s response after a new account connects",
    async (response) => {
      let held = false;
      let answer!: (value: Response) => void;
      const outgoing = client(() =>
        held
          ? new Promise<Response>((resolve) => {
              answer = resolve;
            })
          : Response.json({ snapshot: snapshot("a") }),
      );
      await outgoing.refresh();
      held = true;
      const pending = outgoing.refresh();
      await vi.waitFor(() => expect(answer).toBeTypeOf("function"));
      outgoing.dispose();
      setDraftAccount("synthetic-next-account");
      const current = client(() => Response.json({ snapshot: snapshot("b") }));
      await current.refresh();
      const retained = keep();
      answer(
        response === "no-role"
          ? Response.json({ code: "no-role" }, { status: 403 })
          : Response.json({ snapshot: snapshot("a") }),
      );
      await pending;
      expect(readKeptReferralDraft(retained.key)).not.toBeNull();
      expect(readSessionDraft(retained.key)).toContain("Synthetic previous desk");
      expect(draftSessionVersion()).toBe(retained.owner);
    },
  );

  it.each(["chooseRole", "switchRole"] as const)(
    "retires memory, session copy and autosave owner before %s responds",
    async (method) => {
      let held = false;
      const instance = client(() =>
        held ? new Promise<Response>(() => {}) : Response.json({ snapshot: snapshot("a") }),
      );
      await instance.refresh();
      const old = keep();
      held = true;
      if (method === "chooseRole") instance.chooseRole("22222222-2222-4222-8222-222222222222");
      else instance.switchRole();
      expectRetired(old);
    },
  );

  it("retires drafts when effective access changes at the same clinical revision", async () => {
    let context = "a";
    const instance = client(() => Response.json({ snapshot: snapshot(context) }));
    await instance.refresh();
    const old = keep();
    context = "b"; // Includes cover or break-glass expiry, even without a clinical save.
    await instance.refresh();
    expectRetired(old);
  });

  it("preserves drafts and owner across ordinary clinical snapshot changes", async () => {
    let revision = 1;
    const instance = client(() => Response.json({ snapshot: snapshot("a", revision) }));
    await instance.refresh();
    const old = keep();
    revision++;
    await instance.refresh();
    expect(readKeptReferralDraft(old.key)).not.toBeNull();
    expect(readSessionDraft(old.key)).toContain("Synthetic previous desk");
    expect(draftSessionVersion()).toBe(old.owner);
  });

  it("keeps recovery when a fresh connection confirms the same access context", async () => {
    const instance = client(() => Response.json({ snapshot: snapshot("a") }));
    await instance.refresh();
    const old = keep();
    instance.dispose();
    const replacement = client(() => Response.json({ snapshot: snapshot("a") }));
    await replacement.refresh();
    expect(readSessionDraft(old.key)).toContain("Synthetic previous desk");
    expect(draftSessionVersion()).toBe(old.owner);
  });

  it("retains the session copy after a page reload confirms its persisted access context", async () => {
    const instance = client(() => Response.json({ snapshot: snapshot("a") }));
    await instance.refresh();
    const old = keep();
    instance.dispose();
    vi.resetModules();
    const freshDrafts = await import("../src/components/ward-management/ward-session-drafts");
    const freshClient = await import("../src/components/ward-management/ward-shared-client");
    freshDrafts.setDraftAccount("synthetic-role-holder");
    const replacement = new freshClient.SharedWorkspaceClient({
      baseUrl: "https://offline.example.test",
      token: async () => "synthetic",
      changed: () => {},
      fetch: async () => Response.json({ snapshot: snapshot("a") }),
    });
    clients.push(replacement);
    await replacement.refresh();
    expect(freshDrafts.readSessionDraft(old.key)).toContain("Synthetic previous desk");
  });

  it("fences old autosaves when storage cleanup is blocked during an access change", async () => {
    let context = "a";
    const instance = client(() => Response.json({ snapshot: snapshot(context) }));
    await instance.refresh();
    const old = keep();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Blocked storage");
    });
    context = "b";
    await instance.refresh();
    expectRetired(old);
  });

  it("does not recover old access after reload if cleanup and session-metadata writes failed", async () => {
    let context = "a";
    const instance = client(() => Response.json({ snapshot: snapshot(context) }));
    await instance.refresh();
    const old = keep();
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Blocked cleanup");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "wf-draft-session:v1") throw new Error("Session metadata full");
      setItem.call(this, key, value);
    });
    context = "b";
    await instance.refresh();
    instance.dispose();
    vi.resetModules();
    const freshDrafts = await import("../src/components/ward-management/ward-session-drafts");
    const freshClient = await import("../src/components/ward-management/ward-shared-client");
    freshDrafts.setDraftAccount("synthetic-role-holder");
    const replacement = new freshClient.SharedWorkspaceClient({
      baseUrl: "https://offline.example.test",
      token: async () => "synthetic",
      changed: () => {},
      fetch: async () => Response.json({ snapshot: snapshot(context) }),
    });
    clients.push(replacement);
    await replacement.refresh();
    expect(freshDrafts.readSessionDraft(old.key)).toBeNull();
  });
});
