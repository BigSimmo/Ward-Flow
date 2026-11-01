import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardBrowserAuthAdapter } from "../src/components/ward-management/ward-supabase-auth";
import { WardAuthError } from "../src/components/ward-management/ward-auth-link";

const createWardAuth = vi.hoisted(() => vi.fn<() => Promise<WardBrowserAuthAdapter>>());
vi.mock("@/components/ward-management/ward-auth-session", () => ({ createWardAuth }));

import { WardFlowSignInScreen } from "@/components/ward-flow-sign-in/ward-flow-sign-in-screen";

/**
 * The Ward Flow sign-in page (Josh, 1 November 2026, Q164 to Q166): the front door's card with
 * Username and Password, signing in to a real account so the account opens with its own role's
 * access, and an "Explore the demo" link to the public demo. Synthetic accounts only.
 */

function adapter(overrides: Partial<WardBrowserAuthAdapter> = {}): WardBrowserAuthAdapter {
  return {
    isRecovery: false,
    userId: null,
    accountEmail: null,
    reauthenticate: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    signUp: vi.fn(async () => {}),
    signIn: vi.fn(async () => {}),
    token: vi.fn(async () => "synthetic-token"),
    recover: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => {}),
    captureAccessTokenForSignOut: () => null,
    signOut: vi.fn(async () => {}),
    dispose: vi.fn(),
    ...overrides,
  };
}

let replace: ReturnType<typeof vi.fn>;
let fetcher: ReturnType<typeof vi.fn>;

beforeEach(() => {
  replace = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, hash: "", replace } as Location);
  fetcher = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  createWardAuth.mockReset();
});

describe("Ward Flow sign-in page", () => {
  it("is the front door card with Username, Password and Explore the demo", async () => {
    createWardAuth.mockResolvedValue(adapter());
    const { container } = render(<WardFlowSignInScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    expect(screen.getByLabelText("Username")).toHaveAttribute("autocomplete", "username");
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: /Explore the demo/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\//),
    );
    // The skip link in the root layout points at the page's main landmark.
    expect(container.querySelector("main#main-content")).not.toBeNull();
  });

  it("signs a real account in with the work email as the username, then opens Ward Flow", async () => {
    const auth = adapter();
    createWardAuth.mockResolvedValue(auth);
    render(<WardFlowSignInScreen />);
    fireEvent.change(await screen.findByLabelText("Username"), { target: { value: " synthetic@example.test " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ward-flow"));
    expect(auth.signIn).toHaveBeenCalledWith("synthetic@example.test", "synthetic-password");
    // The password goes to the sign-in service only, and the card forgets it straight away.
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ token: "synthetic-token" });
    expect(screen.queryByDisplayValue("synthetic-password")).toBeNull();
  });

  it("says Username or password when the account refuses", async () => {
    createWardAuth.mockResolvedValue(
      adapter({ signIn: vi.fn(async () => Promise.reject(new WardAuthError("credentials", "Refused."))) }),
    );
    render(<WardFlowSignInScreen />);
    fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "synthetic@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Username or password is not right.")).toBeVisible();
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true");
    expect(replace).not.toHaveBeenCalled();
  });

  it("goes straight through for a tab that is still signed in", async () => {
    createWardAuth.mockResolvedValue(adapter({ userId: "synthetic-user" }));
    render(<WardFlowSignInScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ward-flow"));
  });

  it("says so when this site has no account sign-in, and still offers the demo", async () => {
    createWardAuth.mockRejectedValue(new Error("not configured"));
    render(<WardFlowSignInScreen />);
    expect(await screen.findByText("Sign-in is not available on this site.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByRole("link", { name: /Explore the demo/ })).toBeVisible();
  });
});
