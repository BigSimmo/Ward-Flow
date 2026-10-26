import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useWardShared,
  WardSessionEndingNotice,
  WardSharedAccess,
} from "../src/components/ward-management/ward-shared-access";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { SharedWorkspaceClient } from "../src/components/ward-management/ward-shared-client";
import { releasePhonePush } from "../src/components/ward-management/shell/ward-phone-push";
vi.mock("../src/components/ward-management/shell/ward-phone-push", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/shell/ward-phone-push")>();
  return { ...actual, releasePhonePush: vi.fn(async () => {}) };
});
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";
import { WARD_AUTH_STORAGE_KEY } from "../src/components/ward-management/ward-supabase-auth";
const user = { id: "12345678-1234-1234-1234-123456789abc" };
function Probe({ enabled = true }: { enabled?: boolean }) {
  const connection = useWardShared(enabled);
  return (
    <WardSharedAccess connection={connection}>
      <p>Workspace contents</p>
    </WardSharedAccess>
  );
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "supabase");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://zakzoemeedfepxcstsou.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_WARD_API_BASE_URL", "https://api.example.test");
  sessionStorage.clear();
  window.history.replaceState({}, "", "/ward-flow");
});
/** A stand-in for the app badge API, removed again by the caller. */
function stubAppBadge() {
  const clearAppBadge = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clearAppBadge", { value: clearAppBadge, configurable: true });
  return clearAppBadge;
}
afterEach(() => {
  Reflect.deleteProperty(navigator, "clearAppBadge");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
describe("Supabase shared sign-in", () => {
  it.each(["entra", "supabase"])("makes no Auth, workspace or storage requests in %s demo", (provider) => {
    vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", provider);
    sessionStorage.setItem(WARD_AUTH_STORAGE_KEY, JSON.stringify({ access_token: "synthetic-expired-session" }));
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const get = vi.spyOn(Storage.prototype, "getItem");
    render(<Probe enabled={false} />);
    expect(screen.getByText("Workspace contents")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
  it("opens credentials using the existing sign-in action and clears password on submit", async () => {
    const fetcher = vi.fn(async () => Response.json({}, { status: 400 }));
    vi.stubGlobal("fetch", fetcher);
    render(<Probe />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with email" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "synthetic@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "private-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText("Workspace contents")).toBeNull();
  });
  it.each(["#error=access_denied&error_code=otp_expired&type=recovery", "#type=recovery&access_token=incomplete"])(
    "keeps sign-in usable after an invalid recovery link %s",
    async (fragment) => {
      window.history.replaceState({}, "", "/ward-flow" + fragment);
      const fetcher = vi.fn(async () => Response.json({}, { status: 400 }));
      vi.stubGlobal("fetch", fetcher);
      render(<Probe />);
      expect(await screen.findByText(/recovery link is invalid or expired/i)).toBeInTheDocument();
      expect(window.location.hash).toBe("");
      fireEvent.click(await screen.findByRole("button", { name: "Sign in with email" }));
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "synthetic@example.invalid" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "private-password" } });
      fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
      await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    },
  );
  it.each(["#error=access_denied&error_code=otp_expired&type=recovery", "#type=recovery&access_token=incomplete"])(
    "keeps recovery and nominated signup usable after an invalid link %s",
    async (fragment) => {
      vi.stubEnv("NEXT_PUBLIC_WARD_COORDINATOR_EMAIL", "nominated@example.invalid");
      window.history.replaceState({}, "", "/ward-flow" + fragment);
      const fetcher = vi.fn<typeof fetch>(async () => Response.json({}));
      vi.stubGlobal("fetch", fetcher);
      render(<Probe />);
      expect(await screen.findByText(/recovery link is invalid or expired/i)).toBeInTheDocument();
      expect(window.location.hash).toBe("");
      expect(fetcher).not.toHaveBeenCalled();
      fireEvent.click(await screen.findByRole("button", { name: "Sign in with email" }));
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nominated@example.invalid" } });
      fireEvent.click(screen.getByRole("button", { name: "Forgot password" }));
      await screen.findByText(/a recovery link will be emailed/i);
      expect(String(fetcher.mock.calls[0][0])).toContain("/recover?redirect_to=");
      fireEvent.click(screen.getByRole("button", { name: "Create a Ward Flow account" }));
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
      fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "synthetic-password" } });
      fireEvent.click(screen.getByRole("button", { name: "Create account" }));
      await screen.findByText(/Check your email and confirm/i);
      expect(String(fetcher.mock.calls[1][0])).toContain("/signup?redirect_to=");
      expect(fetcher.mock.calls.some(([url]) => String(url).includes("/v1/workspace"))).toBe(false);
      expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
    },
  );
  it("uses the same trimmed provider selector as the CSP and defaults blank to Supabase", async () => {
    for (const selector of [" supabase ", ""]) {
      vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", selector);
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      const { unmount } = render(<Probe />);
      expect(await screen.findByRole("button", { name: "Sign in with email" })).toBeEnabled();
      expect(fetcher).not.toHaveBeenCalled();
      unmount();
    }
  });
  it.each(["entra", "unknown-provider"])("rejects the %s provider without restoring a session", async (provider) => {
    vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", provider);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const get = vi.spyOn(Storage.prototype, "getItem");
    render(<Probe />);
    expect(await screen.findByText("Shared sign-in configuration is unavailable.")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByText("Workspace contents")).toBeNull();
  });
  it("erases recovery URL and cannot enter workspace before password update", async () => {
    window.history.replaceState(
      {},
      "",
      "/ward-flow#type=recovery&access_token=access&refresh_token=refresh&expires_in=3600",
    );
    let complete!: (response: Response) => void;
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        calls.push(String(url));
        if (init?.method === "PUT")
          return new Promise<Response>((r) => {
            complete = r;
          });
        if (String(url).endsWith("/user")) return Response.json(user);
        return Response.json({}, { status: 503 });
      }),
    );
    render(<Probe />);
    await screen.findByRole("heading", { name: "Set a new password" });
    expect(window.location.hash).toBe("");
    expect(calls.some((url) => url.includes("/v1/workspace"))).toBe(false);
    expect(screen.queryByText("Workspace contents")).toBeNull();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(complete).toBeDefined());
    expect(calls.some((url) => url.includes("/v1/workspace"))).toBe(false);
    await act(async () => {
      complete(Response.json(user));
    });
    await waitFor(() => expect(calls.some((url) => url.includes("/v1/workspace"))).toBe(true));
    expect(JSON.parse(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)!).recovery).toBe(false);
  });
});

