/**
 * The Delays board: pure derivations for the approved October 2026 layout (owner tiles, the
 * waiting table with its row timelines, the registers rail and the three graphs under the table).
 *
 * Everything here reads facts the engine already records. The cause, its owner, the recorded
 * legal due time and the last recorded activity all come from `delays-derivations.ts`; nothing
 * here invents a time limit or a status. The 8, 12 and 24 hour bands are the same named waits the
 * rest of the screen uses (see `delays-view-model.ts`), not new clinical limits.
 */
import { currentDueSoonThresholds, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
  SILENT_WARD_FIRST_REMINDER_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { edHealthService } from "@/components/ward-management/ward-service-scope";
import { edById } from "@/components/ward-management/ward-sites";
import {
  DELAY_CAUSE_ORDER,
  DELAY_OWNERS,
  SEVERE_CAUSES,
  lastRecordedActivity,
  legalDeadlineMinutes,
  ownerOf,
  type DelayCause,
  type DelayGroup,
  type DelayOwnerId,
} from "./delays-derivations";
import { overTwelveHoursMinutes, type CatchmentOrigin } from "./delays-view-model";

export const OVER_8H = ED_SEVERE_PRESSURE_WAIT_MINUTES;
export const OVER_12H = overTwelveHoursMinutes;
export const OVER_24H = LONG_WAIT_MINUTES;
/** "Silent" reuses the first silent-ward reminder (2h), the screen's existing quiet threshold. */
export const SILENT_MINUTES = SILENT_WARD_FIRST_REMINDER_MINUTES;

/** An hour label from a minute count ("8h"), so no hour figure is typed into shown copy. */
export function hoursLabel(minutes: number): string {
  return `${minutes / 60}h`;
}
/** The same, in words ("4 hours"). */
export function hoursWord(minutes: number): string {
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}
export const H8 = hoursLabel(OVER_8H);
export const H12 = hoursLabel(OVER_12H);
export const H24 = hoursLabel(OVER_24H);

export const WAIT_BANDS = [
  `Under ${H8}`,
  `${OVER_8H / 60} to ${H12}`,
  `${OVER_12H / 60} to ${H24}`,
  `Over ${H24}`,
] as const;
export type BandCounts = [number, number, number, number];

export function waitBand(waited: number): 0 | 1 | 2 | 3 {
  if (waited >= OVER_24H) return 3;
  if (waited >= OVER_12H) return 2;
  if (waited >= OVER_8H) return 1;
  return 0;
}

export type BoardRow = {
  movement: Movement;
  cause: DelayCause;
  owner: DelayOwnerId;
  severe: boolean;
  /** Minutes since the journey opened (arrival in the department). */
  waited: number;
  /** The most recent recorded event after arrival, or undefined when nothing has been recorded. */
  activity: { at: Instant; what: string } | undefined;
  /** Minutes since that event, or the whole wait when nothing has been recorded. */
  quiet: number;
  silent: boolean;
  /** Minutes until the typed legal due time; negative once passed; undefined when none recorded. */
  dueIn: number | undefined;
  origin: CatchmentOrigin;
  locked: boolean;
};

export function boardRows(groups: readonly DelayGroup[], now: Instant): BoardRow[] {
  return groups.flatMap((group) =>
    group.movements.map((movement) => {
      const waited = Math.max(0, now - movement.openedAt);
      const recorded = lastRecordedActivity(movement, now);
      // A ward acceptance is a recorded event too; the shared helper predates it, so it is folded in here.
      const accepted =
        movement.acceptedAt !== undefined && movement.acceptedAt <= now
          ? { at: movement.acceptedAt, what: "a ward accepted" }
          : undefined;
      const latest =
        accepted !== undefined && (recorded === undefined || accepted.at > recorded.at) ? accepted : recorded;
      const activity = latest === undefined || latest.what === "the journey opened" ? undefined : latest;
      const quiet = activity === undefined ? waited : Math.min(waited, Math.max(0, now - activity.at));
      return {
        movement,
        cause: group.cause,
        owner: ownerOf(group.cause),
        severe: SEVERE_CAUSES.includes(group.cause),
        waited,
        activity,
        quiet,
        silent: quiet >= SILENT_MINUTES,
        dueIn: legalDeadlineMinutes(movement, now),
        origin: edHealthService(movement.originEdId) ?? "unrecorded",
        locked: movement.security === "Secure",
      };
    }),
  );
}

export function bandCounts(rows: readonly BoardRow[]): BandCounts {
  const counts: BandCounts = [0, 0, 0, 0];
  for (const row of rows) counts[waitBand(row.waited)] += 1;
  return counts;
}

/** Legal tone from the recorded due time and the configured warnings (1h and 3h by default). */
export function dueTone(dueIn: number | undefined): "danger" | "warning" | undefined {
  if (dueIn === undefined) return undefined;
  const { urgentMinutes, soonMinutes } = currentDueSoonThresholds();
  if (dueIn <= urgentMinutes) return "danger";
  if (dueIn <= soonMinutes) return "warning";
  return undefined;
}

/** One shape per person on the spread chart: act now, at risk or waiting. */
export function rowTone(row: BoardRow): "danger" | "warning" | "neutral" {
  const legal = dueTone(row.dueIn);
  if (row.waited >= OVER_24H || legal === "danger") return "danger";
  if (row.waited >= OVER_8H || legal === "warning") return "warning";
  return "neutral";
}

export function waitTone(waited: number): "danger" | "warning" | undefined {
  if (waited >= OVER_24H) return "danger";
  if (waited >= OVER_8H) return "warning";
  return undefined;
}

/* ---------- owners and catchments ---------- */

/** Owners a cause can actually map to. An owner no cause reaches would always read zero. */
export const BOARD_OWNERS = DELAY_OWNERS.filter((owner) =>
  DELAY_CAUSE_ORDER.some((cause) => ownerOf(cause) === owner.id),
);

export function ownerName(owner: DelayOwnerId): string {
  return DELAY_OWNERS.find((entry) => entry.id === owner)?.name ?? owner;
}

const PRIMARY_ORIGINS: CatchmentOrigin[] = ["North Metro", "East Metro", "South Metro", "WACHS"];

export function catchmentName(origin: CatchmentOrigin): string {
  if (origin === "WACHS") return "WA Country";
  if (origin === "unrecorded") return "No service recorded";
  return origin;
}

/** The four primary catchments always, then any other service or the unrecorded case with people. */
export function boardCatchments(rows: readonly BoardRow[]): CatchmentOrigin[] {
  const rest = [...HEALTH_SERVICES, "unrecorded" as const].filter(
    (origin) => !PRIMARY_ORIGINS.includes(origin) && rows.some((row) => row.origin === origin),
  );
  return [...PRIMARY_ORIGINS, ...rest];
}

export type OwnerTile = {
  owner: DelayOwnerId;
  name: string;
  rows: BoardRow[];
  bands: BandCounts;
  sub: { tone: "danger" | "warning" | "neutral"; count: number; text: string };
};

export function ownerTiles(rows: readonly BoardRow[]): OwnerTile[] {
  return BOARD_OWNERS.map(({ id, name }) => {
    const mine = rows.filter((row) => row.owner === id);
    const severe = mine.filter((row) => row.severe).length;
    const over8 = mine.filter((row) => row.waited >= OVER_8H).length;
    const sub =
      id === "yours"
        ? { tone: "danger" as const, count: severe, text: "form due or past its time" }
        : id === "wards"
          ? { tone: "danger" as const, count: severe, text: "no suitable bed" }
          : id === "transport"
            ? { tone: "warning" as const, count: over8, text: `over ${H8}` }
            : { tone: "neutral" as const, count: mine.length, text: "waiting" };
    return { owner: id, name, rows: mine, bands: bandCounts(mine), sub };
  });
}

/* ---------- filters ---------- */

export const WAIT_THRESHOLDS = [0, OVER_8H, OVER_12H, OVER_24H] as const;
export const WAIT_THRESHOLD_LABELS = ["All", "8h+", "12h+", "24h+"] as const;
export type WaitThreshold = 0 | 1 | 2 | 3;

export type BoardFilters = {
  owner: DelayOwnerId | null;
  origin: CatchmentOrigin | null;
  cause: DelayCause | null;
  threshold: WaitThreshold;
  locked: boolean;
  silent: boolean;
  dueSoon: boolean;
  breached: boolean;
  bin: number | null;
  search: string;
};

export const NO_FILTERS: BoardFilters = {
  owner: null,
  origin: null,
  cause: null,
  threshold: 0,
  locked: false,
  silent: false,
  dueSoon: false,
  breached: false,
  bin: null,
  search: "",
};

export function hasFilters(filters: BoardFilters): boolean {
  return (
    filters.owner !== null ||
    filters.origin !== null ||
    filters.cause !== null ||
    filters.threshold !== 0 ||
    filters.locked ||
    filters.silent ||
    filters.dueSoon ||
    filters.breached ||
    filters.bin !== null ||
    filters.search.trim() !== ""
  );
}

export function isDueSoon(row: BoardRow): boolean {
  return row.dueIn !== undefined && row.dueIn >= 0 && row.dueIn <= currentDueSoonThresholds().urgentMinutes;
}

export function isBreached(row: BoardRow): boolean {
  return row.dueIn !== undefined && row.dueIn < 0;
}

/**
 * Applies every filter. `nameOf` resolves the person's display name and number for the search box;
 * the name never leaves the page (no URL, no storage).
 */
export function filterRows(
  rows: readonly BoardRow[],
  filters: BoardFilters,
  bins: readonly RunwayBin[],
  nameOf: (movement: Movement) => string,
): BoardRow[] {
  const binIds = filters.bin === null ? null : (bins[filters.bin]?.ids ?? new Set<string>());
  const needle = filters.search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filters.owner === null || row.owner === filters.owner) &&
      (filters.origin === null || row.origin === filters.origin) &&
      (filters.cause === null || row.cause === filters.cause) &&
      row.waited >= WAIT_THRESHOLDS[filters.threshold] &&
      (!filters.locked || row.locked) &&
      (!filters.silent || row.silent) &&
      (!filters.dueSoon || isDueSoon(row)) &&
      (!filters.breached || isBreached(row)) &&
      (binIds === null || binIds.has(row.movement.id)) &&
      (needle === "" ||
        nameOf(row.movement).toLowerCase().includes(needle) ||
        (edById(row.movement.originEdId)?.name ?? row.movement.originEdId).toLowerCase().includes(needle)),
  );
}

