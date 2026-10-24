"use client";

import { CircleHelp } from "lucide-react";

import { openWardHelp } from "@/components/ward-management/help/ward-help-events";

/**
 * The header's ? beside the screen's name: Help for the screen in view (Josh, 24 Oct 2026). Drawn on
 * computers only; the phone bar stays lean (10 Oct 2026) and keeps Help in its Menu.
 */
export function WardBarScreenHelp({ title, className }: { title: string; className: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => openWardHelp("screen")}
      aria-label={`Help for ${title}`}
      title="Help for this screen"
      data-testid="ward-bar-screen-help"
    >
      <CircleHelp aria-hidden="true" size={16} strokeWidth={1.75} />
    </button>
  );
}
