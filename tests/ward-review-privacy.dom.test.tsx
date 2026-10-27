vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/reports/downtime",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
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
  type DowntimePackOwner,
} from "../src/components/ward-management/reports/downtime-pack";
import { AccessSettings } from "../src/components/ward-management/settings/access-settings";
import {
  WardFlowProvider,
  WardFlowOverride,
  useWardFlow,
  WardFlowClockContext,
} from "../src/components/ward-management/ward-flow-provider";
import { useLayoutEffect, type ReactNode } from "react";
import { useDowntimePackOwner } from "../src/components/ward-management/reports/downtime-pack-context";
import { DowntimePackScreen } from "../src/components/ward-management/reports/downtime-pack-screen";
import { WardDowntimePackLine } from "../src/components/ward-management/shell/ward-downtime-pack-line";
import { ToastProvider } from "../src/components/wf";
import { setWardAccess, resetWardAccessStoreForTests } from "../src/components/ward-management/shell/ward-access-store";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
const world = seedWardFlowStateAt(0);
const snapshot = {
  dataMode: "prototype" as const,
  revision: 1,
  now: 642,
  accessContext: "a".repeat(64),
  payload: { version: 1 as const, state: world, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
};
const pack = () => downtimePack({ ...world, bedUnits: world.units, now: 642, identify: () => "Synthetic person" });
afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  forgetDowntimePack();
  vi.useRealTimers();
  vi.restoreAllMocks();
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
  it("rejects a delayed snapshot whose main report owner has retired", () => {
    const owner = { active: true, ready: true };
    owner.active = false;
    rememberDowntimePack(pack(), world.worldGeneration, owner);
    expect(lastDowntimePack()).toBeNull();
  });
  it.each(["scope", "account", "temporary-opening"])(
    "drops the cached report when %s changes in the same world",
    (change) => {
      let owner: DowntimePackOwner | null = null;
      function Probe() {
        const current = useDowntimePackOwner();
        useLayoutEffect(() => {
          owner = current;
        });
        return <span>Report owner probe</span>;
      }
      const connection = {
        enabled: true,
        signedIn: true,
        snapshot,
        receivedAt: Date.now(),
        status: "ready",
        error: null,
        actorId: "synthetic-account",
        workingAs: "bootstrap",
        accessUntil: Date.now() + 60000,
        access: { role: "coordinator", scope: { kind: "statewide" } },
        signIn: vi.fn(),
        signOut: vi.fn(),
        retry: vi.fn(),
        dispatch: vi.fn(),
        pushApi: {},
      } as unknown as WardSharedConnection;
      const ui = render(
        <WardSharedAccess connection={connection}>
          <Probe />
        </WardSharedAccess>,
      );
      act(() => rememberDowntimePack(pack(), world.worldGeneration, owner));
      expect(lastDowntimePack()).not.toBeNull();
      const next = {
        ...connection,
        actorId: change === "account" ? "different-synthetic-account" : connection.actorId,
        access:
          change === "scope"
            ? { role: "coordinator", scope: { kind: "service", service: "South Metro" } }
            : connection.access,
        snapshot: change === "temporary-opening" ? { ...snapshot, accessContext: "b".repeat(64) } : snapshot,
      } as WardSharedConnection;
      ui.rerender(
        <WardSharedAccess connection={next}>
          <Probe />
        </WardSharedAccess>,
      );
      expect(lastDowntimePack()).toBeNull();
    },
  );
  it("re-arms a long access deadline instead of overflowing and expiring it early", async () => {
    vi.useFakeTimers();
    const maxDelay = 2_147_483_647;
    const schedule = vi.spyOn(globalThis, "setTimeout");
    const deadline = Date.now() + maxDelay + 1000;
    let current: SharedView | undefined;
    const view = () => current;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: (next) => {
        current = next;
      },
      fetch: async () => Response.json({ snapshot, accessUntil: deadline }),
    });
    try {
      await client.refresh();
      expect(schedule.mock.calls.some(([, delay]) => Number(delay) > maxDelay)).toBe(false);
      await vi.advanceTimersByTimeAsync(maxDelay);
      expect(view()?.snapshot === null).toBe(false);
      expect(view()?.accessUntil).toBe(deadline);
      await vi.advanceTimersByTimeAsync(999);
      expect(view()?.snapshot === null).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(view()?.snapshot === null).toBe(true);
      expect(view()?.status).toBe("unavailable");
    } finally {
      client.dispose();
    }
  });

  it("re-arms a long outage-view deadline without a short timer loop", () => {
    vi.useFakeTimers();
    const maxDelay = 2_147_483_647;
    const schedule = vi.spyOn(globalThis, "setTimeout");
    const connection = {
      enabled: true,
      signedIn: true,
      snapshot,
      receivedAt: Date.now(),
      status: "unavailable",
      error: null,
      accessUntil: Date.now() + maxDelay + 1000,
      access: { role: "coordinator", scope: { kind: "statewide" } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      dispatch: vi.fn(),
      pushApi: {},
    } as unknown as WardSharedConnection;
    render(
      <WardSharedAccess connection={connection}>
        <button>Cached report</button>
      </WardSharedAccess>,
    );
    const button = screen.getByRole("button", { name: "Cached report" });
    expect(schedule.mock.calls.some(([, delay]) => Number(delay) > maxDelay)).toBe(false);
    act(() => vi.advanceTimersByTime(maxDelay));
    expect(button.closest("[inert]") === null).toBe(true);
    act(() => vi.advanceTimersByTime(999));
    expect(button.closest("[inert]") === null).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(button.closest("[inert]") === null).toBe(false);
  });

  it.each(["loading", "choose-role"] as const)(
    "forgets an outgoing desk's deadline while the next desk is %s",
    async (phase) => {
      vi.useFakeTimers();
      const deadline = Date.now() + 1000;
      let current: SharedView | undefined;
      const view = () => current;
      let reads = 0;
      let finish!: (response: Response) => void;
      let nextSignal: AbortSignal | undefined;
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        token: async () => "synthetic",
        changed: (next) => {
          current = next;
        },
        fetch: async (_url, init) => {
          if (reads++ === 0) return Response.json({ snapshot, accessUntil: deadline });
          nextSignal = init?.signal as AbortSignal;
          if (phase === "choose-role") return Response.json({ code: "choose-role", choices: [] }, { status: 409 });
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        },
      });
      try {
        await client.refresh();
        client.switchRole();
        await vi.advanceTimersByTimeAsync(0);
        expect(reads).toBe(2);
        expect(view()?.accessUntil).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1001);
        expect(view()?.status).toBe(phase);
        if (phase === "loading") {
          expect(nextSignal?.aborted).toBe(false);
          finish(Response.json({ snapshot, accessUntil: Date.now() + 60_000 }));
          await vi.advanceTimersByTimeAsync(0);
          expect(view()?.status).toBe("ready");
        }
      } finally {
        client.dispose();
      }
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
  it.each(["retry", "expiry"] as const)(
    "settles an uncertain command's in-memory confirmation after %s with stored receipt metadata",
    async (terminal) => {
      vi.useFakeTimers();
      const storage = new Map<string, string>();
      const commandId = "11111111-1111-4111-8111-111111111111";
      const expiresAt = Date.now() + 1000;
      const sent: string[] = [];
      let accept = false;
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        token: async () => "synthetic",
        changed: () => {},
        commandId: () => commandId,
        recoveryStorage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => {
            storage.set(key, value);
          },
          removeItem: (key) => {
            storage.delete(key);
          },
        },
        fetch: async (_url, init) => {
          if (init?.method === "POST") {
            sent.push(JSON.parse(String(init.body)).commandId);
            if (!accept) throw new Error("Synthetic lost response");
          }
          return Response.json({
            outcome: "accepted",
            snapshot: { ...snapshot, revision: accept ? 2 : 1 },
            receiptScope: "synthetic-role-binding",
            accessUntil: expiresAt,
          });
        },
      });
      try {
        await client.refresh();
        const original = await client.dispatchConfirmed({
          type: "REQUEST_CAPACITY_REFRESH",
          role: "coordinator",
          now: 642,
          unitId: "synthetic-ward",
        });
        expect(original.status).toBe("failed");
        expect(original.confirmation).toBeDefined();
        expect(JSON.parse(storage.get(WARD_COMMAND_RECOVERY_KEY)!)).toEqual({
          commandId,
          receiptScope: "synthetic-role-binding",
          expiresAt,
        });
        if (terminal === "retry") {
          accept = true;
          await client.retry();
        } else {
          await vi.advanceTimersByTimeAsync(1001);
        }
        const final = await original.confirmation!;
        expect(final).toMatchObject({ commandId, status: terminal === "retry" ? "accepted" : "cancelled" });
        expect(final.isCurrent?.()).toBe(terminal === "retry");
        expect(storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
        expect(sent).toEqual(terminal === "retry" ? [commandId, commandId] : [commandId]);
      } finally {
        client.dispose();
      }
    },
  );
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
  it("refuses a nested dispatch from the first ready notification while reload recovery is still pending", async () => {
    const storage = new Map([
      [
        WARD_COMMAND_RECOVERY_KEY,
        JSON.stringify({
          commandId: "11111111-1111-4111-8111-111111111111",
          receiptScope: "current",
          expiresAt: Date.now() + 60000,
        }),
      ],
    ]);
    let nested: ReturnType<SharedWorkspaceClient["dispatch"]> | undefined;
    let posts = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      recoveryStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
      changed: (view) => {
        if (view.status === "ready" && view.recovering && !nested)
          nested = client.dispatch({
            type: "REQUEST_CAPACITY_REFRESH",
            role: "coordinator",
            now: 642,
            unitId: "synthetic-ward",
          });
      },
      fetch: async (url, init) => {
        if (init?.method === "POST") posts++;
        return String(url).includes("/receipt?")
          ? Response.json({ receipt: null })
          : Response.json({ snapshot, receiptScope: "current", accessUntil: Date.now() + 60000 });
      },
    });
    await client.refresh();
    expect(nested).toBeDefined();
    expect((await nested)?.status).toBe("cancelled");
    expect(posts).toBe(0);
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
  it("cancels a manual snapshot when shared access becomes unavailable before its delay ends", () => {
    vi.useFakeTimers();
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    const held = pack();
    const connection = {
      enabled: true,
      signedIn: true,
      snapshot,
      receivedAt: Date.now(),
      error: null,
      actorId: "synthetic-account",
      workingAs: "bootstrap",
      accessUntil: Date.now() + 60000,
      access: { role: "coordinator", scope: { kind: "statewide" } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      dispatch: vi.fn(),
      pushApi: {},
    };
    function Retain() {
      const owner = useDowntimePackOwner();
      useLayoutEffect(() => rememberDowntimePack(held, world.worldGeneration, owner), [owner]);
      return null;
    }
    function Phase({ status }: { status: "ready" | "unavailable" }) {
      const value = useWardFlow();
      return (
        <WardFlowOverride value={{ ...value, shared: { enabled: true, status, error: null } }}>
          <WardFlowClockContext.Provider value={15 * 60}>
            <Retain />
            <DowntimePackScreen />
          </WardFlowClockContext.Provider>
        </WardFlowOverride>
      );
    }
    function View({ status }: { status: "ready" | "unavailable" }) {
      return (
        <WardFlowProvider initialNow={642}>
          <WardSharedAccess connection={{ ...connection, status } as unknown as WardSharedConnection}>
            <Phase status={status} />
          </WardSharedAccess>
        </WardFlowProvider>
      );
    }
    const view = render(<View status="ready" />);
    expect(lastDowntimePack()).toBe(held);
    fireEvent.click(screen.getByRole("button", { name: /new snapshot/i }));
    view.rerender(<View status="unavailable" />);
    act(() => vi.advanceTimersByTime(450));
    expect(lastDowntimePack()).toBe(held);
    expect(held.generatedAt).toBe(642);
    expect(connection.dispatch).not.toHaveBeenCalled();
    view.rerender(<View status="ready" />);
    expect(screen.getByRole("button", { name: /new snapshot/i })).not.toBeDisabled();
  });
  it("prints the retained dated report during outage but neither manual nor scheduled snapshot replaces it", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const connection = {
      enabled: true,
      signedIn: true,
      snapshot,
      receivedAt: Date.now(),
      status: "unavailable",
      error: null,
      actorId: "synthetic-account",
      workingAs: "bootstrap",
      accessUntil: Date.now() + 60000,
      access: { role: "coordinator", scope: { kind: "statewide" } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      dispatch: vi.fn(),
      pushApi: {},
    } as unknown as WardSharedConnection;
    const held = pack();
    function Outage({ children }: { children: ReactNode }) {
      const value = useWardFlow();
      return (
        <WardFlowOverride value={{ ...value, shared: { enabled: true, status: "unavailable", error: null } }}>
          {children}
        </WardFlowOverride>
      );
    }
    function Retain() {
      const owner = useDowntimePackOwner();
      useLayoutEffect(() => rememberDowntimePack(held, world.worldGeneration, owner), [owner]);
      return null;
    }
    render(
      <WardFlowProvider initialNow={642}>
        <WardSharedAccess connection={connection}>
          <Outage>
            <WardFlowClockContext.Provider value={15 * 60}>
              <Retain />
              <WardDowntimePackLine />
              <DowntimePackScreen />
            </WardFlowClockContext.Provider>
          </Outage>
        </WardSharedAccess>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-downtime-print"));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /new snapshot/i }));
    expect(lastDowntimePack()).toBe(held);
    expect(held.generatedAt).toBe(642);
    expect(connection.dispatch).not.toHaveBeenCalled();
  });
});