/* ---------- next four hours ---------- */

export type RunwayBin = {
  index: number;
  /** Minutes from now, start exclusive and end inclusive. */
  from: number;
  to: number;
  cross8: BoardRow[];
  cross24: BoardRow[];
  formDue: BoardRow[];
  ids: Set<string>;
};

/** Chart spacing: the runway's half-hour columns, eight of them, the four-hour look-ahead. */
export const CHART_BIN_MINUTES = 30;
export const RUNWAY_BINS = 8;
export const RUNWAY_WINDOW = CHART_BIN_MINUTES * RUNWAY_BINS;

/** If nobody moves: who crosses 8h or 24h, and whose typed legal due time falls, per half hour. */
export function runwayBins(rows: readonly BoardRow[]): RunwayBin[] {
  return Array.from({ length: RUNWAY_BINS }, (_, index) => {
    const from = index * CHART_BIN_MINUTES;
    const to = from + CHART_BIN_MINUTES;
    const crosses = (limit: number) => (row: BoardRow) =>
      row.waited < limit && row.waited + to >= limit && row.waited + from < limit;
    const cross8 = rows.filter(crosses(OVER_8H));
    const cross24 = rows.filter(crosses(OVER_24H));
    const formDue = rows.filter((row) => row.dueIn !== undefined && row.dueIn > from && row.dueIn <= to);
    const ids = new Set([...cross8, ...cross24, ...formDue].map((row) => row.movement.id));
    return { index, from, to, cross8, cross24, formDue, ids };
  });
}

