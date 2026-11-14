import {
  barrierCategory,
  barrierLabel,
  groupDischarges,
} from "@/components/ward-management/discharges/discharge-board-model";
import { delayGroups, type DelayCause } from "@/components/ward-management/delays/delays-derivations";
import { edOpenSummaries, elapsedOpenMinutes } from "@/components/ward-management/ed/ed-home-derivations";
import type { ReservationReferral } from "@/components/ward-management/ward-bed-states";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { dayOf, type DueSoonThresholds, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isFreeingToday } from "@/components/ward-management/ward-shared-figures";
import type {
  BedRelease,
  HealthService,
  LeaveBed,
  Movement,
  Referral,
  Unit,
} from "@/components/ward-management/ward-model";
import { stuckReferralsByPlace, type NoReplyByPlace } from "@/components/ward-management/referrals/referral-no-reply";
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import {
  edHealthService,
  movementBelongsToService,
  unitHealthService,
} from "@/components/ward-management/ward-service-scope";

import {
  bedKindGaps,
  bedKindTotals,
  bedsFreeingTodayTotal,
  networkServiceGroupTotals,
  networkWardRows,
  type BedKindId,
} from "./capacity-derivations";

/**
 * THE MORNING BED-MEETING SHEET — one printed page for the meeting where the day's flow is decided:
 * today's capacity, expected discharges, people waiting in an emergency department, and the top
 * delays.
 *
 * **It re-derives nothing.** Every figure comes from the selector that already owns it on its own
 * screen — `networkWardRows`/`networkServiceGroupTotals` (Capacity), `groupDischarges`
 * (Discharges), `edOpenSummaries` (ED home) and `delayGroups` (Delays) — so the paper and the
 * screens cannot disagree. This module only narrows those answers to the chosen service, picks
 * the few rows that fit on one page, and counts what it left off so nothing is dropped silently.
 *
 * It lives beside Capacity rather than on its own route because the Morning screen was retired
 * into Capacity (OA-41). The 24-hour wait is Josh's own default (D-24), never a limit.
 */

/** How many named rows each section prints before it says "and N more". One A4 page is the brief. */
export const BED_MEETING_ROW_LIMIT = 6;

export type BedMeetingCapacity = {
  wards: number;
  beds: number;
  occupied: number;
  ready: number;
  lockedReady: number;
  pulled: number;
  closed: number;
  /** `undefined` when no ward reports it — never a misleading zero. */
  pendingPreparation: number | undefined;
};

export type BedMeetingDischargeRow = {
  id: string;
  ward: string;
  status: "Held up" | "Confirmed" | "Expected";
  note: string | null;
};

export type BedMeetingDischarges = {
  heldUp: number;
  confirmed: number;
  expected: number;
  dischargedToday: number;
  /** Beds due out today only, from the hero's own source (`bedsFreeingTodayTotal`). */
  freeingToday: number;
  /**
   * Held up among the rows due out today (`todayRows`). Not printed as a "held up" figure: held up
   * on every screen is `heldUp`, due by tomorrow (D-191 item 5); this only checks the today rows.
   */
  heldUpToday: number;
  /** Releases expected two or more days ahead — left out of today's figures, and said so. */
  beyondToday: number;
  /** Held up first, then confirmed, then expected — the same order the Discharges board reads. */
  rows: BedMeetingDischargeRow[];
  moreRows: number;
  /**
   * The rows due today only, the same day span as `freeingToday` and `heldUpToday`, for the
   * on-screen sheet whose headline is "Beds freeing today" (#1470 review).
   */
  todayRows: BedMeetingDischargeRow[];
  moreTodayRows: number;
  /**
   * Wave 4 (C8, D-191): the held-up releases due by tomorrow (overdue, today and tomorrow, the
   * `heldUp` count's own span), by ward with Discharges' short reason words and the due time. No
   * patient names: the list is printed.
   */
  heldUpRows: BedMeetingHeldUpRow[];
  moreHeldUpRows: number;
};

type BedMeetingHeldUpRow = { id: string; ward: string; reason: string; dueAt: Instant };

/**
 * The hero's "short" figure (`bedKindGaps` and `bedKindTotals`, as Capacity's hero reads them), so
 * the sheet says the same number. Network-wide, as Capacity's own band is.
 */
type BedMeetingShort = {
  /** `bedsThatFit - waiting` over every bed type; negative is short. */
  gap: number;
  /** People still needing a bed ("Need a bed"). */
  waiting: number;
  /** The bed types with a bed to spare, in band order. */
  spare: { id: BedKindId; need: string; count: number }[];
};

