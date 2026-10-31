"use client";

// The top of the phone Menu (Josh, 31 Oct 2026, the new sidebar and header): the rail's capacity
// card for the desk's own place, with beds ready.

import Link from "next/link";

import { Dot } from "@/components/wf";
import { useWardFlowClock, useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { useEffectiveWardAccess } from "./ward-access-store";
import { useCanOpenHref } from "./ward-access";
import { useServiceScope } from "./ward-service-store";
import { deriveServiceBedAlerts, formatOccupancyPercent, isBedAlert } from "./ward-service-bed-alerts";
import { BedAlertMeter, cardScopeNote, deskCapacityRows, overLineLabel } from "./ward-rail-parts";
import railStyles from "./ward-rail.module.css";

export function PhoneMenuTop({
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
  const { counts } = useWardNavCounts();
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
          {row.percent === null ? (
            <span className={railStyles.meter} aria-hidden="true" />
          ) : (
            <BedAlertMeter percent={row.percent} />
          )}
          <span className={railStyles.alertRowPercent}>
            {row.percent !== null && isBedAlert(row.percent) ? <Dot tone="warning" /> : null}
            {row.percent === null ? "—" : formatOccupancyPercent(row.percent)}
          </span>
        </span>
      ))}
      <span className={railStyles.capacityReady}>
        <b>{readyBeds}</b> {readyBeds === 1 ? "bed" : "beds"} ready now, {note}
      </span>
    </>
  );
  return (
    <div className={railStyles.phoneTop} data-testid="ward-phone-menu-top">
      {canOpen(WARD_CAPACITY_HREF) ? (
        <Link href={WARD_CAPACITY_HREF} className={railStyles.phoneCard} onClick={onGo}>
          {body}
        </Link>
      ) : (
        <div className={railStyles.phoneCard}>{body}</div>
      )}
    </div>
  );
}