/** Over 8h now, then after each bin if nobody leaves. */
export function projectedOver8(rows: readonly BoardRow[], bins: readonly RunwayBin[]): number[] {
  let running = rows.filter((row) => row.waited >= OVER_8H).length;
  const out = [running];
  for (const bin of bins) {
    running += bin.cross8.length;
    out.push(running);
  }
  return out;
}

/* ---------- time scale shared by the spread chart and the row timeline ---------- */

/** 0 to 24h linear over the first 86% of the width, then 1d to 7d on a log scale over the next 12%. */
export function spreadX(minutes: number): number {
  if (minutes <= OVER_24H) return (Math.max(0, minutes) / OVER_24H) * 86;
  return 86 + Math.min(1, Math.log(minutes / OVER_24H) / Math.log(7)) * 12;
}

export const SPREAD_TICKS: readonly [number, string][] = [
  [0, "0h"],
  [240, "4h"],
  [480, "8h"],
  [720, "12h"],
  [960, "16h"],
  [1200, "20h"],
  [1440, "24h"],
  [4320, "3d"],
  [10080, "7d"],
];

/* ---------- ward answers and the person's own record ---------- */

export function unitName(units: readonly Unit[], unitId: string): string {
  return units.find((unit) => unit.id === unitId)?.name ?? unitId;
}

export type WardLine = {
  unitId: string;
  name: string;
  tone: "success" | "closed" | "neutral" | "warning";
  text: string;
};

/** What each asked ward has said, from the recorded acceptance, declines and open referrals. */
export function wardLines(row: BoardRow, units: readonly Unit[]): WardLine[] {
  const { movement } = row;
  const lines: WardLine[] = [];
  if (movement.acceptedUnitId !== undefined) {
    lines.push({
      unitId: movement.acceptedUnitId,
      name: unitName(units, movement.acceptedUnitId),
      tone: row.cause === "bed_pull_expired" ? "warning" : "success",
      text:
        row.cause === "bed_pull_expired"
          ? "Bed held, reserved time passed"
          : row.cause === "awaiting_bed_ready"
            ? "Accepted, bed not ready"
            : "Accepted",
    });
  }
  for (const decline of movement.declines) {
    lines.push({ unitId: decline.unitId, name: unitName(units, decline.unitId), tone: "closed", text: "Declined" });
  }
  for (const unitId of movement.referredUnitIds) {
    if (unitId === movement.acceptedUnitId || movement.declines.some((decline) => decline.unitId === unitId)) continue;
    lines.push({ unitId, name: unitName(units, unitId), tone: "neutral", text: "Asked, no answer yet" });
  }
  return lines;
}

