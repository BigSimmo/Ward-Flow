import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup, act } from "@testing-library/react";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { WardSharedAccess, type WardSharedConnection } from "../src/components/ward-management/ward-shared-access";
import {
  downtimePack,
  rememberDowntimePack,
  lastDowntimePack,
  forgetDowntimePack,
  downtimePackAccessVersion,
} from "../src/components/ward-management/reports/downtime-pack";
import { AccessSettings } from "../src/components/ward-management/settings/access-settings";
import { WardFlowProvider } from "../src/components/ward-management/ward-flow-provider";
import { ToastProvider } from "../src/components/wf";
import { setWardAccess, resetWardAccessStoreForTests } from "../src/components/ward-management/shell/ward-access-store";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
const world = seedWardFlowStateAt(0);
const snapshot = {
  dataMode: "prototype" as const,
  revision: 1,
  now: 642,
  payload: { version: 1 as const, state: world, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
};
const pack = () => downtimePack({ ...world, now: 642, identify: () => "Synthetic person" });
afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  forgetDowntimePack();
  vi.useRealTimers();
});
describe("review privacy boundaries", () => {
  it("fences receipt follow-up adoption when a role switch interleaves after request validation", async () => {
    const commandId = "11111111-1111-4111-8111-111111111111";
    const saved = new Map([
      [
        WARD_COMMAND_RECOVERY_KEY,
        JSON.stringify({ commandId, receiptScope: "old-role", expiresAt: Date.now() + 60000 }),
      ],
    ]);
    const views: SharedView[] = [];
    let reads = 0;
    let switched = false;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: (next) => {
        views.push(next);
      },
      recoveryStorage: {
        getItem: (key) => saved.get(key) ?? null,
        setItem: (key, value) => {
          saved.set(key, value);
        },
        removeItem: (key) => {
          saved.delete(key);
        },
      },
      fetch: async (url) => {
        if (String(url).includes("/receipt?"))
          return Response.json({ receipt: { outcome: "accepted", commandRevision: 2 } });
        reads++;
        if (reads === 1) return Response.json({ snapshot, receiptScope: "old-role", accessUntil: Date.now() + 60000 });
        if (reads === 2)
          return {
            ok: true,
            status: 200,
            json: () => {
              const p = Promise.resolve(
                JSON.parse(
                  JSON.stringify({
                    snapshot: { ...snapshot, revision: 2 },
                    receiptScope: "old-role",
                    accessUntil: Date.now() + 60000,
                  }),
                ),
              );
              p.then(() =>
                queueMicrotask(() =>
                  queueMicrotask(() =>
                    queueMicrotask(() => {
                      switched = true;
                      client.switchRole();
                    }),
                  ),
                ),
              );
              return p;
            },
          } as Response;
        return Response.json({ code: "choose-role", choices: [] }, { status: 409 });
      },
    });
    await client.refresh();
    await vi.waitFor(() => expect(reads).toBeGreaterThanOrEqual(3));
    expect(switched).toBe(true);
    const switchedAt = views.findIndex((view) => view.status === "loading" && view.snapshot === null);
    expect(switchedAt).toBeGreaterThanOrEqual(0);
    expect(views.slice(switchedAt).every((view) => view.snapshot === null)).toBe(true);
    client.dispose();
  });
  it.each(["outage", "recovery"])(
    "keeps Access settings shared during %s without made-up local staff",
    async (phase) => {
      act(() => setWardAccess({ role: "admin", scope: { kind: "statewide" } }));
      const denied = async () => {
        throw new Error("unavailable");
      };
      const connection = {
        enabled: true,
        signedIn: true,
        snapshot,
        receivedAt: Date.now(),
        status: phase === "outage" ? "unavailable" : "saving",
        recovering: phase === "recovery",
        error: null,
        accessUntil: Date.now() + 60000,
        access: { role: "admin", scope: { kind: "statewide" } },
        signIn: vi.fn(),
        signOut: vi.fn(),
        retry: vi.fn(),
        dispatch: vi.fn(),
        pushApi: {},
        accessApi: { listAccess: denied, listCovers: denied },
      } as unknown as WardSharedConnection;
      render(
        <ToastProvider>
          <WardFlowProvider initialNow={642}>
            <WardSharedAccess connection={connection}>
              <AccessSettings />
            </WardSharedAccess>
          </WardFlowProvider>
        </ToastProvider>,
      );
      await screen.findByText(/list could not be read from the server/i);
      expect(screen.queryAllByText(/Demo staff|Demo access admin/i)).toHaveLength(0);
    },
  );
  it("refuses access changes and temporary openings during outage or recovery without POSTs", async () => {
    let offline = false;
    let releaseReceipt!: (response: Response) => void;
    let posts = 0;
    const stored = new Map<string, string>();
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: () => {},
      recoveryStorage: {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => {
          stored.set(key, value);
        },
        removeItem: (key) => {
          stored.delete(key);
        },
      },
      fetch: async (url, init) => {
        if (init?.method === "POST") {
          posts++;
          return Response.json({});
        }
        if (offline) throw new Error("offline");
        if (String(url).includes("/receipt?"))
          return new Promise((resolve) => {
            releaseReceipt = resolve;
          });
        return Response.json({ snapshot, receiptScope: "role-session", accessUntil: Date.now() + 60000 });
      },
    });
    await client.refresh();
    offline = true;
    await client.refresh();
    expect(await client.revokeAccess("synthetic-membership")).toMatch(/reconnect|unavailable/i);
    expect(await client.breakGlass("synthetic-record", "handover")).toMatch(/reconnect|unavailable/i);
    expect(posts).toBe(0);
    offline = false;
    stored.set(
      WARD_COMMAND_RECOVERY_KEY,
      JSON.stringify({
        commandId: "11111111-1111-4111-8111-111111111111",
        receiptScope: "role-session",
        expiresAt: Date.now() + 60000,
      }),
    );
    const recovery = client.refresh();
    await vi.waitFor(() => expect(releaseReceipt).toBeDefined());
    expect(await client.revokeAccess("synthetic-membership")).toMatch(/reconnect|unavailable/i);
    expect(await client.breakGlass("synthetic-record", "handover")).toMatch(/reconnect|unavailable/i);
    expect(posts).toBe(0);
    releaseReceipt(Response.json({ receipt: null }));
    await recovery;
    client.dispose();
  });
  it("preserves no-role access requests and signed-out phone cleanup without a ready board", async () => {
    const posts: string[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: () => {},
      fetch: async (url, init) => {
        if (init?.method === "POST") {
          posts.push(String(url));
          return Response.json({ revoked: true });
        }
        return Response.json({ code: "no-role", canRequest: true }, { status: 403 });
      },
    });
    await client.refresh();
    expect(await client.requestAccess("ward", { kind: "ward", unitIds: ["synthetic-ward"] })).toBeNull();
    expect(await client.pushUnsubscribe("https://example.test/push")).toBe(true);
    expect(posts.map((url) => new URL(url).pathname)).toEqual([
      "/v1/workspace/access/request",
      "/v1/workspace/push-unsubscribe",
    ]);
    client.dispose();
  });
  it("does not POST an access change whose token wait outlives the ready board", async () => {
    let releaseToken!: (token: string) => void;
    let tokens = 0;
    let offline = false;
    let posts = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => {
        if (++tokens === 2)
          return new Promise((resolve) => {
            releaseToken = resolve;
          });
        return "synthetic";
      },
      changed: () => {},
      fetch: async (_url, init) => {
        if (init?.method === "POST") {
          posts++;
          return Response.json({});
        }
        if (offline) throw new Error("offline");
        return Response.json({ snapshot, accessUntil: Date.now() + 60000 });
      },
    });
    await client.refresh();
    const change = client.revokeAccess("synthetic-membership").catch((error) => error);
    await vi.waitFor(() => expect(releaseToken).toBeDefined());
    offline = true;
    await client.refresh();
    releaseToken("synthetic");
    expect(await change).toBeInstanceOf(Error);
    expect(posts).toBe(0);
    client.dispose();
  });
  it("rejects a delayed snapshot started before the access boundary changed", () => {
    const started = downtimePackAccessVersion();
    forgetDowntimePack();
    rememberDowntimePack(pack(), world.worldGeneration, started);
    expect(lastDowntimePack()).toBeNull();
  });
  it.each(["scope", "account", "temporary-opening"])(
    "drops the cached report when %s changes in the same world",
    async (change) => {
      let narrow = false;
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        token: async () => "synthetic",
        changed: () => {},
        fetch: async () =>
          Response.json({
            snapshot: {
              ...snapshot,
              accessBoundary: change === "temporary-opening" && narrow ? "changed-opening" : "same-opening",
            },
            actorId: change === "account" && narrow ? "different-synthetic-account" : "synthetic-account",
            workingAs: "bootstrap",
            access: {
              role: "coordinator",
              scope: change === "scope" && narrow ? { kind: "service", service: "SMHS" } : { kind: "statewide" },
            },
          }),
      });
      await client.refresh();
      rememberDowntimePack(pack(), world.worldGeneration);
      expect(lastDowntimePack()).not.toBeNull();
      narrow = true;
      await client.refresh();
      expect(lastDowntimePack()).toBeNull();
      client.dispose();
    },
  );
  it("drops a retained pack and board at temporary access expiry without extending it on outage", async () => {
    vi.useFakeTimers();
    let view: SharedView | undefined;
    let offline = false;
    const expires = Date.now() + 1000;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: (next) => {
        view = next;
      },
      fetch: async () => {
        if (offline) throw new Error("offline");
        return Response.json({ snapshot, actorId: "synthetic-account", accessUntil: expires });
      },
    });
    await client.refresh();
    rememberDowntimePack(pack(), world.worldGeneration);
    offline = true;
    await client.refresh();
    expect(view?.snapshot).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1001);
    expect(view?.snapshot).toBeNull();
    expect(lastDowntimePack()).toBeNull();
    client.dispose();
  });
  it("does not restore records from a read that answers after its authorisation expired", async () => {
    vi.useFakeTimers();
    let view: SharedView | undefined;
    let finish!: (response: Response) => void;
    let reads = 0;
    const expires = Date.now() + 1000;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: (next) => {
        view = next;
      },
      fetch: async () => {
        if (reads++ === 0) return Response.json({ snapshot, accessUntil: expires });
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    await client.refresh();
    const oldRead = client.refresh();
    await vi.advanceTimersByTimeAsync(1001);
    finish(Response.json({ snapshot, accessUntil: expires }));
    await oldRead;
    expect(view?.snapshot).toBeNull();
    client.dispose();
  });
  it("recovers an accepted uncertain command after reload without resending its payload", async () => {
    const storage = new Map<string, string>();
    const recoveryStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    const commandId = "11111111-1111-4111-8111-111111111111";
    let view: SharedView | undefined;
    let posts = 0;
    let lookups = 0;
    const response = {
      snapshot,
      actorId: "synthetic-account",
      receiptScope: "opaque-session-role-binding",
      accessUntil: Date.now() + 60000,
    };
    const fetcher: typeof fetch = async (url, init) => {
      if (init?.method === "POST") {
        posts++;
        throw new Error("response lost after commit");
      }
      if (String(url).includes("/receipt?")) {
        lookups++;
        return Response.json({ receipt: { outcome: "accepted", commandRevision: 2 } });
      }
      return Response.json({ ...response, snapshot: { ...snapshot, revision: posts ? 2 : 1 } });
    };
    const options = {
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: (next: SharedView) => {
        view = next;
      },
      fetch: fetcher,
      recoveryStorage,
      commandId: () => commandId,
    };
    const first = new SharedWorkspaceClient(options);
    await first.refresh();
    await first.dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "synthetic-ward" });
    const saved = JSON.parse(storage.get(WARD_COMMAND_RECOVERY_KEY)!);
    expect(Object.keys(saved).sort()).toEqual(["commandId", "expiresAt", "receiptScope"]);
    expect(JSON.stringify(saved)).not.toMatch(/synthetic-ward|REQUEST_CAPACITY_REFRESH|event|payload/);
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    first.dispose();
    const reloaded = new SharedWorkspaceClient(options);
    await reloaded.refresh();
    expect(posts).toBe(1);
    expect(lookups).toBe(1);
    expect(view?.recovery).toMatch(/was accepted/);
    expect(storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
    reloaded.dispose();
  });
  it.each(["different-session", "expired"])("discards %s recovery metadata before any receipt lookup", async (kind) => {
    const storage = new Map([
      [
        WARD_COMMAND_RECOVERY_KEY,
        JSON.stringify({
          commandId: "11111111-1111-4111-8111-111111111111",
          receiptScope: kind === "different-session" ? "other" : "current",
          expiresAt: Date.now() + (kind === "expired" ? -1 : 60000),
        }),
      ],
    ]);
    const fetcher = vi.fn(async () =>
      Response.json({ snapshot, receiptScope: "current", accessUntil: Date.now() + 60000 }),
    );
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: () => {},
      fetch: fetcher,
      recoveryStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
    });
    await client.refresh();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(storage.size).toBe(0);
    client.dispose();
  });
  it("keeps authorised outage print/navigation interactive while dispatch refuses writes", async () => {
    const print = vi.fn();
    const connection = {
      enabled: true,
      signedIn: true,
      snapshot,
      receivedAt: Date.now(),
      status: "unavailable",
      error: null,
      accessUntil: Date.now() + 60000,
      access: { role: "coordinator", scope: { kind: "statewide" } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      dispatch: vi.fn(),
      pushApi: {},
    } as unknown as WardSharedConnection;
    render(
      <WardSharedAccess connection={connection}>
        <button onClick={print}>Print cached report</button>
      </WardSharedAccess>,
    );
    const button = screen.getByRole("button", { name: "Print cached report" });
    expect(button.closest("[inert]")).toBeNull();
    fireEvent.click(button);
    expect(print).toHaveBeenCalledOnce();
  });
});
