import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWardShared, WardSharedAccess } from "../src/components/ward-management/ward-shared-access";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { WARD_AUTH_STORAGE_KEY } from "../src/components/ward-management/ward-supabase-auth";

// P-H3-COLD: a direct page load with a saved sign-in must never flash "Ward Flow did not open"
// while the first workspace read is still out. Nothing has failed yet.
const user = { id: "12345678-1234-1234-1234-123456789abc" };
function Probe() {
  const connection = useWardShared(true);
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
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
it("never shows the did-not-open screen while a saved sign-in's first read is still out", async () => {
  sessionStorage.setItem(
    WARD_AUTH_STORAGE_KEY,
    JSON.stringify({ refresh_token: "refresh", recovery: false, user: { id: user.id } }),
  );
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
  let answer!: () => void;
  const workspace = new Promise<void>((resolve) => {
    answer = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      String(url).includes("/v1/workspace")
        ? workspace.then(() => Response.json({ snapshot }))
        : String(url).endsWith("/user")
          ? Response.json(user)
          : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }),
    ),
  );
  const seen = new Set<string>();
  const observer = new MutationObserver(() => {
    if (document.body.textContent?.includes("Ward Flow did not open")) seen.add("did-not-open");
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  render(<Probe />);
  // The saved sign-in is checked, then the workspace read goes out and stays out.
  await waitFor(() =>
    expect(
      screen.queryByTestId("ward-shared-connecting") ?? screen.queryByTestId("ward-shared-reconnecting"),
    ).not.toBeNull(),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(screen.queryByText("Ward Flow did not open")).toBeNull();
  await act(async () => {
    answer();
  });
  await waitFor(() => expect(screen.queryByText("Workspace contents"), document.body.textContent ?? "").not.toBeNull());
  observer.disconnect();
  expect([...seen]).toEqual([]);
});
