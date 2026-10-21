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
import { downtimePackDue, isShiftChangeMoment } from "@/components/ward-management/reports/downtime-pack-schedule";
import { useTakeDowntimePack } from "@/components/ward-management/reports/use-take-downtime-pack";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";
import { useCanOpenHref } from "./ward-access";
import styles from "./ward-offline-banner.module.css";

const DOWNTIME_PACK_HREF = "/ward-flow/reports/downtime";

/**
 * Fix plan item 9 (Josh, 21 Oct 2026, "yes to all"): the downtime pack is retaken every hour and at
 * each shift change, wherever the person is in Ward Flow, and a quiet line offers the new one to
 * print or save as a PDF. The pack stays in this tab's memory only (D-18): nothing is written to
 * the device, and a copy leaves the tab only as paper or a file the person saves.
 *
 * The pack taken on opening Ward Flow, or after a reset, is silent: the line is for the scheduled
 * packs, so a reload does not ask for paper. The line goes once the print window has opened for
 * that pack or it is put aside, and does not show on the pack's own screen or while offline (the
 * offline notice names the last pack instead).
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
    if (!canOpen || !ready) return;
    if (pack === null) {
      take();
      const opening = lastDowntimePack(owner, worldGeneration);
      if (opening) markDowntimePackHandled(opening);
      return;
    }
    if (downtimePackDue(pack.generatedAt, now)) take();
  }, [canOpen, ready, pack, now, take, owner, worldGeneration]);

  if (!canOpen || !ready || pack === null || handled || !online || pathname === DOWNTIME_PACK_HREF) return null;
  const at = formatInstant(pack.generatedAt);
  return (
    <p
      className={`${styles.quiet} ${styles.recovery}`}
      role="status"
      data-testid="ward-downtime-pack-line"
      data-shift-change={isShiftChangeMoment(pack.generatedAt) ? "true" : undefined}
      data-print-hide
    >
      <span>
        {isShiftChangeMoment(pack.generatedAt) ? "Shift change downtime pack " : "Downtime pack "}
        <b>{at}</b> ready. Print it or save it as a PDF in case Ward Flow goes down.{" "}
        <Link href={DOWNTIME_PACK_HREF} data-testid="ward-downtime-pack-open">
          Open pack
        </Link>
      </span>
      <button
        type="button"
        className={styles.recoveryClose}
        aria-label="Put aside until the next pack"
        data-testid="ward-downtime-pack-dismiss"
        onClick={() => markDowntimePackHandled(pack)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </p>
  );
}
