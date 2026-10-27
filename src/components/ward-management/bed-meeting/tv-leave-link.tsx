"use client";

import Link from "next/link";

import { hasMovedInWardFlow } from "@/components/ward-management/shell/ward-back";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";

/**
 * Audit P129: Leave TV view goes back to the screen the TV was opened from. A TV opened directly
 * (a link, a new tab, a wall screen after reload) has no in-app screen behind it, so it falls back
 * to Capacity, which is also the link's own href for a middle-click or a new tab.
 */
export function TvLeaveLink({ className }: { className: string }) {
  return (
    <Link
      href={WARD_CAPACITY_HREF}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        if (!hasMovedInWardFlow()) return;
        event.preventDefault();
        window.history.back();
      }}
    >
      Leave TV view
    </Link>
  );
}

/**
 * Audit P128: "Scenario: Quiet day" read as a statement about the network while cards said WATCH.
 * The label names it as the demo data set it is.
 */
export function TvFooterText({
  scope,
  shift,
  scenario,
  dayNote,
}: {
  scope: string;
  shift: string;
  scenario: string;
  dayNote: string;
}): string {
  return `${scope} · ${shift} · Demo data: ${scenario} · Synthetic prototype, ${dayNote}. Read only. Not approved for clinical use.`;
}
