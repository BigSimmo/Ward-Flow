"use client";

// shell-next (Josh, 30 Oct 2026): the new parts of the redesigned rail, kept beside the fork so
// `next-rail-body.tsx` stays under the line cap.

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
} from "@/components/ward-management/shell/ward-service-bed-alerts";

import parts from "@/components/ward-management/shell-next/next-rail.module.css";

/** Sent when a header action opens a sheet of its own (New referral), so the rail's More and Menu sheets close. */
// The shell's one close-menus event (`ward-menu-events.ts`), so the bar can name it without this file.
export { CLOSE_MENUS_EVENT } from "@/components/ward-management/shell/ward-menu-events";

/* ── Capacity-led bed alerts ────────────────────────────────────────────────────────────────── */

type CapacityRow = {
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
    // H2 (Josh, 3 Nov 2026): a network desk reads the three fullest health services, fullest first,
    // so the order is the ranking. Metro as a whole moves to the card's foot line.
    const ranked = byOccupancy.slice(0, 3).map((row, index) => ({
      key: row.id,
      name: row.shortName,
      counts: index === 0 ? `${row.shortName}, the fullest health service` : `${row.shortName}'s wards`,
      percent: row.occupancyPercent,
    }));
    return ranked.length > 0 ? ranked : [metro];
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

/** Read aloud as the rows show: "Metro 86% full, over 85%. East Metro 87% full, over 85%". */
/**
 * The card's rows as its name reads them: each place and its percent, in the order on screen, so the
 * visible words sit in the name in one run (CB-3, axe 4.14 label-content-name-mismatch). Which
 * places are over the line, or not recorded, is said after the card's last line (`capacityRowsOver`).
 */
export function capacityRowsSpoken(rows: readonly CapacityRow[]): string {
  return rows
    .map((row) => (row.percent === null ? row.name : `${row.name} ${formatOccupancyPercent(row.percent)}`))
    .join(", ");
}

/** " Over 85%: East Metro and North Metro." and " Not recorded: ...", or nothing. */
export function capacityRowsOver(rows: readonly CapacityRow[]): string {
  const names = (list: readonly CapacityRow[]) =>
    list.length < 2
      ? (list[0]?.name ?? "")
      : `${list
          .slice(0, -1)
          .map((row) => row.name)
          .join(", ")} and ${list.at(-1)!.name}`;
  const over = rows.filter((row) => row.percent !== null && isBedAlert(row.percent));
  const missing = rows.filter((row) => row.percent === null);
  return [
    over.length ? ` Over ${BED_ALERT_THRESHOLD_PERCENT}%: ${names(over)}.` : "",
    missing.length ? ` Not recorded: ${names(missing)}.` : "",
  ].join("");
}

/**
 * WF-44: the closed rail names its place beside the figure, so it never shows a bare "74%". Note 3
 * (Josh, 8 Nov 2026): the words "• E…" were cut off in the 64px strip, so the place now sits under
 * a small ring that holds the figure. "East Metro" shortens to "East"; "Metro" stays.
 */
export function compactPipPlace(row: Pick<CapacityRow, "name"> | undefined): string {
  // A name too long for the 44px strip (a full ward name) reads "Beds"; the button's title names it.
  const place = row?.name.replace(/\s+Metro$/u, "").trim() ?? "";
  return place && place.length <= 6 ? place : "Beds";
}

/** The closed rail's occupancy ring: it fills to the figure, amber when that figure is at or over the line. */
export function RailOccupancyRing({ percent }: { percent: number | null }) {
  const alert = percent !== null && isBedAlert(percent);
  const circumference = 2 * Math.PI * 15;
  const filled = percent === null ? 0 : (Math.min(Math.max(percent, 0), 100) / 100) * circumference;
  return (
    <svg className={parts.occupancyRing} viewBox="0 0 36 36" aria-hidden="true" data-alert={alert || undefined}>
      <circle className={parts.occupancyTrack} cx="18" cy="18" r="15" />
      <circle
        className={parts.occupancyFill}
        cx="18"
        cy="18"
        r="15"
        strokeDasharray={`${filled.toFixed(1)} ${circumference.toFixed(1)}`}
        transform="rotate(-90 18 18)"
      />
      <text className={parts.occupancyFigure} x="18" y="18" textAnchor="middle" dominantBaseline="central">
        {percent === null ? "—" : Math.round(percent)}
      </text>
    </svg>
  );
}

/**
 * "1 at or over 85% full", "None at or over 85% full": the chip's words, so the alert never rests on colour alone.
 * WF-15 (live test, 5 Nov 2026): "full" says this counts places by bed occupancy, so "None over 85%"
 * no longer reads as a contradiction of the Alerts badge beside it, which counts alerts. "At or over"
 * matches isBedAlert (>=) and the Statistics screens (Josh, 5 Nov 2026).
 */
export function overLineLabel(
  rows: readonly CapacityRow[],
  services?: readonly { occupancyPercent: number }[],
): { label: string; over: number } {
  // A network desk shows only the three fullest services, but the chip counts every service over the line.
  const networkRows = services !== undefined && !rows.some((row) => row.key === "own" || row.key === "metro");
  const over = networkRows
    ? services.filter((row) => isBedAlert(row.occupancyPercent)).length
    : rows.filter((row) => row.percent !== null && isBedAlert(row.percent)).length;
  return { label: `${over === 0 ? "None" : over} at or over ${BED_ALERT_THRESHOLD_PERCENT}% full`, over };
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

const PIN_KEY = "ward_flow_mockup_rail_pins";
const pinListeners = new Set<() => void>();
let pinMemory: string[] | null = null;
const NO_PINS: readonly string[] = [];

function readPins(): readonly string[] {
  if (pinMemory) return pinMemory;
  try {
    const stored = window.sessionStorage.getItem(PIN_KEY);
    pinMemory = stored ? (JSON.parse(stored) as string[]).filter((id) => typeof id === "string") : [];
  } catch {
    pinMemory = [];
  }
  return pinMemory;
}

/** Mock-up only: pins last for this browser tab, so nothing reaches the shared record. */
function togglePin(id: string) {
  const current = readPins();
  pinMemory = current.includes(id) ? current.filter((pinned) => pinned !== id) : [...current, id];
  try {
    window.sessionStorage.setItem(PIN_KEY, JSON.stringify(pinMemory));
  } catch {
    // Storage refused: the pin still holds for this page.
  }
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
      className={parts.pinButton}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${label} from my menu` : `Pin ${label} to my menu`}
      title={pinned ? "Unpin from my menu" : "Pin to my menu"}
      data-testid="next-rail-pin"
      onClick={() => togglePin(id)}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} />
    </button>
  );
}

// DK1: the account menu lives in its own file so the executive chrome can share it without the rest.
export { RailAccountMenu } from "@/components/ward-management/shell-next/next-account-menu";

/** H2 (Josh, 3 Nov 2026): the bed alerts foot line, Metro as a whole (when the rows above rank
 *  services) and the beds ready now.
 * WF-44 (5 Nov 2026): Metro sits on its own line above the ready count, so "Metro 74.6%" never
 * paints over the East Metro row above it on a tight rail. */
export function RailReadyLine({ metro, ready }: { metro: number | null; ready: number }) {
  return (
    <span className={parts.readyStack}>
      {metro !== null ? (
        <span className={parts.readyMetro}>
          Metro <b>{formatOccupancyPercent(metro)}</b>
        </span>
      ) : null}{" "}
      <span>
        <b>{ready}</b> {ready === 1 ? "bed" : "beds"} ready now
      </span>
    </span>
  );
}

export function RailLiveClock({
  clock,
  shift,
  classes,
}: {
  clock: string;
  shift: string;
  /** The rail sheet's own classes: its title line and the quieter word beside the time. */
  classes: Readonly<Record<string, string>>;
}) {
  return (
    <span className={`${classes.shiftTitle} ${parts.liveClock}`} data-testid="ward-rail-live-clock">
      <span className={parts.liveDot} aria-hidden="true" />
      <span className={parts.liveTime}>{clock}</span>
      <span className={classes.shiftHours}>{shift}</span>
    </span>
  );
}
