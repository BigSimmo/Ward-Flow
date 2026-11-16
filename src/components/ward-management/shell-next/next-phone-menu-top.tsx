"use client";

// shell-next (Josh, 31 Oct 2026): the top of the phone Menu, the rail's capacity card for the desk's
// own place.

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Dot, durMinutes } from "@/components/wf";
import { formatInstant, minuteOfDay } from "@/components/ward-management/ward-clock";
import { useTrainingMode } from "@/components/ward-management/demo-reset/ward-training-mode";
import { handoverHref } from "@/components/ward-management/shell/ward-facade";
import { computeShiftProgress } from "@/components/ward-management/shell/ward-rail-helpers";
import { useWardFlowClock, useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import {
  BED_ALERT_THRESHOLD_PERCENT,
  deriveServiceBedAlerts,
  formatOccupancyPercent,
  isBedAlert,
} from "@/components/ward-management/shell/ward-service-bed-alerts";
import railStyles from "@/components/ward-management/shell/ward-rail.module.css";
import { useNextNavCounts } from "@/components/ward-management/shell-next/next-nav-counts";
import {
  cardScopeNote,
  deskCapacityRows,
  overLineLabel,
} from "@/components/ward-management/shell-next/next-rail-parts";

import parts from "@/components/ward-management/shell-next/next-rail.module.css";

export function NextPhoneMenuTop({
  onGo,
}: {
  /** Closes the Menu when the card's link is followed. */
  onGo: () => void;
}) {
  const network = useWardNetwork();
  const { units, bedReleases, movements, configuration, admissions, referrals } = useWardFlowSelect(
    "units",
    "bedReleases",
    "movements",
    "configuration",
    "admissions",
    "referrals",
  );
  const now = useWardFlowClock();
  const access = useEffectiveWardAccess();
  const service = useServiceScope();
  const canOpen = useCanOpenHref();
  const { counts } = useNextNavCounts();
  const bedAlerts = deriveServiceBedAlerts(
    units,
    bedReleases,
    network.sites,
    movements,
    now,
    configuration.edAccessTargetMinutes,
    admissions,
    referrals,
  );
  const rows = deskCapacityRows(access, units, admissions ?? [], bedReleases, bedAlerts);
  const overLine = overLineLabel(rows, bedAlerts.services);
  const readyBeds = counts.capacity?.value ?? bedAlerts.totalFreeBeds;
  const note = cardScopeNote(rows, access, service);
  // Josh, 16 Nov 2026: with no clock in any header, the phone Menu opens on the time and the
  // handover countdown, as the tablet Menu does. Executive and access admin hold no shift.
  const clockName = useTrainingMode() ? "Training clock" : "Board time";
  const showHandover = access.role !== "executive" && access.role !== "admin";
  const shift = computeShiftProgress(minuteOfDay(now));
  const handoverValue = shift.handoverDue ? (
    <strong>due now</strong>
  ) : (
    <>
      in <strong>{durMinutes(shift.remainingMinutes)}</strong>
    </>
  );
  const handoverLinks = canOpen(handoverHref());
  const timeCard = (
    <div className={railStyles.menuContext} data-testid="next-phone-menu-time">
      <p className={railStyles.menuContextCell}>
        <span className={railStyles.menuContextLabel}>{clockName}</span>
        <span className={railStyles.menuContextValue}>
          <strong>{formatInstant(now)}</strong>
        </span>
      </p>
      {!showHandover ? null : handoverLinks ? (
        <Link
          href={handoverHref()}
          className={`${railStyles.menuContextCell} ${railStyles.menuContextLink}`}
          onClick={onGo}
        >
          <span className={railStyles.menuContextLabel}>Handover</span>
          <span className={railStyles.menuContextValue}>{handoverValue}</span>
          <ChevronRight aria-hidden="true" className={railStyles.sheetChevron} />
        </Link>
      ) : (
        <p className={railStyles.menuContextCell}>
          <span className={railStyles.menuContextLabel}>Handover</span>
          <span className={railStyles.menuContextValue}>{handoverValue}</span>
        </p>
      )}
    </div>
  );
  const body = (
    <>
      <span className={railStyles.alertsHead}>
        <span className={railStyles.alertsEyebrow}>Bed alerts</span>{" "}
        <span className={railStyles.alertsChip} data-alert={overLine.over > 0 ? "true" : undefined}>
          {overLine.over > 0 ? <Dot tone="warning" /> : null}
          {overLine.label}
        </span>
      </span>
      {rows.map((row) => (
        <span key={row.key} className={railStyles.alertRow}>
          <span className={railStyles.alertRowName}>{row.name}</span>
          <span className={railStyles.meter} aria-hidden="true">
            {row.percent === null ? null : (
              <>
                <span
                  className={railStyles.meterFill}
                  data-alert={isBedAlert(row.percent) ? "true" : undefined}
                  style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }}
                />
                <span className={railStyles.meterTick} style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }} />
              </>
            )}
          </span>
          <span className={railStyles.alertRowPercent}>
            {row.percent !== null && isBedAlert(row.percent) ? <Dot tone="warning" /> : null}
            {row.percent === null ? "—" : formatOccupancyPercent(row.percent)}
          </span>
        </span>
      ))}
      <span className={parts.capacityReady}>
        <b>{readyBeds}</b> {readyBeds === 1 ? "bed" : "beds"} ready now, {note}
      </span>
    </>
  );
  return (
    <div className={parts.phoneTop} data-testid="next-phone-menu-top">
      {timeCard}
      {canOpen(WARD_CAPACITY_HREF) ? (
        <Link href={WARD_CAPACITY_HREF} className={parts.phoneCard} onClick={onGo}>
          {body}
        </Link>
      ) : (
        <div className={parts.phoneCard}>{body}</div>
      )}
    </div>
  );
}
