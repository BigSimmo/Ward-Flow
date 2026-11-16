// Edit bottom bar (Josh, 16 Nov 2026): each desk chooses what the phone bar's four spots open, kept
// on this device. The + stays in the middle; a choice already in the bar swaps places. Synthetic data.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { NextPhoneMenu } from "@/components/ward-management/shell-next/next-phone-menu";
import { openWardMenu } from "@/components/ward-management/shell/ward-drawer-bus";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import {
  DOCK_STORAGE_KEY,
  parseDockChoices,
  resetDockChoicesForTests,
} from "@/components/ward-management/shell/ward-dock-store";
import { ToastProvider } from "@/components/wf/toast-provider";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  resetDockChoicesForTests();
  installMatchMediaStub(false);
});

function renderPhoneMenu() {
  installMatchMediaStub(true);
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NextPhoneMenu
          returnFocusRef={createRef<HTMLButtonElement>()}
          tasksCount={0}
          activityUnread={0}
          onOpenDrawer={() => {}}
          onNewReferral={() => {}}
        />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

async function openEditBar() {
  renderPhoneMenu();
  await screen.findByTestId("ward-phone-dock", {}, { timeout: 15_000 });
  act(() => openWardMenu(null));
  fireEvent.click(await screen.findByTestId("ward-phone-menu-edit-bar", {}, { timeout: 15_000 }));
  return screen.findByTestId("ward-phone-edit-bar", {}, { timeout: 15_000 });
}

const dockNames = () =>
  [...screen.getByTestId("ward-phone-dock").querySelectorAll("a, button")]
    .map((tab) => tab.textContent?.trim() ?? "")
    .filter((name) => name !== "");

describe("Edit bottom bar", () => {
  it("draws the bar's spots, with the first picked", async () => {
    const bar = await openEditBar();
    const spots = within(within(bar).getByTestId("ward-phone-edit-bar-preview")).getAllByRole("button");
    expect(spots.map((spot) => spot.getAttribute("aria-label"))).toEqual([
      "Far left: Home",
      "Left of +: Capacity",
      "Right of +: Alerts",
      "Far right: Tools",
    ]);
    expect(spots[0]).toHaveAttribute("aria-pressed", "true");
    expect(within(bar).getByTestId("ward-phone-edit-bar-option-page:command")).toHaveAttribute("aria-pressed", "true");
  });

  it("places a page in a spot, swaps a choice already in the bar, and keeps it on this device", async () => {
    const bar = await openEditBar();
    fireEvent.click(within(bar).getByTestId("ward-phone-edit-bar-spot-1"));
    fireEvent.click(within(bar).getByTestId("ward-phone-edit-bar-option-page:delays"));
    expect(dockNames().some((name) => name.includes("Waiting"))).toBe(true);
    expect(dockNames().some((name) => name.includes("Capacity"))).toBe(false);
    // Tools is already far right, so choosing it for the far left swaps the two.
    fireEvent.click(within(bar).getByTestId("ward-phone-edit-bar-spot-0"));
    fireEvent.click(within(bar).getByTestId("ward-phone-edit-bar-option-tools"));
    expect(parseDockChoices(window.localStorage.getItem(DOCK_STORAGE_KEY)).coordinator).toEqual([
      "tools",
      "page:delays",
      "queue",
      "page:command",
    ]);
    fireEvent.click(within(bar).getByTestId("ward-phone-edit-bar-reset"));
    expect(window.localStorage.getItem(DOCK_STORAGE_KEY)).toBeNull();
  });
});

describe("the bottom bar store", () => {
  it("keeps known desks and slot keys only", () => {
    expect(parseDockChoices("nope")).toEqual({});
    expect(
      parseDockChoices(
        JSON.stringify({
          coordinator: ["page:delays", "tools"],
          ward: ["page:<b>"],
          nobody: ["tools"],
          ed: ["a", "b", "c", "d", "e"],
        }),
      ),
    ).toEqual({ coordinator: ["page:delays", "tools"] });
  });
});
