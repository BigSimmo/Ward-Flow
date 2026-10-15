"use client";

import { type ReactNode } from "react";

import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";

export type WardDemoClockPopoverProps = {
  className?: string;
  title?: string;
  "aria-label"?: string;
  children?: ReactNode;
  testId?: string;
};

/**
 * The Board time pill (`ward-rail.tsx` / `ward-bar.tsx`). Since the Tools review (15 Oct 2026) it
 * opens the one Demo panel in Tools (`tools/ward-demo-panel.tsx`) rather than its own popover, so
 * the scenario, clock and reset controls live in one place. Keeps every caller `aria-label`,
 * `title` and child on the clock display.
 */
export function WardDemoClockPopover({
  className,
  title,
  "aria-label": ariaLabel,
  children,
  testId = "ward-demo-clock-pill",
}: WardDemoClockPopoverProps) {
  const now = useWardFlowClock();
  const clockText = formatInstant(now);
  return (
    <button
      type="button"
      className={className}
      title={title ?? `Board time ${clockText} AWST`}
      aria-label={`${ariaLabel ?? `Board time ${clockText} AWST`}. Open demo controls in Tools`}
      data-testid={testId}
      onClick={(event) => requestToolsTool("demo", event.currentTarget)}
    >
      {children ?? (
        <>
          <span>Board time</span> <b>{clockText}</b> <span>AWST</span>
        </>
      )}
    </button>
  );
}
