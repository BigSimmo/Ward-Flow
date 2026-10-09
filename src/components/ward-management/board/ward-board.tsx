"use client";

import Link from "next/link";
import { Field, Select, TextInput } from "@/components/wf";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  LEAVING_DESTINATIONS,
  stayBand,
  stayDayNumber,
  STAY_BANDS,
  DISCHARGE_BARRIERS,
  type Admission,
  type LeavingDestination,
  type StayBandId,
  type DischargeBarrier,
} from "@/components/ward-management/ward-admissions";
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { tentativeDiagnosisPhrase } from "@/components/ward-management/ward-diagnosis";
import {
  bedsPendingPreparation,
  capacityBreakdown,
  releaseBand,
  type ReleaseBand,
} from "@/components/ward-management/ward-bed-availability";
import {
  ARROW_HORIZON_DAYS,
  arrowTargets,
  constraintSentence,
  headlineAvailable,
  sinceYesterday,
} from "@/components/ward-management/ward-board-derivations";
import { calendarDateOf, minuteOfDay, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import type {
  BedRelease,
  HomeRegion,
  Movement,
  RecordedSex,
  ReferralGender,
  Site,
  Unit,
} from "@/components/ward-management/ward-model";
import { CAPACITY_FIGURE_LABELS } from "@/components/ward-management/ward-morning-rollup";
import { unitHref, wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { wardSites } from "@/components/ward-management/ward-sites";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";

import { parseReleaseDayInstant } from "@/components/ward-management/ward/release-day";

import { asAtStamp, WardDailySheet } from "./ward-daily-sheet";
import { StrandedPrompts } from "./stranded-prompts";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./board.module.css";

/**
 * The ward board, first pass: one ward's beds on a screen.
 *
 * **The deliverable is the rendered page, not the test.** This pass is deliberately the ugly
 * version — one component, one stylesheet, no decomposition — because every defect that has
 * reached a screen in this feature was found by rendering it and looking, and none of them were
 * found by a test. Polish is a later pass; being LOOKABLE is this one.
 *
 * Three rules govern what is below, each of which this prototype has broken before:
 *
 *   1. **Colour never carries a fact alone.** The stay band sets a fill shade, and the day count
 *      is printed on the same tile in text. The number IS the band (the bands are ranges of that
 *      one number), so a greyscale print, a colour-blind reader, or forced-colors mode loses
 *      nothing. The same applies to the past-expected-date marker: a heavy outline AND the words
 *      "past date".
 *   2. **A pulled-but-not-arrived bed is OCCUPIED.** The ward gave the bed away at the pull; the
 *      person may still be in an emergency department. `bedIsOccupied` already says so and this
 *      component must never re-decide it — such a tile renders as taken, reading "empty, waiting"
 *      instead of a day count, and is never drawn as a free bed.
 *   3. **No figure from the Mental Health Act, and no free text about anybody.** Every word on a
 *      tile comes from `STAY_BANDS` (the product owner's four, verbatim) or from a day count.
 *      Nothing here is a threshold, a target, or a legal clock.
 *
 * **It reads the shared ward-flow provider, like every other screen.** Owner decision 2026-09-01,
 * restoring DB-11 (2026-08-29, "the frozen view is dropped, everything is live") which a later
 * fixed-board decision had contradicted while both sat in this file at once.
 *
 * The refusal recorded here previously was that making the board live means re-anchoring the
 * admissions fixture, and `shiftInstants` is not idempotent — a second applier would double every
 * stay length, so nine days in a bed would read as eighteen. **Taking the provider's state is
 * precisely what avoids that**, rather than what risks it: `seedWardFlowStateAt` is the only door,
 * it seeds and shifts in ONE step, and `state.admissions` is therefore shifted exactly once. This
 * board now consumes an already-correct list instead of applying a second offset of its own.
 */

/** The four band fills, in `STAY_BANDS` order. One hue, four deepening steps — see the
 *  `--wb-band-*` tokens in `board.module.css`. Keyed by band id rather than by array index so a
 *  reordering of `STAY_BANDS` cannot silently re-map a shade onto the wrong band. */
const BAND_CLASS: Record<StayBandId, string> = {
  "under-2-weeks": styles.band1,
  "2-weeks-1-month": styles.band2,
  "1-3-months": styles.band3,
  "over-3-months": styles.band4,
};

type Tile =
  | {
      kind: "occupied";
      key: string;
      days: number;
      bandId: StayBandId | null;
      bandLabel: string;
      pastDate: boolean;
      /**
       * Whether this person is currently at an emergency department. **On the TILE, not only in
       * the person panel** — added 2026-08-30 after looking at the rendered board, where the panel
       * carrying this marker is `display: none` at desktop width. The marker existed, every
       * assertion passed, and a charge nurse scanning the grid saw nothing: jsdom applies no
       * stylesheet, so a DOM query finds an element CSS has hidden.
       *
       * The grid is what a ward reads. A fact that only appears once somebody clicks the right
       * bed is not on the board.
       */
      awayAtEd: boolean;
      who?: string;
    }
  | { kind: "waiting"; key: string }
  | { kind: "blocked"; key: string }
  | { kind: "closed"; key: string }
  | { kind: "empty"; key: string };

const BOARD_FILTERS = ["all", "look", "ready", "quiet"] as const;
type BoardFilter = (typeof BOARD_FILTERS)[number];

const BOARD_FILTER_LABELS: Record<BoardFilter, string> = {
  all: "All beds",
  look: "Needs a look",
  ready: "Ready",
  quiet: "Nobody due out",
};

const BOARD_ORDERS = ["stay", "leaving", "recorded"] as const;
type BoardOrder = (typeof BOARD_ORDERS)[number];

const BOARD_ORDER_LABELS: Record<BoardOrder, string> = {
  stay: "Longest stay first",
  leaving: "Soonest to leave first",
  recorded: "Recorded order",
};

const BOARD_ORDER_NOTES: Record<BoardOrder, string> = {
  stay: "Longest stay first; beds without a recorded stay follow recorded order.",
  leaving: "Soonest expected out first; beds without an expected date follow recorded order.",
  recorded: "Recorded source order; this does not identify bed locations.",
};

const FLOW_TABS = ["outgoing", "incoming", "since"] as const;
type FlowTab = (typeof FLOW_TABS)[number];

/**
 * Where a unit's own record lives.
 *
 * ⚠️ **The UNIT comes from live state; only the SITE comes from `wardSites`.** That split is the
 * whole fix for the board disagreeing with the ward screen. A unit's capacity fields are mutated by
 * the reducer on a structural clone (`PULL_PATIENT`, `RECORD_ARRIVAL`, `CONFIRM_CAPACITY`), and
 * `wardSites` is the un-mutated seed that no reducer path ever writes — so reading the unit from
 * there produced a permanently seed-valued `held` while the ward screen moved.
 *
 * The site is different in kind: name and code are static reference data, not state, and no event
 * changes them. It is still resolved by walking `wardSites` rather than through `unitById`, which
 * `tests/ward-flow-single-source.test.ts` restricts to three named fixture files.
 *
 * Returns `undefined` for an unknown id and never falls back to a different ward.
 */
function findUnit(unitId: string, liveUnits: readonly Unit[]): { unit: Unit; site: Site } | undefined {
  const unit = liveUnits.find((candidate) => candidate.id === unitId);
  if (unit === undefined) return undefined;
  for (const site of wardSites) {
    if (site.units.some((candidate) => candidate.id === unitId)) return { unit, site };
  }
  return undefined;
}

/**
 * One tile per bed, in `unit.beds` of them.
 *
 * A unit's beds divide into the ruled four (`ward-bed-states.ts`): **occupied**, **pulled** — drawn
 * as the "waiting" tile: the ward gave the bed away and the person may still be in an emergency
 * department — **closed** (physically empty, but the ward is not offering it), and **ready** —
 * drawn as the plain "empty" tile, because that is the bed a coordinator can fill right now. The
 * out-of-service **blocked** tiles are kept as their own kind, but the count is 0 on every unit
 * (owner ruling 2026-09-25) and is folded into Closed wherever the four are counted. Tiles are laid
 * out occupied/pulled, then blocked, then closed, then ready, and they add up to `unit.beds`.
 *
 * **The blocked tiles are the fix for a defect found by rendering this page and looking at it.**
 * The first pass knew only occupied and empty, so it drew `beds − occupied` empty tiles and every
 * out-of-service bed appeared as one a coordinator could fill. On `fsh-adult-secure` that put four
 * fillable-looking tiles under a header saying three beds free — both figures correct, and the
 * board contradicting itself on screen. No test caught it; `tests/ward-board-consistency.test.ts`
 * was written afterwards and pins the arithmetic across all 23 units.
 *
 * **The closed tiles (once called "held") are the same class of fix, for a different unit.** On
 * `rph-adult-secure` the header already said "1 bed you can fill today" (`headlineAvailable`, `min(allocatable, empty)`
 * = `min(1, 2)`), but the first pass still drew BOTH physically-empty beds as plain "Empty" tiles —
 * the header and the grid disagreeing about how many beds a coordinator can actually take someone
 * to. **Closed is not invented here**: `bedStates` (`ward-bed-states.ts`) already partitions every
 * unit into Ready · Pulled · Closed · Occupied, and is the same function the ward screen reads for
 * its own figures — this board reads its `closed` count rather than re-deriving a second,
 * possibly-drifting version of the same split. ⚠️ Reading `unitCapacity().held` here, as this board
 * once did, drew a live pull twice: once as its "waiting" tile and again as an unoffered empty bed.
 *
 * **Which tile is blocked or closed is NOT knowable and is not invented.** `Unit.blocked` is a COUNT
 * and Closed is derived from more counts (`unit.allocatable.value`,
 * `unit.empty.value`) — the model holds no per-bed record and no admission carries a bed number —
 * so these are drawn purely because they have to be drawn somewhere. The claim being made on
 * screen is "this many of this ward's beds are out of service" / "this many are empty but not yet
 * offered", which is exactly what the data supports, and nothing on either tile identifies a
 * particular bed. That is the same discipline the tiles already hold for bed numbering: `unit.beds`
 * tiles in a grid, none of them a bed anybody could name.
 *
 * The tiles carry NO bed identity: an `Admission` records the unit, never a bed number, so
 * numbering these "Bed 1..20" would invent an identity nothing in the model holds and a ward would
 * read it as real. They are a count of beds, in a grid, and nothing more.
 *
 * If a unit somehow holds more occupants than it has beds, every occupant is still drawn — the
 * over-count is the fact worth seeing, and truncating the list to `unit.beds` would hide exactly
 * the people a double-allocation put there. The blocked tiles are drawn in that case too: beds out
 * of service do not stop being out of service because the ward is over-full, and the closed/ready
 * counts floor at zero rather than going negative and cancelling them out.
 */
function buildTiles(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  now: Instant,
): Tile[] {
  const occupants = admissionsForUnit(admissions, unit.id).filter(bedIsOccupied);

  const tiles: Tile[] = occupants.map((admission) => {
    const days = daysInBed(admission, now);
    // Rule 2. `daysInBed` is null for a pulled bed nobody has reached yet — the bed is gone, the
    // stay has not started. Never an empty tile, and never a zero-day stay.
    if (days === null) return { kind: "waiting", key: admission.id };
    const band = stayBand(admission, now);
    return {
      kind: "occupied",
      key: admission.id,
      days,
      bandId: band?.id ?? null,
      bandLabel: band?.label ?? "Stay not banded",
      pastDate: isPastExpectedDischarge(admission, now),
      awayAtEd: admission.awayAtEmergencyDepartmentSince !== null,
    };
  });

  // Guarded against a negative or non-integer count in the fixture rather than trusted: a bad
  // `blocked` would otherwise either throw the loop or silently draw nothing.
  const blockedCount = Math.max(0, Math.floor(unit.blocked));
  for (let index = 0; index < blockedCount; index += 1) {
    tiles.push({ kind: "blocked", key: `blocked-${index}` });
  }

  // Derived by subtraction, NOT read from `unit.empty.value`. The two agree on every seeded unit
  // (that is what the consistency test pins), but the tiles must add up to the beds even if a
  // future feed disagrees with itself — a grid that silently drew a different number of tiles
  // than the ward has beds is a worse failure than one that shows the shortfall as empty.
  const emptyPoolCount = Math.max(0, unit.beds - occupants.length - blockedCount);

  // `bedStates`'s `closed` comes from `unit.allocatable.value`/`unit.empty.value`, not from this
  // function's own admissions-derived `emptyPoolCount` above — so it is clamped into that pool
  // exactly as `blockedCount` already is, in case a future feed disagrees with itself. A closed
  // count that overshot the physically-empty pool would otherwise draw more tiles than the ward has
  // beds, which is the same failure class `blockedCount`'s own guard exists to prevent. Leave beds
  // are passed empty: they only feed the On leave marker, never a tile count.
  const closedCount = Math.max(
    0,
    Math.min(Math.floor(bedStates(unit, admissions, [...bedReleases], []).closed), emptyPoolCount),
  );
  for (let index = 0; index < closedCount; index += 1) {
    tiles.push({ kind: "closed", key: `closed-${index}` });
  }

  const emptyCount = Math.max(0, emptyPoolCount - closedCount);
  for (let index = 0; index < emptyCount; index += 1) {
    tiles.push({ kind: "empty", key: `empty-${index}` });
  }
  return tiles;
}

/**
 * One person in one of this ward's beds, as the right-hand panel states them.
 *
 * Every field is copied from the `Admission` or derived from it by an existing helper. Nothing
 * here is looked up, defaulted, or filled in: an absent fact arrives as `null` and is RENDERED as
 * absent, which is the same discipline `isPastExpectedDischarge` and `derivedBedReleases` already
 * hold to a few files away.
 */
type Occupant = {
  key: string;
  /** Whole days in the bed, or `null` for a bed given away to somebody who has not arrived.
   *  A DURATION. The tile renders it as "N days"; it is 0 for everybody admitted since yesterday. */
  days: number | null;
  /** Which day of the stay today is, arrival day = Day 1, or `null` when there is no stay.
   *  An ORDINAL, and the only thing the handover sheet's "Day N" lead may use. Carried separately
   *  from `days` because printing the duration there read "Day 0" — see `stayDayNumber`. */
  dayNumber: number | null;
  /** The stay band's own label, or `null` when there is no stay to band. */
  bandLabel: string | null;
  pastDate: boolean;
  sex: RecordedSex;
  /** Owner answer 2026-09-25 (R7, Q2): gender identity, shown beside sex. Absent = not recorded. */
  gender?: ReferralGender;
  /** `null` for an admission created by an ED arrival: Task 17, 2026-08-30. The fact does not
   *  exist on a movement and the owner has an open ruling on whether suburb or region is recorded,
   *  so the board says so rather than guessing or hiding the person. */
  homeRegion: HomeRegion | null;
  /**
   * The tentative diagnosis AS IT READS — words and block code together, from
   * `tentativeDiagnosisPhrase` — or `null` where the record holds none.
   *
   * Carried already-phrased rather than as the bare code, so this component never assembles its own
   * wording and the one renderer in `ward-admissions.ts` is the only place a block turns into a
   * sentence. A bare "F30–F39" on a ward board would be a string a reader cannot check.
   */
  tentativeDiagnosis: string | null;
  /**
   * Whole hours this person has been away at an emergency department, or `null` while they are on
   * the ward. Rounded down, and floored at zero so a clock nudged backwards cannot print "-1
   * hours".
   *
   * **The bed is still theirs and nothing here says otherwise.** This is a fact about where the
   * person is, not about the bed: the tile still draws as occupied, the stay still counts, and no
   * capacity figure reads it.
   */
  awayAtEdHours: number | null;
  /** Whole days from `now` to the ward's own expected date — NEGATIVE when it has passed, `null`
   *  when nobody has set one. */
  expectedDays: number | null;
  dischargeDateMoves: number;
  dischargeDateSetBy: string | null;
  confirmed: boolean;
  dischargeConfirmedBy: string | null;
  blockReason: string | null;
  admissionId: string;
  dischargeBarrier: DischargeBarrier | null;
  stepDownCandidate: boolean;
};

/** The expected date, or `null` for both of the ways it can be missing — unset, and unusable.
 *  A non-finite instant is exactly as absent as a null one; neither may become a date on screen. */
function expectedInstant(admission: Admission): Instant | null {
  const expected = admission.expectedDischargeAt;
  return expected === null || !Number.isFinite(expected) ? null : expected;
}

/** HTML time inputs accept HH:mm only; the editor stores and saves the departure day separately. */
function departureTimeInputValue(instant: Instant): string {
  const clockMinutes = minuteOfDay(instant);
  return `${String(Math.floor(clockMinutes / 60)).padStart(2, "0")}:${String(clockMinutes % 60).padStart(2, "0")}`;
}

/**
 * Whole days from `now` to the ward's own expected date, or `null` when there is none.
 *
 * The same `Math.floor((expected - now) / MINUTES_PER_DAY)` `arrowTargets` uses, deliberately
 * WITHOUT its floor at zero. That floor is right there — the destinations panel groups people by
 * how soon the nearest one leaves, and a negative "soonest" is meaningless in an ordering — and it
 * would be wrong here, where the sign is the fact: this panel distinguishes a date still ahead
 * from one already passed, and clamping would silently present every passed date as "under a day
 * away". The two panels therefore agree on magnitude and differ only where they are documented to.
 */
function daysUntilExpected(admission: Admission, now: Instant): number | null {
  const expected = expectedInstant(admission);
  if (expected === null || !Number.isFinite(now)) return null;
  return Math.floor((expected - now) / MINUTES_PER_DAY);
}

/**
 * Who is in this ward's beds, soonest expected out first.
 *
 * **Scoped with `admissionsForUnit(admissions, unit.id)` and filtered with `bedIsOccupied` — the
 * same two calls `buildTiles` makes**, so the panel and the grid are looking at one set of people
 * and can never disagree about who is in a bed. That is not a stylistic preference: the sibling
 * destinations panel shipped earlier today reading `admissions` unscoped, and offered "Kimberley
 * 28 people" on a twenty-bed ward. Its derivation was correct and all nine of its assertions
 * passed; the defect was in the CALL, where no test of that derivation could see it. The check
 * that catches this class is arithmetic a ward can do in its head — these rows plus the empty,
 * closed and out-of-service tiles must equal `unit.beds` — and the new suite asserts exactly that.
 *
 * `bedIsOccupied` includes `"pulled"`, so a bed given away to somebody still in an emergency
 * department appears here with no stay rather than being dropped: they hold one of the ward's beds
 * and the grid already draws them.
 *
 * Ordering is total and deterministic — expected date ascending, anyone with no date last, then by
 * id. Ordering by id on a tie is arbitrary but STABLE, which is what the panel needs: two renders
 * of the same fixture must not reshuffle. A passed date sorts to the top on its own, because its
 * instant is the smallest, which is where a flow meeting wants it.
 */
function buildOccupants(unit: Unit, admissions: readonly Admission[], now: Instant): Occupant[] {
  const inBeds = admissionsForUnit(admissions, unit.id).filter(bedIsOccupied);

  return [...inBeds]
    .sort((a, b) => {
      const aAt = expectedInstant(a);
      const bAt = expectedInstant(b);
      if (aAt !== null && bAt !== null && aAt !== bAt) return aAt - bAt;
      if (aAt === null && bAt !== null) return 1;
      if (aAt !== null && bAt === null) return -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((admission) => ({
      key: admission.id,
      days: daysInBed(admission, now),
      dayNumber: stayDayNumber(daysInBed(admission, now)),
      bandLabel: stayBand(admission, now)?.label ?? null,
      pastDate: isPastExpectedDischarge(admission, now),
      sex: admission.sex,
      gender: admission.gender,
      homeRegion: admission.homeRegion,
      tentativeDiagnosis: tentativeDiagnosisPhrase(admission.tentativeDiagnosis),
      awayAtEdHours:
        admission.awayAtEmergencyDepartmentSince === null
          ? null
          : Math.max(0, Math.floor((now - admission.awayAtEmergencyDepartmentSince) / 60)),
      expectedDays: daysUntilExpected(admission, now),
      dischargeDateMoves: admission.dischargeDateMoves,
      dischargeDateSetBy: admission.dischargeDateSetBy,
      // Read as a decision that was TAKEN, never inferred from how close the date is, how long ago
      // it was set, or how often it moved — `ward-discharge-dates.ts` records at length why each
      // of those proxies renders a ward decision nobody made. A non-finite instant is not a
      // decision either, so it degrades to unconfirmed rather than to a confirmation at `NaN`.
      confirmed: admission.dischargeConfirmedAt !== null && Number.isFinite(admission.dischargeConfirmedAt),
      dischargeConfirmedBy: admission.dischargeConfirmedBy,
      blockReason: admission.blockReason,
      admissionId: admission.id,
      dischargeBarrier: admission.dischargeBarrier ?? null,
      stepDownCandidate: Boolean(admission.stepDownCandidate),
    }));
}

/** The expected date in words. Never a calendar date: the model holds instants on a synthetic
 *  operating day and no calendar at all, so a printed "14 March" would be invented. */
function expectedPhrase(expectedDays: number | null): string {
  if (expectedDays === null) return "No expected date set";
  // Sign, not magnitude, is what changes the sentence — see `daysUntilExpected` on why the zero
  // floor `arrowTargets` applies would be wrong here.
  if (expectedDays < 0) {
    const past = -expectedDays;
    return `${past} day${past === 1 ? "" : "s"} past the ward's expected date`;
  }
  // Floors to 0 for anything inside the next day. "Within a day" rather than "today": the model
  // has no calendar, so it cannot say which day anything falls on.
  if (expectedDays === 0) return "Expected out within a day";
  return `Expected out in ${expectedDays} day${expectedDays === 1 ? "" : "s"}`;
}

/** How many times the WARD moved its own plan. Never a measure of the person — `dischargeDateMoves`
 *  says the plan kept changing, and this sentence must not be readable as saying anybody was slow.
 *  Guarded against a negative or non-integer count rather than trusted, the same way `unit.blocked`
 *  is guarded in `buildTiles`. */
function movesPhrase(moves: number): string {
  if (!Number.isFinite(moves) || moves < 1) return "not moved since";
  const whole = Math.floor(moves);
  if (whole === 1) return "moved once since";
  if (whole === 2) return "moved twice since";
  return `moved ${whole} times since`;
}

/**
 * The two outgoing bases the triage bar toggles between — the product owner's own words for what
 * he wanted to switch: "daily discharges … and toggles to daily expects". They are the `state`
 * values a derived forward `BedRelease` can carry (`ward-discharge-dates.ts`), so the toggle
 * selects a real field on real records rather than a display mode invented here.
 */
const OUTGOING_BASES = ["confirmed", "expected"] as const;
type OutgoingBasis = (typeof OUTGOING_BASES)[number];

/**
 * The basis in the words the HOME PAGE already uses for it.
 *
 * `CAPACITY_FIGURE_LABELS` is the single vocabulary the morning page, the hospital rollup and the
 * ward rollup all render (`ward-morning-rollup.ts`, spec D3/D14), so the toggle names the two
 * figures it switches between with the labels those figures already carry. Typing "Confirmed" and
 * "Expected" here instead would pass every test today and cost the cheap rename tomorrow, which
 * is the exact failure that constant exists to prevent.
 */
const OUTGOING_BASIS_LABEL: Record<OutgoingBasis, string> = {
  confirmed: CAPACITY_FIGURE_LABELS.confirmedToday,
  expected: CAPACITY_FIGURE_LABELS.expectedToday,
};

/**
 * Each `ReleaseBand` id, in words.
 *
 * A FORMATTING of ids that already exist (`RELEASE_BANDS` in `ward-bed-availability.ts`), never a
 * new vocabulary: "by-1600" and "By 16:00" are the same fact spelled for a reader. Keyed by band
 * id in a total `Record`, the same discipline `BAND_CLASS` holds, so adding a fifth band is a
 * compile error rather than a row that silently renders its raw id.
 */
const RELEASE_BAND_PHRASE: Record<ReleaseBand, string> = {
  now: "Expected now",
  "by-midday": "Expected by midday",
  "by-1600": "Expected by 16:00",
  tonight: "Expected tonight",
  // WB-DB-7, 2026-08-30. Said plainly rather than folded into "tonight", which is what the four
  // time-of-day bands would have done to it silently.
  tomorrow: "Expected tomorrow",
};

/**
 * The beds this ward expects to free TODAY, on one of the two bases the toggle selects.
 *
 * **Filtered exactly as `capacityBreakdown` counts** — same unit filter, same
 * `releaseBand(...) !== "beyond-today"` cut, same `state` test — so the number of rows this returns
 * is the number printed on the triage bar above them. That equality is the check a reader can
 * perform without trusting anything: the bar says four, the list has four rows. It is asserted
 * across all 23 seeded units in `tests/ward-board-triage.dom.test.tsx`, and it is the reason this
 * function re-uses `releaseBand` rather than comparing instants of its own.
 *
 * **These are BEDS, not people, and the panel says so on screen.** A `BedRelease` deliberately
 * carries nothing whatever about the departing patient — not an id, not a sex, not a destination
 * (see its own field-set doc comment) — so a row here cannot name, and must never appear to name,
 * whoever is leaving. Recovering the person by unpicking the derived release id would defeat the
 * one privacy property that type exists to hold.
 */
function outgoingToday(
  unit: Unit,
  bedReleases: readonly BedRelease[],
  basis: OutgoingBasis,
  now: Instant,
): BedRelease[] {
  // `state === basis` already excludes `"discharged"` — the two bases are the only other states a
  // `BedRelease` can carry — so `capacityBreakdown`'s explicit `"discharged"` skip needs no separate
  // clause here. It is the same cut, reached by the narrower test.
  return bedReleases.filter(
    (release) => release.unitId === unit.id && release.state === basis && releaseBand(release, now) !== "beyond-today",
  );
}

/**
 * One person on their way into a bed on this ward.
 *
 * Two states, and the difference between them is the whole point of the list: `"pulled"` means the
 * ward has ALREADY GIVEN THE BED AWAY and the person is travelling — that bed is gone from the
 * ward's count and the grid draws it as "Empty, waiting" — while `"waitlisted"` means accepted in
 * principle with no bed given, holding nothing and changing no figure. Presenting them as one
 * undifferentiated "incoming" list would let a reader plan against a bed that is already spoken
 * for, so each row states which it is.
 *
 * **Nothing here is invented and nothing is missing on purpose.** The record holds no arrival
 * time, no transport and no estimated time of arrival; a pulled admission carries `pulledAt` (when
 * the bed went) and that is the only clock there is. `arrivedAt` is null in both states by
 * construction, so no row can show a stay.
 */
type Incoming = {
  key: string;
  state: "pulled" | "waitlisted";
  sex: RecordedSex;
  /** Owner answer 2026-09-25 (R7, Q2): gender identity, shown beside sex. Absent = not recorded. */
  gender?: ReferralGender;
  /** `null` for an admission created by an ED arrival - see `Occupant.homeRegion`. */
  homeRegion: HomeRegion | null;
  /** Whole hours since the ward gave the bed away, or `null` for a waitlisted person and for a
   *  pull with no usable instant. Never a guess at when anybody will arrive. */
  bedGoneHours: number | null;
  /** Stored pull hold expiry from the linked movement, when present. */
  pullExpiresAt: Instant | null;
};

/**
 * Who is coming in to this ward, bed-already-given first.
 *
 * Scoped with `admissionsForUnit(admissions, unit.id)` — the same call `buildTiles` and
 * `buildOccupants` make, and for the same reason: a per-person panel handed the whole network's
 * 267 records is this feature's most recently shipped defect. `admissionsForUnit` drops departed
 * admissions and keeps waitlisted ones, which is exactly this list's population.
 *
 * Pulled before waitlisted because a given-away bed is the more urgent fact, then longest-waiting
 * first inside the pulled group, then by id — total, deterministic, and stable across renders.
 */
function buildIncoming(
  unit: Unit,
  admissions: readonly Admission[],
  movements: readonly { id: string; pullExpiresAt?: Instant }[],
  now: Instant,
): Incoming[] {
  const arriving = admissionsForUnit(admissions, unit.id).filter(
    (admission) => admission.state === "pulled" || admission.state === "waitlisted",
  );
  const pullByMovementId = new Map(
    movements
      .filter((movement) => movement.pullExpiresAt !== undefined)
      .map((movement) => [movement.id, movement.pullExpiresAt as Instant]),
  );

  return arriving
    .map((admission) => {
      const pulledAt = admission.pulledAt;
      const usablePull =
        admission.state === "pulled" && pulledAt !== null && Number.isFinite(pulledAt) && Number.isFinite(now);
      const pullExpiresAt = admission.movementId !== null ? (pullByMovementId.get(admission.movementId) ?? null) : null;
      return {
        key: admission.id,
        state: admission.state === "pulled" ? ("pulled" as const) : ("waitlisted" as const),
        sex: admission.sex,
        gender: admission.gender,
        homeRegion: admission.homeRegion,
        bedGoneHours: usablePull && pulledAt !== null ? Math.max(0, Math.floor((now - pulledAt) / 60)) : null,
        pullExpiresAt,
      };
    })
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === "pulled" ? -1 : 1;
      const aHours = a.bedGoneHours ?? -1;
      const bHours = b.bedGoneHours ?? -1;
      if (aHours !== bHours) return bHours - aHours;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
}

/** How long ago the bed went, in words. Whole hours, floored — the record's own resolution is
 *  minutes and an hour is as fine as anybody reads a board. */
function bedGonePhrase(hours: number | null): string {
  if (hours === null) return "Bed given away — when is not recorded";
  if (hours === 0) return "Bed given away within the hour";
  return `Bed given away ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/** The DOM id of a tile's own button, so closing the slide-out can hand focus back to exactly the
 *  control that opened it. Derived from the tile key, which is unique within one board. */
function tileDomId(key: string): string {
  return `ward-board-tile-${key}`;
}

/**
 * One person's discharge plan, rendered identically wherever it appears.
 *
 * **One renderer, two places, on purpose.** The slide-out shows the selected person and the
 * printed sheet shows all of them; two copies of this markup would drift the first time either
 * changed, and the two readings of the same record would then disagree on paper and on screen.
 * `idPrefix` is the only difference between them, and it exists so the printed list keeps the
 * `ward-board-person-*` test ids the existing suite already pins while the slide-out's copy sits
 * under a distinct prefix and cannot be double-counted by a query for either.
 */
function PersonEntry({
  occupant,
  idPrefix,
  resolvedPatient,
  displayDate,
}: {
  occupant: Occupant;
  idPrefix: string;
  resolvedPatient?: ResolvedPatientInfo;
  displayDate?: Date;
}) {
  if (idPrefix === "ward-board-person") {
    return (
      <>
        <p className={styles.personStay}>
          {occupant.days === null ? (
            <span className={styles.personNoStay}>No stay yet — not arrived</span>
          ) : (
            <>
              <span className={styles.personDays} data-testid={`${idPrefix}-${occupant.key}-days`}>
                {occupant.days} day{occupant.days === 1 ? "" : "s"}
              </span>
              {occupant.bandLabel !== null && <span className={styles.personBand}>{occupant.bandLabel}</span>}
            </>
          )}
          {occupant.pastDate && (
            <span className={styles.pastMark}>
              <span aria-hidden="true" className={styles.statusGlyph}>
                ▲{" "}
              </span>
              <span>Past date</span>
            </span>
          )}
        </p>
        <p className={styles.personWho}>
          {occupant.sex} · Gender: {occupant.gender ?? "Not recorded"},{" "}
          {occupant.homeRegion === null ? "home region not recorded" : `from ${occupant.homeRegion}`}
        </p>
        {occupant.stepDownCandidate && (
          <p style={{ margin: "4px 0" }}>
            <span className={styles.stepDownTag} data-testid={`${idPrefix}-${occupant.key}-stepdown`}>
              Flagged for step-down
            </span>
          </p>
        )}
        {occupant.days !== null && occupant.days >= 7 && (
          <p style={{ margin: "4px 0" }}>
            <span
              className={occupant.dischargeBarrier ? styles.barrierTag : styles.barrierTagWarning}
              data-testid={`${idPrefix}-${occupant.key}-barrier`}
            >
              {occupant.dischargeBarrier
                ? `Discharge barrier: ${occupant.dischargeBarrier}`
                : "Discharge barrier unrecorded (Stay ≥ 7d)"}
            </span>
          </p>
        )}
        {occupant.awayAtEdHours !== null && (
          <p className={styles.personAway} data-testid="ward-board-person-away">
            {occupant.awayAtEdHours === 0
              ? "At an emergency department — the bed is still theirs."
              : `At an emergency department for ${occupant.awayAtEdHours} ${occupant.awayAtEdHours === 1 ? "hour" : "hours"} — the bed is still theirs.`}
          </p>
        )}
        <p className={styles.personLine}>
          {occupant.tentativeDiagnosis !== null
            ? `Tentative diagnosis: ${occupant.tentativeDiagnosis}.`
            : "Tentative diagnosis: none recorded."}
        </p>
        <p className={styles.personExpected}>{expectedPhrase(occupant.expectedDays)}</p>
        {occupant.expectedDays !== null && (
          <p className={styles.personLine}>
            {occupant.dischargeDateSetBy !== null
              ? `Date set by ${occupant.dischargeDateSetBy}`
              : "Date set — the role that set it is not recorded"}
            , and {movesPhrase(occupant.dischargeDateMoves)}.{" "}
            {occupant.confirmed
              ? occupant.dischargeConfirmedBy !== null
                ? `Confirmed by ${occupant.dischargeConfirmedBy} — a decision, not a plan.`
                : "Confirmed — a decision, not a plan; the role that confirmed it is not recorded."
              : "Not confirmed — the ward's plan, not yet its decision."}
          </p>
        )}
        {occupant.blockReason !== null && <p className={styles.personBlocker}>Held up by: {occupant.blockReason}.</p>}
      </>
    );
  }

  // Detail panel view (idPrefix === "ward-board-selected-person")
  const patient = resolvedPatient?.patient;
  const age = patient ? patientAgeYears(patient, displayDate ?? new Date()) : null;
  const displayName = resolvedPatient?.formalName || occupant.key;

  return (
    <>
      {/* 1. Identity & Stay Card */}
      <div className={styles.detailIdCard}>
        <div className={styles.detailStayRow}>
          <p className={styles.personStay} style={{ margin: 0 }}>
            {occupant.days === null ? (
              <span className={styles.personNoStay}>No stay yet — not arrived</span>
            ) : (
              <>
                <span className={styles.personDays} data-testid={`${idPrefix}-${occupant.key}-days`}>
                  {occupant.days} day{occupant.days === 1 ? "" : "s"}
                </span>
                <span className={styles.daysUnit}>here</span>
                {occupant.bandLabel !== null && <span className={styles.personBand}>{occupant.bandLabel}</span>}
              </>
            )}
            {occupant.pastDate && (
              <span className={styles.pastMark}>
                <span aria-hidden="true" className={styles.statusGlyph}>
                  ▲{" "}
                </span>
                <span>Past date</span>
              </span>
            )}
          </p>
        </div>

        <div className={styles.detailName}>{displayName}</div>

        <div className={styles.detailChips}>
          {age !== null && <span className={styles.detailChip}>{age} yrs</span>}
          <span className={styles.detailChip}>{occupant.sex}</span>
          <span className={styles.detailChip}>Gender: {occupant.gender ?? "Not recorded"}</span>
          <span className={styles.detailChip}>{occupant.homeRegion ?? "Region unrecorded"}</span>
          {resolvedPatient?.umrn && <span className={styles.detailChip}>UMRN {resolvedPatient.umrn}</span>}
        </div>

        {/* Retain exact personWho text for test contract compatibility */}
        <p className={styles.personWho} style={{ margin: 0 }}>
          {occupant.sex} · Gender: {occupant.gender ?? "Not recorded"},{" "}
          {occupant.homeRegion === null ? "home region not recorded" : `from ${occupant.homeRegion}`}
        </p>

        {occupant.stepDownCandidate && (
          <div style={{ marginTop: 8 }}>
            <span className={styles.stepDownTag} data-testid={`${idPrefix}-${occupant.key}-stepdown`}>
              Flagged for step-down
            </span>
          </div>
        )}
        {occupant.days !== null && occupant.days >= 7 && (
          <div style={{ marginTop: 8 }}>
            <span
              className={occupant.dischargeBarrier ? styles.barrierTag : styles.barrierTagWarning}
              data-testid={`${idPrefix}-${occupant.key}-barrier`}
            >
              {occupant.dischargeBarrier
                ? `Discharge barrier: ${occupant.dischargeBarrier}`
                : "Discharge barrier unrecorded (Stay ≥ 7d)"}
            </span>
          </div>
        )}
      </div>

      {/* 2. Catchment & Demographic Card */}
      <div className={styles.detailSectionCard}>
        <div className={styles.detailSectionHeading}>Catchment & Team</div>
        <div className={styles.catchmentGrid}>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Home Region</span>
            <span className={styles.catchmentValue}>{occupant.homeRegion ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Suburb</span>
            <span className={styles.catchmentValue}>{patient?.suburb ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Community Team</span>
            <span className={styles.catchmentValue}>{patient?.catchmentCommunityTeam ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Legal Status</span>
            <span className={styles.catchmentValue}>{patient?.legalStatus ?? "Not recorded"}</span>
          </div>
        </div>
        <p className={styles.catchmentFootnote}>
          This block resolves through the referral that filled the bed, and that chain is optional by design.
        </p>
      </div>

      {/* 3. Clinical & Transport Card */}
      <div className={styles.detailSectionCard}>
        <div className={styles.detailSectionHeading}>Clinical & Transport</div>
        {occupant.awayAtEdHours !== null && (
          <p className={styles.personAway} data-testid="ward-board-person-away">
            {occupant.awayAtEdHours === 0
              ? "At an emergency department — the bed is still theirs."
              : `At an emergency department for ${occupant.awayAtEdHours} ${occupant.awayAtEdHours === 1 ? "hour" : "hours"} — the bed is still theirs.`}
          </p>
        )}
        <p className={styles.personLine}>
          {occupant.tentativeDiagnosis !== null
            ? `Tentative diagnosis: ${occupant.tentativeDiagnosis}.`
            : "Tentative diagnosis: none recorded."}
        </p>
      </div>

      {/* 4. What is Happening Today / Leaving Plan Card */}
      <div className={styles.detailSectionCard}>
        <div className={styles.detailSectionHeading}>What is happening today</div>
        <p className={styles.personExpected}>{expectedPhrase(occupant.expectedDays)}</p>
        {occupant.expectedDays !== null && (
          <p className={styles.personLine}>
            {occupant.dischargeDateSetBy !== null
              ? `Date set by ${occupant.dischargeDateSetBy}`
              : "Date set — the role that set it is not recorded"}
            , and {movesPhrase(occupant.dischargeDateMoves)}.{" "}
            {occupant.confirmed
              ? occupant.dischargeConfirmedBy !== null
                ? `Confirmed by ${occupant.dischargeConfirmedBy} — a decision, not a plan.`
                : "Confirmed — a decision, not a plan; the role that confirmed it is not recorded."
              : "Not confirmed — the ward's plan, not yet its decision."}
          </p>
        )}
        {occupant.dischargeDateMoves > 0 && (
          <div className={styles.dateMovedAlert}>
            This discharge date has moved {occupant.dischargeDateMoves}{" "}
            {occupant.dischargeDateMoves === 1 ? "time" : "times"}.
          </div>
        )}
        {occupant.blockReason !== null && <p className={styles.personBlocker}>Held up by: {occupant.blockReason}.</p>}
      </div>
    </>
  );
}

interface ShiftAction {
  word: string;
  tone?: "warn" | "danger" | "good";
  say: string;
}
interface ShiftTileItem {
  key: string;
  selectableKey?: string;
  label: string;
  tone?: "warn" | "danger" | null;
  when: string;
  chip: string;
  text: string;
  acts: ShiftAction[];
  who?: string;
}

/**
 * Resolve which movement "Patient arrived" should close on the board.
 *
 * Identity only (`admissionId` or movement `id`). A unit-wide `acceptedUnitId`
 * fallback is forbidden: two pulled patients on the same ward is ordinary, and
 * guessing "any accepted movement on this unit" marks the wrong person
 * (ward-model join comment on `admissionId`).
 */
export function movementForBoardArrival<T extends { id: string; admissionId?: string }>(
  movements: T[] | undefined,
  selectableKey: string | undefined,
): T | undefined {
  if (!selectableKey || !movements) return undefined;
  return movements.find((m) => m.admissionId === selectableKey || m.id === selectableKey);
}

/**
 * Whether the reducer would accept "Patient arrived" for this movement (walkthrough T2, 25 Sept
 * 2026). The board used to offer the button on every pulled tile and announce success while the
 * reducer refused. This mirrors `PATIENT_ARRIVED`'s own stage checks in `ward-flow-reducer.ts`:
 * open, not diverted, an accepted destination, and either collected while moving, or no transport
 * needed with no job booked and the bed pulled. `tests/ward-board-truth.test.ts` checks it agrees
 * with the reducer for every seeded movement, so the two cannot drift apart silently.
 */
export function boardArrivalAllowed(movement: Movement): boolean {
  if (movement.closure) return false;
  if (movement.transport?.diversion) return false;
  if (!movement.acceptedUnitId) return false;
  const liveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
  const noTransportNeeded =
    (movement.transportNeed?.needed ?? movement.transport?.needed) === false &&
    !liveTransportJob &&
    movement.transport?.collectedAt === undefined;
  if (noTransportNeeded) return movement.stage === "pulled" || movement.stage === "handover_ready";
  return movement.stage === "moving" && movement.transport?.collectedAt !== undefined;
}

export function WardBoard({
  unitId,
  requireConfirmation = process.env.NODE_ENV !== "test",
}: {
  unitId: string;
  requireConfirmation?: boolean;
}) {
  // Live state, on the same terms as every other screen. Named `liveUnits` only because `unit`
  // below is the one this board is about; `now` and `admissions` keep their names so every
  // derivation beneath reads unchanged.
  const {
    units: liveUnits,
    admissions,
    leaveBeds,
    dispatch,
    recordWardDeparture,
    movements,
    bedReleases: liveBedReleases,
    patients,
    // The ward-scoped identity projection, never the full referral array: a ward-only screen must
    // not reach a referral's other destinations (ward-referral-screen-boundary). Older provider
    // adapters without it fall back to patient and movement links only.
    resolvePatientIdentity,
    rejections,
    dayZero,
  } = useWardFlow();
  const now = useWardFlowClock();
  const [blockerDialogItem, setBlockerDialogItem] = useState<ShiftTileItem | null>(null);
  const [selectedBlocker, setSelectedBlocker] = useState<BedReleaseBlocker>(BED_RELEASE_BLOCKERS[0]);
  const [pendingConfirm, setPendingConfirm] = useState<{
    kind: "leaving" | "away_at_ed";
    who: string;
    item?: ShiftTileItem;
    admissionId?: string;
  } | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const blockerDialogRef = useRef<HTMLDivElement | null>(null);
  const blockerCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);
  const confirmCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const closeConfirmDialog = useCallback(() => {
    setPendingConfirm(null);
    setTimeout(() => {
      dialogTriggerRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    if (pendingConfirm) {
      confirmCloseBtnRef.current?.focus();
    }
  }, [pendingConfirm]);

  useEffect(() => {
    if (!pendingConfirm) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeConfirmDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingConfirm, closeConfirmDialog]);

  const closeBlockerDialog = useCallback(() => {
    setBlockerDialogItem(null);
    setTimeout(() => {
      dialogTriggerRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    if (blockerDialogItem) {
      blockerCloseBtnRef.current?.focus();
    }
  }, [blockerDialogItem]);

  const trapDialogFocus = (e: React.KeyboardEvent<HTMLElement>, container: HTMLElement | null) => {
    if (e.key !== "Tab" || !container) return;
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (!blockerDialogItem) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (blockerDialogItem) closeBlockerDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blockerDialogItem, closeBlockerDialog]);
  // Item 44, build plan task G2 (§2 "Bed board, ward page and all seven statistics screens: a
  // sentence only."). A hook, so it is read unconditionally, before the "unknown unit" early
  // return further down.
  const service = useServiceScope();

  /*
   * SELECTION, and the one thing it is allowed to mean.
   *
   * The product owner has overruled the decision recorded at 281bdf83f, which built the people
   * panel as a list with no selection at all; that call was his to make and this is it. What that
   * commit's reasoning STILL binds is the part about identity: an `Admission` records the ward and
   * NEVER a bed, so a tile carries no bed identity and nothing here may number a tile, call it
   * "Bed 7", or let the grid read as a floor plan. The recorded order is seed order; the board's
   * ordering control changes only presentation and never turns that order into a location.
   *
   * Selection is therefore honest in exactly one direction. An occupied or waiting tile stands for
   * a PERSON, and `selectedKey` holds that person's admission id, which is a real handle on a real
   * record. A blocked, closed or empty tile stands for no particular bed — those tiles are counts
   * drawn somewhere rather than locations — so selecting one shows what the ward records about
   * that CLASS of bed and says, on the panel, that which bed is not recorded.
   *
   * Held as a key rather than an index so a re-render cannot slide the selection onto a different
   * person, and so nothing in this component ever has an ordinal to print.
   */
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dateEdit, setDateEdit] = useState<{
    admissionId: string;
    time: string;
    day: "recorded" | "today" | "tomorrow";
  } | null>(null);
  /*
   * The destination this ward would record, defaulted to the FIRST of the five rather than to
   * nothing. A "choose one" placeholder would be the safer-looking option and is the wrong one
   * here: it makes the commonest discharge in the service take two interactions, and an unset
   * value has to be guarded at the dispatch, which is a second way to fail. The five are all real
   * destinations, none is a null choice, and the control states which is selected.
   */
  const [leavingDestination, setLeavingDestination] = useState<LeavingDestination>(LEAVING_DESTINATIONS[0].id);
  /*
   * Which of the two outgoing figures the "Going out today" list is built from. The toggle changes
   * what the board EMPHASISES; it hides no figure — all ten stay on the ward band in every state,
   * because a control that can remove the blocked-releases figure from a coordinator's screen is a
   * control that can hide the thing they most need to chase.
   */
  const [outgoingBasis, setOutgoingBasis] = useState<OutgoingBasis>("confirmed");
  const [bedFilter, setBedFilter] = useState<BoardFilter>("all");
  const [bedOrder, setBedOrder] = useState<BoardOrder>("stay");
  const [flowTab, setFlowTab] = useState<FlowTab>("outgoing");
  /*
   * Whether the printed sheet is shown on screen. Closed by default: it repeats the board's own
   * panels, which is why it moved down here, and a reader who wants it is one click away.
   *
   * A `<details>` element was the obvious choice and is the wrong one. The browser hides a closed
   * `details`' content through its own UA stylesheet, and no print rule reliably forces it open —
   * so the handover sheet would have printed as one line of summary text and a blank page. A
   * button plus a class the print stylesheet can override keeps the paper correct, which is the
   * half that matters most: the sheet exists to be printed.
   */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shiftTab, setShiftTab] = useState<"busy" | "quiet">("busy");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /*
   * Walkthrough D12 (25 Sept 2026): the board announced success without checking whether the
   * reducer refused. `dispatch` never says, so, as on the ward screen, the rejection count is read
   * before the dispatch and compared on the next render: a new rejection shows its reason and says
   * nothing was changed; otherwise the success message shows.
   */
  const outcomeCheckRef = useRef<{ prior: number; success: string; spoken: string } | null>(null);
  const [outcomeToken, setOutcomeToken] = useState(0);
  // `record` makes the dispatch itself, with a literal event type at the call site, so every
  // dispatch stays readable to the override-surfaces guard; this only brackets it with the check.
  // `spoken` is what the screen reader hears: privacy review, 27 Sept 2026, a spoken announcement
  // never carries the patient's name, though the visible toast may.
  const dispatchAndReport = useCallback(
    (record: () => void, success: string, spoken: string) => {
      outcomeCheckRef.current = { prior: rejections.length, success, spoken };
      record();
      setOutcomeToken((token) => token + 1);
    },
    [rejections.length],
  );
  useEffect(() => {
    const check = outcomeCheckRef.current;
    if (outcomeToken === 0 || check === null) return;
    outcomeCheckRef.current = null;
    const refused = rejections.length > check.prior ? rejections[rejections.length - 1] : undefined;
    const msg = refused ? `Not recorded: ${refused.reason}. Nothing was changed.` : check.success;
    setToastMessage(msg);
    announceToWardShell(refused ? msg : check.spoken);
  }, [outcomeToken, rejections]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
  /*
   * The tile to hand focus back to once the slide-out closes.
   *
   * A REF rather than a second piece of state, and the distinction is not cosmetic. The focus call
   * has to happen after React has committed the render that removed the panel — inside the click
   * handler it would move focus and then have it undone by the commit — but a state variable
   * written from inside that effect is a cascading render, which `react-hooks/set-state-in-effect`
   * fails the build on and which is right: nothing about "which control to focus" is part of what
   * this component renders. So the ref is set in the handler, read once after the close has
   * committed, and cleared without re-rendering anything.
   */
  const focusBackTo = useRef<string | null>(null);

  useEffect(() => {
    if (selectedKey !== null) return;
    const key = focusBackTo.current;
    if (key === null) return;
    focusBackTo.current = null;
    document.getElementById(tileDomId(key))?.focus();
  }, [selectedKey]);

  const closeDetail = useCallback(() => {
    focusBackTo.current = selectedKey;
    setSelectedKey(null);
    setDateEdit(null);
  }, [selectedKey]);

  /* Escape closes the slide-out from anywhere inside the board's three zones — the tiles and the
   * panel itself — and focus returns to the tile that opened it. Bound to the zones container
   * rather than to `window` so this board never intercepts a key press meant for something else on
   * the page, and NOT a focus trap: Tab continues out of the panel into the rest of the page,
   * because the panel is not modal and does not cover what it describes. */
  const onZoneKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeDetail();
    },
    [closeDetail],
  );

  const found = findUnit(unitId, liveUnits);
  if (found === undefined) {
    // Task A: a "Ward not found" page with no per-screen navigation mount was a dead end — there
    // was no way back to anything else in Ward Flow from it. Every other dynamic-route screen
    // used to mount the rail in BOTH its return branches (see `ed-screen.tsx`'s own not-found
    // branch) to fix that, one screen at a time.
    //
    // Task 8, 2026-09-11: neither branch mounts it directly any more. The third-edition rail
    // (`shell/ward-rail.tsx`) mounts once in `src/app/mockups/ward-flow/layout.tsx`, an ancestor
    // of this route regardless of which branch below runs, so this dead end stays fixed for free
    // rather than depending on this file (or any other) remembering to mount it twice.
    return (
      <div className={styles.screen} data-testid="ward-board-unknown-unit" data-ward-design="third-edition">
        <main id="main-content" className={styles.main}>
          <h1 className={styles.unitName}>Ward not found</h1>
          <p className={styles.constraint}>No ward is recorded with the id “{unitId}”.</p>
          <div className={styles.recoveryContainer}>
            <Link href="/mockups/ward-flow" className={styles.recoveryLink}>
              Return to Ward Flow Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { unit, site } = found;
  /*
   * Derived from the same admissions this page draws, so the header cannot disagree with the tiles
   * about who is in a bed.
   *
   * 🔴 **THE LAST SENTENCE HERE USED TO SAY "no leave beds are modelled on this board, and no
   * leave figure is rendered from them", AND THE SECOND HALF WAS FALSE.** `leaveBeds` was
   * `[] as const`. Two of the three derivations it feeds genuinely never read it —
   * `headlineAvailable` and `constraintSentence` both reduce to `capacityBreakdown(...).availableNow`,
   * which is `min(allocatable, empty)`. **But `capacityBreakdown` also returns `onLeave`, computed as
   * `leave.filter((bed) => bed.unitId === unit.id).length`, and this board renders it as a labelled
   * figure.** So the board announced **On leave: 0** on every ward, always.
   *
   * ⚠️ **It was wrong the day it was written, not merely wrong for data that did not exist yet.**
   * The seed carries two leave beds — `WL-001` on `rph-adult-secure`, `WL-002` on `scgh-older-adult`
   * — so two real wards printed a figure contradicted by the state this page was already holding.
   * **The absence was in an ARGUMENT rather than on the page**, which is why every wording rule this
   * project has written was blind to it (owner ruling D-23).
   *
   * The leave beds now come from the provider, the same live state every other screen reads.
   */
  const bedReleases = derivedBedReleases([...admissions], now);

  const available = headlineAvailable(unit, admissions, bedReleases, [...leaveBeds], now);
  // 🔴 THE FIGURE ABOVE IS CORRECT AND MUST NOT CHANGE. `availableNow` deliberately subtracts
  // nothing for a preparation note: asked in September whether a bed being cleaned should drop the
  // ward's number or merely refuse the pull, the owner chose the refusal, because the ward has not
  // changed what it can staff and its figures must not lurch as cleaning starts and stops. So the
  // defect this closes was never a wrong number — it was a correct number printed without the
  // sentence that makes it safe to act on, while the reducer refuses PULL_PATIENT with "every free
  // bed at X is still being made ready". Do not reach for the subtraction; it looks like the honest
  // fix and would silently reverse an owner ruling with every test still green.
  // Walkthrough D7 (25 Sept 2026): read the LIVE releases, because a preparation note is recorded
  // on a release in state; the rebuilt list above never carries one, so "being cleaned" never showed.
  const pendingPreparation = bedsPendingPreparation(unit.id, [...(liveBedReleases ?? [])]);
  const constraint = constraintSentence(unit, admissions, bedReleases, [...leaveBeds], now);
  const tiles = buildTiles(unit, admissions, bedReleases, now);
  // Read straight back out, purely to say how many closed tiles are on screen in the footnote below
  // — never re-derived. `buildTiles` already clamped this into the physically-empty pool; the
  // footnote must describe exactly what got drawn, not a second, unclamped copy of the figure.
  const closedTileCount = tiles.filter((tile) => tile.kind === "closed").length;

  /*
   * Scoped to THIS unit with the same helper `buildTiles` uses, so the panel and the grid can
   * never disagree about who is in a bed.
   *
   * **Written first as `arrowTargets(admissions, now)` and caught by rendering the page, not by a
   * test.** `admissions` is the whole network's 267 records, so the panel read every ward in the
   * state: it offered "Kimberley 28 people" on a twenty-bed ward and totalled about 180 against
   * eighteen occupants. Nothing failed — `arrowTargets` was correct and its nine assertions still
   * passed, because the defect was in the CALL and every one of them supplies its own admissions.
   * A derivation's tests cannot see a caller handing it the wrong set.
   */
  const targets = arrowTargets(admissionsForUnit(admissions, unit.id), now);
  /* Scoped inside `buildOccupants` with the same `admissionsForUnit(...)` + `bedIsOccupied` pair
   * `buildTiles` uses — see that function's own comment for the defect this prevents. */
  const occupants = buildOccupants(unit, admissions, now);
  /** The person's name for a board message, never their admission id (walkthrough D10). */
  const nameFor = (admissionId: string | undefined): string => {
    const admission = admissions.find((a) => a.id === admissionId);
    const subject = admission ?? { id: admissionId };
    const resolved = resolvePatientIdentity
      ? resolvePatientIdentity(subject)
      : resolveSubjectPatient(subject, { patients, movements });
    return resolved.patient ? resolved.displayName : "the patient (name not recorded)";
  };

  /*
   * THE WARD BAND'S TEN FIGURES, scoped to this one ward. The six canonical capacity figures stay
   * intact; four counts already visible elsewhere on this board join them so the band can support
   * the same rapid scan as the drawing without inventing a new fact.
   *
   * `capacityBreakdown` is the same function the morning page's ward-level rollup calls, given this
   * unit and the releases these admissions imply — so the board's bar and the home page's cards are
   * one arithmetic, not two. The labels come from `CAPACITY_FIGURE_LABELS`, the single vocabulary
   * spec D3/D14 requires to be identical at service, hospital and ward level; the words are never
   * retyped here, which is what stops this board drifting from the home page's.
   *
   * `availableNow` is the same figure the header above already prints through `headlineAvailable` —
   * that helper IS `capacityBreakdown(...).availableNow` floored, so the two cannot disagree.
   */
  const breakdown = capacityBreakdown(unit, [...bedReleases], [...leaveBeds], now);
  // The ruled Closed figure (`ward-bed-states.ts`), the same call `buildTiles` draws its closed
  // tiles from. `breakdown.held` is NOT this figure: it still counts a live pull's empty bed.
  const states = bedStates(unit, admissions, [...bedReleases], [...leaveBeds]);
  const incoming = buildIncoming(unit, admissions, movements, now);
  const outgoing = outgoingToday(unit, bedReleases, outgoingBasis, now);
  /*
   * `sinceYesterday` counts whatever it is given and deliberately cannot use `admissionsForUnit`,
   * which drops departed admissions and would make `discharged` permanently zero — see its own doc
   * comment. So this is the ONE list on this page filtered by hand, keeping `"departed"` admissions in,
   * and it is filtered by `unit.id` all the same: the whole network's records through here would
   * report the state's departures as this ward's.
   */
  const movement = sinceYesterday(
    admissions.filter((admission) => admission.unitId === unit.id),
    now,
  );

  /* Taken from the SAME `now` every figure above was derived from, which is the whole of DB-12 —
     see the stamp's own comment in the heading below. */
  const stamp = asAtStamp(now);

  const occupantByKey = new Map(occupants.map((occupant) => [occupant.key, occupant]));

  const selectedTile = selectedKey === null ? null : (tiles.find((tile) => tile.key === selectedKey) ?? null);
  const selectedOccupant =
    selectedTile === null || (selectedTile.kind !== "occupied" && selectedTile.kind !== "waiting")
      ? null
      : (occupantByKey.get(selectedTile.key) ?? null);

  const tileMatchesFilter = (tile: Tile, filter: BoardFilter): boolean => {
    const occupant = occupantByKey.get(tile.key);
    switch (filter) {
      case "look":
        return (
          tile.kind === "blocked" ||
          tile.kind === "closed" ||
          tile.kind === "waiting" ||
          (tile.kind === "occupied" &&
            (tile.pastDate || tile.awayAtEd || (occupant !== undefined && occupant.blockReason !== null)))
        );
      case "ready":
        return tile.kind === "empty";
      case "quiet":
        return tile.kind === "occupied" && occupant !== undefined && occupant.expectedDays === null;
      case "all":
      default:
        return true;
    }
  };

  let lookCount = 0;
  let readyCount = 0;
  let quietCount = 0;
  let blockedTileCount = 0;
  let emptyTileCount = 0;
  const filteredTiles: Tile[] = [];

  for (const tile of tiles) {
    if (tile.kind === "blocked") blockedTileCount++;
    if (tile.kind === "empty") emptyTileCount++;

    const isLook = tileMatchesFilter(tile, "look");
    const isReady = tileMatchesFilter(tile, "ready");
    const isQuiet = tileMatchesFilter(tile, "quiet");

    if (isLook) lookCount++;
    if (isReady) readyCount++;
    if (isQuiet) quietCount++;

    if (tileMatchesFilter(tile, bedFilter)) {
      filteredTiles.push(tile);
    }
  }

  const filterCounts: Record<BoardFilter, number> = {
    all: tiles.length,
    look: lookCount,
    ready: readyCount,
    quiet: quietCount,
  };

  const tileIndexMap = new Map<Tile, number>();
  for (let i = 0; i < tiles.length; i++) {
    tileIndexMap.set(tiles[i], i);
  }

  const orderedTiles = [...tiles].sort((a, b) => {
    const aIdx = tileIndexMap.get(a) ?? 0;
    const bIdx = tileIndexMap.get(b) ?? 0;
    if (bedOrder === "recorded") return aIdx - bIdx;
    const aOccupant = occupantByKey.get(a.key);
    const bOccupant = occupantByKey.get(b.key);
    if (bedOrder === "stay") {
      const aDays = aOccupant?.days ?? -1;
      const bDays = bOccupant?.days ?? -1;
      return bDays - aDays || aIdx - bIdx;
    }
    const aExpected = aOccupant?.expectedDays ?? Number.POSITIVE_INFINITY;
    const bExpected = bOccupant?.expectedDays ?? Number.POSITIVE_INFINITY;
    return aExpected - bExpected || aIdx - bIdx;
  });

  const onFlowTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = FLOW_TABS.indexOf(flowTab);
    const requestedIndex =
      event.key === "ArrowRight"
        ? (currentIndex + 1) % FLOW_TABS.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + FLOW_TABS.length) % FLOW_TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? FLOW_TABS.length - 1
              : null;
    if (requestedIndex === null) return;
    event.preventDefault();
    const requestedTab = FLOW_TABS[requestedIndex];
    setFlowTab(requestedTab);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-flow-tab="${requestedTab}"]`)?.focus();
  };

  /*
   * WHAT THE "NEEDS A LOOK THIS SHIFT" BAND SAYS, derived from figures this page already holds.
   *
   * ⚠️ NOT ONE NUMBER IS COMPUTED HERE. `blockedTileCount` and `states.closed` are the tiles and the
   * triage bar's own figure; `incoming` and `outgoing` are the two flow lists rendered below. A digest
   * that recomputed them would be a second arithmetic on one screen, and this file already carries a
   * note about why the bar and the home page's cards must be one.
   *
   * NO BED IS NAMED. An `Admission` records the unit and never a bed, so "bed 09 is overdue" is a
   * sentence the model cannot support — the owner ruled on 2026-09-07 that this board carries no bed
   * identity at all. A count is the whole of what is true, and it is enough: a reader who sees "2 out
   * of service" goes to the grid, where the hatch shows which.
   *
   * ZEROES ARE DROPPED rather than printed as "none". The band exists to shorten a scan and a list of
   * nothings lengthens it. The empty case gets its own sentence instead, because a band that vanishes
   * when there is nothing to say cannot tell a reader that there is nothing to say.
   */
  const pulledIn = incoming.filter((person) => person.state === "pulled");
  const figures: { key: string; label: string; value: number; led?: boolean }[] = [
    {
      key: "availableNow",
      label: CAPACITY_FIGURE_LABELS.availableNow,
      value: breakdown.availableNow,
    },
    // Keyed `held` because that is the `CAPACITY_FIGURE_LABELS` key; the label it carries is
    // "Closed" (2026-09-01 ruling 5) and the value is the ruled Closed, so it matches the tiles.
    { key: "held", label: CAPACITY_FIGURE_LABELS.held, value: states.closed },
    {
      key: "confirmedToday",
      label: CAPACITY_FIGURE_LABELS.confirmedToday,
      value: breakdown.confirmedToday,
      led: outgoingBasis === "confirmed",
    },
    {
      key: "expectedToday",
      label: CAPACITY_FIGURE_LABELS.expectedToday,
      value: breakdown.expectedToday,
      led: outgoingBasis === "expected",
    },
    { key: "blockedToday", label: CAPACITY_FIGURE_LABELS.blockedToday, value: breakdown.blockedToday },
    {
      key: "awayAtEd",
      label: "Away at an ED",
      value: occupants.filter((occupant) => occupant.awayAtEdHours !== null).length,
    },
    { key: "pulled", label: "Pulled, not arrived", value: pulledIn.length },
    { key: "blockedBeds", label: "Out of service", value: blockedTileCount },
    {
      key: "overThreeMonths",
      label: "Here over 3 months",
      value: tiles.filter((tile) => tile.kind === "occupied" && tile.bandId === "over-3-months").length,
    },
    { key: "onLeave", label: CAPACITY_FIGURE_LABELS.onLeave, value: breakdown.onLeave },
  ];

  const shiftTiles: ShiftTileItem[] = [];

  // 1. Confirmed or Expected discharges past their expected time or due today
  for (const occupant of occupants) {
    if (occupant.pastDate || (occupant.expectedDays !== null && occupant.expectedDays <= 0)) {
      const isConfirmed = occupant.confirmed;
      const daysPast =
        occupant.expectedDays !== null && occupant.expectedDays < 0 ? Math.abs(occupant.expectedDays) : 0;
      const blockerPhrase = occupant.blockReason
        ? occupant.blockReason.toLowerCase().startsWith("awaiting")
          ? ` ${occupant.blockReason.charAt(0).toUpperCase() + occupant.blockReason.slice(1).toLowerCase()}.`
          : ` Waiting on ${occupant.blockReason.toLowerCase()}.`
        : "";
      shiftTiles.push({
        key: `discharge-${occupant.key}`,
        selectableKey: occupant.key,
        label: isConfirmed ? "Confirmed discharge" : "Expected discharge",
        tone: "warn",
        when: "Discharge",
        chip: daysPast > 0 ? `${daysPast}d overdue` : "Due today",
        text: `${isConfirmed ? "Confirmed out" : "Expected out"} today, still here.${blockerPhrase}`,
        acts: [
          { word: "They have left", say: "would release this bed and make it ready" },
          { word: "Record a blocker", tone: "warn", say: "would record what is holding this discharge up" },
        ],
      });
    }
  }

  // 2. Out of service beds
  for (let index = 0; index < blockedTileCount; index += 1) {
    shiftTiles.push({
      key: `blocked-shift-${index}`,
      selectableKey: `blocked-${index}`,
      label: "Out of service",
      tone: "danger",
      when: "Unavailable",
      chip: "Out of service",
      // Bed board decision 5A (Josh, 26 Sept 2026): nothing records why a bed is out of service.
      text: "Out of service. Reason not recorded. No return date recorded.",
      // "Set a return date" was removed 25 Sept 2026 (Josh, leave-bed Q4 "A"): it recorded a LEAVE
      // bed for an out-of-service bed, which is the wrong record. How an out-of-service bed records
      // its return is decided separately.
      acts: [],
    });
  }

  // 3. Away at an ED
  for (const occupant of occupants) {
    if (occupant.awayAtEdHours !== null) {
      shiftTiles.push({
        key: `away-${occupant.key}`,
        selectableKey: occupant.key,
        label: "Away at an ED",
        tone: "warn",
        when: `${occupant.awayAtEdHours}h ago`,
        chip: `${occupant.awayAtEdHours}h away`,
        text: "Their patient is away at an emergency department. The bed is still held for them.",
        acts: [{ word: "Mark them back", say: "would record that the person in this bed is back on the ward" }],
      });
    }
  }

  // 4. Pulled beds
  for (const person of pulledIn) {
    shiftTiles.push({
      key: `pulled-${person.key}`,
      selectableKey: person.key,
      label: "Pulled bed",
      tone: null,
      when: person.bedGoneHours !== null ? `${person.bedGoneHours}h ago` : "Today",
      chip: person.bedGoneHours !== null ? `${person.bedGoneHours}h travelling` : "Pulled",
      text: `Pulled for ${nameFor(person.key)}, taken and not yet arrived.`,
      // "Release the bed" removed 2026-09-25 (owner decision, Q5, bed-release-link plan): it
      // dispatched RELEASE_BED against "the first live release on the unit", the same guess-by-ward
      // defect a bed release now refuses everywhere else that a release must name its own admission
      // (`BedRelease.admissionId`). Giving a pull back is a different, separate decision (not this
      // one) — not yet wired to any event here.
      // Walkthrough T2: offered only when the reducer would accept it for this person's movement.
      acts: (() => {
        const movement = movementForBoardArrival(movements, person.key);
        return movement && boardArrivalAllowed(movement)
          ? [{ word: "Patient arrived", say: "would record the arrival and fill this bed" }]
          : [];
      })(),
    });
  }

  const handleConfirmAction = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.kind === "leaving") {
      const admissionId = pendingConfirm.admissionId || pendingConfirm.item?.selectableKey;
      if (!admissionId) return;
      dispatchAndReport(
        () =>
          recordWardDeparture
            ? recordWardDeparture(admissionId, unit.id, leavingDestination)
            : dispatch({
                type: "RECORD_LEAVING",
                role: "ward",
                now,
                admissionId: admissionId,
                actingUnitId: unit.id,
                leavingDestination,
              }),
        `Recorded departure: ${pendingConfirm.who} has left the ward.`,
        "Recorded departure: this patient has left the ward.",
      );
      if (selectedTile && admissionId === selectedTile.key) {
        closeDetail();
      }
    } else if (pendingConfirm.kind === "away_at_ed" && pendingConfirm.admissionId) {
      dispatchAndReport(
        () =>
          dispatch({
            type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
            role: "ward",
            now,
            admissionId: pendingConfirm.admissionId!,
            actingUnitId: unit.id,
          }),
        `Recorded: ${pendingConfirm.who} is currently away at an emergency department. Their bed is still held.`,
        "Recorded: patient is currently away at an emergency department.",
      );
    }
    closeConfirmDialog();
  };

  const handleShiftAction = (item: ShiftTileItem, word: string) => {
    if (word === "They have left") {
      const executeLeaving = () => {
        dispatchAndReport(
          () =>
            recordWardDeparture
              ? recordWardDeparture(item.selectableKey!, unit.id, leavingDestination)
              : dispatch({
                  type: "RECORD_LEAVING",
                  role: "ward",
                  now,
                  admissionId: item.selectableKey!,
                  actingUnitId: unit.id,
                  leavingDestination,
                }),
          `Recorded departure: ${item.who || nameFor(item.selectableKey)} has left the ward.`,
          "Recorded departure: this patient has left the ward.",
        );
      };

      if (!requireConfirmation) {
        executeLeaving();
        return;
      }

      setPendingConfirm({
        kind: "leaving",
        who: item.who || nameFor(item.selectableKey),
        item,
        admissionId: item.selectableKey,
      });
      return;
    }
    if (word === "Patient arrived" || word === "They have arrived") {
      const matchingMovement = movementForBoardArrival(movements, item.selectableKey);
      if (!matchingMovement) {
        const msg = `Cannot confirm arrival: no movement matches ${item.who || nameFor(item.selectableKey)}.`;
        setToastMessage(msg);
        announceToWardShell("Cannot confirm arrival: no movement matches this patient.");
        return;
      }
      dispatchAndReport(
        () =>
          dispatch({
            type: "PATIENT_ARRIVED",
            role: "ward",
            now,
            movementId: matchingMovement.id,
            actingUnitId: unit.id,
          }),
        `Patient arrived: ${item.who || nameFor(item.selectableKey)} confirmed on the ward.`,
        "Patient arrived: this patient confirmed on the ward.",
      );
      return;
    }
    if (word === "Mark them back") {
      // Owner ruling 2026-09-25: a leave bed names its stay, so this ends THIS person's own leave,
      // if they have one, and never the ward's first leave bed or an invented id (the old guess
      // could end somebody else's leave).
      const matchingLeave = leaveBeds.find((b) => b.admissionId === item.selectableKey);
      const isAwayAtEd = occupants.some((o) => o.key === item.selectableKey && o.awayAtEdHours !== null);
      const who = item.who || nameFor(item.selectableKey);
      if (!matchingLeave && !isAwayAtEd) {
        const msg = `Nothing to mark back: no leave or emergency department absence is recorded for ${who}. Nothing was changed.`;
        setToastMessage(msg);
        announceToWardShell(
          "Nothing to mark back: no leave or emergency department absence is recorded for this patient. Nothing was changed.",
        );
        return;
      }
      dispatchAndReport(
        () => {
          if (matchingLeave) {
            dispatch({
              type: "END_LEAVE_BED",
              role: "ward",
              now,
              leaveBedId: matchingLeave.id,
              actingUnitId: unit.id,
            });
          }
          if (isAwayAtEd) {
            dispatch({
              type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
              role: "ward",
              now,
              admissionId: item.selectableKey!,
              actingUnitId: unit.id,
            });
          }
        },
        `Returned to ward: ${who} marked back${isAwayAtEd && !matchingLeave ? " from the emergency department" : " from leave"}.`,
        `Returned to ward: this patient marked back${isAwayAtEd && !matchingLeave ? " from the emergency department" : " from leave"}.`,
      );
      return;
    }
    if (word === "Record a blocker") {
      dialogTriggerRef.current =
        typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
      setSelectedBlocker(BED_RELEASE_BLOCKERS[0]);
      setBlockerDialogItem(item);
      return;
    }
  };

  const shiftDigest =
    shiftTab === "quiet"
      ? "A quiet shift, drawn on purpose so the empty state is designed rather than left to look broken."
      : shiftTiles.length > 0
        ? `${shiftTiles.length} ${shiftTiles.length === 1 ? "thing needs" : "things need"} you before the handover at 15:30.`
        : "Nothing needs you before the handover at 15:30.";

  return (
    <div className={styles.screen} data-testid="ward-board" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        <h1 className={styles.screenName}>Bed board</h1>

        {/*
         * A `<div>`, NOT a `<header>` — found by printing the page and looking, not by a test.
         * The global print reset in `globals.css` carries `header, nav, button { display: none
         * !important }` to strip workspace chrome from a printed sheet. This block is a page
         * header, not workspace chrome, so as a `<header>` it vanished in print and a printed ward
         * board carried no ward name, no hospital and no headline figure at all — a sheet of
         * anonymous numbered boxes that could have come from any ward in the state. Other pages
         * fight that rule back with a `display: block !important` override; not using the element
         * is simpler and cannot be undone by a later reset. Nothing here is a landmark: the page's
         * one landmark is the `<main>` above.
         */}
        <div className={styles.header}>
          {/* 🔴 **THE SCREEN'S NAME IN THE `h1`, THE WARD'S IN AN `h2`** — the drawing's shape, and the
              same ruling already applied to the ward screen (A1). Until now the `h1` WAS the ward's
              name, so **every ward rendered a different `h1` and this screen had no stable name
              anywhere on it**.

              ⚠️ **The ward's name is DEMOTED, never dropped.** A board that lost it would be a grid of
              anonymous tiles that could have come from any ward in the state — which is the worse of
              the two defects, and is what `ward-board-third-edition-headings.dom.test.tsx` asserts
              alongside the `h1`, deliberately in the same file. **The class and the test id do not
              move**, so nothing that finds this by id or styles it by class is disturbed. */}
          <h2 id="ward-board-unit-name" className={styles.unitName} data-testid="ward-board-unit-name">
            {unit.name}
          </h2>
          <p className={styles.siteName} data-testid="ward-board-site-name">
            <strong>{site.service}</strong> · {site.name}
          </p>
          {/* Item 44, build plan task G2, §3 "Bed board": this page is about ONE named place (§2
           *  "Never hidden", S4) and is never itself narrowed by the chosen service — this states
           *  how the choice relates to it. Two branches, same as the choice, never the same
           *  service ↔ different service the ward page's own F3 sentence deliberately avoided. */}
          {service !== null ? (
            <p className={styles.constraint} data-testid="ward-board-service-sentence">
              {service === site.service
                ? `The Service selector is set to ${service}, which is this ward's own service.`
                : `The Service selector is set to ${service}. This ward is in ${site.service}. The board always shows this one ward.`}
            </p>
          ) : null}
          {/*
           * THE LOCKED/OPEN SPLIT, which the owner asked for by name on 2026-09-04 — "some wards are a
           * combination with a number of designated locked beds and open beds" — and which this board
           * was the last screen not to say. Five others already render it.
           *
           * ⚠️ THROUGH `designationSummary`, NEVER `beds - lockedBeds` HERE. Open beds are derived and
           * never stored, on the owner's one-source ruling, and that module exists precisely because
           * the old flag was read in eight files: a subtraction repeated eight times is eight chances
           * to get it the wrong way round. It also says "All open" rather than "0 locked, 17 open",
           * because a zero beside a real number reads as a measurement, and a ward with no locked beds
           * has a kind of bed it does not have rather than zero of them.
           *
           * ⚠️ A COUNT, NOT AN ASSIGNMENT, and that is the whole of what this board may say. Which
           * TILE is a locked bed is not recorded — an `Admission` holds the unit and never a bed — so
           * the drawing this screen came from split the grid into a "locked bay" and an "open beds"
           * group and could not have. The ward's split is a fact; a tile's is not.
           *
           * ⚠️ AND IT SAYS NOTHING ABOUT PATIENTS. `ward-model.ts` puts it in terms: a locked bed is a
           * property of the WARD, an involuntary patient a property of the PERSON, and a voluntary
           * patient may be nursed on a locked ward. The drawing headed twelve tiles "these are the only
           * beds that can hold a detained patient" — false in both directions, and rendered nowhere here.
           */}
          <p className={styles.designation} data-testid="ward-board-designation">
            {unit.beds} bed{unit.beds === 1 ? "" : "s"} · {designationSummary(unit)}
          </p>
          <p className={styles.headline} data-testid="ward-board-headline">
            <span className={styles.headlineValue}>{available}</span>
            <span className={styles.headlineLabel}>ready bed{available === 1 ? "" : "s"}</span>
          </p>
          {/*
            Its OWN sentence, never a figure beside the figure — `ward-screen.tsx` found in a browser
            that rendering "Ready 2" immediately followed by "1 still being made ready" reads as 21
            on the screen whose whole job is telling a ward how many beds it has. It renders only
            when there is one: an absence here is silence, never a "0 being made ready", which would
            be a claim nobody made.
          */}
          {/* v6 band figures (design/pages-v6/WardBoard--bed-board.png). Each is a count this page
              already prints below — the triage bar, the incoming list and the Going out list — so the
              band cannot disagree with them. */}
          <dl className={styles.bandStats} data-testid="ward-board-band-stats">
            <div>
              <dt>Occupied</dt>
              <dd>{states.occupied}</dd>
            </div>
            <div>
              <dt>Going out today</dt>
              <dd>{outgoing.length}</dd>
            </div>
            <div>
              <dt>Coming in</dt>
              <dd>{incoming.length}</dd>
            </div>
            <div>
              <dt>
                {pulledIn.length > 0 ? (
                  <span aria-hidden="true" className={styles.bandGlyph}>
                    ▲
                  </span>
                ) : null}
                Pulled, not arrived
              </dt>
              <dd>{pulledIn.length}</dd>
            </div>
          </dl>
          {pendingPreparation > 0 ? (
            <p className={styles.beingMadeReady} data-testid="ward-board-pending-preparation">
              {pendingPreparation} of them {pendingPreparation === 1 ? "is" : "are"} still being made ready — the bed
              stays offered and stays counted, but the ward cannot admit into it yet.
            </p>
          ) : null}
          {/* `constraintSentence` returns null — never an empty string — when nothing is
            constraining, so nothing is rendered rather than a blank line that reads as a sentence
            which failed to load. */}
          {constraint !== null && (
            <p className={styles.constraint} data-testid="ward-board-constraint">
              {constraint}
            </p>
          )}
          {/*
           * THE "AS AT" STAMP — spec DB-10, DB-11 and DB-12, and it is load-bearing rather than
           * provenance.
           *
           * DB-11 dropped the frozen 08:00 view outright: this board and its printed sheet are one
           * LIVE picture, and the owner was shown the cost of that and took it. What was traded for
           * the freeze is exactly this line. Two sheets taken an hour apart are then visibly two
           * moments rather than two competing claims — so DB-10 puts the stamp in the HEADING, read
           * as part of the title, and says in terms that small print at the foot of the page does
           * not discharge the requirement.
           *
           * **It reads `now` — the same variable every figure on this page reads (DB-12).** Never
           * `wallClockNow()`. Ward Flow screens take their `now` from a shared value a demo control
           * can move, so a stamp on the wall clock beside figures from a moved clock would assert a
           * moment that is not the moment being shown. A stamp that can lie is worse than no stamp,
           * because the freeze was removed on the strength of it. That is invisible to any test
           * that does not move the clock, which is why `tests/ward-daily-sheet.dom.test.tsx`
           * renders this board at two different instants and asserts the stamp AND the figures both
           * moved.
           *
           * The DATE that DB-10 also asks for is absent, and since `b1198cf6e` that is a CHOICE
           * rather than a limitation: the clock gained a real date, so this could print one. It
           * does not, because a real date beside invented figures is the one combination that
           * makes a prototype look like a record. See `asAtStamp`'s own doc comment.
           */}
          <p className={styles.asAt} data-testid="ward-board-as-at">
            {stamp.time === null ? (
              "As at — the moment shown is not recorded."
            ) : (
              <>
                <span className={styles.asAtValue}>As at {stamp.time}</span>
                <span className={styles.asAtNote}>{stamp.dayNote}</span>
              </>
            )}
          </p>
          {/*
           * THE BOARD IS LIVE, and the note that said otherwise has gone with the fixture.
           *
           * Owner decision 2026-09-01. Two of his decisions had been sitting in this one file at
           * once: DB-11 (2026-08-29) dropped the frozen view and made everything live, and a
           * fixed-board decision (2026-08-30) kept this screen still. The board carried both, forty
           * lines apart, and the visible result was this screen reading `Held 1` at 10:42 while the
           * ward screen read `Held 0` at 12:32 for the same ward at the same moment. Under a note
           * mentioning only the clock, that reads as a fault rather than as a stated design — which
           * is exactly what the earlier comment here predicted would happen, and it did.
           *
           * Nothing renders a fixed-example note now, because there is no fixed example.
           */}
        </div>

        <div className={styles.wardTools}>
          <div className={styles.wardToolsLeft}>
            <nav className={styles.wardScreenNav} aria-label={`${unit.name} screens`}>
              <Link href={unitHref(unit.id)}>Ward home</Link>
              <span aria-current="page">Bed board</span>
            </nav>
          </div>
          <div className={styles.wardToolsRight}>
            <button
              type="button"
              className={`${styles.topDailySheetButton}${sheetOpen ? ` ${styles.topDailySheetButtonOpen}` : ""}`}
              onClick={() => {
                setSheetOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => {
                      const el =
                        document.getElementById("ward-board-daily-sheet") ||
                        document.getElementById("ward-daily-sheet");
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 60);
                  }
                  return next;
                });
              }}
              aria-expanded={sheetOpen}
              aria-controls="ward-board-sheet-body"
              data-testid="ward-board-top-sheet-toggle"
            >
              <svg
                className={styles.topDailySheetIcon}
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5.5 2.5h5M6 1.5h4a1 1 0 0 1 1 1v1H5v-1a1 1 0 0 1 1-1z" />
                <rect x="3" y="3.5" width="10" height="11" rx="1.5" />
                <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" />
              </svg>
              <span>{sheetOpen ? "Hide shift brief" : "Show shift brief"}</span>
              <span
                className={`${styles.topDailySheetChevron}${sheetOpen ? ` ${styles.topDailySheetChevronOpen}` : ""}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
            <details className={styles.wardSwitch}>
              <summary>
                Change ward <span>{liveUnits.length} wards</span>
              </summary>
              <div className={styles.wardSwitchBody}>
                <p className={styles.wardSwitchHeading}>Choose a ward</p>
                <ul className={styles.wardSwitchList}>
                  {liveUnits.map((candidate) => (
                    <li key={candidate.id}>
                      <Link
                        href={wardBoardHref(candidate.id)}
                        aria-current={candidate.id === unit.id ? "page" : undefined}
                      >
                        <span>{candidate.name}</span>
                        {candidate.id === unit.id && <small>You are here</small>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        </div>

        {/*
         * THE WARD BAND — ten current figures for this one ward. Six retain the home page's exact
         * vocabulary; the other four repeat counts already present in the grid and flow regions.
         *
         * **Every label comes from `CAPACITY_FIGURE_LABELS`** (`ward-morning-rollup.ts`), the single
         * capacity vocabulary spec D3/D14 requires to be identical at service, hospital and ward
         * level. Retyping "Available now" here would pass every test today and cost the cheap rename
         * tomorrow — and, worse, would let this board and the morning page start calling one figure
         * two things. The values come from `capacityBreakdown` for THIS unit, which is the same
         * function the morning page's ward rollup calls, so the two surfaces are one arithmetic.
         *
         * **The toggle changes emphasis; it never hides a figure.** All ten are on the band in every
         * state. A control able to take the blocked-releases figure off a coordinator's screen is a
         * control able to hide the one thing they most need to chase, so the toggle instead selects
         * which of Confirmed today / Expected today the "Going out today" list below is built from —
         * the owner's own "daily discharges … and toggles to daily expects". The selected figure is
         * marked in WORDS ("shown in Going out") as well as by weight, because a mark carried by
         * weight alone is a mark a greyscale sheet loses.
         */}
        <section className={styles.triage} aria-labelledby="ward-board-triage-heading" data-testid="ward-board-triage">
          <h2 id="ward-board-triage-heading" className={styles.triageHeading}>
            Today on this ward
          </h2>
          <dl className={styles.triageFigures}>
            {figures.map(({ key, label, value, led = false }) => {
              return (
                <div
                  key={key}
                  className={`${styles.triageFigure}${led ? ` ${styles.triageFigureLed}` : ""}`}
                  data-testid={`ward-board-figure-${key}`}
                  data-figure-key={key}
                  data-figure-led={led ? "true" : "false"}
                >
                  <dt className={styles.triageLabel}>{label}</dt>
                  <dd className={styles.triageValue}>{value}</dd>
                  {led && <dd className={styles.triageLedNote}>shown in Going out</dd>}
                </div>
              );
            })}
          </dl>
        </section>

        {/* Stranded-patient prompts (smart feature 12): long stays with no expected date, and people
            ready to leave but waiting on something outside the ward. Scoped to this ward. */}
        <StrandedPrompts
          admissions={admissionsForUnit(admissions, unit.id)}
          now={now}
          nameFor={nameFor}
          onOpen={setSelectedKey}
          bedReleases={liveBedReleases}
        />

        {/*
         * NEEDS A LOOK THIS SHIFT — the owner asked for the board's exceptions condensed into one
         * toggle rather than read off six panels, and this is that.
         *
         * ⚠️ EVERY FIGURE HERE IS ALREADY ON THIS PAGE. Nothing is computed for this band: the counts
         * come from `incoming`, `outgoing`, `blockedTileCount` and the same `breakdown` the triage bar
         * prints, so the band cannot disagree with the panels below it. A digest that derives its own
         * numbers is a second arithmetic, and two arithmetics on one screen eventually differ.
         *
         * NO BED IDENTITY, and this is the owner's ruling of 2026-09-07 rather than a style choice.
         * The drawing this came from named beds — "bed 09 overdue 7h", "bed 18 out of service" — and an
         * `Admission` records the unit and never a bed, so those sentences claim something the model
         * does not hold. They are counts here, and a count is the whole of what is true.
         *
         * A `<details>` IS PERMITTED HERE AND WAS NOT ELSEWHERE, so the two need telling apart. The
         * owner ruled a fold out on the network PICTURE (2026-08-29) because a folded group makes wards
         * disappear; the ruling says in terms that folding was permitted for the bed LIST, "where
         * folding only shortens a scroll". This is a list.
         *
         * ⚠️ AND IT IS NOT PART OF THE PRINTED SHEET. A closed `<details>` prints as its summary and a
         * blank space — the reason `sheetOpen` below is a button and not a `details` at all. The
         * handover sheet is its own document further down this page; this band is screen chrome, so
         * the stylesheet drops it from print rather than half-printing it.
         *
         * `open` by default: nothing is hidden from a reader who has not met the control.
         */}
        {/*
         * THE THREE ZONES, and the reading they are arranged to give: LEFT who is coming in and what
         * is going out, MIDDLE the beds themselves, RIGHT whichever one the reader has chosen. Left
         * to right that is in → in a bed → out, which is the flow this whole prototype is about.
         *
         * The right zone is a SLIDE-OUT rather than a permanent column: it is absent until a tile is
         * chosen, so it costs no width on a screen where nobody has chosen one, and it takes its own
         * grid track rather than sitting over the beds — a panel that covered the grid would force a
         * reader to close it to do the thing they opened it for. On a phone there is no third column
         * at all and it falls into the flow directly beneath the grid, which is the same arrangement
         * without the overlay a phone sheet would impose.
         */}
        <div
          className={`${styles.zones}${selectedTile !== null ? ` ${styles.zonesOpen}` : ""}`}
          onKeyDown={onZoneKeyDown}
        >
          <div className={styles.flowColumn}>
            <div className={styles.flowHeader}>
              <h2 id="ward-board-flow-heading">Either side of this ward</h2>
              <span>
                {outgoing.length} going out · {incoming.length} coming in
              </span>
            </div>
            <div className={styles.tabList} role="tablist" aria-label="Which side of the ward is shown">
              <button
                type="button"
                id="ward-board-flow-tab-outgoing"
                role="tab"
                data-flow-tab="outgoing"
                aria-selected={flowTab === "outgoing"}
                aria-controls="ward-board-outgoing"
                tabIndex={flowTab === "outgoing" ? 0 : -1}
                onClick={() => setFlowTab("outgoing")}
                onKeyDown={onFlowTabKeyDown}
              >
                Going out <span>{outgoing.length}</span>
              </button>
              <button
                type="button"
                id="ward-board-flow-tab-incoming"
                role="tab"
                data-flow-tab="incoming"
                aria-selected={flowTab === "incoming"}
                aria-controls="ward-board-incoming"
                tabIndex={flowTab === "incoming" ? 0 : -1}
                onClick={() => setFlowTab("incoming")}
                onKeyDown={onFlowTabKeyDown}
              >
                Coming in <span>{incoming.length}</span>
              </button>
              <button
                type="button"
                id="ward-board-flow-tab-since"
                role="tab"
                data-flow-tab="since"
                aria-selected={flowTab === "since"}
                aria-controls="ward-board-since-yesterday"
                tabIndex={flowTab === "since" ? 0 : -1}
                onClick={() => setFlowTab("since")}
                onKeyDown={onFlowTabKeyDown}
              >
                Since yesterday
              </button>
            </div>
            {/*
             * COMING IN. Two states with a real difference between them: `"pulled"` means this ward
             * has ALREADY given the bed away and the person is travelling — the grid draws that bed
             * as "Empty, waiting" and it is gone from the ward's count — while `"waitlisted"` means
             * accepted in principle with nothing held. Merging them would let a reader plan against
             * a bed that is already spoken for.
             */}
            <section
              id="ward-board-incoming"
              className={styles.flowPanel}
              role="tabpanel"
              aria-labelledby="ward-board-flow-tab-incoming"
              data-testid="ward-board-incoming"
              hidden={flowTab !== "incoming"}
              tabIndex={0}
            >
              <h2 id="ward-board-incoming-heading" className={styles.flowHeading}>
                Coming in
              </h2>
              <p className={styles.flowIntro} data-testid="ward-board-incoming-count">
                {incoming.length === 0
                  ? "Nobody is recorded as coming in to this ward."
                  : `${incoming.length} recorded as coming in.`}
              </p>
              {incoming.length > 0 && (
                <ol className={styles.flowList} data-testid="ward-board-incoming-list">
                  {incoming.map((person) => (
                    <li
                      key={person.key}
                      className={styles.flowRow}
                      data-testid={`ward-board-incoming-${person.key}`}
                      data-incoming-state={person.state}
                    >
                      <p className={styles.flowRowLead}>
                        {person.state === "pulled" ? "Bed already given away" : "Waiting — no bed given"}
                      </p>
                      <p className={styles.flowRowLine}>
                        {person.sex} · Gender: {person.gender ?? "Not recorded"},{" "}
                        {person.homeRegion === null ? "home region not recorded" : `from ${person.homeRegion}`}
                      </p>
                      {person.state === "pulled" && (
                        <p className={styles.flowRowLine}>{bedGonePhrase(person.bedGoneHours)}</p>
                      )}
                      {person.state === "pulled" && person.pullExpiresAt !== null ? (
                        <p className={styles.flowRowLine} data-testid={`ward-board-incoming-pull-hold-${person.key}`}>
                          Bed pull {pullHoldRemainingLabel(person.pullExpiresAt, now)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
              {/* Said rather than left as an absence a reader might read as "not yet loaded". The
                record holds when a bed was given away and nothing else about the journey. */}
              <p className={styles.flowNote}>Expected arrival time is not recorded.</p>
            </section>

            {/*
             * GOING OUT TODAY, on whichever of the two bases the triage bar's toggle selects. The row
             * count here EQUALS the figure on the bar above by construction — `outgoingToday` applies
             * the same filter `capacityBreakdown` counts with — so a reader can check the board
             * against itself without trusting either.
             */}
            <section
              id="ward-board-outgoing"
              className={styles.flowPanel}
              role="tabpanel"
              aria-labelledby="ward-board-flow-tab-outgoing"
              data-testid="ward-board-outgoing"
              hidden={flowTab !== "outgoing"}
              tabIndex={0}
            >
              <h2 id="ward-board-outgoing-heading" className={styles.flowHeading}>
                Going out today
              </h2>
              {/* The basis is stated in WORDS as well as by the toggle's pressed state, so a printed
                sheet — where the toggle is gone with every other button — still says which of the
                two lists it is. */}
              <p className={styles.flowIntro} data-testid="ward-board-outgoing-count">
                Showing {OUTGOING_BASIS_LABEL[outgoingBasis]}: {outgoing.length} bed{outgoing.length === 1 ? "" : "s"}.
              </p>
              {/*
               * THE TOGGLE SITS WITH THE LIST IT CHANGES. Owner, 2026-08-30.
               *
               * It was on the far right of the triage bar, a full screen-width away from the only
               * thing it alters — so a reader who pressed it watched a list move in the corner of
               * their eye, and a reader looking at the list had no idea it had two states. A
               * control belongs beside its effect.
               *
               * The count line directly above states the basis in WORDS as well, which is what
               * keeps a printed sheet honest: every button is stripped from paper, so the toggle's
               * pressed state cannot be the only thing saying which list this is.
               */}
              <div
                className={styles.flowToggle}
                role="group"
                aria-label="Which of today's departures the Going out list shows"
              >
                <span className={styles.flowToggleLabel}>Going out shows</span>
                {OUTGOING_BASES.map((basis) => (
                  <button
                    key={basis}
                    type="button"
                    className={`${styles.flowToggleButton}${outgoingBasis === basis ? ` ${styles.flowToggleButtonOn}` : ""}`}
                    aria-pressed={outgoingBasis === basis}
                    onClick={() => setOutgoingBasis(basis)}
                    data-testid={`ward-board-basis-${basis}`}
                  >
                    {OUTGOING_BASIS_LABEL[basis]}
                  </button>
                ))}
              </div>
              {outgoing.length === 0 ? (
                <p className={styles.flowRowLine}>No bed on this ward carries that today.</p>
              ) : (
                <ol className={styles.flowList} data-testid="ward-board-outgoing-list">
                  {outgoing.map((release) => {
                    const band = releaseBand(release, now);
                    return (
                      <li key={release.id} className={styles.flowRow} data-testid={`ward-board-outgoing-${release.id}`}>
                        <p className={styles.flowRowLead}>
                          {band === "beyond-today" ? "Expected today" : RELEASE_BAND_PHRASE[band]}
                        </p>
                        {/* A ROLE, never a personal name — `BedRelease.confirmedBy`'s own rule. */}
                        <p className={styles.flowRowLine}>Reported by {release.confirmedBy}</p>
                        {release.blocker !== null && (
                          <p className={styles.flowRowBlocker}>
                            Held up by: {release.blocker}
                            {release.blockedBy !== null ? ` — recorded by ${release.blockedBy}` : ""}.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {/* The honest limit of this list, stated on it. A `BedRelease` deliberately carries
                NOTHING about the departing patient — not an id, not a sex, not a destination — so
                these rows are beds and can never become people without breaking that. */}
              <p className={styles.flowNote}>Beds, not people; bed-release records carry no patient identifier.</p>
              {/* 🟢 **FOLDED IN FROM ITS OWN PANEL.** The drawing's footnote: *"Where these beds free
                  up to was folded into Going out. Both panels listed the same beds, the ones with a
                  discharge date."* **Two panels, one population** — so it is now a group inside the
                  list it duplicated, not a second landmark beside it.

                  ⚠️ **An `h3` and a `<div>`, not an `h2` and an `<aside>`.** It stopped being a panel,
                  so it stops being a landmark and stops competing with its parent's heading. The
                  destination team, whether that team has been told, and the no-date note all come
                  with it — the footnote's "no count, note or action was dropped" is a promise this
                  fold has to keep. */}
              {targets.length > 0 && (
                <div className={styles.destinations}>
                  <h3 className={styles.destinationsHeading}>Where these beds free up to</h3>
                  <p className={styles.destinationsIntro}>Expected within {ARROW_HORIZON_DAYS} days, soonest first.</p>
                  <ol className={styles.destinationList} data-testid="ward-board-destinations">
                    {targets.map((target) => {
                      return (
                        <li
                          key={target.region}
                          className={styles.destination}
                          data-testid={`ward-board-destination-${target.region}`}
                        >
                          <p className={styles.destinationRegion}>{target.region}</p>
                          <p className={styles.destinationCount}>
                            {target.count} {target.count === 1 ? "person" : "people"}
                            {" · "}
                            {target.nearestDays === 0
                              ? "soonest due now or overdue"
                              : `soonest in ${target.nearestDays} day${target.nearestDays === 1 ? "" : "s"}`}
                          </p>
                          {/*
                            🔴 **NO TEAM IS NAMED HERE, AND THE ABSENCE IS THE CORRECT ANSWER
                            RATHER THAN AN UNFINISHED ONE. Owner instruction, 2026-09-18.**

                            This panel groups by `admission.homeRegion` (`arrowTargets`). Until today
                            it printed `teamForRegion(region)` — ten hand-written names each ending
                            "(placeholder)" — while the community screen and the referral picker one
                            click away showed the 64 REAL catchment teams. The owner asked for the real
                            list to be wired in here too.

                            ⚠️ **It must not be, and swapping the names would have been worse
                            than leaving them.** A real clinic name derived from a patient's home region
                            is a routing CLAIM — "these people go to Butler" — produced from
                            where somebody lives. Owner decision 8 (2026-09-17, answer 20): referral
                            lists narrow by sending and receiving service, **never home area**. The
                            research pack forbids the same move in its own words, by name: never match
                            on suburb, postcode, LGA or proximity. A "(placeholder)" suffix reads on
                            sight as a stand-in; "Butler Community Mental Health Service" reads as a
                            fact, so the swap would have converted an obvious stub into a false claim.

                            ✅ **Nothing records a team for these people.** `Admission`
                            (`ward-admissions.ts:288`) carries no team field; `bookedBy.placeId`
                            identifies a community team that booked TRANSPORT, which is a different
                            fact about a different act. So this line says so, in the words this panel
                            already used for the same situation — "there is nobody to ring about
                            this region" is exactly what a coordinator chasing a discharge needs to
                            see rather than infer from a gap.

                            When a recorded team field exists, read THAT here. Do not reintroduce a
                            region lookup.
                          */}
                          <p className={styles.destinationTeamAbsent}>No community team is recorded for this region.</p>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </section>

            {/* SINCE YESTERDAY — `sinceYesterday`'s first consumer. The last whole day, which carries
              no clinical or legal meaning and is simply the window between one morning and the
              next. */}
            <section
              id="ward-board-since-yesterday"
              className={styles.flowPanel}
              role="tabpanel"
              aria-labelledby="ward-board-flow-tab-since"
              data-testid="ward-board-since-yesterday"
              hidden={flowTab !== "since"}
              tabIndex={0}
            >
              <h2 id="ward-board-since-heading" className={styles.flowHeading}>
                Since yesterday
              </h2>
              <ul className={styles.sinceList}>
                <li className={styles.sinceItem} data-testid="ward-board-since-discharged">
                  <span className={styles.sinceValue}>{movement.discharged}</span> left this ward
                </li>
                <li className={styles.sinceItem} data-testid="ward-board-since-pulled">
                  <span className={styles.sinceValue}>{movement.pulled}</span> bed{movement.pulled === 1 ? "" : "s"}{" "}
                  given away
                </li>
                <li className={styles.sinceItem} data-testid="ward-board-since-dates-moved">
                  <span className={styles.sinceValue}>{movement.datesMoved}</span> expected date
                  {movement.datesMoved === 1 ? "" : "s"} moved
                </li>
              </ul>
              {/* `discharged` counts departures of every destination and must never be summed across
                wards as beds returned to the network — see `sinceYesterday`'s own doc comment. */}
              <p className={styles.flowNote}>
                A transfer to another psychiatric ward counts here: this ward gets its bed back, the state does not.
              </p>
            </section>
          </div>

          <div className={styles.gridColumn}>
            {/* ✅ **THE GRID HAD NO HEADING AT ALL** — measured across the whole component, not inferred.
                The drawing names it, and a grid of twenty tiles with nothing above it is unreachable
                for anybody navigating this screen by heading. */}
            <header className={styles.sectionHeading}>
              <h2 id="ward-board-beds-heading">Every bed, and who is in it</h2>
              <span className={styles.sectionCount}>
                Showing {filteredTiles.length} of {tiles.length} beds
              </span>
            </header>
            <div className={styles.boardBar}>
              <div className={styles.filterSet} role="group" aria-label="Narrow the bed board">
                {BOARD_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={bedFilter === filter}
                    onClick={() => {
                      setBedFilter(filter);
                      if (selectedTile !== null && !tileMatchesFilter(selectedTile, filter)) {
                        focusBackTo.current = null;
                        setSelectedKey(null);
                      }
                    }}
                    data-testid={`ward-board-filter-${filter}`}
                  >
                    {BOARD_FILTER_LABELS[filter]}
                    <span className={styles.filterCount}>
                      {filterCounts[filter] === 0 ? "none" : filterCounts[filter]}
                    </span>
                  </button>
                ))}
              </div>
              <label className={styles.orderControl} htmlFor="ward-board-order-select">
                <span>Order</span>
                <select
                  id="ward-board-order-select"
                  name="wardBoardOrder"
                  value={bedOrder}
                  onChange={(event) => setBedOrder(event.target.value as BoardOrder)}
                  aria-label="Order the beds"
                >
                  {BOARD_ORDERS.map((order) => (
                    <option key={order} value={order}>
                      {BOARD_ORDER_LABELS[order]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/* The legend explains the shades. It is not what makes the board readable without colour —
              the day count on every tile does that — it just saves a reader working the ranges out. */}
            <ul className={styles.legend} data-testid="ward-board-legend">
              {STAY_BANDS.map((band) => (
                <li key={band.id} className={styles.legendItem}>
                  <span className={`${styles.legendSwatch} ${BAND_CLASS[band.id]}`} aria-hidden="true">
                    <span className={styles.legendGlyph}>●</span>
                  </span>
                  <span className="sr-only">Stay length: </span>
                  {band.label}
                </li>
              ))}
              <li className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.legendSwatchPast}`} aria-hidden="true">
                  <span className={styles.legendGlyph}>▲</span>
                </span>
                <span className="sr-only">Warning: </span>
                Past the ward&apos;s own expected date
              </li>
              {/* Listed beside the stay bands because a reader counting fillable beds needs to know
                this tile exists. The tile says so in words on its own face too — this is the index,
                not the explanation. */}
              <li className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.legendSwatchBlocked}`} aria-hidden="true">
                  <span className={styles.legendGlyph}>■</span>
                </span>
                <span className="sr-only">Out of service: </span>
                Out of service — not fillable
              </li>
              {/* Task B. Same reasoning as the blocked entry just above: the tile itself says
                "Closed" in words, this is only the index. (The `Held` style names predate the
                2026-09-01 ruling that renamed this box Closed; "Held" now means a leave bed only.) */}
              <li className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.legendSwatchHeld}`} aria-hidden="true">
                  <span className={styles.legendGlyph}>○</span>
                </span>
                <span className="sr-only">{BED_STATE_LABELS.closed}: </span>
                Empty, not offered — not fillable
              </li>
            </ul>

            {/*
             * THE TILES ARE NOW BUTTONS, and two things follow that are not negotiable.
             *
             * **The print restore.** `globals.css`'s print reset carries `header, nav, button {
             * display: none !important }`, so an unrestored tile button vanishes from paper and the
             * printed board is an empty grid — the exact defect this branch spent today fixing on
             * four other surfaces. `board.module.css`'s print block forces `.bed` back to
             * `display: flex !important`; a class selector outranks the bare element selector, so the
             * restore holds without touching the global reset.
             *
             * **Still no bed identity.** The button's accessible name is the tile's own content — a
             * day count, or the word Ready / Pulled / Closed / Out of service — and never an ordinal. Nothing
             * numbers these tiles and nothing may. The chosen presentation order changes only the
             * scan order; “Recorded order” restores the source order and none is a floor plan.
             */}
            {/* 🔴 **`<ul>`, NOT `<ol>` — THE GRID ASSERTS NO ORDER BECAUSE IT HAS NONE.** The rule at
                the top of this component says a tile carries no bed identity and that nothing here
                ever has an ordinal to print. `buildTiles` pushes occupants in seed order and then
                `blocked-n`, `closed-n`, `empty-n` — **counts rendered as tiles, with keys that are
                literally `empty-3`.** Reordering two of them changes nothing a reader could read, so
                an ordered list was claiming what the data cannot support.

                ⚠️ **An `<ol>` supplies a position IMPLICITLY**, with no `aria-posinset` anywhere — which
                is how a census of those two attribute names once reported this defect absent from the
                codebase while the grid was it. **Still a list: the tile count is real and a screen
                reader should keep it. Unordered, not unlisted.**

                ⚠️ **The board's other lists are a different matter and were left alone** — the
                destinations and people lists ARE ordered and say so in visible prose. */}
            <ul className={styles.beds} data-testid="ward-board-beds" aria-label="Beds on this ward" tabIndex={0}>
              {orderedTiles.map((tile) => {
                const index = tileIndexMap.get(tile) ?? tiles.indexOf(tile);
                const selected = tile.key === selectedKey;
                const tileOccupant = occupantByKey.get(tile.key);
                return (
                  <li
                    key={tile.key}
                    className={styles.bedSlot}
                    data-testid={`ward-board-bed-${index + 1}`}
                    data-bed-kind={tile.kind}
                    hidden={!tileMatchesFilter(tile, bedFilter)}
                  >
                    <button
                      type="button"
                      id={tileDomId(tile.key)}
                      className={tileClassName(tile, selected)}
                      aria-pressed={selected}
                      aria-controls={selected ? "ward-board-detail" : undefined}
                      onClick={() => (selected ? closeDetail() : setSelectedKey(tile.key))}
                    >
                      {tile.kind === "occupied" && (
                        <>
                          <span className={styles.bedTop}>
                            <span className={styles.bedState}>Occupied</span>
                          </span>
                          <span className={styles.bedFigureRow}>
                            <span className={styles.days} data-testid={`ward-board-bed-${index + 1}-days`}>
                              {tile.days}
                              <span className={styles.daysUnit}> day{tile.days === 1 ? "" : "s"}</span>
                            </span>
                            {tileOccupant !== undefined && (
                              <span className={styles.bedWho}>
                                {tileOccupant.sex} · {tileOccupant.homeRegion ?? "home region not recorded"}
                              </span>
                            )}
                          </span>
                          {/* The stay band as four steps, the legend's own scale. It repeats the band
                            label beside it, so nothing is carried by the bar alone. */}
                          <span className={styles.stayBar} data-band={tile.bandId ?? "none"} aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <span />
                          </span>
                          <span className={styles.bedNote}>{tile.bandLabel}</span>
                          {/* The band in words, for the screen reader only: the visible number already
                            states it.

                            🔴 **THE ORIGINAL SENTENCE HERE SAID PRINTING BOTH "WOULD CROWD OUT THE NUMBER
                            THIS WHOLE TILE EXISTS TO SHOW". MEASURED IN A BROWSER, THAT IS FALSE.**
                            Revealing the band on every occupied tile: **zero horizontal overflow, and
                            the number's width unchanged to the pixel** (38→38, 19→19).
                            ⚠️ **Both fit.** The tile is not crowded and never was.

                            ✅ **THE REAL COST IS VERTICAL, AND IT IS WHY THE LABEL STAYS `sr-only`:** every
                            occupied tile grows **88px → 117px**, one to 138px, all seventeen — about a
                            third taller, and the grid a third longer. **On a phone that is a materially
                            longer scroll through the beds, and that is the cost we declined.**

                            ⚠️ **THE MEASUREMENT, carried with the conclusion so nobody re-runs it:**
                            Chromium, **375px viewport**, 17 occupied tiles, tile **109×88px**, three
                            columns of 109px. 🔴 **Note 109 and not 80: `minmax(5rem, 1fr)` under
                            `auto-fill` makes 5rem a FLOOR, not the width** — two earlier versions of this
                            comment named 390px and then 80px, and both were wrong.

                            ⚠️ **DESKTOP IS UNMEASURED.** This is a phone cost only; at a wider viewport the
                            same label might cost nothing anybody notices. **Nobody has the desktop
                            answer, and a viewport-conditional label is deliberately NOT explored — a
                            breakpoint-conditional difference is invisible to every gate here.**

                            🔴 **The reason the label stays in that channel at all is an ASYMMETRY OF NEED,
                            untouched by any of the above: a sighted reader sees the number and derives
                            the band; a screen-reader user cannot scan a grid of numbers to form one.** */}
                          <span className="sr-only">{tile.bandLabel}</span>
                          {tile.pastDate && (
                            <span className={styles.pastMark} data-testid={`ward-board-bed-${index + 1}-past`}>
                              <span aria-hidden="true" className={styles.statusGlyph}>
                                ▲{" "}
                              </span>
                              <span>Past date</span>
                            </span>
                          )}
                          {/* Words, never a fill or a colour — the same rule the past-date badge
                            above follows, and for the same reader: greyscale, forced-colors, or
                            paper. The short form is what fits the tile; the full sentence, including
                            that the bed is still theirs, is in the person panel.

                            ⚠️ **This said "a 390px tile" too — same error as the band-label comment
                            above, and the same direction.** The tile is 80px on a phone, not 390px.
                            **Two comments in one component carried the same wrong width**, which is
                            how a number gets believed: it was consistent with itself. */}
                          {tile.awayAtEd && (
                            <span className={styles.awayMark} data-testid={`ward-board-bed-${index + 1}-away`}>
                              <span aria-hidden="true" className={styles.statusGlyph}>
                                ◆{" "}
                              </span>
                              <span>At ED</span>
                            </span>
                          )}
                        </>
                      )}
                      {/* Rule 2 on screen: taken, but nobody is in it yet — the ruled Pulled box. */}
                      {tile.kind === "waiting" && (
                        <>
                          <span className={styles.bedState}>{BED_STATE_LABELS.pulled}</span>
                          <span className={styles.bedNote}>The ward has already given this bed away.</span>
                        </>
                      )}
                      {/* Rule 1 on screen for the third bed state: the words say it, not the fill. A
                        coordinator reading this board in greyscale, in forced-colors, or on paper
                        must still be able to tell an unfillable bed from a fillable one, and "Out of
                        service" is what does that — the hatched fill only makes it quicker. */}
                      {tile.kind === "blocked" && (
                        <>
                          <span className={styles.bedState}>Out of service</span>
                          <span className={styles.bedNote}>Not fillable today.</span>
                        </>
                      )}
                      {/* Task B on screen: physically empty, but not one of the beds this ward is
                        offering — the ruled Closed box, a different fact from Ready (fillable now)
                        and from "Out of service". The word is what makes it unambiguous; the dotted
                        edge and dot pattern only make it quicker to spot. */}
                      {tile.kind === "closed" && (
                        <>
                          <span className={styles.bedState}>{BED_STATE_LABELS.closed}</span>
                          <span className={styles.bedNote}>Empty, not offered.</span>
                        </>
                      )}
                      {tile.kind === "empty" && (
                        <>
                          <span className={styles.bedState}>Ready</span>
                          <span className={styles.bedNote}>Empty and offered.</span>
                        </>
                      )}
                      {/* Selection in WORDS, beside the heavier edge that carries it visually. A sheet
                        that has made no decision must not show a filled element — a fill reads as a
                        decision taken — and a weight alone is a mark a greyscale reader can miss. */}
                      {selected && <span className={styles.selectedMark}>Selected</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {filteredTiles.length === 0 && <p className={styles.filterEmpty}>No bed matches this filter.</p>}

            {/*
             * The arithmetic a ward can do in its head, kept ON SCREEN even though the per-person list
             * has moved to the slide-out and the printed sheet. "18 of this ward's 20 beds are taken"
             * beside a grid of 20 tiles is the check that catches a panel fed the wrong collection —
             * the sibling panel that shipped "Kimberley 28 people" on a twenty-bed ward this morning
             * was invisible in a list and would have been obvious here. Both numbers come from the
             * same two values the grid and the printed list are built from, so no third figure exists
             * to drift.
             */}
            <p className={styles.occupancy} data-testid="ward-board-people-count">
              {occupants.length} of this ward&apos;s {unit.beds} bed{unit.beds === 1 ? "" : "s"}{" "}
              {occupants.length === 1 ? "is" : "are"} taken. {BOARD_ORDER_NOTES[bedOrder]}
            </p>
            {/*
             * THE LINE THAT QUALIFIES EVERY DIAGNOSIS ON THIS PAGE, and it replaced — deliberately,
             * on 2026-08-29 — the sentence that used to stand here saying the record held none.
             *
             * The owner reversed that decision ("It can give a tentative diagnosis. This is because
             * most referrals will require a diagnosis"), so the honest line is no longer about an
             * absence; it is about what the values ARE. It stays in exactly this position, under the
             * grid rather than inside the slide-out, for the reason the old line was put here: it is
             * on the page whether or not anybody has selected a tile, and it prints.
             *
             * It is the ONE place the qualification is stated in full, and every per-person line
             * repeats the word "tentative" rather than relying on a reader having scrolled past this.
             */}
            <p className={styles.peopleAbsence}>
              Any diagnosis shown is tentative: a broad category, not a diagnosis this ward has confirmed.
            </p>
          </div>

          {/*
           * THE SLIDE-OUT. Present only while something is selected, so it costs no width otherwise,
           * and it takes its own grid track rather than covering the beds it describes — a reader who
           * has just chosen a tile wants to compare it with the others, and a panel over the grid
           * would make them close it to do that.
           *
           * NOT modal and NOT a focus trap: Tab leaves it into the rest of the page, Escape closes it
           * from anywhere in the zones, and focus returns to the exact tile that opened it. The tile's
           * own `aria-pressed` is what says which one is open.
           */}
          {/*
           * A PERMANENT COLUMN, not a slide-out — owner, 2026-08-30: make the side panels more
           * like the home page's.
           *
           * The home page keeps its right region always present and, with nothing chosen, says so:
           * "Select a movement from the priority queue to see its explainable shortlist." That is
           * the pattern this now follows. A panel that appears only on click has two costs: the
           * grid reflows under the reader's hands at the moment they click, and until they click
           * there is nothing telling them the beds are clickable at all.
           */}
          <aside
            className={styles.detail}
            id="ward-board-detail"
            aria-labelledby="ward-board-detail-heading"
            data-testid="ward-board-detail"
            data-detail-kind={selectedTile?.kind ?? "none"}
            tabIndex={0}
          >
            <div className={styles.detailBar}>
              <h2 id="ward-board-detail-heading" className={styles.detailHeading}>
                {selectedTile === null
                  ? "Who is in a bed"
                  : selectedTile.kind === "occupied" || selectedTile.kind === "waiting"
                    ? "Who is in this bed"
                    : selectedTile.kind === "empty"
                      ? "An empty bed"
                      : selectedTile.kind === "closed"
                        ? "A closed bed"
                        : "A bed out of service"}
              </h2>
              {/* No Close on an empty panel — there is nothing to close, and a control that does
                nothing is worse than no control. */}
              {selectedTile !== null && (
                <button
                  type="button"
                  className={styles.detailClose}
                  onClick={closeDetail}
                  data-testid="ward-board-detail-close"
                >
                  Close
                </button>
              )}
            </div>

            {selectedTile === null ? (
              <div className={styles.detailEmptyWrapper}>
                <div className={styles.detailEmptyCard}>
                  <div className={styles.detailEmptyIcon} aria-hidden="true">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 4v16" />
                      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
                      <path d="M2 17h20" />
                      <path d="M6 8v9" />
                    </svg>
                  </div>
                  <div className={styles.detailEmptyTitle}>Bed Inspector & Trajectory</div>
                  <p className={styles.detailEmpty} data-testid="ward-board-select-hint">
                    Choose a bed to view its record.
                  </p>
                  <div className={styles.detailEmptyGuide}>
                    <div className={styles.detailEmptyGuideItem}>
                      <span className={styles.detailEmptyBullet} aria-hidden="true">
                        ●
                      </span>
                      <span>Occupant identity, stay length & trajectory</span>
                    </div>
                    <div className={styles.detailEmptyGuideItem}>
                      <span className={styles.detailEmptyBullet} aria-hidden="true">
                        ●
                      </span>
                      <span>Discharge barriers & expected departure plan</span>
                    </div>
                    <div className={styles.detailEmptyGuideItem}>
                      <span className={styles.detailEmptyBullet} aria-hidden="true">
                        ●
                      </span>
                      <span>Catchment corridor & destination clinic link</span>
                    </div>
                  </div>
                  <div className={styles.detailEmptyStats}>
                    <span className={styles.detailEmptyBadge}>
                      {unit.beds} beds · {available} ready now
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {selectedTile.kind === "occupied" || selectedTile.kind === "waiting" ? (
                  selectedOccupant !== null ? (
                    <div className={styles.person} data-testid="ward-board-detail-person">
                      <PersonEntry
                        occupant={selectedOccupant}
                        idPrefix="ward-board-selected-person"
                        displayDate={calendarDateOf(now, dayZero)}
                        resolvedPatient={(() => {
                          // Walkthrough D9: a referral-linked stay read "Unknown Patient". Resolved
                          // through the ward-scoped identity projection (never the full referral
                          // array); still unresolved means the name is not recorded.
                          const selectedAdmission = admissions.find((a) => a.id === selectedTile.key);
                          const resolved = resolvePatientIdentity
                            ? resolvePatientIdentity(selectedAdmission)
                            : resolveSubjectPatient(selectedAdmission, { patients, movements });
                          return resolved.patient
                            ? resolved
                            : { ...resolved, displayName: "Not recorded", formalName: "Not recorded" };
                        })()}
                      />
                      {/* Rule 2 spelled out where a reader is looking at one person rather than at the
                      grid: this bed is gone from the ward's count, and the person is not here. */}
                      {selectedTile.kind === "waiting" && (
                        <p className={styles.personLine}>
                          This ward has already given this bed away. It is taken, not free, and nobody has arrived.
                        </p>
                      )}
                      {selectedTile.kind === "occupied" && (
                        <div className={styles.leaving} data-testid="ward-board-record-leaving">
                          <label className={styles.leavingLabel} htmlFor="ward-board-leaving-destination">
                            Where are they going?
                          </label>
                          <select
                            id="ward-board-leaving-destination"
                            className={styles.leavingSelect}
                            data-testid="ward-board-leaving-destination"
                            value={leavingDestination}
                            onChange={(changed) => setLeavingDestination(changed.target.value as LeavingDestination)}
                          >
                            {LEAVING_DESTINATIONS.map((destination) => (
                              <option key={destination.id} value={destination.id}>
                                {destination.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={styles.leavingButton}
                            data-testid="ward-board-record-leaving-submit"
                            onClick={(e) => {
                              const executeLeaving = () => {
                                dispatchAndReport(
                                  () =>
                                    recordWardDeparture
                                      ? recordWardDeparture(selectedTile.key, unit.id, leavingDestination)
                                      : dispatch({
                                          type: "RECORD_LEAVING",
                                          role: "ward",
                                          now,
                                          admissionId: selectedTile.key,
                                          actingUnitId: unit.id,
                                          leavingDestination,
                                        }),
                                  `Recorded departure: ${selectedTile.who || nameFor(selectedTile.key)} has left the ward.`,
                                  "Recorded departure: this patient has left the ward.",
                                );
                                closeDetail();
                              };

                              if (!requireConfirmation) {
                                executeLeaving();
                                return;
                              }

                              dialogTriggerRef.current = e.currentTarget;
                              setPendingConfirm({
                                kind: "leaving",
                                who: selectedTile.who || nameFor(selectedTile.key),
                                admissionId: selectedTile.key,
                              });
                            }}
                          >
                            Record that they have left
                          </button>
                        </div>
                      )}

                      {/* Secondary action controls */}
                      {selectedTile.kind === "occupied" && (
                        <div className={styles.detailSecondaryActions}>
                          <button
                            type="button"
                            className={styles.detailSecondaryBtn}
                            data-tone="warn"
                            onClick={() => {
                              dialogTriggerRef.current =
                                typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
                              setSelectedBlocker(BED_RELEASE_BLOCKERS[0]);
                              setBlockerDialogItem({
                                key: `occupant-${selectedOccupant.key}`,
                                selectableKey: selectedOccupant.key,
                                label: selectedOccupant.confirmed ? "Confirmed discharge" : "Expected discharge",
                                tone: "warn",
                                when: "Discharge",
                                chip: "Discharge blocker",
                                text: `Recording what is holding up departure for ${nameFor(selectedOccupant.key)}`,
                                acts: [],
                              });
                            }}
                          >
                            Record a blocker
                          </button>
                          {dateEdit?.admissionId === selectedTile.key ? (
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                const admission = admissions.find((row) => row.id === selectedTile.key);
                                const today = parseReleaseDayInstant(
                                  now,
                                  dateEdit.day === "tomorrow" ? "tomorrow" : "today",
                                  dateEdit.time,
                                );
                                if (!admission || today === undefined) return;
                                const expectedDischargeAt =
                                  dateEdit.day === "recorded" && admission.expectedDischargeAt !== null
                                    ? today +
                                      (Math.floor(admission.expectedDischargeAt / MINUTES_PER_DAY) -
                                        Math.floor(now / MINUTES_PER_DAY)) *
                                        MINUTES_PER_DAY
                                    : today;
                                dispatchAndReport(
                                  () =>
                                    dispatch({
                                      type: "UPDATE_EXPECTED_DISCHARGE",
                                      role: "ward",
                                      actingUnitId: unit.id,
                                      now,
                                      admissionId: admission.id,
                                      expectedDischargeAt,
                                    }),
                                  "Expected departure updated.",
                                  "Expected departure updated.",
                                );
                                setDateEdit(null);
                              }}
                            >
                              <Field label="Departure day">
                                <Select
                                  aria-label="Departure day"
                                  value={dateEdit.day}
                                  onChange={(event) =>
                                    setDateEdit({
                                      ...dateEdit,
                                      day: event.target.value as "recorded" | "today" | "tomorrow",
                                    })
                                  }
                                >
                                  <option value="recorded">Keep recorded day</option>
                                  <option value="today">Today</option>
                                  <option value="tomorrow">Tomorrow</option>
                                </Select>
                              </Field>
                              <Field label="Expected departure time">
                                <TextInput
                                  aria-label="Expected departure time"
                                  type="time"
                                  required
                                  value={dateEdit.time}
                                  onChange={(event) => setDateEdit({ ...dateEdit, time: event.target.value })}
                                />
                              </Field>
                              <button type="submit" className={styles.detailSecondaryBtn}>
                                Save departure date
                              </button>
                              <button
                                type="button"
                                className={styles.detailSecondaryBtn}
                                onClick={() => setDateEdit(null)}
                              >
                                Cancel date change
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className={styles.detailSecondaryBtn}
                              onClick={() => {
                                const admission = admissions.find((row) => row.id === selectedTile.key);
                                if (admission)
                                  setDateEdit({
                                    admissionId: admission.id,
                                    time: departureTimeInputValue(admission.expectedDischargeAt ?? now),
                                    day: admission.expectedDischargeAt === null ? "today" : "recorded",
                                  });
                              }}
                            >
                              Move the date
                            </button>
                          )}
                          <div data-testid="ward-board-away-at-ed" style={{ flex: "1 1 100%" }}>
                            {selectedOccupant.awayAtEdHours === null ? (
                              <button
                                type="button"
                                className={styles.detailSecondaryBtn}
                                style={{ width: "100%" }}
                                data-testid="ward-board-record-away-submit"
                                onClick={(e) => {
                                  const executeAway = () => {
                                    dispatchAndReport(
                                      () =>
                                        dispatch({
                                          type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
                                          role: "ward",
                                          now,
                                          admissionId: selectedTile.key,
                                          actingUnitId: unit.id,
                                        }),
                                      `Recorded: ${nameFor(selectedTile.key)} is currently away at an emergency department. Their bed is still held.`,
                                      "Recorded: patient is currently away at an emergency department.",
                                    );
                                  };

                                  if (!requireConfirmation) {
                                    executeAway();
                                    return;
                                  }

                                  dialogTriggerRef.current = e.currentTarget;
                                  setPendingConfirm({
                                    kind: "away_at_ed",
                                    who: nameFor(selectedTile.key),
                                    admissionId: selectedTile.key,
                                  });
                                }}
                              >
                                Record that they have gone to an emergency department
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.detailSecondaryBtn}
                                style={{ width: "100%" }}
                                data-tone="good"
                                data-testid="ward-board-record-returned-submit"
                                onClick={() =>
                                  dispatch({
                                    type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
                                    role: "ward",
                                    now,
                                    admissionId: selectedTile.key,
                                    actingUnitId: unit.id,
                                  })
                                }
                              >
                                Record that they are back on the ward
                              </button>
                            )}
                            <p className={styles.personLine} style={{ marginTop: "0.25rem", textAlign: "center" }}>
                              This trip does not free the bed.
                            </p>
                          </div>
                          <div data-testid="ward-board-stepdown-container" style={{ flex: "1 1 100%", marginTop: 8 }}>
                            <button
                              type="button"
                              className={styles.detailSecondaryBtn}
                              style={{ width: "100%" }}
                              data-tone={selectedOccupant.stepDownCandidate ? "good" : undefined}
                              data-testid="ward-board-stepdown-toggle"
                              onClick={() => {
                                dispatch({
                                  type: "SET_STEP_DOWN_CANDIDATE",
                                  role: "ward",
                                  now,
                                  actingUnitId: unit.id,
                                  admissionId: selectedOccupant.key,
                                  stepDownCandidate: !selectedOccupant.stepDownCandidate,
                                });
                                const msg = !selectedOccupant.stepDownCandidate
                                  ? `Marked ${nameFor(selectedOccupant.key)} as step-down candidate for subacute care.`
                                  : `Removed step-down candidate flag for ${nameFor(selectedOccupant.key)}.`;
                                setToastMessage(msg);
                                announceToWardShell(
                                  !selectedOccupant.stepDownCandidate
                                    ? "Marked this patient as step-down candidate for subacute care."
                                    : "Removed step-down candidate flag for this patient.",
                                );
                              }}
                            >
                              {selectedOccupant.stepDownCandidate
                                ? "✓ Marked as Step-Down Candidate (Subacute Transfer)"
                                : "Mark as Step-Down Candidate (Subacute Transfer)"}
                            </button>
                          </div>
                          {selectedOccupant.days !== null && selectedOccupant.days >= 7 && (
                            <div
                              className={styles.barrierSelectGroup}
                              data-testid="ward-board-barrier-container"
                              style={{ flex: "1 1 100%", marginTop: 8 }}
                            >
                              <label htmlFor="ward-board-barrier-select" className={styles.leavingLabel}>
                                Primary Discharge Barrier (Stay: {selectedOccupant.days} days)
                              </label>
                              <select
                                id="ward-board-barrier-select"
                                className={styles.leavingSelect}
                                data-testid="ward-board-barrier-select"
                                value={selectedOccupant.dischargeBarrier ?? "None"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  dispatch({
                                    type: "SET_DISCHARGE_BARRIER",
                                    role: "ward",
                                    now,
                                    actingUnitId: unit.id,
                                    admissionId: selectedOccupant.key,
                                    barrier: val === "None" ? null : (val as DischargeBarrier),
                                  });
                                  const msg = `Discharge barrier for ${nameFor(selectedOccupant.key)}: ${val}`;
                                  setToastMessage(msg);
                                  announceToWardShell(`Discharge barrier for this patient: ${val}`);
                                }}
                              >
                                <option value="None">None / Clear barrier</option>
                                {DISCHARGE_BARRIERS.map((barrier) => (
                                  <option key={barrier} value={barrier}>
                                    {barrier}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Unreachable while the grid and the list are built from the same two calls, and
                   said rather than rendered blank if it ever is: an empty panel would read as a
                   loading failure, and inventing a person to fill it is the one thing this board
                   must never do. */
                    <p className={styles.personLine}>No record could be read for this bed.</p>
                  )
                ) : (
                  <div data-testid="ward-board-detail-bed-class">
                    <p className={styles.detailLead}>
                      {selectedTile.kind === "empty"
                        ? `One of this ward's ${emptyTileCount} bed${emptyTileCount === 1 ? "" : "s"} a coordinator can fill right now.`
                        : selectedTile.kind === "closed"
                          ? `One of this ward's ${closedTileCount} bed${closedTileCount === 1 ? "" : "s"} that are empty but not offered by this ward.`
                          : `One of this ward's ${blockedTileCount} bed${blockedTileCount === 1 ? "" : "s"} that are out of service and cannot be filled today.`}
                    </p>
                    {/* The constraint the header already carries, repeated here only where it bites: a
                    reader looking at a fillable bed is exactly the reader who needs to know what
                    will and will not go in it. `constraintSentence` returns null rather than an
                    empty string when nothing constrains. */}
                    {selectedTile.kind === "empty" && constraint !== null && (
                      <p className={styles.personLine}>{constraint}</p>
                    )}
                    {/*
                     * THE LINE THAT KEEPS SELECTION HONEST. `Unit.blocked` is a count and
                     * the Closed/Ready split is derived from two more counts; no record
                     * anywhere says WHICH bed. So a reader who has just clicked one of these tiles is
                     * told, on the panel, that they have selected a class of bed and not a location.
                     */}
                    <p className={styles.detailNotLocation}>
                      Bed location is not recorded; this tile represents part of a count.
                    </p>
                  </div>
                )}
              </>
            )}
          </aside>
          <section className={`${styles.workBand} ${styles.workZone}`} aria-labelledby="ward-board-work-band-heading">
            <details className={styles.workBandFold} data-testid="ward-board-work-band" open>
              <summary className={styles.workBandSummary}>
                <h2 id="ward-board-work-band-heading" className={styles.workBandTitle}>
                  Needs you this shift
                </h2>
                <span className={styles.workBandDigest} data-testid="ward-board-work-band-digest">
                  {shiftDigest}
                </span>
              </summary>
              <div className={styles.shiftTabbar} role="group" aria-label="Which shift is drawn">
                <button
                  type="button"
                  className={`${styles.shiftTabBtn}${shiftTab === "busy" ? ` ${styles.shiftTabBtnActive}` : ""}`}
                  aria-pressed={shiftTab === "busy"}
                  onClick={(e) => {
                    e.preventDefault();
                    setShiftTab("busy");
                  }}
                >
                  This shift <span className={styles.shiftTabNum}>{shiftTiles.length}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.shiftTabBtn}${shiftTab === "quiet" ? ` ${styles.shiftTabBtnActive}` : ""}`}
                  aria-pressed={shiftTab === "quiet"}
                  onClick={(e) => {
                    e.preventDefault();
                    setShiftTab("quiet");
                  }}
                >
                  Preview: a quiet shift
                </button>
              </div>
              {shiftTab === "quiet" ? (
                <p className={styles.workBandEmpty}>
                  Every bed is accounted for. Nothing on this board needs you before the next handover at 15:30. Absence
                  here means every bed has been looked at, not that the board is empty.
                </p>
              ) : shiftTiles.length === 0 ? (
                <p className={styles.workBandEmpty}>
                  No bed is out of service or closed; nobody is travelling here or due out today.
                </p>
              ) : (
                <div className={styles.shiftGrid} data-testid="ward-board-work-band-list">
                  {shiftTiles.map((item) => (
                    <div key={item.key} className={styles.shiftTile} data-tone={item.tone ?? undefined}>
                      <div className={styles.shiftTop}>
                        <button
                          type="button"
                          className={styles.shiftBedLink}
                          onClick={() => {
                            if (item.selectableKey) {
                              setSelectedKey(item.selectableKey);
                            }
                          }}
                        >
                          {item.label}
                        </button>
                        <span className={styles.shiftTag}>{item.chip}</span>
                        <span className={styles.shiftWhen}>{item.when}</span>
                      </div>
                      <span className={styles.shiftSub}>{item.text}</span>
                      <div className={styles.shiftRowActs}>
                        {item.acts.map((act, actIdx) => (
                          <button
                            key={actIdx}
                            type="button"
                            className={styles.shiftCtl}
                            data-tone={act.tone ?? undefined}
                            onClick={() => handleShiftAction(item, act.word)}
                          >
                            {act.word}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {blockerDialogItem ? (
                <div
                  ref={blockerDialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="blocker-dialog-title"
                  aria-describedby="blocker-dialog-description"
                  id="ward-board-blocker-dialog"
                  tabIndex={-1}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) closeBlockerDialog();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      closeBlockerDialog();
                    } else {
                      trapDialogFocus(e, blockerDialogRef.current);
                    }
                  }}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "var(--scrim)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                    padding: "1rem",
                  }}
                >
                  <div
                    style={{
                      background: "var(--surface)",
                      color: "var(--ink)",
                      padding: "1.5rem",
                      borderRadius: "var(--r1, 0.5rem)",
                      maxWidth: "32rem",
                      width: "92%",
                      boxShadow: "var(--lift)",
                      border: "1px solid var(--line-strong)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <h3
                        id="blocker-dialog-title"
                        style={{
                          margin: 0,
                          fontSize: "1.15rem",
                          fontWeight: 600,
                          color: "var(--ink)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        Record a blocker for {blockerDialogItem.label}
                      </h3>
                      <button
                        ref={blockerCloseBtnRef}
                        type="button"
                        onClick={closeBlockerDialog}
                        aria-label="Close dialog"
                        style={{
                          minHeight: "var(--ward-tap, 48px)",
                          minWidth: "var(--ward-tap, 48px)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid var(--line-strong)",
                          borderRadius: "var(--r1, 0.25rem)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          cursor: "pointer",
                          fontSize: "1.1rem",
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "var(--r1, 0.25rem)",
                        background: "var(--surface-2, var(--sunk))",
                        border: "1px solid var(--line)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.375rem",
                        fontSize: "0.875rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                          Bed / Subject: {blockerDialogItem.label}
                        </span>
                        {blockerDialogItem.chip ? (
                          <span
                            style={{
                              fontFamily: "var(--mono, monospace)",
                              fontVariantNumeric: "tabular-nums",
                              fontSize: "0.8rem",
                              padding: "0.125rem 0.5rem",
                              borderRadius: "999px",
                              border: "1px solid var(--line-strong)",
                              background: "var(--surface)",
                              color: "var(--ink)",
                            }}
                          >
                            {blockerDialogItem.chip}
                          </span>
                        ) : null}
                      </div>
                      {blockerDialogItem.when ? (
                        <span
                          style={{ color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums", fontSize: "0.8rem" }}
                        >
                          Timing indicator: {blockerDialogItem.when}
                        </span>
                      ) : null}
                      {blockerDialogItem.text ? (
                        <span style={{ color: "var(--ink-soft)", fontSize: "0.825rem", lineHeight: 1.4 }}>
                          {blockerDialogItem.text}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <p
                        id="blocker-dialog-description"
                        style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-soft)", fontWeight: 500 }}
                      >
                        Select the reason preventing bed release:
                      </p>
                      <div
                        role="radiogroup"
                        aria-labelledby="blocker-dialog-description"
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          maxHeight: "14rem",
                          overflowY: "auto",
                          padding: "0.25rem",
                        }}
                      >
                        {BED_RELEASE_BLOCKERS.map((b) => {
                          const isSelected = selectedBlocker === b;
                          return (
                            <button
                              key={b}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setSelectedBlocker(b)}
                              style={{
                                minHeight: "var(--ward-tap, 48px)",
                                minWidth: "var(--ward-tap, 48px)",
                                padding: "0.625rem 0.875rem",
                                borderRadius: "var(--r1, 0.25rem)",
                                border: isSelected
                                  ? "2px solid var(--accent, var(--primary))"
                                  : "1px solid var(--line-strong)",
                                background: isSelected ? "var(--accent-soft, var(--surface-2))" : "var(--surface)",
                                color: "var(--ink)",
                                fontWeight: isSelected ? 600 : 400,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                textAlign: "left",
                                fontVariantNumeric: "tabular-nums",
                                fontSize: "0.875rem",
                                lineHeight: "1.3",
                                boxShadow: isSelected ? "var(--lift)" : "none",
                              }}
                            >
                              {b}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                      <button
                        type="button"
                        className={styles.shiftCtl}
                        onClick={closeBlockerDialog}
                        style={{
                          minHeight: "var(--ward-tap, 48px)",
                          minWidth: "var(--ward-tap, 48px)",
                          padding: "0.625rem 1.25rem",
                          fontWeight: 500,
                          border: "1px solid var(--line-strong)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          cursor: "pointer",
                          boxShadow: "var(--lift)",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.shiftCtl}
                        data-tone="warn"
                        onClick={() => {
                          // Walkthrough D3 (25 Sept 2026): a release names its stay (owner ruling),
                          // so the blocker goes on THIS person's own live release, never the ward's
                          // first release or a made-up id. With none, nothing is recorded.
                          const ownRelease = liveBedReleases?.find(
                            (r) => r.admissionId === blockerDialogItem.selectableKey && r.state !== "discharged",
                          );
                          const who = blockerDialogItem.who || nameFor(blockerDialogItem.selectableKey);
                          if (!ownRelease) {
                            const msg = `No discharge is recorded for ${who}, so there is nothing to hold up. Nothing was changed.`;
                            setToastMessage(msg);
                            announceToWardShell(
                              "No discharge is recorded for this patient, so there is nothing to hold up. Nothing was changed.",
                            );
                          } else {
                            dispatchAndReport(
                              () =>
                                dispatch({
                                  type: "BLOCK_BED_RELEASE",
                                  role: "ward",
                                  now,
                                  releaseId: ownRelease.id,
                                  actingUnitId: unit.id,
                                  blocker: selectedBlocker,
                                }),
                              `Blocker recorded for ${who}: ${selectedBlocker}.`,
                              `Blocker recorded for this patient: ${selectedBlocker}.`,
                            );
                          }
                          closeBlockerDialog();
                        }}
                        style={{
                          minHeight: "var(--ward-tap, 48px)",
                          minWidth: "var(--ward-tap, 48px)",
                          padding: "0.625rem 1.25rem",
                          fontWeight: 600,
                          border: "2px solid var(--warn)",
                          background: "var(--warn-soft, var(--surface))",
                          color: "var(--ink)",
                          cursor: "pointer",
                          fontVariantNumeric: "tabular-nums",
                          boxShadow: "var(--lift)",
                        }}
                      >
                        Confirm blocker
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </details>
          </section>
        </div>

        {/*
         * WHERE THESE BEDS FREE UP TO — from `arrowTargets`, which existed fully tested with zero
         * consumers until this board became its first.
         *
         * **It has moved out of the left column, and the reason is a measured one rather than a
         * preference.** In a 17rem sidebar it was 746px tall — 55% of a 1362px column, and by itself
         * taller than the whole middle column beside it (439px) — because the longest team name,
         * "Goldfields-Esperance Community Mental Health Team (placeholder)", needs roughly 380px to
         * sit on one line and had 272px to do it in. Eight entries each wrapped to two lines, and the
         * panel's height was almost entirely the cost of that wrapping. **The content is wide; the
         * column was not.** Nothing here was shortened, generalised or dropped to fix it: all eight
         * regions, their counts, their soonest days and their team names are on the page exactly as
         * before, in a full-width band where each one fits on a single line.
         *
         * The alternative considered and REJECTED was stating the naming convention once in the intro
         * and dropping the per-row team name. It reads well against today's fixture — every value in
         * `COMMUNITY_TEAMS` is "<Region> Community Mental Health Team (placeholder)" — but that file's
         * own comment says the product owner may later supply real team names, at which point a
         * sentence claiming the convention becomes a false statement on a clinical screen that no test
         * would catch. A layout must not depend on a fixture happening to be formulaic.
         *
         * It sits BELOW the three zones rather than inside one, for the same reason the triage bar
         * sits above them: this is a ward-level aggregate, not a per-bed or per-column fact. The
         * left-to-right reading is untouched — coming in and going out are still LEFT, the beds
         * MIDDLE, the chosen bed RIGHT — and this band is the tail of the "Going out today" list,
         * read last, which is where a departure story ends.
         *
         * **There are deliberately no drawn arrows, and that is a correctness decision rather than
         * a simplification.** Connector geometry on the coordinator's diagrams is measured in
         * JavaScript from the live screen layout and never re-measured for print, so a printed
         * route line points at whichever ward has since moved under it — proven on paper this
         * session, and the reason those connectors are now hidden in print entirely. Drawing
         * eighteen bed-to-region arrows would import that failure and add a spaghetti of lines
         * nobody can follow. The connection is carried by a shared REGION NAME on both sides
         * instead. Words survive greyscale, a stripped-background print and forced-colors;
         * measured coordinates survive none of it.
         *
         * Scoped to `ARROW_HORIZON_DAYS`, so this is a short list a flow meeting can read, not a
         * second copy of the bed list. Someone with no expected date is absent entirely rather
         * than defaulted — nobody has said when they are leaving, so the board says nothing.
         */}

        {/*
         * WHO IS IN THESE BEDS — every occupant with their discharge plan, and on paper only.
         *
         * **This is the 281bdf83f deliverable, kept whole rather than lost to the slide-out.** That
         * commit's panel listed every occupant with when they are expected out, who set the date, how
         * many times it has moved, whether the ward has confirmed it and what is holding it up. The
         * owner has replaced it ON SCREEN with a per-selection panel, which is his call; none of that
         * makes the printed sheet worse, and a sheet carrying only whoever was last clicked would be
         * a page whose content depends on an interaction that left no mark on it. So the screen shows
         * one person on request and the paper shows all of them, which is what each medium is good
         * at: the screen is interactive and the sheet is not.
         *
         * It is `display: none` on screen and restored in the print block — the only hidden content on
         * this board, and hidden in the direction that ADDS to the sheet rather than removing from it.
         * The rendered rows are what the existing suite in `tests/ward-board-people-panel.dom.test.tsx`
         * asserts against (rows + blocked + closed + empty === `unit.beds`, ordering, provenance, no
         * diagnosis), so every one of those invariants still has a live subject after the rebuild.
         *
         * The list is NOT truncated and must not become so. Eighteen people is a long sheet, and a
         * "top 5" with the rest hidden is worse than no list, because nobody reading it can tell that
         * anything is missing.
         */}
        {/*
         * THE WARD'S DAILY SHEET — LAST ON SCREEN, AND FOLDED AWAY UNTIL SOMEBODY WANTS IT.
         *
         * **Moved here from directly under the heading, owner 2026-08-30.** Measured before the
         * move: the sheet was 995px of a 2493px page — **40% of the ward board, sitting second**,
         * pushing the beds themselves below the fold. The board's subject is the beds; the sheet is
         * what the board PRINTS.
         *
         * **Folded because on screen it repeats the board almost entirely, and that was by design.**
         * The sheet was built as a printout of these same panels, so its "Since yesterday", "Who
         * came in", "Who is going" and destinations list are the board's own since-panel, incoming
         * panel, outgoing panel and destinations panel a second time. Two answers to one question,
         * a screen apart, is exactly what this board refuses everywhere else.
         *
         * **Folding removes the duplication from the screen and removes nothing from the paper.**
         * `<details>` keeps it one click away so nobody has to print to see what will print, and
         * the print stylesheet forces it open — see `.sheetFold[open]` and the `@media print` rule,
         * which must stay together: a fold that stayed shut on paper would print a blank page where
         * the handover sheet belongs, which is the worst outcome of the three.
         */}
        <section className={styles.sheetFold} data-testid="ward-board-sheet-fold" id="ward-board-daily-sheet">
          <button
            type="button"
            className={styles.sheetFoldSummary}
            aria-expanded={sheetOpen}
            aria-controls="ward-board-sheet-body"
            onClick={() => setSheetOpen((open) => !open)}
          >
            {sheetOpen ? "Hide" : "Show"} shift brief
          </button>
          <div
            id="ward-board-sheet-body"
            className={sheetOpen ? styles.sheetBody : styles.sheetBodyHidden}
            data-testid="ward-board-sheet-body"
          >
            <WardDailySheet
              movement={movement}
              incomingPulled={incoming.filter((person) => person.state === "pulled").length}
              incomingWaitlisted={incoming.filter((person) => person.state === "waitlisted").length}
              outgoingCount={outgoing.length}
              outgoingBasisLabel={OUTGOING_BASIS_LABEL[outgoingBasis]}
              destinations={targets}
              people={occupants}
            />
          </div>
        </section>

        <aside className={styles.people} aria-labelledby="ward-board-people-heading">
          <h2 id="ward-board-people-heading" className={styles.peopleHeading}>
            Who is in these beds
          </h2>
          <p className={styles.peopleIntro}>
            Every occupant of this ward, soonest expected out first; anyone with no date set is last.
          </p>
          {/* An empty list under a heading reads as a panel that failed to load rather than as a ward
            with nobody in it, so the absence is said in words. `constraintSentence` returns null for
            the same reason a few lines up. */}
          {occupants.length === 0 && <p className={styles.personLine}>Nobody is recorded in a bed on this ward.</p>}
          <ol className={styles.peopleList} data-testid="ward-board-people">
            {occupants.map((occupant) => (
              <li
                key={occupant.key}
                className={`${styles.person}${occupant.key === selectedKey ? ` ${styles.personSelected}` : ""}`}
                data-testid={`ward-board-person-${occupant.key}`}
              >
                {/* Selection on paper is WEIGHT and a word, never a fill: on a sheet that has made no
                  decision a filled element reads as a decision made. */}
                {occupant.key === selectedKey && <p className={styles.personSelectedMark}>Selected on screen</p>}
                <PersonEntry occupant={occupant} idPrefix="ward-board-person" />
              </li>
            ))}
          </ol>
        </aside>

        <p className={styles.footnote} data-testid="ward-board-footnote">
          {unit.name} · {tiles.length} recorded bed{tiles.length === 1 ? "" : "s"}
        </p>

        {pendingConfirm ? (
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            id="ward-board-confirm-dialog"
            tabIndex={-1}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeConfirmDialog();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeConfirmDialog();
              } else {
                trapDialogFocus(e, confirmDialogRef.current);
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--scrim)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                color: "var(--ink)",
                padding: "1.5rem",
                borderRadius: "var(--r1, 0.5rem)",
                maxWidth: "30rem",
                width: "92%",
                boxShadow: "var(--lift)",
                border: "1px solid var(--line-strong)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <h3
                  id="confirm-dialog-title"
                  style={{
                    margin: 0,
                    fontSize: "1.15rem",
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {pendingConfirm.kind === "leaving"
                    ? "Confirm patient departure"
                    : "Confirm emergency department transfer"}
                </h3>
                <button
                  ref={confirmCloseBtnRef}
                  type="button"
                  onClick={closeConfirmDialog}
                  aria-label="Close dialog"
                  data-testid="ward-board-confirm-close"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--ink-soft)",
                    cursor: "pointer",
                    fontSize: "1.25rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "var(--r0, 0.25rem)",
                  }}
                >
                  ✕
                </button>
              </div>

              <p
                id="confirm-dialog-description"
                style={{ margin: 0, fontSize: "0.95rem", color: "var(--ink-soft)", lineHeight: 1.5 }}
              >
                {pendingConfirm.kind === "leaving" ? (
                  <>
                    Are you sure you want to record that <strong>{pendingConfirm.who}</strong> has left the ward? This
                    will record their discharge and make this bed available for new admissions.
                  </>
                ) : (
                  <>
                    Are you sure you want to record that <strong>{pendingConfirm.who}</strong> has gone to an emergency
                    department? The bed will remain held for them while they are away.
                  </>
                )}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={closeConfirmDialog}
                  data-testid="ward-board-confirm-cancel"
                  className={styles.detailSecondaryBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  data-testid="ward-board-confirm-proceed"
                  className={styles.detailPrimaryBtn}
                  data-tone={pendingConfirm.kind === "leaving" ? "warn" : undefined}
                >
                  {pendingConfirm.kind === "leaving" ? "Record departure" : "Record ED transfer"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {toastMessage ? (
          <div className={styles.toast} role="status" aria-live="polite" data-testid="ward-board-toast">
            {toastMessage}
          </div>
        ) : null}
      </main>
      <WardPrototypeFooter />
    </div>
  );
}

/**
 * An EXHAUSTIVE switch on `tile.kind`, not a chain of early returns ending in the occupied case as
 * the fall-through — which is how the blocked tile was broken the moment it was added.
 *
 * The chain read `if empty … if waiting … otherwise treat it as occupied`, so the new third kind
 * silently took the occupied branch, read a `bandId` it does not have, and rendered with the class
 * name `"undefined"` and an occupied fill. **Nothing failed.** `"undefined"` is a legal class name
 * that matches no rule, the tile still drew, and it drew in a plausible-looking colour. It was
 * found by sampling the rendered background of every tile kind on the page — not by a test, and
 * not by reading the diff, where the missing branch is an absence rather than a mistake.
 *
 * The `never` binding below is the guard against the next kind: adding a fifth `Tile` variant and
 * forgetting this function becomes a compile error instead of another silently mis-styled tile.
 */
function tileClassName(tile: Tile, selected: boolean): string {
  /* Selection is a WEIGHT — a heavier edge — and never a fill. On a sheet that has made no
     decision a filled element reads as a decision made, which is the failure the whole
     colour-never-alone rule exists to prevent; and a fill would additionally collide with the four
     band shades, so a selected band-2 tile would stop being readable as band 2. The word "Selected"
     on the tile face is the channel that survives greyscale and a stripped-background print. */
  const mark = selected ? ` ${styles.bedSelected}` : "";
  switch (tile.kind) {
    case "empty":
      return `${styles.bed} ${styles.bedEmpty}${mark}`;
    case "waiting":
      return `${styles.bed} ${styles.bedWaiting}${mark}`;
    case "blocked":
      return `${styles.bed} ${styles.bedBlocked}${mark}`;
    case "closed":
      return `${styles.bed} ${styles.bedHeld}${mark}`;
    case "occupied": {
      const band = tile.bandId === null ? "" : ` ${BAND_CLASS[tile.bandId]}`;
      const past = tile.pastDate ? ` ${styles.bedPast}` : "";
      return `${styles.bed} ${styles.bedOccupied}${band}${past}${mark}`;
    }
    default: {
      // Unreachable while the switch is exhaustive; a new variant fails to assign here.
      const unhandled: never = tile;
      throw new Error(`Unhandled ward-board tile kind: ${JSON.stringify(unhandled)}`);
    }
  }
}
