// Q99 (Josh, 1 Nov 2026, "image 1 version"): one Activity design everywhere. The app bar's Activity
// button opens Home's Activity panel (Changes, Recent activity and Notices) on every page, and Home's
// "N changes since 07:00 · Review" button opens that same instance. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

let currentPathname = "/ward-flow/movements";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { openActivityPanel } from "@/components/ward-management/shell/ward-activity-panel-store";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  installMatchMediaStub(false);
  resetWardLiveRegionForTests();
  currentPathname = "/ward-flow/movements";
  window.sessionStorage.clear();
});

function renderBar(withHome = false) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar />
      {withHome ? <CoordinatorScreen /> : null}
    </WardFlowProvider>,
  );
}

describe("the app bar's Activity button opens the one shared Activity panel", () => {
  it("opens Home's panel on a page other than Home, and Escape returns focus to the button", async () => {
    const user = userEvent.setup();
    renderBar();
    const trigger = screen.getByTestId("ward-bar-activity-trigger");
    expect(trigger).toHaveAttribute("aria-controls", "ward-bar-activity-drawer");
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    expect(dialog).toHaveAttribute("id", "ward-bar-activity-drawer");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Home's design: three tabs, the review, the feed and this desk's notices.
    for (const tab of [/^Changes/u, /^Recent activity/u, /^Notices/u])
      expect(within(dialog).getByRole("tab", { name: tab })).toBeInTheDocument();
    expect(window.history.state).toEqual(expect.objectContaining({ wardDrawer: "activity" }));
    // The retired drawer's parts are gone.
    expect(within(dialog).queryByRole("textbox", { name: "Search activity" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /^Live tally/u })).toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Activity · Statewide" })).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens as a sheet from the phone dock and returns focus to the dock button", async () => {
    installMatchMediaStub(true);
    renderBar();
    const dock = screen.getByTestId("ward-phone-menu-activity");
    fireEvent.click(dock);
    const sheet = await screen.findByTestId("ward-bar-activity-sheet");
    expect(within(sheet).getByRole("tab", { name: /^Recent/u })).toBeInTheDocument();
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(dock).toHaveFocus());
  });

  it("is the same instance Home's changes button opens, on the tab it asks for", async () => {
    currentPathname = "/ward-flow";
    renderBar(true);
    const chip = screen.getByRole("button", { name: /· (Review|Activity)$/u });
    fireEvent.click(chip);
    const dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    expect(within(dialog).getByRole("tab", { name: /^Changes/u })).toHaveAttribute("aria-selected", "true");
    // One panel: Home draws no copy of its own.
    expect(screen.getAllByRole("dialog", { name: "Activity · Statewide" })).toHaveLength(1);
    expect(screen.queryByTestId("home-activity-panel")).toBeNull();
    expect(screen.getByTestId("ward-bar-activity-trigger")).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(chip).toHaveFocus());

    // A request for a tab opens there; the bar's own button then opens plainly again.
    act(() => openActivityPanel({ tab: "notices" }));
    const again = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    expect(within(again).getByRole("tab", { name: /^Notices/u })).toHaveAttribute("aria-selected", "true");
  });
});
