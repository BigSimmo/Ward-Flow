"use client";

import { useEffect, type ReactNode } from "react";

import { NOT_WIRED } from "@/components/ward-management/referrals/referral-board-parts";
import { Button } from "@/components/wf";

import { HomeReferralActionsSlot } from "@/components/ward-redesign/home-activity/home-preview-slot";

/**
 * The Not wired mock-up (owner decision D4): how a control that is drawn but not connected looks.
 * It uses the wf kit Button's own unavailable state (`disabledReason`): `aria-disabled` so it keeps
 * its tab stop, the dashed grey style, a lock and the exact sentence, "Not wired in this
 * prototype.", from the app's one constant (referrals/referral-board-parts.tsx).
 *
 * Josh (30 Oct 2026): the example sits inside a page panel, not a panel docked over the page. Home
 * opens on the oldest referral to decide, and its Referral placement panel shows Contact referrer
 * (the action the record preview drew before it was hidden for not working) under the referral's
 * own wired Decide, which stays the panel's one filled button. The panel loads after the page, so
 * the mock-up scrolls it into view once it is there.
 */
export function PopStateNotWired({ page }: { page: ReactNode }) {
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      const example = document.querySelector<HTMLElement>('[data-testid="pop-state-not-wired"]');
      tries += 1;
      if (example) example.scrollIntoView({ block: "center" });
      if (example || tries > 40) window.clearInterval(timer);
    }, 150);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <HomeReferralActionsSlot
      value={
        <Button variant="sec" size="sm" disabledReason={NOT_WIRED} data-testid="pop-state-not-wired">
          Contact referrer
        </Button>
      }
    >
      {page}
    </HomeReferralActionsSlot>
  );
}
