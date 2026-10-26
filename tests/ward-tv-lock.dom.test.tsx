import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/ward-flow/bed-meeting", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import {
  TV_LOCK_STORAGE_KEY,
  TvLockControl,
  TvLockGuard,
  lockTv,
} from "@/components/ward-management/bed-meeting/tv-lock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  window.localStorage.removeItem(TV_LOCK_STORAGE_KEY);
  navigation.pathname = "/ward-flow/bed-meeting";
  navigation.replace.mockReset();
});

describe("TV lock (A11)", () => {
  it("locks the TV in one tap, hides Leave TV view, and unlocks after a confirm", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingTvScreen ward="no-such-ward" />
      </WardFlowProvider>,
    );
    const tv = screen.getByTestId("bed-meeting-tv");
    expect(within(tv).getByRole("link", { name: "Leave TV view" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("tv-lock"));
    expect(window.localStorage.getItem(TV_LOCK_STORAGE_KEY)).toBe("/ward-flow/bed-meeting?ward=no-such-ward");
    expect(within(tv).queryByRole("link", { name: "Leave TV view" })).toBeNull();

    fireEvent.click(screen.getByTestId("tv-unlock"));
    const dialog = screen.getByTestId("tv-unlock-dialog");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Unlock" }));
    });
    expect(window.localStorage.getItem(TV_LOCK_STORAGE_KEY)).toBeNull();
    expect(
      within(screen.getByTestId("bed-meeting-tv")).getByRole("link", { name: "Leave TV view" }),
    ).toBeInTheDocument();
  });

  it("sends a locked browser back to its TV view from any other page", () => {
    act(() => lockTv("/ward-flow/bed-meeting?ed=rph-ed"));
    navigation.pathname = "/ward-flow/capacity";
    render(<TvLockGuard />);
    expect(screen.getByTestId("tv-lock-cover")).toHaveTextContent("locked to the TV view");
    expect(navigation.replace).toHaveBeenCalledWith("/ward-flow/bed-meeting?ed=rph-ed");
  });

  it("leaves an unlocked browser, and the TV page itself, alone", () => {
    navigation.pathname = "/ward-flow/capacity";
    const { unmount } = render(<TvLockGuard />);
    expect(screen.queryByTestId("tv-lock-cover")).toBeNull();
    unmount();
    act(() => lockTv("/ward-flow/bed-meeting"));
    navigation.pathname = "/ward-flow/bed-meeting";
    render(<TvLockGuard />);
    expect(screen.queryByTestId("tv-lock-cover")).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("ignores a stored address that is not a TV view", () => {
    window.localStorage.setItem(TV_LOCK_STORAGE_KEY, "https://example.invalid/");
    navigation.pathname = "/ward-flow/capacity";
    render(<TvLockGuard />);
    expect(screen.queryByTestId("tv-lock-cover")).toBeNull();
  });

  it("keeps a shared-workspace TV locked while the password cannot be checked", async () => {
    act(() => lockTv("/ward-flow/bed-meeting"));
    render(<TvLockControl href="/ward-flow/bed-meeting" className="" shared />);
    fireEvent.click(screen.getByTestId("tv-unlock"));
    const dialog = screen.getByTestId("tv-unlock-dialog");
    expect(dialog).toHaveTextContent("without a connection");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Sign in and unlock" }));
    });
    expect(window.localStorage.getItem(TV_LOCK_STORAGE_KEY)).toBe("/ward-flow/bed-meeting");
  });

  it("only rewrites the stored address when this tab's own view changes", () => {
    act(() => lockTv("/ward-flow/bed-meeting?ed=rph-ed"));
    const { rerender } = render(<TvLockControl href="/ward-flow/bed-meeting" className="" shared={false} />);
    // Another tab's address stays put: this tab did not move.
    expect(window.localStorage.getItem(TV_LOCK_STORAGE_KEY)).toBe("/ward-flow/bed-meeting?ed=rph-ed");
    rerender(<TvLockControl href="/ward-flow/bed-meeting?ward=x" className="" shared={false} />);
    expect(window.localStorage.getItem(TV_LOCK_STORAGE_KEY)).toBe("/ward-flow/bed-meeting?ward=x");
  });
});
