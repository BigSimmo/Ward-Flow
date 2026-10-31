"use client";

// shell-next (Josh, 31 Oct 2026): the top of the phone Menu, the rail's capacity card for the desk's
// own place.

import Link from "next/link";

import { Dot } from "@/components/wf";
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
import { useNextNavCounts } from "@/components/ward-redesign/shell-next/next-nav-counts";
import { cardScopeNote, deskCapacityRows, overLineLabel } from "@/components/ward-redesign/shell-next/next-rail-parts";

import parts from "@/components/ward-redesign/shell-next/next-rail.module.css";

export function NextPhoneMenuTop({
  onGo,
}: {
  /** Closes the Menu when the card's link is followed. */
  onGo: () => void;
}) {
  const network = useWardNetwork();
  const { units, bedReleases, movements, configuration, admissions } = useWardFlowSelect(
    "units",
    "bedReleases",
    "movements",
    "configuration",
    "admissions",
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
  );
  const rows = deskCapacityRows(access, units, admissions ?? [], bedReleases, bedAlerts);
  const overLine = overLineLabel(rows);
  const readyBeds = counts.capacity?.value ?? bedAlerts.totalFreeBeds;
  const note = cardScopeNote(rows, access, service);
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