it("keeps signup confirmation tokens out of workspace and storage", async () => {
  window.history.replaceState({}, "", "/ward-flow#type=signup&access_token=confirmation&refresh_token=confirmation");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<Probe />);
  await screen.findByRole("heading", { name: "Sign in to Ward Flow" });
  expect(window.location.hash).toBe("");
  expect(fetcher).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  expect(screen.queryByText("Workspace contents")).toBeNull();
});

it("disposes the old provider and starts without its signed-in state", async () => {
  const snapshot = {
    dataMode: "prototype",
    revision: 1,
    now: 642,
    payload: {
      version: 1,
      state: seedWardFlowStateAt(0),
      dayZero: "2026-10-07T00:00:00Z",
      startedAt: "2026-10-07T10:00:00Z",
    },
  };
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    Response.json(
      String(url).includes("/v1/workspace")
        ? { snapshot }
        : String(url).endsWith("/user")
          ? user
          : { access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_in: 3600 },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const { result, rerender } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "synthetic-password");
  });
  expect(result.current.snapshot).not.toBeNull();
  const old = result.current;
  const dispose = vi.spyOn(SharedWorkspaceClient.prototype, "dispose");
  vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "unknown-provider");
  rerender();
  expect(dispose).toHaveBeenCalledOnce();
  expect(result.current.snapshot).toBeNull();
  const calls = fetcher.mock.calls.length;
  old.dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "synthetic" });
  old.retry();
  expect(fetcher).toHaveBeenCalledTimes(calls);
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "supabase");
  rerender();
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.snapshot).toBeNull();
  expect(result.current.signedIn).toBe(false);
});