describe("shared recovery alert lifetime", () => {
  const commandId = "11111111-1111-4111-8111-111111111111";
  function recoveryClient(outcome: "accepted" | "refused" | "unavailable", accessUntil = Date.now() + 60_000) {
    const storage = new Map([
      [WARD_COMMAND_RECOVERY_KEY, JSON.stringify({ commandId, receiptScope: "current", expiresAt: accessUntil })],
    ]);
    let current: SharedView | undefined;
    let phase: "ready" | "choose-role" | "no-role" | "denied" = "ready";
    let unreadable = false;
    let receiptReads = 0;
    let posts = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic",
      changed: (next) => {
        current = next;
      },
      recoveryStorage: {
        getItem: (key) => {
          if (unreadable) throw new Error("Synthetic storage refusal");
          return storage.get(key) ?? null;
        },
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
      fetch: async (url, init) => {
        if (init?.method === "POST") posts++;
        if (String(url).includes("/receipt?")) {
          receiptReads++;
          if (outcome === "unavailable") throw new Error("Synthetic receipt outage");
          return Response.json({ receipt: { outcome, commandRevision: 1 } });
        }
        if (phase === "choose-role") return Response.json({ code: "choose-role", choices: [] }, { status: 409 });
        if (phase === "no-role") return Response.json({ code: "no-role" }, { status: 403 });
        if (phase === "denied")
          return Response.json({ code: "signed-out", error: "Synthetic session ended" }, { status: 401 });
        return Response.json({ snapshot, receiptScope: "current", accessUntil });
      },
    });
    return {
      client,
      storage,
      view: () => current,
      receiptReads: () => receiptReads,
      posts: () => posts,
      phase: (next: typeof phase) => {
        phase = next;
      },
      refuseStorage: () => {
        unreadable = true;
      },
    };
  }

  it.each(["accepted", "refused"] as const)(
    "keeps a %s receipt outcome during ordinary same-desk polls",
    async (outcome) => {
      const h = recoveryClient(outcome);
      try {
        await h.client.refresh();
        const message = h.view()?.recovery;
        expect(message).toMatch(outcome === "accepted" ? /was accepted/ : /was not applied/);
        expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
        await h.client.refresh();
        await h.client.refresh();
        expect(h.view()?.recovery).toBe(message);
        expect(h.view()?.recovering).toBe(false);
        expect(h.receiptReads()).toBe(1);
        expect(h.posts()).toBe(0);
      } finally {
        h.client.dispose();
      }
    },
  );

  it.each(["chooseRole", "switchRole", "choose-role", "no-role", "denied", "expiry"] as const)(
    "drops an outgoing recovery outcome on %s",
    async (transition) => {
      vi.useFakeTimers();
      const h = recoveryClient("accepted", Date.now() + 1000);
      try {
        await h.client.refresh();
        expect(h.view()?.recovery).toMatch(/was accepted/);
        if (transition === "expiry") await vi.advanceTimersByTimeAsync(1001);
        else if (transition === "chooseRole" || transition === "switchRole") {
          h.phase("choose-role");
          if (transition === "chooseRole") h.client.chooseRole("22222222-2222-4222-8222-222222222222");
          else h.client.switchRole();
          await vi.advanceTimersByTimeAsync(0);
        } else {
          h.phase(transition);
          await h.client.refresh();
        }
        expect(h.view()?.snapshot === null).toBe(true);
        expect(h.view()?.recovery).toBeUndefined();
        expect(h.view()?.recovering).toBe(false);
        expect(h.view()?.unconfirmedSave).toBe(false);
      } finally {
        h.client.dispose();
      }
    },
  );

  it.each(["missing", "malformed", "mismatched", "invalid", "unreadable", "expired"] as const)(
    "retires a pending checking alert after a %s recovery entry without replay",
    async (entry) => {
      const h = recoveryClient("unavailable");
      try {
        await h.client.refresh();
        expect(h.view()?.recovery).toMatch(/Checking the previous uncertain save/);
        expect(h.view()?.recovering).toBe(true);
        await expect(
          h.client.dispatch({
            type: "REQUEST_CAPACITY_REFRESH",
            role: "coordinator",
            now: 642,
            unitId: "synthetic-ward",
          }),
        ).resolves.toMatchObject({ status: "cancelled" });
        if (entry === "missing") h.storage.delete(WARD_COMMAND_RECOVERY_KEY);
        else if (entry === "malformed") h.storage.set(WARD_COMMAND_RECOVERY_KEY, "{");
        else if (entry === "unreadable") h.refuseStorage();
        else
          h.storage.set(
            WARD_COMMAND_RECOVERY_KEY,
            JSON.stringify({
              commandId: entry === "invalid" ? "invalid" : commandId,
              receiptScope: entry === "mismatched" ? "other" : "current",
              expiresAt: Date.now() + (entry === "expired" ? -1 : 60_000),
            }),
          );
        await h.client.refresh();
        if (entry === "expired") expect(h.view()?.recovery).toMatch(/receipt has expired/);
        else expect(h.view()?.recovery).toBeUndefined();
        expect(h.view()?.status).toBe("ready");
        expect(h.view()?.recovering).toBe(false);
        expect(h.view()?.unconfirmedSave).toBe(false);
        expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
        expect(h.receiptReads()).toBe(1);
        expect(h.posts()).toBe(0);
      } finally {
        h.client.dispose();
      }
    },
  );
});
