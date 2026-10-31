"use client";

// The new sidebar and header (Josh, 30-31 Oct 2026): the rail's capacity card, count titles and pins,
// kept beside `ward-rail.tsx` so it stays under the line cap. The phone Menu's top shares them.

import { useSyncExternalStore } from "react";
import { Pin, PinOff } from "lucide-react";

import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { WardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { unitInScope } from "@/components/ward-management/ward-role-access";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import {
  BED_ALERT_THRESHOLD_PERCENT,
  formatOccupancyPercent,
  isBedAlert,
  type ServiceBedAlertsSummary,
} from "./ward-service-bed-alerts";
import styles from "./ward-rail.module.css";

/** Sent when a header action opens a sheet of its own (New referral), so the rail's More and Menu sheets close. */
export const CLOSE_MENUS_EVENT = "ward-flow-close-menus";

/* ── Capacity-led bed alerts ────────────────────────────────────────────────────────────────── */

export type CapacityRow = {
  key: string;
  /** Short name on the row ("Metro", "RPH", "East Metro"). */
  name: string;
  /** What the row counts, for its title and the screen reader ("Royal Perth Hospital's wards"). */
  counts: string;
  percent: number | null;
};

/**
 * The rail's bed alert rows, always occupancy first (Josh, 30 Oct 2026: alerts stay about capacity).
 * Every desk sees figures for its own place (round 2 found a site desk reading the network's Metro
 * line): a site, service or ward desk reads its own wards first and then its health service; every
 * other desk, which watches the network, keeps Metro and the fullest service.
 */
export function deskCapacityRows(
  access: WardAccess,
  units: readonly Unit[],
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  bedAlerts: ServiceBedAlertsSummary,
): CapacityRow[] {
  const byOccupancy = bedAlerts.services.toSorted((a, b) => b.occupancyPercent - a.occupancyPercent);
  const metro: CapacityRow = {
    key: "metro",
    name: "Metro",
    counts: "the metropolitan health services' wards",
    percent: bedAlerts.metroOccupancyPercent,
  };
  const scope = access.scope;
  if (scope.kind !== "site" && scope.kind !== "ward" && scope.kind !== "service") {
    const hottest = byOccupancy[0];
    return hottest
      ? [
          metro,
          {
            key: hottest.id,
            name: hottest.shortName,
            counts: `${hottest.shortName}, the fullest health service`,
            percent: hottest.occupancyPercent,
          },
        ]
      : [metro];
  }
  const places = wardPlaceLookup(units);
  const own = units.filter((unit) => unitInScope(scope, unit.id, places));
  const siteCodes = new Set(own.map((unit) => unit.siteCode));
  const service = bedAlerts.services.find((row) => row.hospitalCodes?.some((code) => siteCodes.has(code)));
  const ownName =
    scope.kind === "site"
      ? scope.siteCode
      : scope.kind === "ward"
        ? own.length === 1
          ? (own[0]?.name ?? "Your ward")
          : "Your wards"
        : (service?.shortName ?? "Your service");
  const ownRow: CapacityRow = {
    key: "own",
    name: ownName,
    counts: scope.kind === "site" ? `${scope.siteCode}'s wards` : `${ownName}'s beds`,
    percent: wardOccupancy(own, admissions, bedReleases).percent,
  };
  if (scope.kind === "service") return [ownRow, metro];
  return service
    ? [
        ownRow,
        {
          key: service.id,
          name: service.shortName,
          counts: `${service.shortName}, your health service`,
          percent: service.occupancyPercent,
        },
      ]
    : [ownRow];
}

/** Read aloud as the rows show: "Metro 85.9% full, over 85%. East Metro 86.7% full, over 85%". */
export function capacityRowsSpoken(rows: readonly CapacityRow[]): string {
  return rows
    .map((row) => {
      if (row.percent === null) return `${row.name} not recorded`;
      const over = isBedAlert(row.percent) ? `, over ${BED_ALERT_THRESHOLD_PERCENT}%` : "";
      return `${row.name} ${formatOccupancyPercent(row.percent)} full${over}`;
    })
    .join(". ");
}

/** One meter row: a 5px track with the 85% tick (the label and percentage sit beside it). */
export function BedAlertMeter({ percent }: { percent: number }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <span className={styles.meter} aria-hidden="true">
      <span
        className={styles.meterFill}
        data-alert={isBedAlert(percent) ? "true" : undefined}
        style={{ width: `${width}%` }}
      />
      <span className={styles.meterTick} style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }} />
    </span>
  );
}

/** "1 over 85%", "None over 85%": the chip's words, so the alert never rests on colour alone. */
export function overLineLabel(rows: readonly CapacityRow[]): { label: string; over: number } {
  const over = rows.filter((row) => row.percent !== null && isBedAlert(row.percent)).length;
  return { label: `${over === 0 ? "None" : over} over ${BED_ALERT_THRESHOLD_PERCENT}%`, over };
}

/* ── What a count counts ────────────────────────────────────────────────────────────────────── */

/**
 * The words after a rail count's own noun that say whose figure it is (round 2: the bed manager's
 * "Waiting 6" counts every ED on the desk while the page's hero names one ED). Shown in the hover
 * title and read with the count; the visible noun is unchanged.
 */
export function countScopeNote(access: WardAccess, service: string | null): string {
  const scope = access.scope;
  switch (scope.kind) {
    case "site":
      return `for ${scope.siteCode} and the EDs this desk covers`;
    case "ward":
      return "for your ward";
    case "service":
      return `for ${scope.service}`;
    case "ed":
      return "for your ED";
    case "team":
      return `for the ${scope.teamName} team`;
    case "jobs":
      return "for your transport jobs";
    default:
      return service ? `for ${service}` : "across the whole network";
  }
}

/**
 * Whose figures the capacity card shows: its own place for a site, service or ward desk, else the
 * network ("26 beds ready now, across the whole network", never "for your ED").
 */
export function cardScopeNote(rows: readonly CapacityRow[], access: WardAccess, service: string | null): string {
  return rows[0]?.key === "own"
    ? countScopeNote(access, service)
    : service
      ? `for ${service}`
      : "across the whole network";
}

type NavCount = NonNullable<WardNavCounts[keyof WardNavCounts]>;

export function countTitle(label: string, count: NavCount, note: string): string {
  return `${label}: ${count.value} ${count.noun}, ${note}`;
}

/* ── Pin to my menu ─────────────────────────────────────────────────────────────────────────── */

/*
 * Pins last for this browser tab only and are never stored: remembering them per person needs Josh's
 * privacy decision first. They live in this module, so they survive moving between pages and go
 * when the tab reloads or closes.
 */
const pinListeners = new Set<() => void>();
let pinned: readonly string[] = [];
const NO_PINS: readonly string[] = [];

function readPins(): readonly string[] {
  return pinned;
}

function togglePin(id: string) {
  pinned = pinned.includes(id) ? pinned.filter((pinnedId) => pinnedId !== id) : [...pinned, id];
  for (const listener of pinListeners) listener();
}

function subscribePins(listener: () => void) {
  pinListeners.add(listener);
  return () => pinListeners.delete(listener);
}

export function usePinnedPages(): readonly string[] {
  return useSyncExternalStore(subscribePins, readPins, () => NO_PINS);
}

export function PinButton({ id, label, pinned }: { id: string; label: string; pinned: boolean }) {
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      className={styles.pinButton}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${label} from my menu` : `Pin ${label} to my menu`}
      title={pinned ? "Unpin from my menu" : "Pin to my menu"}
      data-testid="ward-rail-pin"
      onClick={() => togglePin(id)}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} />
    </button>
  );
}
