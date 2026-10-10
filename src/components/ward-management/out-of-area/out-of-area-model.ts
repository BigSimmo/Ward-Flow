import { daysInBed } from "@/components/ward-management/ward-admissions";
import { dayOf, formatInstant, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { travelBand, TRAVEL_BANDS, type TravelBand } from "@/components/ward-management/ward-distance";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import type {
  HomeRegion,
  TransportLegalStatus,
  TransportProvider,
  Unit,
} from "@/components/ward-management/ward-model";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";
import type { OutOfAreaEntry } from "@/components/ward-management/ward-referrals";
import { siteByCode, wardSites } from "@/components/ward-management/ward-sites";
import { SYNTHETIC_TRAVEL_BANDS } from "@/components/ward-management/ward-travel-bands";

/**
 * Out of area option A (9 Oct 2026): the small, pure reads the page shows beside the ledger.
 *
 * Every figure here is read off a record the ledger already returned, a unit's own confirmed
 * capacity, or a repatriation the coordinator recorded. Nothing is written back and nothing feeds
 * `outOfAreaLedger`. The travel bands are the invented `SYNTHETIC_TRAVEL_BANDS` table, read only
 * through `travelBand`, so a checked table replaces them with no change here.
 */

/** The short travel words for a cell, a card and a fact. The full label stays in `TRAVEL_BAND_LABELS`. */
export const TRAVEL_SHORT: Record<TravelBand, string> = {
  under_an_hour: "Under 1h",
  one_to_three_hours: "1 to 3h",
  three_hours_or_more: "Road 3h+",
  air_transport_only: "Air only",
};

/** "Royal Perth", "Fiona Stanley", "Albany": a site name without its building word. */
export function shortSiteName(code: string): string {
  const name = siteByCode(code)?.name ?? code;
  return name.replace(/\s+(Public Hospital|Hospital|Health Campus|Health Service)$/u, "");
}

/** Whole calendar days from today to the recorded discharge date, or `null` when none is set. */
export function dischargeOffsetDays(entry: OutOfAreaEntry, now: Instant): number | null {
  const at = entry.admission.expectedDischargeAt;
  if (at === null || !Number.isFinite(at)) return null;
  return dayOf(at) - dayOf(now);
}

function dayWord(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** "Due 2 days ago", "Due today", "Due in 5 days" or "No date". */
export function dischargeText(offset: number | null): string {
  if (offset === null) return "No date";
  if (offset === 0) return "Due today";
  return offset < 0 ? `Due ${dayWord(-offset)} ago` : `Due in ${dayWord(offset)}`;
}

/** The same fact in fewer words, for a phone card and the plan's facts row. */
export function dischargeShort(offset: number | null): string {
  if (offset === null) return "No date";
  if (offset === 0) return "Today";
  return offset < 0 ? `${dayWord(-offset)} ago` : `In ${dayWord(offset)}`;
}

/**
 * The days away strip on the hero. Display groups for reading the spread at a glance, not
 * thresholds: nothing is triggered, ranked or escalated by crossing one.
 */
export const DAYS_AWAY_GROUPS = [
  { id: "under7", label: "Under 7", min: 0, max: 6 },
  { id: "week", label: "7 to 29", min: 7, max: 29 },
  { id: "month", label: "30 to 89", min: 30, max: 89 },
  { id: "long", label: "90 plus", min: 90, max: Number.POSITIVE_INFINITY },
] as const;
export type DaysAwayGroupId = (typeof DAYS_AWAY_GROUPS)[number]["id"];

export function daysAway(entry: OutOfAreaEntry, now: Instant): number {
  return daysInBed(entry.admission, now) ?? 0;
}

export function inDaysAwayGroup(entry: OutOfAreaEntry, now: Instant, id: DaysAwayGroupId): boolean {
  const group = DAYS_AWAY_GROUPS.find((candidate) => candidate.id === id);
  if (!group) return false;
  const days = daysAway(entry, now);
  return days >= group.min && days <= group.max;
}

/* ------------------------------------------------------------------------------------------- *
 * The return plan's answers. Held in the page's own React state only, never in browser storage.
 * ------------------------------------------------------------------------------------------- */

export type RepatDraft = {
  homeHospital: string;
  receivingWardAgreed: boolean | undefined;
  mode: "" | "road" | "flight";
  provider: TransportProvider | undefined;
  cadNumber: string;
  transportLegalStatus: TransportLegalStatus | undefined;
  estimatedTime: string;
  estimatedDay: "today" | "tomorrow";
};

export const BLANK_REPAT_DRAFT: RepatDraft = {
  homeHospital: "",
  receivingWardAgreed: undefined,
  mode: "",
  provider: undefined,
  cadNumber: "",
  transportLegalStatus: undefined,
  estimatedTime: "",
  estimatedDay: "today",
};

/** Same HH:MM parser the ED booking popup uses, kept local so this screen does not import from ed-screen. */
export function minutesFromTimeInput(value: string): number | undefined {
  const parts = value.split(":");
  if (parts.length !== 2) return undefined;
  const [rawHours, rawMinutes] = parts;
  if (rawHours?.length !== 2 || rawMinutes?.length !== 2) return undefined;
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

export function instantFromEstimatedTimeInputs(
  timeValue: string,
  day: "today" | "tomorrow",
  now: Instant,
): number | undefined {
  const minuteOfDay = minutesFromTimeInput(timeValue);
  if (minuteOfDay === undefined) return undefined;
  const startOfToday = Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  return startOfToday + (day === "tomorrow" ? MINUTES_PER_DAY : 0) + minuteOfDay;
}

/** The three steps of the plan, and the answers each holds. */
export const PLAN_STEPS = [
  { n: 1, title: "Receiving bed", answers: ["receiving hospital", "ward agreement"] },
  { n: 2, title: "Transport", answers: ["road or flight", "provider", "legal status"] },
  { n: 3, title: "Dispatch", answers: ["CAD number", "depart time"] },
] as const;
export const PLAN_ANSWER_COUNT = 7;

/** The answers still needed, in plan order. None is filled in for the coordinator. */
export function missingAnswers(draft: RepatDraft, now: Instant): string[] {
  const missing: string[] = [];
  if (!wardSites.some((site) => site.code === draft.homeHospital)) missing.push("receiving hospital");
  if (draft.receivingWardAgreed === undefined) missing.push("ward agreement");
  if (draft.mode !== "road" && draft.mode !== "flight") missing.push("road or flight");
  if (draft.provider === undefined) missing.push("provider");
  if (draft.transportLegalStatus === undefined) missing.push("legal status");
  if (draft.cadNumber.trim().length === 0) missing.push("CAD number");
  if (instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now) === undefined) {
    missing.push("depart time");
  }
  return missing;
}

/* ------------------------------------------------------------------------------------------- *
 * Return status, from the recorded repatriation first and the page's own draft second.
 * ------------------------------------------------------------------------------------------- */

export type ReturnStatus = "none" | "started" | "not_agreed" | "agreed";

export function returnStatus(
  record: RepatriationRecord | undefined,
  draft: RepatDraft | undefined,
  now: Instant,
): ReturnStatus {
  if (record) return record.receivingWardAgreed ? "agreed" : "not_agreed";
  if (draft && missingAnswers(draft, now).length < PLAN_ANSWER_COUNT) return "started";
  return "none";
}

export const RETURN_STATUS_SHORT: Record<ReturnStatus, string> = {
  none: "No plan",
  started: "Plan started",
  not_agreed: "Ward not agreed",
  agreed: "Agreed, bed to place",
};

/* ------------------------------------------------------------------------------------------- *
 * Beds with shorter travel, read from each unit's own ward-confirmed capacity.
 * ------------------------------------------------------------------------------------------- */

const BAND_RANK: Record<TravelBand, number> = Object.fromEntries(
  TRAVEL_BANDS.map((band, index) => [band, index]),
) as Record<TravelBand, number>;

export type BedOption = {
  unit: Unit;
  siteCode: string;
  band: TravelBand;
  beds: number;
  ageMinutes: number;
  stale: boolean;
};

function bedOption(unit: Unit, band: TravelBand, now: Instant): BedOption {
  const ageMinutes = Math.max(0, now - unit.allocatable.confirmedAt);
  return {
    unit,
    siteCode: unit.siteCode,
    band,
    beds: unit.allocatable.value,
    ageMinutes,
    stale: ageMinutes > unit.allocatable.staleAfterMinutes,
  };
}

/** "8m ago", "1h 05m ago": how old a ward's confirmed bed figure is. */
export function confirmedAgeText(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m ago`;
}

/**
 * Units in this person's cohort at a site the band table records as shorter travel from their home
 * region than the bed they are in now. Most beds first within the shortest band.
 */
export function closerBedOptions(entry: OutOfAreaEntry, units: Unit[], now: Instant): BedOption[] {
  const region = entry.admission.homeRegion;
  if (region === null) return [];
  const current = BAND_RANK[entry.band];
  const options: BedOption[] = [];
  for (const unit of units) {
    if (unit.cohort !== entry.unit.cohort || unit.id === entry.unit.id) continue;
    const band = travelBand(region, unit.siteCode);
    if (band === undefined || BAND_RANK[band] >= current) continue;
    options.push(bedOption(unit, band, now));
  }
  return options.sort((a, b) => BAND_RANK[a.band] - BAND_RANK[b.band] || b.beds - a.beds);
}

export type HomeRegionBeds = {
  region: HomeRegion;
  away: number;
  band: TravelBand | undefined;
  options: BedOption[];
};

/**
 * People away by home region, most first, then the adult units at the sites the band table
 * records as the shortest travel from that region.
 */
export function homeRegionBeds(entries: OutOfAreaEntry[], units: Unit[], now: Instant): HomeRegionBeds[] {
  const counts = new Map<HomeRegion, number>();
  for (const entry of entries) {
    const region = entry.admission.homeRegion;
    if (region === null) continue;
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([region, away]) => {
      const table = SYNTHETIC_TRAVEL_BANDS[region] ?? {};
      const recorded = Object.entries(table).filter((pair): pair is [string, TravelBand] => pair[1] !== undefined);
      const best = recorded.length ? Math.min(...recorded.map(([, band]) => BAND_RANK[band])) : undefined;
      const sites = recorded.filter(([, band]) => BAND_RANK[band] === best).map(([code]) => code);
      const band = recorded.find(([, candidate]) => BAND_RANK[candidate] === best)?.[1];
      const options = units
        .filter((unit) => sites.includes(unit.siteCode) && unit.cohort === "Adult")
        .map((unit) => bedOption(unit, travelBand(region, unit.siteCode)!, now));
      return { region, away, band, options };
    });
}

/* ------------------------------------------------------------------------------------------- *
 * The shift, from the one shift pattern every screen uses.
 * ------------------------------------------------------------------------------------------- */

export function currentShiftStart(now: Instant): Instant {
  const minute = ((now % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  for (const shift of SHIFT_PATTERN) {
    const { startMinute, endMinute } = shift;
    const inside =
      startMinute < endMinute
        ? minute >= startMinute && minute < endMinute
        : minute >= startMinute || minute < endMinute;
    if (inside) return now - ((minute - startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  }
  return now;
}

export function shiftLabel(now: Instant): string {
  return `${formatInstant(currentShiftStart(now))} to now`;
}

/** Whether a recorded return departs on today's calendar day. */
export function leavesToday(record: RepatriationRecord, now: Instant): boolean {
  return dayOf(record.estimatedAt) === dayOf(now);
}
