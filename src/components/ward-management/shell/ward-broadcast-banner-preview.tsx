"use client";

import { useEffect, useState } from "react";
import { Button, StatusGlyph } from "@/components/wf";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { formatTimeRemaining, type WardBroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { calendarDateOf, type Instant } from "@/components/ward-management/ward-clock";
import styles from "./ward-broadcast-banner.module.css";

/**
 * The broadcast banner's preview mode (#25): draws one supplied alert, with optional Extend and
 * Stand down callbacks, instead of reading the desk's alerts from the provider. `WardBroadcastBanner`
 * (`ward-broadcast-banner.tsx`) loads it on demand when given `activeAlert`. It used to live in that
 * file, which every screen loads, though only tests and previews use it, so it moved here (6 Nov
 * 2026) and the every-screen file stays light.
 */
function toControlledMinutes(val: string | Instant): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const parsed = Date.parse(val);
  if (Number.isNaN(parsed)) return 0;
  return Math.floor(parsed / 60_000);
}

/**
 * TC-08 (audit 24 Oct 2026, H-0777): an expiry and the time it is read against must be on one clock.
 * A numeric expiry is a board `Instant` (demo minutes), so it is read against the board clock: the
 * `now` prop when it is an Instant, else the provider's clock. An ISO expiry is read against the
 * `now` prop when it is a string, else the board clock as a calendar moment (H-0221): the device's
 * real time never decides it, and with no board clock nothing shows. The old code
 * read a board Instant against `Date.now()` minutes, and an ISO expiry against a board Instant, so
 * preview mode could show an alert decades long or already gone.
 */
function computeControlledRemainingMinutes(
  expiresAt: string | Instant,
  now?: string | Instant,
  boardNow?: Instant,
  dayZero?: Date,
): number {
  const expMin = toControlledMinutes(expiresAt);
  if (typeof expiresAt === "number") {
    const boardClock = typeof now === "number" ? now : boardNow;
    if (boardClock === undefined || !Number.isFinite(boardClock)) return 0;
    return expMin - boardClock;
  }
  if (typeof now === "string") return expMin - toControlledMinutes(now);
  const boardClock = typeof now === "number" ? now : boardNow;
  if (boardClock === undefined || !Number.isFinite(boardClock) || !dayZero) return 0;
  return expMin - Math.floor(calendarDateOf(boardClock, dayZero).getTime() / 60_000);
}

export type WardBroadcastBannerPreviewProps = {
  /** The alert to draw (#25), or null for none. */
  activeAlert: WardBroadcastAlert | null;
  /** Optional reference clock (#25). */
  now?: string | Instant;
  /** Optional quick +2h extension callback (#25). */
  onExtend?: () => void;
  /** Optional stand-down / resolved callback (#25). */
  onClear?: () => void;
};

export function WardBroadcastBannerPreview({ activeAlert, now, onExtend, onClear }: WardBroadcastBannerPreviewProps) {
  const [, setClockTick] = useState(0);
  // The board clock, when a provider is in reach; NaN outside one (no board time to read).
  const boardNow = useWardFlowClock(Number.NaN);
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  useEffect(() => {
    if (now !== undefined || !activeAlert) return;
    const timer = window.setInterval(() => setClockTick((t) => t + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [activeAlert, now]);

  if (!activeAlert || activeAlert.status === "stood_down" || activeAlert.status === "expired") {
    return null;
  }
  const remainingMinutes = computeControlledRemainingMinutes(activeAlert.expiresAt, now, boardNow, dayZero);
  if (remainingMinutes <= 0) {
    return null;
  }
  const timeLabel = formatTimeRemaining(remainingMinutes as Instant, 0 as Instant);
  const isCritical = activeAlert.severity === "critical";

  return (
    <section
      className={styles.banner}
      data-tone={isCritical ? "critical" : "warning"}
      data-severity={activeAlert.severity}
      data-testid="ward-broadcast-banner"
      role={isCritical ? "alert" : "status"}
      aria-live={isCritical ? "assertive" : "polite"}
      aria-atomic="true"
      aria-label={activeAlert.title ?? activeAlert.message}
    >
      <span className="sr-only">These counts are invented figures.</span>
      <div className={styles.row}>
        <div className={styles.lead}>
          <StatusGlyph tone={isCritical ? "danger" : "warning"} size={12} />
          <strong className={styles.headline}>{activeAlert.title ?? activeAlert.message}</strong>
          {activeAlert.author ? <span className={styles.meta}>{activeAlert.author}</span> : null}
        </div>
        <div className={styles.actions}>
          <span className={styles.meta} title="Time until this alert ends">
            <span className={styles.mono}>{timeLabel}</span>
          </span>
          {onExtend ? (
            <Button size="sm" onClick={onExtend}>
              Extend <span>+2h</span>
            </Button>
          ) : null}
          {onClear ? (
            <Button size="sm" variant="ghost" onClick={onClear}>
              Stand down
            </Button>
          ) : null}
        </div>
      </div>
      {activeAlert.title && activeAlert.title !== activeAlert.message ? (
        <p className={styles.message}>{activeAlert.message}</p>
      ) : null}
    </section>
  );
}
