import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Archived D-16's catcher (`docs/history/archive/dated-notes/owner-decisions-2026-09-1x.md`, `BRIEF-primary-action-seam.md`):
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
import { NextBar as WardBar, NextBarMount as WardBarMount } from "@/components/ward-management/shell-next/next-bar";
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

/** New, then Referral: the way into today's referral slide-out since 7 Nov 2026. */
async function openReferralFromNew(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("ward-bar-primary-action"));
  await user.click(await screen.findByTestId("ward-new-referral"));
}

/** The bar's referral action reads "New" with a caret and opens the Triage or Referral menu. */
function expectNewMenuTrigger() {
  const trigger = screen.getByTestId("ward-bar-primary-action");
  expect(trigger.textContent?.trim()).toBe("New");
  expect(trigger).toHaveAttribute("aria-haspopup", "menu");
}

afterEach(() => {
  resetWardLiveRegionForTests();
  // The slide-out keeps an unsent draft in memory between opens; each test starts with none.
  discardReferralDraft();
});

describe("WardBar primary action — the five kinds, archived D-16", () => {
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
   *
   * Triage and risk (Josh's approved mock-up, built 7 Nov 2026): the button reads "New" with a caret
   * and offers Triage or Referral. Referral opens the same slide-out, unchanged, with no destination
   * menu of its own; the destination is still chosen only on the slide-out's switch.
   */
  it('renders the "new-referral" trigger as New, whose Referral opens the slide-out with no destination menu', async () => {
    const user = userEvent.setup();
    renderBar({ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU });

    const trigger = screen.getByTestId("ward-bar-primary-action");
    expect(trigger.textContent?.trim()).toBe("New");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");

    await openReferralFromNew(user);
    expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();
    const drawer = await screen.findByTestId("ward-bar-referral-sheet");
    expect(within(drawer).getByTestId("ward-referral-refer-to-ward")).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["community", "ed"] as const)(
    'changes "Refer to" to %s on the slide-out\'s own switch',
    async (destination) => {
      const user = userEvent.setup();
      renderBar({ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU });

      await openReferralFromNew(user);
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
      // Not disabled, not greyed out — archived D-16 is explicit this is the opposite of archived D-13's rejected
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

describe("WardBarMount — the layout-level route resolution, archived D-16", () => {
  it("resolves the coordinator home route to the New menu (Triage or Referral)", () => {
    route.pathname = "/ward-flow";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardBarMount />
      </WardFlowProvider>,
    );
    expectNewMenuTrigger();
  });

  // Device audit, 11 Oct 2026 (stable shell): the header primary stays New referral everywhere;
  // Record a decision lives on the movement page itself.
  it("resolves a movement detail route to New (the referral action), like every other page", () => {
    route.pathname = "/ward-flow/movements/mv-0001";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardBarMount />
      </WardFlowProvider>,
    );
    expectNewMenuTrigger();
  });

  // Universal header (Josh, 9 Oct 2026): every page offers New referral. A route the list does not
  // cover, or one marked "none", falls back to it on desktop as it already did on the phone.
  it.each(["/ward-flow/handover", "/ward-flow/discharges", "/ward-flow/people/pt-0001"])(
    "resolves %s, which has no action of its own, to New (the referral action)",
    (pathname) => {
      route.pathname = pathname;
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardLiveRegion />
          <WardBarMount />
        </WardFlowProvider>,
      );
      expectNewMenuTrigger();
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