type BedMeetingEdRow = {
  id: string;
  department: string;
  waiting: number;
  longestWaitMinutes: number;
  detained: number;
};

type BedMeetingEdPerson = { id: string; name: string; department: string; waitMinutes: number };

type BedMeetingEd = {
  waiting: number;
  detained: number;
  /** Waiting longer than `LONG_WAIT_MINUTES` — Josh's default (D-24), not a legal limit. */
  overLongWait: number;
  departments: BedMeetingEdRow[];
  longestWaits: BedMeetingEdPerson[];
  morePeople: number;
};

/** The coordinator cause as a shared screen says it: "you" means nobody in a meeting room. */
const SHARED_COORDINATOR_CAUSE_TITLE = "Waiting on the bed coordinator";

type BedMeetingDelayRow = { cause: DelayCause; title: string; count: number; longestWaitMinutes: number };

type BedMeetingDelays = {
  /** Every open movement that sits in a delay group. */
  total: number;
  /** Worst cause first — `delayGroups`' own ranking, never re-sorted here. */
  groups: BedMeetingDelayRow[];
};

/** One person in the sheet's single "Waiting longest" list: where they are and what holds them. */
type BedMeetingWaitingPerson = { id: string; name: string; department?: string; cause?: string; waitMinutes: number };

export type BedMeetingSheet = {
  service: HealthService | null;
  /** The agenda's group filter in words, when the people lists are narrowed to it. */
  peopleFilter?: string;
  capacity: BedMeetingCapacity;
  short: BedMeetingShort;
  discharges: BedMeetingDischarges;
  ed: BedMeetingEd;
  delays: BedMeetingDelays;
  /** Polish (Josh, 3 Nov 2026): the ED and delay people lists as one, each person once. */
  waitingLongest: { people: BedMeetingWaitingPerson[]; morePeople: number };
  /**
   * Referrals with no reply recorded past the Settings time limit, one line per ward or service
   * (item 17). Counts and times only. `undefined` when the caller passed no referrals.
   */
  stuckReferrals?: { limitMinutes: number; places: NoReplyByPlace[]; morePlaces: number };
};

export type BedMeetingInput = {
  units: Unit[];
  movements: Movement[];
  bedReleases: BedRelease[];
  admissions: Admission[];
  leaveBeds: LeaveBed[];
  now: Instant;
  /** The due-time warnings Settings sets (`useDueSoonThresholds`). */
  thresholds: DueSoonThresholds;
  /** The service scope chosen on Capacity; `null` is all services. */
  service: HealthService | null;
  /** Resolves a movement to the patient's display name — the screen's own resolver. */
  nameOf: (movement: Movement) => string;
  /** Waiting referrals and the "Referral decision" time limit; both or neither. */
  referrals?: readonly Referral[];
  referralLimitMinutes?: number;
  /**
   * WF-FIG-017: every journey and referral that may hold a named bed, unfiltered, so the bed
   * figures stay whole when `movements`/`referrals` are narrowed. Defaults to those two lists.
   */
  namedHolds?: readonly ReservationReferral[];
  /**
   * B1 extended (Josh, 4 Nov 2026): the agenda's group filter in words ("Tier 1, Involuntary"),
   * when the caller has already narrowed `movements` and `referrals` to it. Bed figures stay whole.
   */
  peopleFilter?: string;
};

/** Longest first, then by id so two prints of the same picture never reshuffle. */
function byWaitThenId<T extends { waitMinutes: number; id: string }>(a: T, b: T): number {
  return b.waitMinutes - a.waitMinutes || a.id.localeCompare(b.id);
}

