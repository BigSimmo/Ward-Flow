import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The app bar's New menu (Josh's approved triage and risk mock-up, built 7 Nov 2026): "New" with a
 * caret opens Triage or Referral, with the arrow keys, Home and End, type-ahead, Enter, Escape back
 * to the button and a press outside to close. Triage opens Start a triage; Referral opens today's
 * referral slide-out unchanged.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { NextBar as WardBar } from "@/components/ward-management/shell-next/next-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_NEW_REFERRAL_MENU } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderBar() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar primaryAction={{ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU }} />
    </WardFlowProvider>,
  );
}

beforeEach(() => navigation.push.mockClear());
afterEach(() => {
  resetWardLiveRegionForTests();
  discardReferralDraft();
});

describe("the app bar's New menu", () => {
  it("opens from the button with the two rows, headed New, and the button says it is open", async () => {
    const user = userEvent.setup();
    renderBar();
    const trigger = screen.getByTestId("ward-bar-primary-action");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    const menu = await screen.findByRole("menu", { name: "New" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "TriageMental health triage and risk assessment (SMHMR900 and SMHMR905)",
      "ReferralRefer to a ward, community team or ED",
    ]);
    await waitFor(() => expect(screen.getByTestId("ward-new-triage")).toHaveFocus());
  });

  it("moves with the arrow keys, Home, End and type-ahead, and Escape returns to the button", async () => {
    const user = userEvent.setup();
    renderBar();
    const trigger = screen.getByTestId("ward-bar-primary-action");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const triage = await screen.findByTestId("ward-new-triage");
    const referral = screen.getByTestId("ward-new-referral");
    await waitFor(() => expect(triage).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(referral).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(triage).toHaveFocus();
    await user.keyboard("{End}");
    expect(referral).toHaveFocus();
    await user.keyboard("{Home}");
    expect(triage).toHaveFocus();
    await user.keyboard("r");
    expect(referral).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on the arrow up at the last row", async () => {
    const user = userEvent.setup();
    renderBar();
    screen.getByTestId("ward-bar-primary-action").focus();
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(screen.getByTestId("ward-new-referral")).toHaveFocus());
  });

  it("Triage, with Enter, goes to Start a triage and opens no slide-out", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-primary-action"));
    await waitFor(() => expect(screen.getByTestId("ward-new-triage")).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(navigation.push).toHaveBeenCalledWith("/ward-flow/triage/new");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();
  });

  it("closes on a press outside, leaving nothing open", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-primary-action"));
    await screen.findByRole("menu");
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
