"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { WARD_HOME_HREF } from "@/components/ward-management/ward-nav";

/** The id on Home's Act now group (`coordinator/my-list-card.tsx`), which this link moves focus to. */
export const ACT_NOW_TARGET_ID = "ward-act-now";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function moveToActNow(event: MouseEvent<HTMLAnchorElement>) {
  const group = document.getElementById(ACT_NOW_TARGET_ID);
  // No Act now group on screen (My list narrowed to referrals): the plain link jumps nowhere useful,
  // so leave it to the browser rather than move focus somewhere unexpected.
  if (!group) return;
  event.preventDefault();
  (group.querySelector<HTMLElement>(FOCUSABLE) ?? group).focus();
}

/**
 * WS-18 (workflow speed audit, 26 Oct 2026): on a desktop keyboard the first Act now control on Home
 * took 45 Tab presses, past the sidebar and the header. This second skip link sits straight after
 * "Skip to main content" (the root layout's), drawn the same way, and only on Home, where Act now is.
 * It moves focus to the group's first control, so the next Enter acts on it.
 */
export function WardSkipToActNow() {
  if (usePathname() !== WARD_HOME_HREF) return null;
  return (
    <a
      href={`#${ACT_NOW_TARGET_ID}`}
      onClick={moveToActNow}
      data-testid="ward-skip-to-act-now"
      className="sr-only focus:not-sr-only focus:fixed focus:left-[max(0.75rem,env(safe-area-inset-left))] focus:top-[max(0.75rem,env(safe-area-inset-top))] focus:z-[100] focus:rounded-lg focus:border focus:border-[color:var(--border-lux)] focus:bg-[color:var(--surface-raised)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--text)] focus:shadow-[var(--shadow-elevated)]"
    >
      Skip to Act now
    </a>
  );
}