it("disposes the board immediately while phone cleanup is unresolved", async () => {
  let release!: (value: void) => void;
  let cleanupApi!: Parameters<typeof releasePhonePush>[0];
  vi.mocked(releasePhonePush).mockImplementation((api) => {
    cleanupApi = api;
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  const snapshot = {
    dataMode: "prototype",
    revision: 1,
    now: 642,
    payload: {
      version: 1,
      state: seedWardFlowStateAt(0),
      dayZero: "2026-10-07T00:00:00Z",
      startedAt: "2026-10-07T10:00:00Z",
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      String(url).includes("/v1/workspace")
        ? Response.json({ snapshot })
        : String(url).endsWith("/user")
          ? Response.json(user)
          : String(url).includes("/logout")
            ? new Response(null, { status: 204 })
            : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }),
    ),
  );
  const dispose = vi.spyOn(SharedWorkspaceClient.prototype, "dispose");
  const { result } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  expect(result.current.snapshot).not.toBeNull();
  dispose.mockClear();
  act(() => {
    result.current.signOut();
    expect(dispose).toHaveBeenCalled();
  });
  expect(result.current.snapshot).toBeNull();
  expect(result.current.signedIn).toBe(false);
  expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  expect(release).toBeDefined();
  await cleanupApi.pushUnsubscribe("synthetic-endpoint");
  const fetcher = vi.mocked(fetch);
  const cleanupCall = fetcher.mock.calls.find(([url]) => String(url).endsWith("/push-unsubscribe"));
  expect((cleanupCall?.[1]?.headers as Record<string, string>)?.authorization).toBe("Bearer access");
  await act(async () => {
    release();
  });
  vi.mocked(releasePhonePush).mockResolvedValue();
});
it("treats a rejected password as a form answer, not a sign-in outage", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({}, { status: 400 })),
  );
  const { result } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "wrong-password");
  });
  expect(result.current.status).toBe("ready");
  expect(result.current.error ?? null).toBeNull();
});
it("keeps a deliberate sign-out quiet when remote logout fails", async () => {
  vi.mocked(releasePhonePush).mockResolvedValue();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      String(url).includes("/v1/workspace")
        ? Response.json({ snapshot: null }, { status: 503 })
        : String(url).endsWith("/user")
          ? Response.json(user)
          : String(url).includes("/logout")
            ? Promise.reject(new TypeError("offline"))
            : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }),
    ),
  );
  const { result } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  const clearAppBadge = stubAppBadge();
  await act(async () => {
    result.current.signOut();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  // The act-now count on the app icon goes with the account, so a shared phone never shows it.
  expect(clearAppBadge).toHaveBeenCalled();
  expect(result.current.signedIn).toBe(false);
  expect(result.current.status).not.toBe("unavailable");
  expect(result.current.error ?? null).toBeNull();
  expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
});
it("stops polling and signs out the view when the workspace refuses access", async () => {
  const fetcher = vi.fn(async (url: string | URL | Request) =>
    String(url).includes("/v1/workspace")
      ? Response.json({ error: "Origin not allowed" }, { status: 403 })
      : String(url).endsWith("/user")
        ? Response.json(user)
        : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }),
  );
  vi.stubGlobal("fetch", fetcher);
  const interval = vi.spyOn(globalThis, "setInterval");
  const clearAppBadge = stubAppBadge();
  const { result } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  expect(result.current.status).toBe("not-authorised");
  expect(clearAppBadge).toHaveBeenCalled();
  // Audit 24-3 SV-6: the server's own reason.
  expect(result.current.error).toBe("Origin not allowed");
  expect(result.current.signedIn).toBe(false);
  expect(interval.mock.calls.some(([, ms]) => ms === 3000)).toBe(false);
  const workspaceCalls = fetcher.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/v1/workspace"));
  // One refused read, no polling, and at most one request asking the server to end the sign-in.
  expect(workspaceCalls.filter((url) => !url.endsWith("/v1/workspace/sign-out"))).toHaveLength(1);
  expect(workspaceCalls.filter((url) => url.endsWith("/v1/workspace/sign-out")).length).toBeLessThanOrEqual(1);
  expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
});
it("turns this device's phone alerts off when the session limit signs the person out", async () => {
  let revoked: boolean | undefined;
  vi.mocked(releasePhonePush).mockImplementation(async (api) => {
    revoked = await api.pushUnsubscribe("synthetic-endpoint");
  });
  const fetcher = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async (url) =>
    String(url).endsWith("/push-unsubscribe")
      ? Response.json({ subscribed: false, revoked: true })
      : String(url).includes("/v1/workspace")
        ? Response.json({ code: "session-limit", error: "Signed out after 12 hours." }, { status: 401 })
        : String(url).endsWith("/user")
          ? Response.json(user)
          : String(url).includes("/logout")
            ? new Response(null, { status: 204 })
            : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }),
  );
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  expect(result.current.status).toBe("not-authorised");
  expect(result.current.error).toBe("Signed out after 12 hours.");
  expect(result.current.signedIn).toBe(false);
  await waitFor(() => expect(revoked).toBe(true));
  const cleanupCall = fetcher.mock.calls.find(([url]) => String(url).endsWith("/push-unsubscribe"));
  expect((cleanupCall?.[1]?.headers as Record<string, string>)?.authorization).toBe("Bearer access");
  vi.mocked(releasePhonePush).mockResolvedValue();
});
it("pauses 3-second polling while document is hidden and refreshes immediately when visible", async () => {
  const snapshot = {
    dataMode: "prototype",
    revision: 1,
    now: 642,
    payload: {
      version: 1,
      state: seedWardFlowStateAt(0),
      dayZero: "2026-10-07T00:00:00Z",
      startedAt: "2026-10-07T10:00:00Z",
    },
  };
  const fetcher = vi.fn(async (url: string | URL | Request) =>
    String(url).includes("/v1/workspace")
      ? Response.json({ snapshot })
      : String(url).endsWith("/user")
        ? Response.json(user)
        : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }),
  );
  vi.stubGlobal("fetch", fetcher);
  const realSetInterval = globalThis.setInterval;
  let pollTick: (() => void) | undefined;
  vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: TimerHandler, ms?: number) => {
    if (ms === 3000 && typeof fn === "function") {
      pollTick = fn as () => void;
      return 0 as unknown as ReturnType<typeof setInterval>;
    }
    return realSetInterval(fn, ms);
  }) as typeof setInterval);
  const { result, unmount } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  expect(pollTick).toBeDefined();
  const initialReads = fetcher.mock.calls.filter(([url]) => String(url).includes("/v1/workspace")).length;
  expect(initialReads).toBe(1);

  const visibilitySpy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => {
    pollTick!();
  });
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/v1/workspace"))).toHaveLength(1);

  visibilitySpy.mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitFor(() =>
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/v1/workspace"))).toHaveLength(2),
  );
  unmount();
});
describe("sign-out across tabs and the session limit (Audit 5 PS-08, Audit 4 A4-05, A4-06)", () => {
  const channels: { posted: unknown[]; onmessage: ((event: { data: unknown }) => void) | null }[] = [];
  const startedAt = 1_790_000_000; // seconds, the token's first sign-in factor
  const payload = btoa(JSON.stringify({ amr: [{ method: "password", timestamp: startedAt }] })).replace(/=+$/, "");
  const access = `header.${payload}.signature`;
  async function signedIn() {
    channels.length = 0;
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        posted: unknown[] = [];
        onmessage: ((event: { data: unknown }) => void) | null = null;
        constructor() {
          channels.push(this);
        }
        postMessage(data: unknown) {
          this.posted.push(data);
        }
        close() {}
      },
    );
    vi.mocked(releasePhonePush).mockResolvedValue();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        String(url).includes("/v1/workspace")
          ? Response.json({ snapshot: null }, { status: 503 })
          : String(url).endsWith("/user")
            ? Response.json(user)
            : String(url).includes("/logout")
              ? Response.json({})
              : Response.json({ access_token: access, refresh_token: "refresh", expires_in: 3600, user }),
      ),
    );
    const hook = renderHook(() => useWardShared(true));
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    await act(async () => {
      await hook.result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
    });
    return hook;
  }

  it("tells every other tab when a person signs out on purpose", async () => {
    const { result } = await signedIn();
    await act(async () => {
      result.current.signOut();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(channels[0].posted).toEqual(["signed-out"]);
  });

  it("signs this tab out, says why and stays quiet, when another tab signs out", async () => {
    const { result } = await signedIn();
    await act(async () => {
      channels[0].onmessage?.({ data: "signed-out" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.signedIn).toBe(false);
    expect(result.current.error).toBe("Signed out in another Ward Flow tab. Sign in again to carry on.");
    expect(channels[0].posted).toEqual([]);
    expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  });

  it("an idle sign-out with a reason stays in this tab", async () => {
    const { result } = await signedIn();
    await act(async () => {
      result.current.signOut("Signed out after 15 minutes without use. Sign in again to carry on.");
      // No other tab answers its question within the wait (audit 24-3 SM-1).
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(channels[0].posted).not.toContain("signed-out");
    expect(result.current.error).toBe("Signed out after 15 minutes without use. Sign in again to carry on.");
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/logout"))).toBe(true);
  });

  it("keeps the shared session when another tab on this sign-in is in use (audit 24-3 SM-1)", async () => {
    const { result } = await signedIn();
    await act(async () => {
      result.current.signOut("Signed out after 15 minutes without use. Sign in again to carry on.");
      const { ask } = channels[0].posted[0] as { ask: string };
      channels[0].onmessage?.({ data: { inUse: ask } });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.signedIn).toBe(false);
    expect(result.current.error).toBe("Signed out after 15 minutes without use. Sign in again to carry on.");
    expect(channels[0].posted).not.toContain("signed-out");
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/logout"))).toBe(false);
    expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  });

  it("says it is in use only for the same sign-in, used within the idle time (audit 24-3 SM-1)", async () => {
    await signedIn();
    channels[0].onmessage?.({ data: { ask: "a", userId: user.id, within: 60_000 } });
    channels[0].onmessage?.({ data: { ask: "b", userId: "someone-else", within: 60_000 } });
    channels[0].onmessage?.({ data: { ask: "c", userId: user.id, within: 0 } });
    expect(channels[0].posted).toEqual([{ inUse: "a" }]);
  });

  it("knows when the sign-in reaches the session limit, from the token's first sign-in", async () => {
    const { result } = await signedIn();
    await waitFor(() =>
      expect(result.current.sessionEndsAt).toBe(startedAt * 1000 + CLINICAL_VALUES.sessionLimit.value * 3_600_000),
    );
  });
});

it("warns ten minutes before the session limit, and not before (A4-05)", () => {
  const { rerender } = render(<WardSessionEndingNotice endsAt={Date.now() + 11 * 60_000} />);
  expect(screen.queryByTestId("ward-session-ending")).toBeNull();
  rerender(<WardSessionEndingNotice endsAt={Date.now() + 9 * 60_000} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/You will be signed out at .*12-hour sign-in limit/);
});
