// src/components/ward-management/capacity/capacity-derivations.ts
//
// The computation behind Ward Flow's merged Capacity screen (MERGE 02, folding `capacity` and
// `morning`). Design lock: docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md §5.
//
// ⚠️ **THIS SCREEN ANSWERS "WHERE IS THE MISMATCH", NEVER "WHERE COULD THIS PERSON GO".** An
// earlier design put a single patient's shortlist here and the owner corrected it — this file
// computes AGGREGATE supply-versus-demand only. Nothing here ranks a unit for a patient, nothing
// returns a per-patient suggestion, and nothing here imports from `ward-eligibility.ts`. If a
// future change needs a per-patient answer, that belongs on the movement/shortlist surfaces that
// already exist (`shortlistCandidates`, `eligibility`), never bolted on here.
import { dayOf } from "@/components/ward-management/ward-clock";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  bedsPendingPreparation,
  capacityBreakdown,
  releaseBand,
} from "@/components/ward-management/ward-bed-availability";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedIsOccupied, remainingSpeciallingCapacity } from "@/components/ward-management/ward-admissions";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { isOpen, unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { siteByCode } from "@/components/ward-management/ward-sites";
import type {
  Cohort,
  HealthService,
  LeaveBed,
  Movement,
  Security,
  Unit,
  BedRelease,
} from "@/components/ward-management/ward-model";

/**
 * The four bed kinds a coordinator actually reasons about, in the order the design lock fixes
 * them. `bedKindGaps` returns rows in exactly this order — never sorted by size of gap, so the
 * page reads the same shape every time a coordinator opens it.
 */
export type BedKindId = "locked_adult" | "open_adult" | "older_adult" | "youth";

export type BedKindGap = {
  id: BedKindId;
  /** "A locked adult bed" — the thing being counted, for the row heading. */
  need: string;
  /** "Detained, or assessed as needing one" — who this kind of bed is for, in plain words. */
  who: string;
  /** Open movements needing this kind. Never includes a closed movement — see `isOpen`. */
  waiting: number;
  /** Beds of this kind currently allocatable anywhere in the network. */
  bedsThatFit: number;
  /** `bedsThatFit - waiting`. Negative is a shortfall; the sign is the whole point of the row. */
  gap: number;
};

/**
 * A movement's cohort and security together say what kind of bed it needs. Real `COHORTS` values
 * are `"Adult" | "Older adult" | "Youth"` (`ward-model.ts`) and `Security` is `"Open" | "Secure"` —
 * six combinations, four kinds, because an older-adult or youth movement needs a bed of that age
 * group regardless of security: the ward home board never splits those two cohorts by lock state,
 * so this screen does not invent a split the rest of the app does not have.
 */
function bedKindOfMovement(cohort: Cohort, security: Security): BedKindId {
  if (cohort === "Older adult") return "older_adult";
  if (cohort === "Youth") return "youth";
  // Only "Adult" is left, and that is the one cohort this screen does split by security.
  return security === "Secure" ? "locked_adult" : "open_adult";
}

/**
 * The same split, for bed SUPPLY rather than demand. A unit's `cohort` names the age group it
 * serves; within an Adult-cohort unit, `lockedBedsFree`/`openBedsFree` (`ward-bed-designation.ts`)
 * give the two counts this screen needs without any subtraction of its own. An older-adult or
 * youth unit's whole allocatable count fits either security level of its own cohort's demand, for
 * the same reason the demand side does not split those two cohorts by security.
 *
 * ⚠️ **DELIBERATELY IGNORES `unit.authorised`.** `bedsThatFit` asks "is this bed the right KIND",
 * never "may this ward lawfully detain" — those are different facts (design lock §5.7,
 * `tests/ward-locked-not-authorised.test.ts`) and merging them here would make a shortfall
 * disappear behind a bed nobody may actually place a detained patient in.
 */
function bedsOfKindAtUnit(unit: Unit, kind: BedKindId): number {
  switch (kind) {
    case "locked_adult":
      return unit.cohort === "Adult" ? lockedBedsFree(unit) : 0;
    case "open_adult":
      return unit.cohort === "Adult" ? openBedsFree(unit) : 0;
    case "older_adult":
      return unit.cohort === "Older adult" ? lockedBedsFree(unit) + openBedsFree(unit) : 0;
    case "youth":
      return unit.cohort === "Youth" ? lockedBedsFree(unit) + openBedsFree(unit) : 0;
  }
}

const ROWS: { id: BedKindId; need: string; who: string }[] = [
  { id: "locked_adult", need: "A locked adult bed", who: "Detained, or assessed as needing one" },
  { id: "open_adult", need: "An open adult bed", who: "Not detained, and not assessed as needing a locked bed" },
  { id: "older_adult", need: "An older-adult bed", who: "Older adult, locked or open — the age group is the need" },
  { id: "youth", need: "A youth bed", who: "Youth, locked or open — the age group is the need" },
];

/** One row per bed kind, in the locked order above. */
export function bedKindGaps(movements: Movement[], units: Unit[], now: Instant): BedKindGap[] {
  // `now` is accepted for parity with every other Ward Flow derivation and because a caller
  // computing `movements`/`units` upstream typically already has it — `isOpen` itself does not
  // read a clock, and neither does this function.
  void now;

  const open = movements.filter(isOpen);

  return ROWS.map(({ id, need, who }) => {
    const waiting = open.filter((movement) => bedKindOfMovement(movement.cohort, movement.security) === id).length;
    const bedsThatFit = units.reduce((total, unit) => total + bedsOfKindAtUnit(unit, id), 0);
    return { id, need, who, waiting, bedsThatFit, gap: bedsThatFit - waiting };
  });
}

/** The "All four together" row. Sums the rows — never recomputed independently, so the total can
 *  never disagree with what is sitting above it. */
export function bedKindTotals(rows: BedKindGap[]): { waiting: number; bedsThatFit: number; gap: number } {
  return rows.reduce(
    (totals, row) => ({
      waiting: totals.waiting + row.waiting,
      bedsThatFit: totals.bedsThatFit + row.bedsThatFit,
      gap: totals.gap + row.gap,
    }),
    { waiting: 0, bedsThatFit: 0, gap: 0 },
  );
}

export type NetworkWardRow = {
  unit: Unit;
  /** Beds free and usable now — `lockedBedsFree(unit) + openBedsFree(unit)`, which the two
   *  functions' own clamping keeps equal to `unit.allocatable.value` in every case. */
  ready: number;
  /** Of `ready`, how many are locked. */
  lockedReady: number;
  /**
   * ⚠️ **DELIBERATELY `undefined`, ON EVERY ROW, AND THAT IS NOT A PLACEHOLDER.**
   *
   * "Expected to free today" is a real figure elsewhere in this codebase (`BedRelease`,
   * `releaseBand`, `capacityBreakdown` in `ward-bed-availability.ts`) but it is built from a
   * `BedRelease[]` list that is reducer state, not a fact carried on `Unit` — and this function's
   * signature, fixed by the merge's shared contract, takes only `units` and `now`. There is no
   * honest way to answer "how many will free today" from a `Unit` alone: nothing on the type
   * records a future discharge.
   *
   * Every existing per-unit derivation that answers this question (`capacityBreakdown`,
   * `unitCapacity`) takes the release list as a parameter rather than importing the fixture
   * (`bedReleases` in `ward-movements.ts`) directly — and this file does the same rather than
   * break that pattern by reaching past its own inputs for a global. Reaching for the global would
   * also silently ignore whatever `units` a caller actually passed, which defeats the point of
   * taking `units` as a parameter at all.
   *
   * Returning `undefined` here rather than `0` matters: a coordinator reading `0` believes nothing
   * is freeing today, which is a specific, false, and dangerous claim to fabricate on a capacity
   * screen. `undefined` says "not tracked on this screen" instead, and it is on the caller of this
   * function to render that as an honest absence rather than a number.
   */
  freeing: number | undefined;
  /**
   * People in a bed on this ward whose discharge record says they are due to leave on today's
   * calendar day (bed board decision 8A, Josh, 26 Sept 2026: "go ahead with all recommendations";
   * the discharge record is the truth when screens disagree). Read from each stay's own
   * `expectedDischargeAt`, never from the release list, so it counts the record rather than a
   * prediction. `undefined` when this screen was not given the admissions, never a made-up 0.
   */
  dischargesDueToday: number | undefined;
  /**
   * 🔴 **THE SIX PER-WARD FIGURES, RESTORED 2026-09-06 BY OWNER RULING — AND EVERY ONE OF THEM IS
   * READ FROM `capacityBreakdown()` / `unitCapacity()` / `bedStates()`, NEVER COUNTED IN THIS FILE.**
   *
   * MERGE 02 cut this board to Ready · Locked · Freeing, and a release's stage stopped reaching the
   * coordinator entirely. Owner, asked whether that was intended: _"Yes the coordinator should still
   * see confirmed and blocked releases"_, then _"Yes add expected, held and occupied back too."_
   *
   * ⚠️ **THE FIRST BUILD OF THIS COUNTED `confirmed` AND `blocked` WITH ITS OWN LOOP OVER
   * `releases`, AND THAT WAS A DEFECT — TWO SOURCES OF TRUTH FOR ONE CLINICAL FIGURE.**
   * `capacityBreakdown()` already computed both, and already got two things right that the hand
   * count did not:
   *
   *   - it is scoped by `releaseBand(release, now)`, so it agrees with what the WARD screen shows;
   *     the hand count was unscoped and would have printed a different number for the same ward on
   *     two screens, which is worse than either scoping;
   *   - **it counts a blocked-but-confirmed bed as confirmed**, which its own comment records as the
   *     2026-08-28 defect: marking a stuck discharge blocked used to drop the confirmed count, so
   *     the figures improved at the moment the ward got stuck.
   *
   * **`excludedBeyondToday` is carried beside them for exactly that reason** — a release outside
   * today's band is not counted in the three figures above, and the screen must be able to say so
   * rather than let it vanish. ⚠️ **A discharge held up since Tuesday falls outside today's band:
   * that is a real clinical question, raised with the owner rather than settled by choosing a
   * derivation here.**
   */
  confirmed: number | undefined;
  /** Releases this ward expects today and has not yet confirmed — `capacityBreakdown().expectedToday`. */
  expected: number | undefined;
  /** Releases held up — `capacityBreakdown().blockedToday`, which tests `release.blocker !== null`. */
  blocked: number | undefined;
  /**
   * WLQ-10, owner ruling 2026-09-15: the EARLIEST `expectedAt` among this ward's currently blocked
   * releases (`blocker !== null` — always `null` once a bed is free, per `BedRelease.blocker`'s
   * own comment), so the screen can say since when the oldest of them has been held up. Deliberately
   * UNSCOPED by `releaseBand` —
   * unlike `blocked` above, which only ever counts TODAY's band, this reads every blocked release
   * regardless of age, because a discharge held up since three days ago is exactly the one whose
   * "since when" a coordinator needs, and `blockedToday` already keeps counting it (see
   * `releasesBeyondToday`'s own corrected comment for the measurement that established this).
   *
   * `undefined` exactly when `blocked` is `undefined` (no releases supplied) OR the ward has no
   * blocked release at all — never a fabricated instant standing in for "not tracked" or "none".
   */
  oldestBlockedSince: Instant | undefined;
  /** Releases outside today's band, counted in none of the three figures above and stated on screen. */
  excludedBeyondToday: number | undefined;
  /**
   * The ruled bed boxes (`ward-bed-states.ts`): Ready · Pulled · Closed · Occupied add up to the
   * ward's beds. `closed` is physically empty and not offered — the box once mislabelled "Held";
   * "Held" now means only a bed kept for a patient on leave (`onLeave`, inside `occupied`).
   * Without `admissions` no pull can be told apart, so `pulled` is 0 and a seeded pulled patient
   * stays inside `occupied` — the figure the screen printed before the ruling, not an invented one.
   */
  pulled: number;
  /** Empty beds this ward is NOT offering, and not pulled into — `bedStates().closed`. Always a number. */
  closed: number;
  /** Beds with a patient in them, excluding a pulled patient — `bedStates().occupied`. Always a number. */
  occupied: number;
  /** Inside `occupied`: beds held for a patient on leave — `bedStates().onLeave`. A marker, never a box. */
  onLeave: number;
  surge?: number;
  /** When the ward last confirmed its allocatable count — `unit.allocatable.confirmedAt`, the
   *  ward-sourced figure, not `unit.empty` (the feed's). */
  confirmedAt: Instant;
  /**
   * 🔴 **BEDS THAT ARE FREE BUT NOT YET USABLE — the count `ready` deliberately does NOT subtract.**
   *
   * Owner ruling 2026-09-05, after Ward Lead measured that "Ready" counted beds the application
   * itself refuses to admit a patient into: `ward-flow-reducer.ts` rejects `PULL_PATIENT` with
   * *"every free bed at X is still being made ready"*. At the seeded anchor `arm-adult-open` shows
   * Ready 2 while only 1 is pullable, because `WR-008` is discharged and still being cleaned. A
   * coordinator commits two patients and the second is refused at the moment of action, after the
   * ward has already been told.
   *
   * ⚠️ **THE RULING WAS EXPLICITLY *NOT* TO CHANGE THE NUMBER.** An earlier ruling of his avoids the
   * figure lurching as cleaning starts and stops, so `ready` stays exactly as it was and this sits
   * BESIDE it: "Ready 2 · 1 still being made ready". Do not subtract this from `ready`.
   *
   * `undefined` without `releases`, never 0 — same reasoning as `freeing` above. "Nothing is being
   * cleaned" and "we were not told" are different facts and only one of them is safe to imply.
   */
  pendingPreparation?: number;
  /**
   * 🔴 **TRUE WHEN THIS WARD'S BED RECORDS ARE MID-UPDATE — the SIGNAL, never the data.**
   *
   * Ward Lead ruling 2026-09-05, built 2026-09-06. `RELEASE_BED` raises `allocatable.value` and
   * `empty.value` together (`ward-flow-reducer.ts` 2335-2343, verified rather than recalled) and
   * **does not touch `sexMix`** — the model cannot know which sex left, and guessing a decrement
   * would be inventing a fact about a person. So for a moment the ward's recorded male/female total
   * and its occupancy disagree, and `allocatable` — which is what `ready` reads — has just moved.
   *
   * ⚠️ **THIS CARRIES THE SIGNAL AND NOT THE FIGURE, DELIBERATELY.** No sex mix is exposed here and
   * none should be: whether a ward's male/female counts belong on a network view is an open owner
   * question. What a coordinator needs from this screen is narrower and safe to state — that the
   * number in front of them may not have settled yet.
   *
   * `occupied` comes from `unitCapacity`, the model's own derivation, rather than a second
   * subtraction written here, so this predicate cannot drift from the figure it qualifies.
   */
  bedRecordsMidUpdate: boolean;
  /**
   * How many one-to-one specialling slots this ward could still staff, and how many it is authored
   * to staff at all. **Owner ruling 2026-09-06: specialling headroom goes on the network view**,
   * because `ward-flow-reducer.ts` REFUSES a pull when `remainingSpeciallingCapacity(...) <= 0`, and
   * a coordinator was being asked to plan against a rule the software enforces and the screen hid.
   *
   * ⚠️ **`speciallingFree` IS `undefined` WITHOUT AN ADMISSIONS LIST, AND THAT IS NOT FUSSINESS —
   * IT IS THE `freeing` LESSON APPLIED TO A GATE THAT REFUSES PEOPLE.** `remainingSpeciallingCapacity`
   * subtracts the occupied specialling beds it finds; hand it `[]` and it returns the ward's FULL
   * authored capacity. So a caller with no admissions would render *"2 free"* for a ward with none —
   * **a fabricated claim of headroom, in the direction that sends a patient somewhere that must
   * refuse them.** `undefined` says "not known on this screen" and the cell prints words.
   */
  speciallingFree: number | undefined;
  /** `unit.speciallingCapacity`, floored at zero — the denominator the refusal message quotes. */
  speciallingStaffable: number;
};

/**
 * WLQ-10, owner ruling 2026-09-15: the earliest `expectedAt` among ONE unit's currently blocked
 * releases, or `undefined` when it has none. Never scoped by `releaseBand`/day — a release held up
 * since three days ago is exactly the one this exists to find, not one to exclude. `discharged` is
 * excluded for the same reason `networkWardRows` and `capacityBreakdown` both exclude it: a
 * discharged release's `blocker` is always `null` (see `BedRelease.blocker`'s own comment), so the
 * filter is belt-and-braces rather than load-bearing.
 */
function oldestBlockedSince(unitId: string, releases: BedRelease[]): Instant | undefined {
  const blockedAt = releases
    .filter((release) => release.unitId === unitId && release.state !== "discharged" && release.blocker !== null)
    .map((release) => release.expectedAt);
  return blockedAt.length === 0 ? undefined : Math.min(...blockedAt);
}

/**
 * ⚠️ **`releases` IS OPTIONAL, AND `freeing` IS `undefined` WITHOUT IT — NOT ZERO.**
 *
 * "Expected to free today" is a real concept but it does NOT live on `Unit`: it lives in
 * `BedRelease[]`, which is reducer state. The first version of this function had no way to reach
 * it and correctly returned `undefined` rather than `0` — **because `0` would tell a coordinator
 * "nothing is freeing today" on a capacity screen, which is a fabricated fact in the direction that
 * causes harm.** That judgement was right and is preserved here: a caller who supplies no releases
 * still gets `undefined`, and the screen must render an absence in words rather than a figure.
 *
 * Optional rather than required so the parameter could be added without breaking a caller written
 * against the earlier signature.
 *
 * "Today" is `dayOf`, the model's own notion of which demonstration day an instant falls on. An
 * `Instant` carries no calendar date, so comparing against one would be inventing a fact the model
 * does not hold — the same reasoning `delays-screen.tsx` records for its "resolved today" panel.
 *
 * A release already `released` is not "freeing": the bed is free and is already counted in
 * `ready`. Counting it in both would double-count the same bed on the same row.
 */
export function networkWardRows(
  units: Unit[],
  now: Instant,
  releases?: BedRelease[],
  admissions?: Admission[],
  leave?: LeaveBed[],
): NetworkWardRow[] {
  const freeingByUnit = new Map<string, number>();
  for (const release of releases ?? []) {
    // ⚠️ "discharged", NOT "released". The third bed state was RENAMED on 2026-08-30 because
    // "released" reads as release from detention. BED_RELEASE_STATES is ["expected", "confirmed",
    // "discharged"] — there is no "released" and no "cancelled", and I wrote both before checking.
    // A discharged bed is already free and already counted in `ready`; counting it again here
    // would double-count the same bed on the same row.
    if (release.state === "discharged") continue;
    if (dayOf(release.expectedAt) !== dayOf(now)) continue;
    freeingByUnit.set(release.unitId, (freeingByUnit.get(release.unitId) ?? 0) + 1);
  }
  return units.map((unit) => {
    const cap = unitCapacity(unit, []);
    const states = bedStates(unit, admissions ?? [], releases ?? [], leave ?? []);
    return {
      unit,
      ready: lockedBedsFree(unit) + openBedsFree(unit),
      lockedReady: lockedBedsFree(unit),
      freeing: releases === undefined ? undefined : (freeingByUnit.get(unit.id) ?? 0),
      dischargesDueToday:
        admissions === undefined
          ? undefined
          : admissions.filter(
              (admission) =>
                admission.unitId === unit.id &&
                bedIsOccupied(admission) &&
                admission.expectedDischargeAt !== null &&
                dayOf(admission.expectedDischargeAt) === dayOf(now),
            ).length,
      // 🔴 ALL FIVE FROM THE CANONICAL DERIVATIONS, NEVER COUNTED HERE — see the row type's note.
      confirmed:
        releases === undefined ? undefined : capacityBreakdown(unit, releases, leave ?? [], now).confirmedToday,
      expected: releases === undefined ? undefined : capacityBreakdown(unit, releases, leave ?? [], now).expectedToday,
      blocked: releases === undefined ? undefined : capacityBreakdown(unit, releases, leave ?? [], now).blockedToday,
      // WLQ-10: unscoped by day, deliberately — see the field's own doc comment on `NetworkWardRow`.
      oldestBlockedSince: releases === undefined ? undefined : oldestBlockedSince(unit.id, releases),
      excludedBeyondToday:
        releases === undefined ? undefined : capacityBreakdown(unit, releases, leave ?? [], now).excludedBeyondToday,
      // The four ruled boxes come from `bedStates`, never counted here. Unlike the release figures
      // above they are ALWAYS a number: Closed and Occupied read the `Unit`, and Pulled reads the
      // admissions (0 without them — see the field's note on `NetworkWardRow`).
      pulled: states.pulled,
      closed: states.closed,
      occupied: states.occupied,
      onLeave: states.onLeave,
      surge: ("surge" in cap ? (cap as { surge?: number }).surge : undefined) ?? Math.max(0, cap.occupied - unit.beds),
      // `bedsPendingPreparation` is the reducer's OWN helper — the same function whose result gates
      // PULL_PATIENT — so the screen and the refusal cannot disagree about which beds are still
      // being made ready.
      pendingPreparation: releases === undefined ? undefined : bedsPendingPreparation(unit.id, releases),
      confirmedAt: unit.allocatable.confirmedAt,
      // `releases ?? []` only because `unitCapacity` takes them for its `potential` field, which this
      // never reads; `occupied` is derived from `beds`, `empty` and `blocked` alone, so the answer is
      // the same whether or not a caller supplied releases.
      bedRecordsMidUpdate:
        Object.values(unit.sexMix).reduce((sum, count) => sum + count, 0) !==
        unitCapacity(unit, [...(releases ?? [])]).occupied,
      // `admissions === undefined` is "nobody told this screen", never "nobody is being specialled".
      // See the field's own note: `remainingSpeciallingCapacity(unit, [])` returns FULL capacity.
      speciallingFree: admissions === undefined ? undefined : remainingSpeciallingCapacity(unit, admissions),
      speciallingStaffable: Number.isFinite(unit.speciallingCapacity)
        ? Math.max(0, Math.floor(unit.speciallingCapacity))
        : 0,
    };
  });
}

/**
 * What a ward's "freeing today" cell prints — the one place that decides it.
 *
 * ⚠️ **SPLIT OUT OF THE JSX SO ITS ABSENCE BRANCH CAN BE REACHED BY A TEST AT ALL.** Inline in the
 * cell, `row.freeing === undefined ? … : …` was only ever exercised through the fixture, and
 * `CapacityScreen` reads `bedReleases` from `useWardFlow()`, which types it `BedRelease[]` — never
 * `undefined`. So `networkWardRows` always receives releases, always returns a number, and the
 * absence branch could not run: measured 2026-09-05, 23 rows, 0 of them untracked. A branch no test
 * can reach is indistinguishable from one that does not work, and would not be missed if a refactor
 * quietly dropped it. Taking `number | undefined` as a plain argument makes both answers directly
 * constructible.
 *
 * 🔴 **A NUMBER IS PRINTED WHENEVER THERE IS ONE, INCLUDING ZERO.** `0` and `undefined` are the two
 * different facts this whole field exists to keep apart (see `NetworkWardRow.freeing`): `0` is a
 * ward that reports and has nothing freeing today, `undefined` is a ward that does not report. A
 * `?? 0` anywhere on this path collapses the second into the first and tells a coordinator
 * something false with total confidence.
 *
 * The words themselves are ordinary copy, not ward vocabulary — a redesign may reword them. What
 * must survive any rewording is the PROPERTY, which is what the tests assert: the absence reads as
 * a sentence and never as a figure.
 */
export function freeingCellText(freeing: number | undefined): string {
  /*
   * 🔴 **`"none"` FOR A KNOWN ZERO — owner ruling 2026-09-06, closing census §8.**
   *
   * The three cells disagreed with each other on one line. After `ready === 0` began rendering the
   * word, a row where all three counts were zero read **`none · 0 · 0`** — Kununurra Adult Open was
   * the clean case. Three zero counts, one a word and two digits, with nothing on screen saying they
   * mean the same thing; **the most natural reading of a deliberate difference is that there is
   * one.** The owner took the option that makes the row internally consistent.
   *
   * ⚠️ **`"Not tracked here"` AND `"none"` ARE STILL DIFFERENT STATEMENTS AND MUST STAY SO.**
   * `undefined` means *nobody told this screen*; `0` means *the ward told us, and the answer is
   * none*. Collapsing them would be the fabrication this file's other comments exist to prevent.
   */
  return freeing === undefined ? "Not tracked here" : countCellText(freeing);
}

/**
 * 🔴 **THE ONE PLACE THIS SCREEN DECIDES HOW A COUNT IS SPELLED.**
 *
 * The census-§8 fix above made all three count columns agree. This makes them unable to disagree.
 * `Ready`, `Locked` and `Freeing` each carried their own copy of the rule, **and the defect was
 * exactly that: one copy was updated and two were not**, so a row read `none · 0 · 0`. Three copies
 * of one rule with only one changed is how the row shipped, and fixing the three copies leaves the
 * next person three places to update. Routing them through here removes the possibility instead.
 *
 * ⚠️ `tests/ward-capacity-zero-spelling.dom.test.tsx` still asserts across the ROW rather than
 * relying on this, because a future cell could be written without calling it — but a cell that does
 * call it cannot drift, which is the stronger of the two guarantees.
 *
 * The word is ordinary copy and a redesign may reword it. What must survive any rewording is that
 * **every count column spells zero the same way**, and that a stated zero stays distinguishable
 * from `freeingCellText`'s absence.
 */
export function countCellText(value: number): string {
  return value === 0 ? "none" : String(value);
}

/**
 * 🔴 **THE RELEASES THIS BOARD DOES NOT SHOW, COUNTED — because dropping them in silence is the
 * one thing the retired capacity board's own test forbade.**
 *
 * `networkWardRows` above counts a release into `freeing` only when `dayOf(release.expectedAt)`
 * is today. A bed genuinely expected to free the day after tomorrow is therefore left out of every
 * figure on this screen, correctly — "freeing today" must not quietly include tomorrow — **but
 * being left out of a figure is not the same as being unmentioned.** The board this screen replaced
 * surfaced the excluded count, and `ward-capacity-view.dom.test.tsx` pinned the rule in as many
 * words: *"a release beyond the horizon must be counted and shown, never quietly omitted."* That
 * pin had been standing over an unreachable mode since MERGE 02.
 *
 * ⚠️ **`discharged` IS EXCLUDED HERE FOR THE SAME REASON IT IS EXCLUDED ABOVE, AND NOT BECAUSE IT
 * IS BEYOND THE HORIZON.** A discharged bed is already free and already counted in `ready`;
 * counting it as "expected later" would be a second claim about the same bed. The two exclusions
 * look alike in the code and mean opposite things — one bed is not here yet, the other already
 * arrived — so they are two statements rather than one combined condition.
 *
 * 🔴 **CORRECTED 2026-09-15 (WLQ-10) — MUST AGREE WITH `releaseBand`, NOT RECOMPUTE ITS OWN DAY
 * TEST.** This used to read `dayOf(release.expectedAt) !== dayOf(now)`, which is symmetric: it
 * flagged a release expected TWO DAYS FROM NOW (the case this comment above is actually about) but
 * also, by the same test, a release expected TWO DAYS AGO — a discharge that is still held up
 * today, still counted in `capacityBreakdown().blockedToday` and in `groupDischarges().blocked`
 * (`discharge-board.tsx`) exactly as it should be, since neither of those reads this function.
 * Measured directly: a `confirmed` release with a blocker, `expectedAt` two days in the past,
 * produced `blockedToday: 1` and `excludedBeyondToday: 0` from `capacityBreakdown` — correctly
 * still counted — while THIS function said `1`, and the screen printed *"1 release outside today,
 * excluded from today's figures"* beside it. That sentence was false: the release was never
 * excluded from anything. Owner ruling 2026-09-15: a held-up discharge keeps counting in its
 * ward's held-up figure for as long as it is held up, so the sentence claiming otherwise had to go,
 * not the counting.
 *
 * `releaseBand` already draws exactly the line this function's own comment describes — "day after
 * tomorrow" is `"beyond-today"`, "tomorrow" and anything already due or overdue is not — and it is
 * the SAME line `capacityBreakdown` and `groupDischarges` use for the figures this sentence sits
 * beside. Reusing it, rather than a second hand-rolled day comparison, is what keeps the three
 * agreeing.
 *
 * Returns a plain number and not `undefined`: unlike `freeing`, a caller that hands over the
 * releases has genuinely been told, so nought excluded is a fact rather than an absence.
 */
export function releasesBeyondToday(releases: BedRelease[], now: Instant): number {
  return releases.filter((release) => release.state !== "discharged" && releaseBand(release, now) === "beyond-today")
    .length;
}

export function networkTotals(rows: NetworkWardRow[]): {
  wards: number;
  beds: number;
  ready: number;
  /** Summed only over rows that HAVE a figure; `undefined` when none does, never a misleading 0. */
  pendingPreparation?: number;
} {
  const tracked = rows.map((row) => row.pendingPreparation).filter((value): value is number => value !== undefined);
  return rows.reduce(
    (totals, row) => ({
      ...totals,
      wards: totals.wards + 1,
      beds: totals.beds + row.unit.beds,
      ready: totals.ready + row.ready,
    }),
    {
      wards: 0,
      beds: 0,
      ready: 0,
      pendingPreparation: tracked.length === 0 ? undefined : tracked.reduce((sum, value) => sum + value, 0),
    },
  );
}

/**
 * Task 2 (Part Two) — the network table's rows, grouped by health service so the table can fold.
 *
 * ⚠️ **THE SAME PARTITION `bed-map.tsx`'s `groupBedMapWardsByService` USES, SO THE TABLE AND THE
 * MAP DIRECTLY ABOVE IT CAN NEVER GROUP A WARD DIFFERENTLY.** Same canonical order
 * (`wardServiceOrder`), same lookup (`siteByCode(unit.siteCode).service`), same throw on an
 * unresolved site. This is not a call into `groupBedMapWardsByService` itself — that function
 * groups `BedMapWard[]`, a different shape from `NetworkWardRow[]` — but an identical algorithm
 * over the same field read the same way, which is what "never group differently" actually
 * requires: two functions computing the SAME fact from the SAME input, not one calling the other.
 *
 * Every service in `wardServiceOrder` gets an entry, including one with no wards — an empty array,
 * never an omitted entry — for the same reason `groupBedMapWardsByService` does: a service simply
 * absent from the table would read as "no such bed exists", which is the failure this partition
 * exists to prevent. `wardServiceOrder` is FIVE services today (North Metro, East Metro, South
 * Metro, WACHS, Private) — read from the constant rather than hand-listed, so a sixth added later
 * cannot be missed the same way an earlier draft of this task's own brief missed Private.
 */
export type NetworkServiceGroup = {
  service: HealthService;
  wards: NetworkWardRow[];
};

export function groupNetworkWardRowsByService(rows: NetworkWardRow[]): NetworkServiceGroup[] {
  return wardServiceOrder.map((service) => ({
    service,
    wards: rows.filter((row) => {
      const site = siteByCode(row.unit.siteCode);
      // Every unit in this fixture resolves to a real site (see `groupBedMapWardsByService`'s own
      // comment) — an unresolved site is a data contradiction, not a case to place somewhere by
      // default, so this throws rather than silently dropping the ward or guessing its service.
      if (!site) {
        throw new Error(`Capacity network table: no site matches "${row.unit.siteCode}" for "${row.unit.name}".`);
      }
      return site.service === service;
    }),
  }));
}

/**
 * One service group's folded totals — every field produced by calling the SAME function the
 * per-ward cell already calls (`countCellText`/`freeingCellText` in `capacity-screen.tsx`),
 * summed over that group's OWN rows and never sliced from `networkTotals`. A column appearing or
 * disappearing therefore cannot slide a total one cell sideways: each field here is named for the
 * column it feeds, never for its position.
 *
 * `undefined` fields mirror `NetworkWardRow`'s own honesty rule: a figure this screen was never
 * told is `undefined`, never a fabricated 0, whether it is one ward's cell or a whole service's
 * total. `networkWardRows` takes one `releases`/`admissions` argument for the whole network, so in
 * practice every row it returns is tracked together or not at all — "some rows tracked, some not"
 * does not arise in this product today — but `trackedSum` below still sums only the tracked values
 * and reports `undefined` when none exist, rather than silently treating an absent figure as zero,
 * in case that ever changes.
 *
 * Three of the table's fifteen columns are deliberately NOT totalled here — bed kinds served, the
 * per-ward freshness stamp, and the per-ward refresh action — because each names a fact that does
 * not sum, average, or otherwise fold into one number without inventing a claim nobody made.
 * `capacity-screen.tsx`'s group summary row states that in words rather than rendering a figure
 * that looks like a total and is not.
 */
export type NetworkServiceGroupTotals = {
  wards: number;
  ready: number;
  lockedReady: number;
  freeing: number | undefined;
  dischargesDueToday: number | undefined;
  confirmed: number | undefined;
  expected: number | undefined;
  blocked: number | undefined;
  pulled: number;
  closed: number;
  occupied: number;
  surge?: number;
  sexMix: { Female: number; Male: number };
  speciallingFree: number | undefined;
  speciallingStaffable: number;
  /** How many of this group's own wards are `unit.authorised` — a real count, not a sum of a flag. */
  authorised: number;
};

function trackedSum(values: (number | undefined)[]): number | undefined {
  const tracked = values.filter((value): value is number => value !== undefined);
  return tracked.length === 0 ? undefined : tracked.reduce((sum, value) => sum + value, 0);
}

export function networkServiceGroupTotals(rows: NetworkWardRow[]): NetworkServiceGroupTotals {
  return {
    wards: rows.length,
    ready: rows.reduce((sum, row) => sum + row.ready, 0),
    lockedReady: rows.reduce((sum, row) => sum + row.lockedReady, 0),
    freeing: trackedSum(rows.map((row) => row.freeing)),
    dischargesDueToday: trackedSum(rows.map((row) => row.dischargesDueToday)),
    confirmed: trackedSum(rows.map((row) => row.confirmed)),
    expected: trackedSum(rows.map((row) => row.expected)),
    blocked: trackedSum(rows.map((row) => row.blocked)),
    pulled: rows.reduce((sum, row) => sum + row.pulled, 0),
    closed: rows.reduce((sum, row) => sum + row.closed, 0),
    occupied: rows.reduce((sum, row) => sum + row.occupied, 0),
    surge: rows.reduce((sum, row) => sum + (row.surge ?? 0), 0),
    sexMix: rows.reduce(
      (totals, row) => ({
        Female: totals.Female + row.unit.sexMix.Female,
        Male: totals.Male + row.unit.sexMix.Male,
      }),
      { Female: 0, Male: 0 },
    ),
    speciallingFree: trackedSum(rows.map((row) => row.speciallingFree)),
    speciallingStaffable: rows.reduce((sum, row) => sum + row.speciallingStaffable, 0),
    authorised: rows.filter((row) => row.unit.authorised).length,
  };
}
