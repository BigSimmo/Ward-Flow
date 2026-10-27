import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWardShared, WardSharedAccess } from "../src/components/ward-management/ward-shared-access";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// P013: between signing in and the first workspace read, the screen shows only a spinner with no
// text (Josh, 27 Oct 2026), never the bare sign-in form or a Reconnect screen.
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
it("shows a spinner with no text, not the sign-in or Reconnect screen, until the first read settles", async () => {
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
  render(<Probe />);
  fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "synthetic@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "private-password" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
  });
  const spinner = await screen.findByTestId("ward-shared-reconnecting");
  expect(spinner.textContent).toBe("");
  expect(screen.queryByLabelText("Email")).toBeNull();
  expect(screen.queryByRole("button", { name: "Reconnect" })).toBeNull();
  expect(screen.queryByText("Ward Flow did not open")).toBeNull();
  await act(async () => {
    answer();
  });
  expect(await screen.findByText("Workspace contents")).toBeInTheDocument();
  expect(screen.queryByTestId("ward-shared-reconnecting")).toBeNull();
});