/** One line for the table's Wards column. */
export function wardSummary(row: BoardRow, units: readonly Unit[]): { tone: WardLine["tone"]; text: string } {
  const lines = wardLines(row, units);
  const accepted = lines.find((line) => line.tone === "success" || line.tone === "warning");
  if (accepted) return { tone: accepted.tone, text: `${accepted.name}, ${accepted.text.toLowerCase()}` };
  const declined = lines.filter((line) => line.tone === "closed").length;
  const asked = lines.filter((line) => line.tone === "neutral").length;
  if (declined === 0 && asked === 0) return { tone: "neutral", text: "No ward asked yet" };
  const parts = [declined ? `${declined} declined` : null, asked ? `${asked} asked` : null].filter(Boolean);
  return { tone: declined ? "closed" : "neutral", text: parts.join(", ") };
}

export type RowEvent = {
  /** Minutes after arrival. */
  offset: number;
  what: string;
  tone: "neutral" | "info" | "success" | "closed";
};

/** Every recorded event on the journey, in order, clipped to arrival and now. */
export function rowEvents(row: BoardRow, units: readonly Unit[], now: Instant): RowEvent[] {
  const { movement } = row;
  const opened = movement.openedAt;
  const edName = edById(movement.originEdId)?.name ?? "the department";
  const events: { at: Instant; what: string; tone: RowEvent["tone"] }[] = [
    { at: opened, what: `Arrived, ${edName}`, tone: "neutral" },
  ];
  if (movement.formedAt !== undefined)
    events.push({ at: movement.formedAt, what: "Referral for examination made", tone: "info" });
  if (movement.legalFormReceivedAt !== undefined && movement.legalForm !== undefined)
    events.push({ at: movement.legalFormReceivedAt, what: `Form ${movement.legalForm.code} received`, tone: "info" });
  if (movement.examination !== undefined)
    events.push({ at: movement.examination.at, what: "Examination recorded", tone: "info" });
  if (movement.referralAbsence !== undefined)
    events.push({ at: movement.referralAbsence.at, what: "Referral source recorded", tone: "neutral" });
  if (movement.referredAt !== undefined) {
    const asked = movement.referredUnitIds.length + movement.declines.length;
    events.push({
      at: movement.referredAt,
      what: asked > 0 ? `Referred to ${asked} ward${asked === 1 ? "" : "s"}` : "Referral raised",
      tone: "info",
    });
  }
  for (const decline of movement.declines)
    events.push({ at: decline.at, what: `Declined, ${unitName(units, decline.unitId)}`, tone: "closed" });
  for (const withdrawal of movement.withdrawnReferrals)
    events.push({ at: withdrawal.at, what: `Withdrawn, ${unitName(units, withdrawal.unitId)}`, tone: "closed" });
  if (movement.acceptedAt !== undefined && movement.acceptedUnitId !== undefined)
    events.push({
      at: movement.acceptedAt,
      what: `Accepted, ${unitName(units, movement.acceptedUnitId)}`,
      tone: "success",
    });
  if (movement.escalation !== undefined)
    events.push({ at: movement.escalation.at, what: `Escalated, ${movement.escalation.contact}`, tone: "info" });
  const transport = movement.transport;
  if (transport?.acceptedAt !== undefined)
    events.push({ at: transport.acceptedAt, what: "Transport accepted", tone: "info" });
  if (transport?.enRouteAt !== undefined)
    events.push({ at: transport.enRouteAt, what: "Transport en route", tone: "info" });
  if (transport?.collectedAt !== undefined)
    events.push({ at: transport.collectedAt, what: "Patient collected", tone: "info" });
  if (transport?.cancelledAt !== undefined)
    events.push({ at: transport.cancelledAt, what: "Transport cancelled", tone: "closed" });
  return events
    .filter((event) => event.at >= opened && event.at <= now)
    .sort((a, b) => a.at - b.at)
    .map((event) => ({ offset: event.at - opened, what: event.what, tone: event.tone }));
}

/** Rows whose recorded legal time is pinned above the rest in the Longest wait view. */
export function isPinned(row: BoardRow): boolean {
  return row.dueIn !== undefined && row.dueIn <= currentDueSoonThresholds().soonMinutes;
}
