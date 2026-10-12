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
