import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWardShared, WardSharedAccess } from "../src/components/ward-management/ward-shared-access";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { SharedWorkspaceClient } from "../src/components/ward-management/ward-shared-client";
import { releasePhonePush } from "../src/components/ward-management/shell/ward-phone-push";
vi.mock("../src/components/ward-management/shell/ward-phone-push", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/shell/ward-phone-push")>();
  return { ...actual, releasePhonePush: vi.fn(async () => {}) };
});
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
  window.history.replaceState({}, "", "/mockups/ward-flow");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
describe("Supabase shared sign-in", () => {
  it.each(["entra", "supabase"])("makes no Auth, workspace or storage requests in %s demo", (provider) => {
    vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", provider);
    vi.stubEnv("NEXT_PUBLIC_WARD_CLIENT_ID", "synthetic-client");
    vi.stubEnv("NEXT_PUBLIC_WARD_TENANT_ID", "synthetic-tenant");
    vi.stubEnv("NEXT_PUBLIC_WARD_API_SCOPE", "synthetic-scope");
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
      window.history.replaceState({}, "", "/mockups/ward-flow" + fragment);
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
      window.history.replaceState({}, "", "/mockups/ward-flow" + fragment);
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
      fireEvent.click(screen.getByRole("button", { name: "Create coordinator account" }));
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
  it("reports Microsoft sign-in unavailable without network calls when entra is selected", async () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "entra");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<Probe />);
    expect(
      await screen.findByText("Microsoft sign-in or shared workspace configuration is unavailable."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Microsoft" })).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects an unknown provider without restoring a session", async () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "unknown-provider");
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
      "/mockups/ward-flow#type=recovery&access_token=access&refresh_token=refresh&expires_in=3600",
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
  window.history.replaceState(
    {},
    "",
    "/mockups/ward-flow#type=signup&access_token=confirmation&refresh_token=confirmation",
  );
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<Probe />);
  await screen.findByRole("heading", { name: "Coordinator sign-in" });
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
  await act(async () => {
    result.current.signOut();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(result.current.signedIn).toBe(false);
  expect(result.current.status).not.toBe("unavailable");
  expect(result.current.error ?? null).toBeNull();
  expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
});
it("stops polling and signs out the view when the workspace refuses access", async () => {
  const fetcher = vi.fn(async (url: string | URL | Request) =>
    String(url).includes("/v1/workspace")
      ? Response.json({}, { status: 403 })
      : String(url).endsWith("/user")
        ? Response.json(user)
        : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }),
  );
  vi.stubGlobal("fetch", fetcher);
  const interval = vi.spyOn(globalThis, "setInterval");
  const { result } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  expect(result.current.status).toBe("not-authorised");
  expect(result.current.error).toMatch(/coordinator access/);
  expect(result.current.signedIn).toBe(false);
  expect(interval.mock.calls.some(([, ms]) => ms === 3000)).toBe(false);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/v1/workspace"))).toHaveLength(1);
  expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
});
