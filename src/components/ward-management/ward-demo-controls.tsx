"use client";

import { type ReactNode } from "react";

import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useWardShellPublic } from "./shell/ward-shell-public-context";
import { requestDemoMenu } from "@/components/ward-management/tools/ward-demo-menu-open";
import { notUpdatingWords, useLiveFreshness } from "@/components/wf/live";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";

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
  // M8 (Josh, 3 Nov 2026): "One clock in the top bar. Stale is said in words." While the board is
  // offline or its shared refresh is late, the clock says so in words with its amber dot, in place
  // of the time ("Offline", "Not updating since 10:42"), so no bar or sheet shows a live time over
  // a board that is not updating. Its name starts with the same words (label in name, F-19).
  const freshness = useLiveFreshness();
  const stateWords =
    freshness.state === "offline" ? "Offline" : freshness.state === "stale" ? notUpdatingWords(freshness.since) : null;
  const name = stateWords
    ? `${stateWords}. Board time ${clockText} AWST`
    : (ariaLabel ?? `Board time ${clockText} AWST`);
  return (
    <button
      type="button"
      className={className}
      title={stateWords ? name : (title ?? `Board time ${clockText} AWST`)}
      aria-label={`${name}. Open demo controls`}
      data-testid={testId}
      data-freshness={stateWords ? freshness.state : undefined}
      onClick={(event) => (onOpen ?? requestDemoMenu)(event.currentTarget)}
    >
      {stateWords ? (
        <>
          <span className={barStyles.demoClockDot} data-offline="true" aria-hidden="true" />
          <span>{stateWords}</span>
        </>
      ) : (
        (children ?? (
          <>
            <span>Board time</span> <b>{clockText}</b> <span>AWST</span>
          </>
        ))
      )}
    </button>
  );
}
