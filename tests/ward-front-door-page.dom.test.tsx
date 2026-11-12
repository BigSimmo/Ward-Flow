import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardBrowserAuthAdapter } from "../src/components/ward-management/ward-supabase-auth";
import { WardAuthError, WARD_RECOVERY_VERIFIER_KEY } from "../src/components/ward-management/ward-auth-link";

const createWardAuth = vi.hoisted(() => vi.fn<() => Promise<WardBrowserAuthAdapter>>());
vi.mock("@/components/ward-management/ward-auth-session", () => ({ createWardAuth }));

import { FrontDoorPage } from "../src/components/ward-management/front-door/front-door-page";
import {
  END_PASS_DEADLINE_MS,
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
    expect(screen.getByText("Checking your sign-in. This usually takes a few seconds.")).toBeInTheDocument();
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

  it("exchanges a recovery code only with this browser's verifier, and takes it off the address (SEC-2)", async () => {
    const verifier = "f".repeat(64);
    localStorage.setItem(WARD_RECOVERY_VERIFIER_KEY, JSON.stringify({ verifier, createdAt: Date.now() }));
    const history = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hash: "",
      pathname: "/sign-in",
      search: "?code=synthetic-code&next=%2Fward-flow",
      replace,
    } as Location);
    const auth = adapter();
    createWardAuth.mockResolvedValue(auth);
    render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
    await waitFor(() => expect(auth.restore).toHaveBeenCalledWith({ code: "synthetic-code", verifier }));
    expect(history.mock.calls.map((call) => call[2])).toEqual(["/sign-in?next=%2Fward-flow"]);
    expect(localStorage.getItem(WARD_RECOVERY_VERIFIER_KEY)).toBeNull();
  });

  it("does not sign in with a recovery code from another device or browser (SEC-2)", async () => {
    localStorage.removeItem(WARD_RECOVERY_VERIFIER_KEY);
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hash: "",
      pathname: "/sign-in",
      search: "?code=synthetic-code&next=%2Fward-flow",
      replace,
    } as Location);
    const auth = adapter();
    createWardAuth.mockResolvedValue(auth);
    render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
    expect(
      await screen.findByText(
        "Open this link on the device and browser where you asked for it, or ask for a new link here.",
      ),
    ).toBeVisible();
    expect(auth.restore).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the sign-in as unavailable when it is not set up", async () => {
    createWardAuth.mockRejectedValue(new Error("not configured"));
    render(<FrontDoorPage next="/ward-flow" mode="account" tv />);
    await waitFor(() =>
      expect(screen.queryByText("Checking your sign-in. This usually takes a few seconds.")).not.toBeInTheDocument(),
    );
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

  it.each([false, true])(
    "returns to the usable form when token acquisition rejects (restored=%s)",
    async (restored) => {
      const auth = adapter({
        userId: restored ? "synthetic-user" : null,
        token: vi.fn().mockRejectedValue(new Error("Synthetic token failure")),
      });
      createWardAuth.mockResolvedValue(auth);
      render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
      if (!restored) {
        fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "synthetic@example.test" } });
        fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
        fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      }
      expect(await screen.findByText("The sign-in service is busy.")).toBeVisible();
      expect(screen.getByRole("button", { name: "Try again" })).not.toBeDisabled();
      expect(screen.queryByText("Opening Ward Flow.")).not.toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it("never opens a page after the opening sign-in was unmounted", async () => {
    let token!: (value: string) => void;
    createWardAuth.mockResolvedValue(
      adapter({
        userId: "synthetic-user",
        token: () =>
          new Promise<string>((resolve) => {
            token = resolve;
          }),
      }),
    );
    const { unmount } = render(<FrontDoorPage next="/ward-flow" mode="account" tv={false} />);
    await waitFor(() => expect(token).toBeTypeOf("function"));
    unmount();
    await act(async () => token("synthetic-token"));
    expect(fetcher).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
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

  // Review of PR #1626: Leave the demo waits on the end, so it reports failure and never hangs.
  it("says whether the server ended the pass, and stops waiting at the deadline", async () => {
    document.cookie = "wf_door=1";
    await expect(endFrontDoorPass()).resolves.toBe(true);
    fetcher.mockResolvedValueOnce(answer(500));
    await expect(endFrontDoorPass()).resolves.toBe(false);
    fetcher.mockRejectedValueOnce(new TypeError("offline"));
    await expect(endFrontDoorPass()).resolves.toBe(false);
    vi.useFakeTimers();
    try {
      fetcher.mockImplementationOnce(() => new Promise<Response>(() => {}));
      const ended = endFrontDoorPass();
      await vi.advanceTimersByTimeAsync(END_PASS_DEADLINE_MS);
      await expect(ended).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
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

describe("the keyboard on a phone", () => {
  // A stand-in for the iPhone's visible area: the keyboard shortens it and the phone pans it.
  function fakeViewport(height: number) {
    const viewport = Object.assign(new EventTarget(), { height, offsetTop: 0, scale: 1 });
    vi.stubGlobal("visualViewport", viewport);
    return viewport;
  }
  const nextFrame = () => act(async () => void (await new Promise((done) => requestAnimationFrame(done))));

  it("brings the page back to the top when the phone pans too far for the folded layout", async () => {
    const viewport = fakeViewport(500);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { container } = render(<FrontDoorPage next="/" mode="demo-code" tv={false} />);
    const code = screen.getByLabelText("Demo code");
    const door = container.firstElementChild as HTMLElement;
    vi.spyOn(code, "getBoundingClientRect").mockReturnValue({ bottom: -180 } as DOMRect); // 480 scrolled, so 300 from the top
    code.focus();
    door.scrollTop = 480;
    viewport.offsetTop = 130;
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();
    expect(door.scrollTop).toBe(0);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("leaves the phone's own pan alone when the field would sit under the keyboard", async () => {
    const viewport = fakeViewport(500);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<FrontDoorPage next="/" mode="demo-code" tv={false} />);
    const code = screen.getByLabelText("Demo code");
    vi.spyOn(code, "getBoundingClientRect").mockReturnValue({ bottom: 600 } as DOMRect);
    code.focus();
    viewport.offsetTop = 130;
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
