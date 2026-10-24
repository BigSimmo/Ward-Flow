"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePracticeRunning } from "@/components/ward-management/demo-reset/ward-practice-mode";
import { lastDowntimePack, subscribeDowntimePack } from "@/components/ward-management/reports/downtime-pack";
import { useDowntimePackOwner } from "@/components/ward-management/reports/downtime-pack-context";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";
import styles from "./ward-offline-banner.module.css";

// Design audit DA-07: a screen in full screen (the bed meeting TV) shows only the element it made
// full screen, so the notice moves inside that element, pinned to its top corner, while it lasts.
const FULLSCREEN_PLACEMENT = {
  position: "fixed",
  insetBlockStart: "0.75rem",
  insetInlineEnd: "0.75rem",
  zIndex: 10,
  maxInlineSize: "min(36rem, calc(100% - 1.5rem))",
  margin: 0,
} as const;

function useFullscreenElement(): Element | null {
  const [element, setElement] = useState<Element | null>(null);
  useEffect(() => {
    const sync = () => setElement(document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return element;
}

/** Fix plan item 9: offline, the notice names the last downtime pack, the copy to work from on paper. */
function useLastDowntimePackAt(): number | null {
  const owner = useDowntimePackOwner();
  const worldGeneration = useOptionalWardFlowSelect("worldGeneration")?.worldGeneration;
  return useSyncExternalStore(
    subscribeDowntimePack,
    () => lastDowntimePack(owner, worldGeneration)?.generatedAt ?? null,
    () => null,
  );
}

/**
 * Audit 24-7 (CT-17): while a practice runs, the real screens look the same, so a slim line on every
 * Ward Flow page says practice is on and its steps are real saves. Hidden when none is running.
 */
function WardPracticeLine() {
  const running = usePracticeRunning();
  if (!running) return null;
  return (
    <p className={styles.quiet} role="status" data-testid="ward-practice-line">
      Practising: synthetic demo steps are real saves on this device. Stop in Tools.
    </p>
  );
}

/**
 * A quiet notice when the device loses its network connection. The prototype keeps its state in
 * this tab's memory, so screens keep working; the notice says so, and that nothing is syncing, so
 * nobody reads "Live" as current while Wi-Fi is down. It also says which downtime pack to use if
 * the screen stops. Renders nothing while online. It also carries the practice line (CT-17).
 */
export function WardOfflineBanner() {
  return (
    <>
      <WardPracticeLine />
      <WardOfflineNotice />
    </>
  );
}

function WardOfflineNotice() {
  const online = useOnlineStatus();
  const fullscreenElement = useFullscreenElement();
  const lastPackAt = useLastDowntimePackAt();
  // Outside the provider there is no pack, so the fallback clock is never shown.
  const now = useWardFlowClock(0);
  if (online) return null;
  const banner = (
    <p
      className={styles.banner}
      role="status"
      data-testid="ward-offline-banner"
      style={fullscreenElement ? FULLSCREEN_PLACEMENT : undefined}
    >
      Offline. This screen keeps working from this session, but nothing is updating until the connection returns.{" "}
      {lastPackAt === null
        ? "If it stops, use the latest printed or saved downtime pack."
        : `If it stops, use the downtime pack taken at ${formatInstantWithDay(lastPackAt, now)}, printed or saved as a PDF.`}
    </p>
  );
  return fullscreenElement ? createPortal(banner, fullscreenElement) : banner;
}
