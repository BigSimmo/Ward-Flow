// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SharedSessionContext,
  type SharedSession,
} from "@/components/ward-management/shell/ward-shared-session-context";
import {
  readSignInEnd,
  signInEndingSoon,
  WardSignInEnding,
} from "@/components/ward-management/shell/ward-sign-in-ending";

afterEach(() => {
  cleanup();
  document.cookie = "wf_door_end=; path=/; max-age=0";
});

describe("sign-in ending strip (R-STRUCT-43, R-STRUCT-51)", () => {
  it("reads the end cookie and only warns inside the last 10 minutes", () => {
    const end = readSignInEnd("a=1; wf_door_end=account.1700000600000");
    expect(end).toEqual({ kind: "account", endsAt: 1700000600000 });
    expect(signInEndingSoon(end, 1700000000000 - 1)).toBeNull();
    expect(signInEndingSoon(end, 1700000000000)).toEqual(end);
    expect(signInEndingSoon(end, 1700000600000)).toBeNull();
    expect(readSignInEnd("wf_door_end=junk")).toBeNull();
  });

  it("shows one line with a sign-in link for an account, and the demo wording for a demo code", () => {
    document.cookie = `wf_door_end=account.${Date.now() + 5 * 60_000}; path=/`;
    const { unmount } = render(<WardSignInEnding />);
    expect(screen.getByTestId("ward-sign-in-ending").textContent).toMatch(/^Your sign-in ends at \d\d:\d\d\./);
    expect(screen.getByRole("link", { name: "sign in again" }).getAttribute("href")).toBe("/sign-in");
    unmount();
    document.cookie = `wf_door_end=demo.${Date.now() + 5 * 60_000}; path=/`;
    render(<WardSignInEnding />);
    expect(screen.getByTestId("ward-sign-in-ending").textContent).toMatch(/^The demo code ends at/);
    expect(screen.getByRole("button", { name: "enter the code again" })).toBeTruthy();
  });

  it("signs a signed-in account out, so the next sign-in starts a new 12 hours", () => {
    document.cookie = `wf_door_end=account.${Date.now() + 5 * 60_000}; path=/`;
    const signOut = vi.fn();
    render(
      <SharedSessionContext.Provider value={{ signOut } as unknown as SharedSession}>
        <WardSignInEnding />
      </SharedSessionContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "sign out and sign in again" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("shows nothing with no cookie or far from the end", () => {
    document.cookie = `wf_door_end=account.${Date.now() + 3 * 3_600_000}; path=/`;
    render(<WardSignInEnding />);
    expect(screen.queryByTestId("ward-sign-in-ending")).toBeNull();
  });
});
