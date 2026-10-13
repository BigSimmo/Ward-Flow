// Josh (13 Oct 2026, iPhone): with the phone New referral sheet open (it starts under the bar), the
// bar's Menu and Search could not be tapped, because the sheet inerted the whole page. They now stay
// live; Menu opens its own sheet on top and the referral stays open beneath with what was typed.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/delays",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

function renderBar() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  installMatchMediaStub(false);
  resetWardLiveRegionForTests();
  discardReferralDraft();
});

describe("phone header stays live over the New referral sheet", () => {
  it("keeps Menu and Search out of the sheet's inert background, and Menu opens above the referral", async () => {
    installMatchMediaStub(true);
    renderBar();
    act(() => openWardDrawer("referral"));
    const referral = await screen.findByTestId("ward-bar-referral-sheet");

    const menu = screen.getByTestId("ward-bar-phone-menu");
    const search = screen.getByTestId("ward-global-search-input");
    expect(menu.closest("[inert]"), "Menu sits inside an inert container").toBeNull();
    expect(search.closest("[inert]"), "Search sits inside an inert container").toBeNull();
    // The rest of the page behind the sheet is still inert.
    expect(document.querySelector("[data-sheet-inert]")).not.toBeNull();

    fireEvent.click(menu);
    expect(await screen.findByTestId("ward-phone-menu")).toBeInTheDocument();
    expect(referral).toBeInTheDocument();
  });

  it("leaves Menu inert behind other sheets and on desktop (no opt-out without the referral sheet)", async () => {
    installMatchMediaStub(false);
    renderBar();
    act(() => openWardDrawer("referral"));
    await screen.findByTestId("ward-bar-referral-sheet");
    expect(screen.getByTestId("ward-bar-phone-menu")).not.toHaveAttribute("data-sheet-inert-skip");
  });
});
