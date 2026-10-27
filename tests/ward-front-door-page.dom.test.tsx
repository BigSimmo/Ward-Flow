import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardBrowserAuthAdapter } from "../src/components/ward-management/ward-supabase-auth";
import { WardAuthError } from "../src/components/ward-management/ward-auth-link";

const createWardAuth = vi.hoisted(() => vi.fn<() => Promise<WardBrowserAuthAdapter>>());
vi.mock("@/components/ward-management/ward-auth-session", () => ({ createWardAuth }));

import { FrontDoorPage } from "../src/components/ward-management/front-door/front-door-page";
import {
  endFrontDoorPass,
  renewFrontDoorPass,
} from "../src/components/ward-management/front-door/front-door-pass-client";
import { IdleLockScreen, IdleWarningSheet } from "../src/components/ward-management/front-door/lock-cards";

// Synthetic sign-in only: no account, address or token here belongs to anyone.
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

function answer(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let replace: ReturnType<typeof vi.fn>;
let fetcher: ReturnType<typeof vi.fn>;

beforeEach(() => {
  replace = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, hash: "", replace } as Location);
  fetcher = vi.fn(async () => answer(200, { ok: true }));
  vi.stubGlobal("fetch", fetcher);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  createWardAuth.mockReset();
  document.cookie = "wf_door=; max-age=0";
});

describe("the public demo's code door", () => {
  it("opens the demo with the right code", async () => {
    render(<FrontDoorPage next="/ward-flow/capacity" mode="demo-code" tv={false} />);
    expect(screen.getByText(/for 8 hours/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Demo code"), { target: { value: "SYNTHETIC-CODE" } });
    fireEvent.click(screen.getByRole("button", { name: "Open the demo" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ward-flow/capacity"));
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ demoCode: "SYNTHETIC-CODE" });
  });

  it("says when the code is wrong, and when the server gave a reason", async () => {
    fetcher.mockResolvedValueOnce(answer(401)).mockResolvedValueOnce(answer(429, { error: "Wait ten minutes." }));
    render(<FrontDoorPage next="/ward-flow" mode="demo-code" tv={false} />);
    fireEvent.change(screen.getByLabelText("Demo code"), { target: { value: "WRONG" } });
    fireEvent.click(screen.getByRole("button", { name: "Open the demo" }));
    expect(await screen.findByText("That demo code is not right.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open the demo" }));
    expect(await screen.findByText("Wait ten minutes.")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("says when there is no connection", async () => {
    fetcher.mockRejectedValueOnce(new TypeError("offline"));
    render(<FrontDoorPage next="/ward-flow" mode="demo-code" tv={false} />);
    fireEvent.change(screen.getByLabelText("Demo code"), { target: { value: "SYNTHETIC-CODE" } });
    fireEvent.click(screen.getByRole("button", { name: "Open the demo" }));
    expect(await screen.findByText("No connection.")).toBeVisible();
  });
});

describe("the account door", () => {
  it("goes straight through for a tab that is still signed in", async () => {
    createWardAuth.mockResolvedValue(adapter({ userId: "synthetic-user" }));
    render(<FrontDoorPage next="/ward-flow/ed" mode="account" tv={false} />);
    expect(screen.getByText("Checking your sign-in.")).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ward-flow/ed"));
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ token: "synthetic-token" });
  });

  it("signs in, then asks for the pass and opens the page", async () => {
    const auth = adapter();
    createWardAuth.mockResolvedValue(auth);
    render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "synthetic@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ward-flow"));
    expect(auth.signIn).toHaveBeenCalledWith("synthetic@example.test", "synthetic-password");
  });

  it("shows a refused sign-in and a refused pass", async () => {
    const auth = adapter({
      signIn: vi
        .fn<WardBrowserAuthAdapter["signIn"]>()
        .mockRejectedValueOnce(new WardAuthError("credentials", "Refused."))
        .mockResolvedValue(undefined),
    });
    createWardAuth.mockResolvedValue(auth);
    fetcher.mockResolvedValueOnce(answer(401, { error: "This account has no Ward Flow role." }));
    render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "synthetic@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email or password is not right.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/This account has no Ward Flow role\./)).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a reset link", async () => {
    const auth = adapter();
    createWardAuth.mockResolvedValue(auth);
    render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "synthetic@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: /Send reset link/ }));
    await waitFor(() =>
      expect(auth.recover).toHaveBeenCalledWith("synthetic@example.test", expect.stringMatching(/\/ward-flow$/)),
    );
  });

  it("sets a new password from a recovery link", async () => {
    const auth = adapter({ isRecovery: true, accountEmail: "synthetic@example.test" });
    createWardAuth.mockResolvedValue(auth);
    render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
    const fields = await screen.findAllByLabelText(/password/i, { selector: "input" });
    for (const field of fields) fireEvent.change(field, { target: { value: "synthetic-new-password-1" } });
    fireEvent.submit(fields[0]!.closest("form")!);
    await waitFor(() => expect(auth.updatePassword).toHaveBeenCalledWith("synthetic-new-password-1"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ward-flow"));
  });

  it("shows the sign-in as unavailable when it is not set up", async () => {
    createWardAuth.mockRejectedValue(new Error("not configured"));
    render(<FrontDoorPage next="/ward-flow" mode="account" tv />);
    await waitFor(() => expect(screen.queryByText("Checking your sign-in.")).not.toBeInTheDocument());
  });

  it("closes the sign-in when the page goes away first", async () => {
    let resolve: (value: WardBrowserAuthAdapter) => void = () => {};
    createWardAuth.mockReturnValue(new Promise((done) => (resolve = done)));
    const auth = adapter();
    const { unmount } = render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
    unmount();
    await act(async () => resolve(auth));
    expect(auth.dispose).toHaveBeenCalled();
  });
});

describe("the pass from inside the app", () => {
  it("asks for nothing on a site without the front door", async () => {
    await renewFrontDoorPass(async () => "synthetic-token");
    endFrontDoorPass();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("renews and ends the pass on a site with the front door", async () => {
    document.cookie = "wf_door=1";
    await renewFrontDoorPass(async () => "synthetic-token");
    endFrontDoorPass();
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "DELETE"]);
  });

  it("keeps quiet when the renewal fails", async () => {
    document.cookie = "wf_door=1";
    fetcher.mockRejectedValue(new TypeError("offline"));
    await expect(renewFrontDoorPass(async () => "synthetic-token")).resolves.toBeUndefined();
  });
});

describe("the idle cards", () => {
  it("counts down and offers both ways out", () => {
    const stillHere = vi.fn();
    const signOut = vi.fn();
    render(
      <IdleWarningSheet
        panelRef={createRef()}
        minutes={15}
        secondsLeft={1}
        warningSeconds={60}
        onStillHere={stillHere}
        onSignOutNow={signOut}
      />,
    );
    expect(screen.getByRole("alertdialog", { name: "Still there?" })).toHaveTextContent("signed out in 1 second");
    fireEvent.click(screen.getByRole("button", { name: "I'm still here" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out now" }));
    expect(stillHere).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("covers the desk with the lock card", () => {
    const unlock = vi.fn();
    render(
      <IdleLockScreen panelRef={createRef()} title="Desk locked" action="Sign in again" onAction={unlock}>
        Signed out after 15 minutes without use.
      </IdleLockScreen>,
    );
    expect(screen.getByRole("dialog", { name: "Desk locked" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Sign in again/ }));
    expect(unlock).toHaveBeenCalledOnce();
  });
});
