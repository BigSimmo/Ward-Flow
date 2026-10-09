import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors and this suite
// never checks routing, so a plain <a> avoids an App Router context jsdom cannot provide.
vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referrals } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE WORDS ON THE TWO CONTROLS THE FRONT DOOR TURNS ON.
 *
 * **Why this file exists, and why it is only two controls.** A survey of the Ward Flow screens
 * found 30 buttons whose labels are plain literals and **20 of them are pinned by no test at all** —
 * their visible words could be changed, emptied or broken with every gate green, because every
 * journey and every dom suite clicks by `data-testid` rather than by what a person reads. The
 * owner was given the count and chose to pin **these two only** (2026-08-30), leaving the other
 * eighteen deliberately free so that reworking a screen does not fight a test.
 *
 * These two, because they are the only controls in the prototype that commit a clinical request:
 * one sends a person's referral into the network, one refuses it. A button that says something
 * other than what it does is a different class of defect on those two than on "Stop tour".
 *
 * **What is asserted, and what deliberately is not.** The assertion is that the control a user
 * activates is REACHABLE BY ITS WORDS — `getByRole("button", { name })` — not that a particular
 * string appears somewhere in the DOM. A label that has moved into an `aria-label`, or been split
 * across elements, still passes; a label that has become "Submit", or emptied, does not. That is
 * the property worth holding: a clinician finds the control by reading it.
 *
 * **This suite does not pin any other wording on these screens**, on purpose. The referral surface
 * is being rebuilt around a per-patient screen, and a pin on wording nobody has settled would be
 * an obstacle rather than a guard. If either control is legitimately renamed, this file is the
 * place that says so out loud — which is the whole point of it going red.
 */
describe("the two referral controls are findable by the words on them", () => {
  /*
   * The "Send referral" pin read the full-page intake form, retired on 8 Oct 2026: the referral
   * slide-out (`referrals/ward-referral-drawer.tsx`) is now the one place a referral is sent, and the
   * owner's pin on that control's words moves with it, to the slide-out's own suite.
   */

  it('the match view\'s decline control reads "Decline referral"', () => {
    const referral = referrals[0];
    expect(referral, "the movements fixture supplied no referral to render").toBeDefined();

    // Mounted through a harness inside the provider, exactly as its own suite does: the component
    // takes `referral`/`units` as explicit props, but `now`, `dispatch` and `rejections` come from
    // context. Hand-built stand-ins for those are what made the first attempt throw.
    function MatchHarness() {
      const { now, dispatch, rejections } = useWardFlow();
      return (
        <ReferralMatchView
          referral={referral}
          units={allUnits()}
          now={now}
          dispatch={dispatch}
          rejections={rejections}
        />
      );
    }

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MatchHarness />
      </WardFlowProvider>,
    );

    expect(screen.getByRole("button", { name: /decline referral/i })).toBeInTheDocument();
  });
});
