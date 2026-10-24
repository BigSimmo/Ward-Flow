// The bed board's model: tile, occupant and incoming/outgoing derivations, the filter, order and
// flow-tab vocabularies, shift-tile types and tile class names. Split out of ward-board.tsx to keep
// that file under the line cap; ward-board.tsx re-exports movementForBoardArrival and
// boardArrivalAllowed.
import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  stayBand,
  stayDayNumber,
  type Admission,
  type StayBandId,
  type DischargeBarrier,
} from "@/components/ward-management/ward-admissions";
import { tentativeDiagnosisPhrase, type TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import { releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import {
  formatInstantWithDay,
  minuteOfDay,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { bedStates } from "@/components/ward-management/ward-bed-states";
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
import styles from "./board.module.css";

/** The four band fills, in `STAY_BANDS` order. One hue, four deepening steps — see the
 *  `--wb-band-*` tokens in `board.module.css`. Keyed by band id rather than by array index so a
 *  reordering of `STAY_BANDS` cannot silently re-map a shade onto the wrong band. */
export const BAND_CLASS: Record<StayBandId, string> = {
  "under-2-weeks": styles.band1,
  "2-weeks-1-month": styles.band2,
  "1-3-months": styles.band3,
  "over-3-months": styles.band4,
};

export type Tile =
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

export const BOARD_FILTERS = ["all", "look", "ready", "quiet"] as const;
export type BoardFilter = (typeof BOARD_FILTERS)[number];

export const BOARD_FILTER_LABELS: Record<BoardFilter, string> = {
  all: "All beds",
  look: "Needs a look",
  ready: "Ready",
  quiet: "Nobody due out",
};

export const BOARD_ORDERS = ["stay", "leaving", "recorded"] as const;
export type BoardOrder = (typeof BOARD_ORDERS)[number];

export const BOARD_ORDER_LABELS: Record<BoardOrder, string> = {
  stay: "Longest stay first",
  leaving: "Soonest to leave first",
  recorded: "Recorded order",
};

export const BOARD_ORDER_NOTES: Record<BoardOrder, string> = {
  stay: "Longest stay first; beds without a recorded stay follow recorded order.",
  leaving: "Soonest expected out first; beds without an expected date follow recorded order.",
  recorded: "Recorded source order; this does not identify bed locations.",
};

export const FLOW_TABS = ["outgoing", "incoming", "since"] as const;
export type FlowTab = (typeof FLOW_TABS)[number];

/**
 * Where a unit's own record lives.
 *
 * ⚠️ **The UNIT comes from live state; only the SITE comes from the network's sites
 * (`useWardNetwork().sites`).** That split is the whole fix for the board disagreeing with the
 * ward screen. A unit's capacity fields are mutated by the reducer on a structural clone (`PULL_PATIENT`, `RECORD_ARRIVAL`, `CONFIRM_CAPACITY`), and
 * the network's sites are the un-mutated seed that no reducer path ever writes — so reading the
 * unit from there produced a permanently seed-valued `held` while the ward screen moved.
 *
 * The site is different in kind: name and code are static reference data, not state, and no event
 * changes them. It is still resolved by walking the network's sites rather than through
 * `unitById`, which `tests/ward-flow-single-source.test.ts` restricts to three named fixture files.
 *
 * Returns `undefined` for an unknown id and never falls back to a different ward.
 */
export function findUnit(
  unitId: string,
  liveUnits: readonly Unit[],
  sites: readonly Site[],
): { unit: Unit; site: Site } | undefined {
  const unit = liveUnits.find((candidate) => candidate.id === unitId);
  if (unit === undefined) return undefined;
  for (const site of sites) {
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
export function buildTiles(
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
export type Occupant = {
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
   * FD-10: the ward's own tentative diagnosis, phrased the same way, with when it was recorded
   * (`formatInstantWithDay`), or `null` while the ward has recorded none. Shown beside
   * `tentativeDiagnosis`, never in place of it.
   */
  wardDiagnosis: { phrase: string; block: TentativeDiagnosisBlock; recordedAt: string; recordedBy: string } | null;
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
export function departureTimeInputValue(instant: Instant): string {
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
export function buildOccupants(unit: Unit, admissions: readonly Admission[], now: Instant): Occupant[] {
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
      wardDiagnosis: wardDiagnosisLine(admission, now),
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
export function expectedPhrase(expectedDays: number | null): string {
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
export function movesPhrase(moves: number): string {
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
export const OUTGOING_BASES = ["confirmed", "expected"] as const;
export type OutgoingBasis = (typeof OUTGOING_BASES)[number];

/**
 * The basis in the words the HOME PAGE already uses for it.
 *
 * `CAPACITY_FIGURE_LABELS` is the single vocabulary the morning page, the hospital rollup and the
 * ward rollup all render (`ward-morning-rollup.ts`, spec D3/D14), so the toggle names the two
 * figures it switches between with the labels those figures already carry. Typing "Confirmed" and
 * "Expected" here instead would pass every test today and cost the cheap rename tomorrow, which
 * is the exact failure that constant exists to prevent.
 */
export const OUTGOING_BASIS_LABEL: Record<OutgoingBasis, string> = {
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
export const RELEASE_BAND_PHRASE: Record<ReleaseBand, string> = {
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
export function outgoingToday(
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
export type Incoming = {
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
export function buildIncoming(
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
export function bedGonePhrase(hours: number | null): string {
  if (hours === null) return "Bed given away — when is not recorded";
  if (hours === 0) return "Bed given away within the hour";
  return `Bed given away ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/** The DOM id of a tile's own button, so closing the slide-out can hand focus back to exactly the
 *  control that opened it. Derived from the tile key, which is unique within one board. */
export function tileDomId(key: string): string {
  return `ward-board-tile-${key}`;
}

interface ShiftAction {
  word: string;
  tone?: "warn" | "danger" | "good";
  say: string;
}
export interface ShiftTileItem {
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
export function tileClassName(tile: Tile, selected: boolean): string {
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

/** FD-10: the ward's own block, phrased, with its recorded time; `null` when the ward has none. */
function wardDiagnosisLine(admission: Admission, now: Instant): Occupant["wardDiagnosis"] {
  const recorded = admission.wardDiagnosis;
  if (!recorded) return null;
  const phrase = tentativeDiagnosisPhrase(recorded.block);
  return phrase === null
    ? null
    : {
        phrase,
        block: recorded.block,
        recordedAt: formatInstantWithDay(recorded.recordedAt, now),
        // The coordinator may record for a ward, so the line names who actually did.
        recordedBy: recorded.recordedBy === "coordinator" ? "the coordinator" : "the ward",
      };
}
