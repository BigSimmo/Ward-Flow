import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * D-16's catcher (`docs/ward-flow/owner-decisions-2026-09-1x.md`, `BRIEF-primary-action-seam.md`):
 * `WardBar`'s `primaryAction` prop is `ward-nav.ts`'s five-kind `WardPrimaryAction` union, not the
 * old `{ id, label, href }` shape — this file proves what each kind renders, that `"none"` and an
 * absent action both render nothing, and — the assertion the brief names as the one a reviewer
 * would not think to ask for — that no `href` attribute exists ANYWHERE in the primary-action area
 * for the three kinds that carry no destination. `tests/ward-nav.test.ts` covers the pure
 * `resolveWardPrimaryAction` lookup directly; this file covers what `WardBar` DOES with the result,
 * and (in the last describe block) that `WardBarMount` actually wires the two together.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardBar, WardBarMount } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import type { WardPrimaryAction } from "@/components/ward-management/shell/ward-shell-types";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_NEW_REFERRAL_MENU } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderBar(primaryAction?: WardPrimaryAction) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar primaryAction={primaryAction} />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  resetWardLiveRegionForTests();
  // The slide-out keeps an unsent draft in memory between opens; each test starts with none.
  discardReferralDraft();
});

describe("WardBar primary action — the five kinds, D-16", () => {
  it('renders no button at all for kind "none"', () => {
    renderBar({ kind: "none" });
    expect(screen.queryByTestId("ward-bar-primary-action")).toBeNull();
  });

  it("renders no button at all when primaryAction is absent", () => {
    renderBar(undefined);
    expect(screen.queryByTestId("ward-bar-primary-action")).toBeNull();
  });

  /*
   * UX audit (21 Oct 2026): New referral opens the slide-out at once. The bar used to ask "To a
   * ward / To community / To an ED" in a menu and the slide-out then asked the same question again,
   * so the destination is now chosen only on the slide-out's own "Refer to" switch.
   */
  it('renders the "new-referral" trigger as a button that opens the slide-out with no menu first', async () => {
    const user = userEvent.setup();
    renderBar({ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU });

    const trigger = screen.getByTestId("ward-bar-primary-action");
    expect(trigger).toHaveTextContent("New referral");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).not.toHaveAttribute("aria-haspopup");

    await user.click(trigger);
    expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();
    const drawer = await screen.findByTestId("ward-bar-referral-sheet");
    expect(within(drawer).getByTestId("ward-referral-refer-to-ward")).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["community", "ed"] as const)(
    'changes "Refer to" to %s on the slide-out\'s own switch',
    async (destination) => {
      const user = userEvent.setup();
      renderBar({ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU });

      await user.click(screen.getByTestId("ward-bar-primary-action"));
      const drawer = await screen.findByTestId("ward-bar-referral-sheet");
      await user.click(within(drawer).getByTestId(`ward-referral-refer-to-${destination}`));
      expect(within(drawer).getByTestId(`ward-referral-refer-to-${destination}`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    },
  );

  it.each([
    ["record-decision", "Record a decision"],
    ["contact-team", "Contact a team"],
    ["export-figures", "Export the figures"],
  ] as const)(
    'renders "%s" as a working button that announces itself as not wired, never as a link',
    async (kind, label) => {
      const user = userEvent.setup();
      renderBar({ kind, label } as WardPrimaryAction);

      const control = screen.getByTestId("ward-bar-primary-action");
      expect(control.tagName).toBe("BUTTON");
      expect(control).toHaveTextContent(label);
      // Not disabled, not greyed out — D-16 is explicit this is the opposite of D-13's rejected
      // disabled-control shape: the control WORKS and answers on the first press.
      expect(control).not.toBeDisabled();

      await user.click(control);
      expect(screen.getByTestId("ward-live-region").textContent ?? "").toBe(`${label} is not wired in this prototype.`);
    },
  );

  /*
   * 🔴 THE ASSERTION THE BRIEF NAMES AS THE ONE A REVIEWER WOULD NOT THINK TO ASK FOR: no `href`
   * attribute exists ANYWHERE in the bar's primary-action area for the three destinationless
   * kinds. This is what the trap in the brief would have failed — mapping the union onto
   * `{ id, label, href }` and inventing a destination for these three kinds still renders
   * something with the right visible LABEL, so every text-based assertion above would keep
   * passing even with an invented href underneath it. Only an assertion about the attribute
   * itself catches that.
   */
  it.each([
    ["record-decision", "Record a decision"],
    ["contact-team", "Contact a team"],
    ["export-figures", "Export the figures"],
  ] as const)('asserts the ABSENCE of any href in the primary-action area for "%s"', (kind, label) => {
    renderBar({ kind, label } as WardPrimaryAction);
    const control = screen.getByTestId("ward-bar-primary-action");
    expect(control.tagName).not.toBe("A");
    expect(control.hasAttribute("href")).toBe(false);
    // Defence in depth: no anchor is nested inside it either, and no other element anywhere in the
    // document carries the primary-action testid with an href (a second, hidden rendering path).
    expect(control.querySelectorAll("[href]")).toHaveLength(0);
    expect(document.querySelectorAll('[data-testid="ward-bar-primary-action"][href]')).toHaveLength(0);
  });
});

describe("WardBarMount — the layout-level route resolution, D-16", () => {
  it("resolves the coordinator home route to the New referral menu", () => {
    route.pathname = "/ward-flow";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardBarMount />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-bar-primary-action")).toHaveTextContent("New referral");
  });

  // Device audit, 11 Oct 2026 (stable shell): the header primary stays New referral everywhere;
  // Record a decision lives on the movement page itself.
  it("resolves a movement detail route to New referral, like every other page", () => {
    route.pathname = "/ward-flow/movements/mv-0001";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardBarMount />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-bar-primary-action")).toHaveTextContent("New referral");
  });

  // Universal header (Josh, 9 Oct 2026): every page offers New referral. A route the list does not
  // cover, or one marked "none", falls back to it on desktop as it already did on the phone.
  it.each(["/ward-flow/handover", "/ward-flow/discharges", "/ward-flow/people/pt-0001"])(
    "resolves %s, which has no action of its own, to New referral",
    (pathname) => {
      route.pathname = pathname;
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardLiveRegion />
          <WardBarMount />
        </WardFlowProvider>,
      );
      expect(screen.getByTestId("ward-bar-primary-action")).toHaveTextContent("New referral");
    },
  );

  it("keeps the referral intake route, where the slide-out is already open, without a header action", () => {
    route.pathname = "/ward-flow/referrals/new";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardBarMount />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-bar-primary-action")).toBeNull();
  });
});
