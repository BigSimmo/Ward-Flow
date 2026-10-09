import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The referral slide-out is the one place a referral is written (Josh, 8 Oct 2026). Every link to
 * `/mockups/ward-flow/referrals/new` — the patient page's Refer, the board's New referral, a search
 * preview — opens the slide-out in place, and arriving on that route opens it over the board.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/mockups/ward-flow" };
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderBarWith(children?: ReactNode) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar primaryAction={{ kind: "none" }} />
      {children}
    </WardFlowProvider>,
  );
}

afterEach(() => {
  resetWardLiveRegionForTests();
  discardReferralDraft();
  route.pathname = "/mockups/ward-flow";
  replace.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("a link to the referral route opens the slide-out in place", () => {
  it("opens the referral sheet and does not navigate", async () => {
    renderBarWith(
      <a href="/mockups/ward-flow/referrals/new?patientId=PT-001&source=community&refer=community">Refer</a>,
    );
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();

    const link = screen.getByRole("link", { name: "Refer" });
    const notPrevented = fireEvent.click(link);

    // `fireEvent` returns false when a handler called preventDefault: the browser follows nothing.
    expect(notPrevented, "the click still navigates").toBe(false);
    const sheet = await screen.findByTestId("ward-bar-referral-sheet");
    expect(within(sheet).getByTestId("ward-referral-refer-to-community")).toHaveAttribute("aria-pressed", "true");
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves a modified click (new tab) and every other link alone", () => {
    renderBarWith(
      <>
        <a href="/mockups/ward-flow/referrals/new">New referral</a>
        <a href="/mockups/ward-flow/referrals">Referrals</a>
      </>,
    );

    expect(fireEvent.click(screen.getByRole("link", { name: "New referral" }), { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(screen.getByRole("link", { name: "Referrals" }))).toBe(true);
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();
  });
});

describe("arriving on the referral route opens the slide-out over the board", () => {
  it("opens once with what the query asks for, and settles the URL on the board when closed", async () => {
    route.pathname = "/mockups/ward-flow/referrals/new";
    window.history.replaceState(null, "", "/mockups/ward-flow/referrals/new?refer=ed");
    renderBarWith();

    const sheet = await screen.findByTestId("ward-bar-referral-sheet");
    expect(within(sheet).getByTestId("ward-referral-refer-to-ed")).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    await waitFor(() => expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull());
    expect(replace).toHaveBeenCalledWith("/mockups/ward-flow/referrals");
  });
});
