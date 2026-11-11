import { bedIsOccupied, daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import { CAD_TO_FOLLOW, cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import {
  dayOf,
  formatInstantWithDay,
  minuteOfDay,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { travelBand, type TravelBand } from "@/components/ward-management/ward-distance";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import type {
  Movement,
  HomeRegion,
  TransportLegalStatus,
  TransportProvider,
  Unit,
} from "@/components/ward-management/ward-model";
import { BED_MEETING_MINUTES, SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";
import { outOfAreaLedger, type OutOfAreaEntry } from "@/components/ward-management/ward-referrals";
import { siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import {
  instantFromEstimatedTimeInputs,
  minutesFromTimeInput,
} from "@/components/ward-management/ward-transport-checks";

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
  under_an_hour: "Under 1 hour",
  one_to_three_hours: "1 to 3 hours",
  three_hours_or_more: "3 hours or more",
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
  /**
   * #177 (Josh, 27 Oct 2026): for an involuntary return, whether Form 4C is in hand and whether an
   * escort is needed for the journey. Both open blank and are answered by a person. Unanswered is a
   * warning on the plan, never a missing answer, and neither is derived. Saved on the return.
   */
  form4CReceived: boolean | undefined;
  escortRequired: boolean | undefined;
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
  form4CReceived: undefined,
  escortRequired: undefined,
};

/** The three steps of the plan, and the answers each holds. */
export const PLAN_STEPS = [
  { n: 1, title: "Receiving bed", answers: ["receiving hospital", "ward agreement"] },
  { n: 2, title: "Transport", answers: ["road or flight", "provider", "legal status"] },
  { n: 3, title: "Dispatch", answers: ["CAD number", "depart time"] },
] as const;
/** The answers that block (`missingAnswers`), all missing on a blank plan. */
const PLAN_ANSWER_COUNT = 4;

/**
 * The answers still needed, in plan order. None is filled in for the coordinator.
 *
 * Form rule (design audit W13, Josh's card 3, 5 Nov 2026): the provider and depart time warn
 * (`planWarnings`) and a blank CAD is "CAD to follow". A typed CAD the rule refuses is a wrong answer
 * and still blocks. So does a typed depart time that cannot be read: recording it would drop the
 * time the person gave. A blank depart time only warns.
 */
export function missingAnswers(draft: RepatDraft): string[] {
  const missing: string[] = [];
  if (!siteDirectory.some((site) => site.code === draft.homeHospital)) missing.push("receiving hospital");
  if (draft.receivingWardAgreed === undefined) missing.push("ward agreement");
  if (draft.mode !== "road" && draft.mode !== "flight") missing.push("road or flight");
  if (draft.transportLegalStatus === undefined) missing.push("legal status");
  if (draft.cadNumber.trim() && cadNumberProblem(draft.cadNumber) !== undefined) missing.push("CAD number");
  if (departTimeUnreadable(draft)) missing.push("depart time");
  return missing;
}

/** A depart time was typed but cannot be read as a clock time. Blank is not unreadable. */
export function departTimeUnreadable(draft: RepatDraft): boolean {
  return draft.estimatedTime.trim() !== "" && minutesFromTimeInput(draft.estimatedTime) === undefined;
}

/** W13: the words for a return recorded with no depart time or no provider. */
export const DEPART_TIME_NOT_RECORDED = "Depart time not recorded";
export const PROVIDER_NOT_RECORDED = "Provider not recorded";

/** W13: what the plan sends without, as warnings. Recording still goes ahead. */
function planWarnings(draft: RepatDraft, now: Instant): string[] {
  return [
    draft.provider === undefined ? "provider" : "",
    // An unreadable typed time blocks in `missingAnswers` instead, so only a blank one warns here.
    !departTimeUnreadable(draft) &&
    instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now) === undefined
      ? "depart time"
      : "",
  ].filter(Boolean);
}

/**
 * W13: the plan's warning line, with "CAD to follow" for a blank CAD. Empty when nothing warns.
 * "You can still record." is said only when nothing blocks "Record sent to ward" (every blocking
 * answer but the ward agreement, which that record does not need); otherwise the omissions are
 * listed without the promise.
 */
export function planWarningsLine(draft: RepatDraft, now: Instant): string {
  const missing = planWarnings(draft, now);
  const parts = [
    missing.length ? `Not recorded: ${missing.join(", ")}.` : "",
    draft.cadNumber.trim() ? "" : `${CAD_TO_FOLLOW}.`,
  ].filter(Boolean);
  if (!parts.length) return "";
  const blocked = missingAnswers(draft).some((answer) => answer !== "ward agreement");
  return blocked ? parts.join(" ") : `${parts.join(" ")} You can still record.`;
}

/**
 * #177: the involuntary return's answers for `RECORD_REPATRIATION`. Only an involuntary return
 * asks them, and a blank answer is left out rather than sent as "no".
 */
export function involuntaryReturnAnswers(draft: RepatDraft): { form4CReceived?: boolean; escortRequired?: boolean } {
  if (draft.transportLegalStatus !== "involuntary") return {};
  return {
    ...(draft.form4CReceived === undefined ? {} : { form4CReceived: draft.form4CReceived }),
    ...(draft.escortRequired === undefined ? {} : { escortRequired: draft.escortRequired }),
  };
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
  if (
    draft &&
    (missingAnswers(draft).length < PLAN_ANSWER_COUNT ||
      planWarnings(draft, now).length < 2 ||
      draft.cadNumber.trim() !== "")
  )
    return "started";
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

/**
 * Only the road bands are ordered. Air only says how someone gets there, not how long it takes
 * (`ward-distance.ts`), so it is never ranked against a drive in either direction.
 */
const ROAD_RANK: Partial<Record<TravelBand, number>> = {
  under_an_hour: 0,
  one_to_three_hours: 1,
  three_hours_or_more: 2,
};

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
    // The same `min(allocatable, empty)` every other screen shows: a ward can confirm more
    // allocatable beds than it has physically empty once arrivals land.
    beds: boundedBedAvailability(unit).available,
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
 * The notes under the closer-bed and home-region lists: each is a travel list, not a fit list, so it
 * says what it leaves out (M118, 10 Nov 2026).
 */
export const CLOSER_BED_NOTE =
  "Travel list, same cohort only. It does not check authorisation, sex designation or forensic wards.";
export const HOME_REGION_BEDS_NOTE =
  "Travel list, adult wards only. It does not check authorisation, sex designation or forensic wards.";

/**
 * Units in this person's cohort at a site the band table records as shorter travel from their home
 * region than the bed they are in now. Shortest band first, then A to Z by ward name: never most beds
 * first, which would nudge towards one ward (never-build sweep, Josh 24 Oct 2026).
 */
export function closerBedOptions(entry: OutOfAreaEntry, units: Unit[], now: Instant): BedOption[] {
  const region = entry.admission.homeRegion;
  if (region === null) return [];
  const current = ROAD_RANK[entry.band];
  if (current === undefined) return [];
  const options: BedOption[] = [];
  for (const unit of units) {
    if (unit.cohort !== entry.unit.cohort || unit.id === entry.unit.id) continue;
    const band = travelBand(region, unit.siteCode);
    const rank = band === undefined ? undefined : ROAD_RANK[band];
    if (band === undefined || rank === undefined || rank >= current) continue;
    options.push(bedOption(unit, band, now));
  }
  return options.sort(
    (a, b) => (ROAD_RANK[a.band] ?? 0) - (ROAD_RANK[b.band] ?? 0) || a.unit.name.localeCompare(b.unit.name, "en-AU"),
  );
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
      // Asked of `travelBand` site by site: only ward-distance.ts reads the band fixture.
      const recorded = siteDirectory
        .map((site): [string, TravelBand | undefined] => [site.code, travelBand(region, site.code)])
        .filter((pair): pair is [string, TravelBand] => pair[1] !== undefined);
      // The shortest road band recorded, or the air only sites when a region has no road band.
      const road = recorded.filter(([, band]) => ROAD_RANK[band] !== undefined);
      const best = road.length ? Math.min(...road.map(([, band]) => ROAD_RANK[band] as number)) : undefined;
      const pool = road.length ? road.filter(([, band]) => ROAD_RANK[band] === best) : recorded;
      const sites = pool.map(([code]) => code);
      const band = pool[0]?.[1];
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
  return `${formatInstantWithDay(currentShiftStart(now), now)} to now`;
}

/** Whether a recorded return departs on today's calendar day. */
export function leavesToday(record: RepatriationRecord, now: Instant): boolean {
  return record.estimatedAt !== undefined && dayOf(record.estimatedAt) === dayOf(now);
}

/** A night shift runs past midnight, so a departure can fall yesterday as well as today or tomorrow. */
export function departureDayLabel(record: RepatriationRecord, now: Instant): string {
  if (record.estimatedAt === undefined) return DEPART_TIME_NOT_RECORDED;
  const offset = dayOf(record.estimatedAt) - dayOf(now);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  return offset < 0 ? `${-offset} days ago` : `In ${offset} days`;
}

/** The most recent bed meeting at or before `now` (today's, or yesterday's before it starts). */
export function lastBedMeetingAt(now: Instant): Instant {
  return now - ((minuteOfDay(now) - BED_MEETING_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

export type BedMeetingComparison = {
  /** When the meeting was, on the session clock. */
  at: Instant;
  /** People away from home at the meeting. */
  away: number;
  /** Of them, people whose recorded discharge date had already passed then. */
  passed: number;
};

/**
 * "Since the 08:30 bed meeting" (v10 delta twins), derived from the records, never from a stored
 * snapshot: the ledger as it stood at the meeting. A person counts when they had arrived by then
 * and were still in the bed, either now or until a recorded leaving after the meeting. A stay with
 * no recorded leaving time is not counted back, so the figure never guesses.
 */
export function bedMeetingComparison(admissions: Admission[], units: Unit[], now: Instant): BedMeetingComparison {
  const at = lastBedMeetingAt(now);
  const thenInBed: Admission[] = [];
  for (const admission of admissions) {
    if (admission.arrivedAt === null || !Number.isFinite(admission.arrivedAt) || admission.arrivedAt > at) continue;
    const stillIn = bedIsOccupied(admission);
    const leftAfter =
      admission.state === "departed" &&
      admission.leftAt !== null &&
      Number.isFinite(admission.leftAt) &&
      admission.leftAt > at;
    if (!stillIn && !leftAfter) continue;
    thenInBed.push(stillIn ? admission : { ...admission, state: "occupied" });
  }
  const { entries } = outOfAreaLedger(thenInBed, units, at);
  const passed = entries.filter((entry) => {
    const offset = dischargeOffsetDays(entry, at);
    return offset !== null && offset < 0;
  }).length;
  return { at, away: entries.length, passed };
}

/** Prefer the newest open return; retain the latest closed return for its recorded outcome. */
export function currentReturnMovement(movements: readonly Movement[], admissionId: string): Movement | undefined {
  return movements
    .filter((movement) => movement.sourceAdmissionId === admissionId)
    .reduce<Movement | undefined>((current, movement) => {
      if (!current) return movement;
      if (Boolean(current.closure) !== Boolean(movement.closure)) return movement.closure ? current : movement;
      return movement.openedAt > current.openedAt ? movement : current;
    }, undefined);
}
