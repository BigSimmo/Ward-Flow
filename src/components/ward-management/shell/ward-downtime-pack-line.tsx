"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import {
  downtimePackHandled,
  lastDowntimePack,
  markDowntimePackHandled,
  subscribeDowntimePack,
} from "@/components/ward-management/reports/downtime-pack";
import { useDowntimePackAccess } from "@/components/ward-management/reports/downtime-pack-context";
import { downtimePackDue, shiftChangeCrossed } from "@/components/ward-management/reports/downtime-pack-schedule";
import { useTakeDowntimePack } from "@/components/ward-management/reports/use-take-downtime-pack";
import { DOWNTIME_PACK_HREF } from "@/components/ward-management/reports/report-routes";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";
import { useCanOpenHref } from "./ward-access";
import styles from "./ward-offline-banner.module.css";

/** Runs `work` once the browser is idle (at most 3 s on), and returns a cancel. */
function whenIdle(work: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(work, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = window.setTimeout(work, 1000);
  return () => window.clearTimeout(timer);
}

/**
 * Fix plan item 9 (Josh, 21 Oct 2026, "yes to all"): the downtime pack is retaken every hour and at
 * each shift change, wherever the person is in Ward Flow. Only a shift change pack offers itself
 * to print or save as a PDF (Josh, 21 Oct 2026, UX audit): an hourly pack is taken silently, so
 * the line comes three times a day at handover rather than up to 24. A shift change pack not yet
 * printed or put aside is carried into the hourly retakes, so a missed handover prompt stays up with
 * the freshest pack until it is handled. The pack stays in this tab's memory only (D-18): nothing is
 * written to the device, and a copy leaves the tab only as paper or a file the person saves.
 *
 * No pack is taken while offline, where the records may be stale; the one due is taken on
 * reconnecting. A late retake keeps the shift change it stands for. The pack taken on opening Ward
 * Flow, or after a reset, is silent: the line is for the scheduled packs, so a reload does not ask
 * for paper. The line goes once the print window has opened for that pack or it is put aside, until
 * the next shift change, and does not show on the pack's own screen or while offline (the offline
 * notice names the last pack instead).
 */
export function WardDowntimePackLine() {
  const now = useWardFlowClock();
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  const { owner, ready } = useDowntimePackAccess();
  const canOpen = useCanOpenHref()(DOWNTIME_PACK_HREF);
  const take = useTakeDowntimePack();
  const pathname = usePathname() ?? "";
  const online = useOnlineStatus();

  const pack = useSyncExternalStore(
    subscribeDowntimePack,
    () => lastDowntimePack(owner, worldGeneration),
    () => null,
  );
  const handled = useSyncExternalStore(
    subscribeDowntimePack,
    () => (pack ? downtimePackHandled(pack) : true),
    () => true,
  );

  useEffect(() => {
    // Offline, the records may be stale (a shared board stops syncing), so no pack is stamped with a
    // later time. The pack due meanwhile is taken as soon as the connection returns.
    if (!canOpen || !ready || !online) return undefined;
    if (pack === null) {
      // F-11: the opening pack is silent, so it waits until the page has finished starting rather
      // than adding to a phone's first load. Hourly and shift change packs below are taken at once.
      return whenIdle(() => {
        take();
        const opening = lastDowntimePack(owner, worldGeneration);
        if (opening) markDowntimePackHandled(opening);
      });
    }
    // A pack taken offline is replaced as soon as the connection returns.
    if (pack.offline) {
      take();
      return undefined;
    }
    if (!downtimePackDue(pack.generatedAt, now)) return undefined;
    // A shift change pack nobody has printed or put aside keeps asking: the hourly retake after it
    // carries the shift change on, so the line shows the fresher pack instead of going quiet. A
    // clock moved back before the pack is a fresh start, so nothing is carried.
    const unhandledShiftChange = handled || now < pack.generatedAt ? undefined : pack.shiftChangeAt;
    take({ shiftChangeAt: shiftChangeCrossed(pack.generatedAt, now) ?? unhandledShiftChange });
    return undefined;
  }, [canOpen, ready, online, pack, handled, now, take, owner, worldGeneration]);

  if (!canOpen || !ready || pack === null || handled || !online || pathname === DOWNTIME_PACK_HREF) return null;
  if (pack.shiftChangeAt === undefined) return null;
  const at = formatInstantWithDay(pack.generatedAt, now);
  return (
    <p
      className={`${styles.quiet} ${styles.recovery}`}
      role="status"
      data-testid="ward-downtime-pack-line"
      data-shift-change="true"
      data-print-hide
    >
      <span>
        Shift change downtime pack <b>{at}</b> ready. Print it or save it as a PDF in case Ward Flow goes down.{" "}
        <Link href={DOWNTIME_PACK_HREF} data-testid="ward-downtime-pack-open">
          Open pack
        </Link>
      </span>
      <button
        type="button"
        className={styles.recoveryClose}
        aria-label="Put aside until the next shift change"
        data-testid="ward-downtime-pack-dismiss"
        onClick={() => markDowntimePackHandled(pack)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </p>
  );
}
