"use client";

import { type ReactNode } from "react";

import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useWardShellPublic } from "./shell/ward-shell-public-context";
import { requestDemoMenu } from "@/components/ward-management/tools/ward-demo-menu-open";

export type WardDemoClockPopoverProps = {
  className?: string;
  title?: string;
  "aria-label"?: string;
  children?: ReactNode;
  testId?: string;
  /** Replaces the default open, for a pill inside a sheet that must close first. */
  onOpen?: (button: HTMLElement) => void;
};

/**
 * The Board time pill (`ward-rail.tsx` / `ward-bar.tsx`). It opens the one Demo panel
 * (`tools/ward-demo-panel.tsx`) rather than its own popover, so the scenario, clock and reset
 * controls live in one place: the Demo menu under the Synthetic pill since change 8 (D-77), or Tools
 * on a phone. Keeps every caller `aria-label`,
 * `title` and child on the clock display.
 */
export function WardDemoClockPopover(props: WardDemoClockPopoverProps) {
  const shell = useWardShellPublic();
  return shell ? <WardDemoClockView {...props} now={shell.now} /> : <OperationalDemoClock {...props} />;
}
function OperationalDemoClock(props: WardDemoClockPopoverProps) {
  const now = useWardFlowClock();
  return <WardDemoClockView {...props} now={now} />;
}
function WardDemoClockView({
  className,
  title,
  "aria-label": ariaLabel,
  children,
  testId = "ward-demo-clock-pill",
  onOpen,
  now,
}: WardDemoClockPopoverProps & { now: number }) {
  const clockText = formatInstant(now);
  return (
    <button
      type="button"
      className={className}
      title={title ?? `Board time ${clockText} AWST`}
      aria-label={`${ariaLabel ?? `Board time ${clockText} AWST`}. Open demo controls`}
      data-testid={testId}
      onClick={(event) => (onOpen ?? requestDemoMenu)(event.currentTarget)}
    >
      {children ?? (
        <>
          <span>Board time</span> <b>{clockText}</b> <span>AWST</span>
        </>
      )}
    </button>
  );
}
