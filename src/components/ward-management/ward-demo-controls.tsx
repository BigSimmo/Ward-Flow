"use client";

import { type ReactNode } from "react";

import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { requestDemoMenu } from "@/components/ward-management/tools/ward-demo-menu-open";

export type WardDemoClockPopoverProps = {
  className?: string;
  title?: string;
  "aria-label"?: string;
  children?: ReactNode;
  testId?: string;
};

/**
 * The Board time pill (`ward-rail.tsx` / `ward-bar.tsx`). It opens the one Demo panel
 * (`tools/ward-demo-panel.tsx`) rather than its own popover, so the scenario, clock and reset
 * controls live in one place: the Demo menu under the Synthetic pill since change 8 (D-77), or Tools
 * on a phone. Keeps every caller `aria-label`,
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
      aria-label={`${ariaLabel ?? `Board time ${clockText} AWST`}. Open demo controls`}
      data-testid={testId}
      onClick={(event) => requestDemoMenu(event.currentTarget)}
    >
      {children ?? (
        <>
          <span>Board time</span> <b>{clockText}</b> <span>AWST</span>
        </>
      )}
    </button>
  );
}