export function bedMeetingSheet(input: BedMeetingInput): BedMeetingSheet {
  const { units, movements, bedReleases, admissions, leaveBeds, now, thresholds, service, nameOf } = input;

  const scopedUnits = service === null ? units : units.filter((unit) => unitHealthService(unit) === service);
  const scopedUnitIds = new Set(scopedUnits.map((unit) => unit.id));
  const scopedReleases = bedReleases.filter((release) => scopedUnitIds.has(release.unitId));
  const scopedMovements =
    service === null ? movements : movements.filter((movement) => movementBelongsToService(movement, service, units));

  // Capacity — the same rows and the same group totals the Capacity screen renders.
  // WF-FIG-017: named holds (journeys and referrals) are held, not Ready, as on Capacity.
  const rows = networkWardRows(
    scopedUnits,
    now,
    scopedReleases,
    admissions,
    leaveBeds,
    input.namedHolds ?? [...movements, ...(input.referrals ?? [])],
  );
  const totals = networkServiceGroupTotals(rows);
  const tracked = rows.map((row) => row.pendingPreparation).filter((value): value is number => value !== undefined);
  const capacity: BedMeetingCapacity = {
    wards: totals.wards,
    beds: rows.reduce((sum, row) => sum + row.unit.beds, 0),
    occupied: totals.occupied,
    ready: totals.ready,
    lockedReady: totals.lockedReady,
    pulled: totals.pulled,
    closed: totals.closed,
    pendingPreparation: tracked.length === 0 ? undefined : tracked.reduce((sum, value) => sum + value, 0),
  };

  // Discharges — the Discharges board's own grouping.
  const unitName = (unitId: string) => wardLabel(unitId, units.find((unit) => unit.id === unitId)?.name);
  const groups = groupDischarges(scopedReleases, now);
  // A16-05: "due today" is the shared `isFreeingToday` rule, the same span as `freeingToday`, so the
  // sheet's today rows and its "held up" subcount never take in a date that has already passed.
  const dueToday = (release: BedRelease) => isFreeingToday(release, now);
  const orderedReleases: { release: BedRelease; row: BedMeetingDischargeRow }[] = [
    ...groups.blocked.map((release) => ({
      release,
      row: { id: release.id, ward: unitName(release.unitId), status: "Held up" as const, note: release.blocker },
    })),
    ...groups.confirmed.map((release) => ({
      release,
      row: { id: release.id, ward: unitName(release.unitId), status: "Confirmed" as const, note: null },
    })),
    ...groups.expected.map((release) => ({
      release,
      row: {
        id: release.id,
        ward: unitName(release.unitId),
        status: "Expected" as const,
        note: release.waitingOn ?? null,
      },
    })),
  ];
  const dischargeRows = orderedReleases.map(({ row }) => row);
  // Held up first by due time (oldest first), then ward, so two prints never reshuffle.
  const heldUpRows = [...groups.blocked]
    .sort((a, b) => a.expectedAt - b.expectedAt || unitName(a.unitId).localeCompare(unitName(b.unitId)))
    .map((release) => ({
      id: release.id,
      ward: unitName(release.unitId),
      reason: barrierLabel(barrierCategory(release.blocker ?? "")),
      dueAt: release.expectedAt,
    }));
  const todayDischargeRows = orderedReleases.filter(({ release }) => dueToday(release)).map(({ row }) => row);
  const discharges: BedMeetingDischarges = {
    heldUp: groups.blocked.length,
    confirmed: groups.confirmed.length,
    expected: groups.expected.length,
    // NA3-04 (audit 26 Oct 2026): "discharged today" is the Perth calendar day, as Statistics and
    // Tools count it (left the ward on today's date). The board's discharged group is a rolling 24
    // hours of releases, so the printed sheet read 4 where those screens read 2.
    dischargedToday: admissions.filter(
      (admission) =>
        scopedUnitIds.has(admission.unitId) && admission.leftAt !== null && dayOf(admission.leftAt) === dayOf(now),
    ).length,
    beyondToday: groups.excludedBeyondToday,
    freeingToday: bedsFreeingTodayTotal(scopedReleases, now, scopedUnitIds) ?? 0,
    heldUpToday: scopedReleases.filter((release) => release.blocker !== null && dueToday(release)).length,
    rows: dischargeRows.slice(0, BED_MEETING_ROW_LIMIT),
    moreRows: Math.max(0, dischargeRows.length - BED_MEETING_ROW_LIMIT),
    todayRows: todayDischargeRows.slice(0, BED_MEETING_ROW_LIMIT),
    moreTodayRows: Math.max(0, todayDischargeRows.length - BED_MEETING_ROW_LIMIT),
    heldUpRows: heldUpRows.slice(0, BED_MEETING_ROW_LIMIT),
    moreHeldUpRows: Math.max(0, heldUpRows.length - BED_MEETING_ROW_LIMIT),
  };

  // Short — Capacity's hero selector, unchanged, over the whole network as Capacity's band reads it.
  const kinds = bedKindGaps(movements, units, now, admissions, input.referrals ?? [], bedReleases);
  const kindTotals = bedKindTotals(kinds);
  const short: BedMeetingShort = {
    gap: kindTotals.gap,
    waiting: kindTotals.waiting,
    spare: kinds.filter((kind) => kind.gap > 0).map((kind) => ({ id: kind.id, need: kind.need, count: kind.gap })),
  };

  // Emergency departments — the ED home's own per-department summaries, narrowed to the service.
  const edSummaries = edOpenSummaries(movements, now).filter(
    (summary) => summary.waiting > 0 && (service === null || edHealthService(summary.ed.id) === service),
  );
  const edPeople = edSummaries
    .flatMap((summary) =>
      summary.open.map((movement) => ({
        id: movement.id,
        name: nameOf(movement),
        department: summary.ed.name,
        waitMinutes: elapsedOpenMinutes(movement, now),
      })),
    )
    .sort(byWaitThenId);
  const ed: BedMeetingEd = {
    waiting: edSummaries.reduce((sum, summary) => sum + summary.waiting, 0),
    detained: edSummaries.reduce((sum, summary) => sum + summary.detained, 0),
    // Audit 6 (Josh, 20 Oct 2026): "over 24h" is 24 hours or more, as Waiting counts it.
    overLongWait: edPeople.filter((person) => person.waitMinutes >= LONG_WAIT_MINUTES).length,
    departments: [...edSummaries]
      .sort(
        (a, b) =>
          b.waiting - a.waiting || b.longestWaitMinutes - a.longestWaitMinutes || a.ed.id.localeCompare(b.ed.id),
      )
      .map((summary) => ({
        id: summary.ed.id,
        department: summary.ed.name,
        waiting: summary.waiting,
        longestWaitMinutes: summary.longestWaitMinutes,
        detained: summary.detained,
      })),
    longestWaits: edPeople.slice(0, BED_MEETING_ROW_LIMIT),
    morePeople: Math.max(0, edPeople.length - BED_MEETING_ROW_LIMIT),
  };

  // Delays — the Delays screen's own causes, worst first. The sheet and TV are read by a room, so
  // "Waiting on you" names whose desk it is instead (UX audit, 21 Oct 2026).
  const delayed = delayGroups(scopedMovements.filter(isOpen), units, now, thresholds).map((group) =>
    group.cause === "awaiting_coordinator" ? { ...group, title: SHARED_COORDINATOR_CAUSE_TITLE } : group,
  );
  const delayPeople = delayed
    .flatMap((group) =>
      group.movements.map((movement) => ({
        id: movement.id,
        name: nameOf(movement),
        cause: group.title,
        waitMinutes: elapsedOpenMinutes(movement, now),
      })),
    )
    .sort(byWaitThenId);
  const delays: BedMeetingDelays = {
    total: delayPeople.length,
    groups: delayed.map((group) => ({
      cause: group.cause,
      title: group.title,
      count: group.movements.length,
      longestWaitMinutes: Math.max(...group.movements.map((movement) => elapsedOpenMinutes(movement, now))),
    })),
  };

  // Stuck referrals — a ward place counts in its own service; a non-ward place only in "All services".
  let stuckReferrals: BedMeetingSheet["stuckReferrals"];
  if (input.referrals !== undefined && input.referralLimitMinutes !== undefined) {
    const limitMinutes = input.referralLimitMinutes;
    const places = stuckReferralsByPlace(
      input.referrals,
      now,
      { referralDecisionTargetMinutes: limitMinutes },
      units,
      (wait) => service === null || (wait.unitId !== undefined && scopedUnitIds.has(wait.unitId)),
    );
    stuckReferrals = {
      limitMinutes,
      places: places.slice(0, BED_MEETING_ROW_LIMIT),
      morePlaces: Math.max(0, places.length - BED_MEETING_ROW_LIMIT),
    };
  }

  const waitingById = new Map<string, BedMeetingWaitingPerson>();
  for (const person of edPeople) waitingById.set(person.id, { ...person });
  for (const person of delayPeople) {
    const known = waitingById.get(person.id);
    waitingById.set(person.id, known ? { ...known, cause: person.cause } : { ...person });
  }
  const waitingPeople = [...waitingById.values()].sort(byWaitThenId);
  const waitingLongest = {
    people: waitingPeople.slice(0, BED_MEETING_ROW_LIMIT),
    morePeople: Math.max(0, waitingPeople.length - BED_MEETING_ROW_LIMIT),
  };

  return {
    service,
    ...(input.peopleFilter ? { peopleFilter: input.peopleFilter } : {}),
    capacity,
    short,
    discharges,
    ed,
    delays,
    waitingLongest,
    ...(stuckReferrals ? { stuckReferrals } : {}),
  };
}
