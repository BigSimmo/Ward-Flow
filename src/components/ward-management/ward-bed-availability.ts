import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { dayOf, MINUTES_PER_DAY, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";
import { EVENING_SHIFT_END_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";

/**
 * Every figure the capacity board shows, derived in one place so no screen computes its own
 * version. Phase 5, spec D5 and D6.
 *
 * The rule this file exists to enforce: **nothing expected, confirmed-but-unreleased, or on leave
 * is ever added into `availableNow`.** A coordinator must be able to point at that number and say
 * "that is a bed I can fill this minute", and it must never have been softened by an expectation.
 *
 * A released bed still being made ready is NOT in `availableNow` (Josh, 13 Nov 2026, D-179 item 8;
 * A9-13, Audit 9 question 11).
 * This replaces the 5 September 2026 ruling (bed-model rework, Q4) that such a bed is still offered
 * and still counted. It is counted and shown on its own (`bedsPendingPreparation`, and
 * `bedStates().beingMadeReady` beside Ready), and it may still be pulled (D-181 item 5).
 */

const MIDDAY_MINUTES = 12 * 60; // 720
const LATE_AFTERNOON_MINUTES = 16 * 60; // 960

/**
 * The evening shift ends at 23:00 (the one shift pattern, `SHIFT_PATTERN`). Named once here rather than repeated as a literal anywhere a
 * band boundary is checked.
 */
export { EVENING_SHIFT_END_MINUTES };

/**
 * WB-DB-7 added `"tomorrow"` on 2026-08-30, and it is not a fifth bucket bolted onto four.
 *
 * The owner asked for the horizon to roll forward twenty-four hours instead of stopping at the end
 * of the evening shift. Widening it alone would have been one line and would have LIED: the four
 * bands below are TIMES OF DAY, and a discharge expected at 09:00 tomorrow falls through
 * `<= MIDDAY` and `<= LATE_AFTERNOON` and lands in `"tonight"`. It compiles, every test passes, and
 * a ward reads at handover that a bed frees tonight when it frees tomorrow morning.
 *
 * That is the same defect as `Instant` meaning two things: an absolute instant compared against a
 * time-of-day constant, in a fourth place. So the fix is the same shape rather than a new band -
 * `releaseBand` decides WHICH DAY first and only then which part of that day, and "tomorrow" falls
 * out of the model instead of being added to it.
 */
export const RELEASE_BANDS = ["now", "by-midday", "by-1600", "tonight", "tomorrow"] as const;
export type ReleaseBand = (typeof RELEASE_BANDS)[number];

/**
 * WHICH DAY FIRST, THEN WHICH PART OF THAT DAY. Rewritten 2026-08-30; read the reason before
 * changing it back.
 *
 * The three named constants are minutes from the start of DAY ZERO. Until the demo clock moved,
 * every instant WAS a minute of day zero, so comparing a raw instant against them was correct —
 * and the comment that used to sit here defended exactly that, for a real reason restated below.
 *
 * **Once the clock ran past midnight that comparison collapsed.** An instant on day one is 1440 or
 * more, so every release on day one exceeded `EVENING_SHIFT_END_MINUTES` and came back
 * `"beyond-today"`: the whole band vocabulary reduced to one value, and "beyond today" came to
 * mean "beyond day zero". Confirmed by running it rather than inferred —
 * `tests/ward-release-band-day-boundary.test.ts` failed with `expected 'beyond-today' to be
 * 'by-midday'` for an 09:00 discharge read at 08:00 on day one.
 *
 * **The rule the old comment protected still holds and is still enforced.** A release a full day
 * after `now` must NOT wrap back into an earlier band — `now + 1440` falls at the same clock time
 * as `now` and is emphatically not "now". That is why the DAY comparison comes first and
 * short-circuits before any minute-of-day comparison is reached. Wrapping first was the danger;
 * wrapping only after the day is settled is not.
 *
 * **DB-7 HAS SINCE LANDED and this paragraph's premise is gone.** It said the horizon was
 * deliberately unchanged and that a later day was still `"beyond-today"`. The owner answered on
 * 2026-08-30: the horizon rolls a full twenty-four hours and a later day is `"tomorrow"`. The
 * morning page carries the stated notice that its figures rose because the rule changed. Kept as a
 * record rather than deleted, because the reasoning above is why the change was dangerous to make
 * carelessly, and that is still true
 */
export function releaseBand(release: BedRelease, now: Instant): ReleaseBand | "beyond-today" {
  if (release.state === "discharged") {
    // A ROLLING twenty-four hours, not the calendar day. A bed discharged at 23:00 stopped counting
    // at midnight under the old comparison - an hour later, and by the calendar rather than by
    // anything a ward would recognise. The night shift reads this board at 02:00 and the beds
    // discharged on their own shift had already dropped off it.
    if (now - release.confirmedAt >= MINUTES_PER_DAY) return "beyond-today";
    return "now";
  }

  // WHICH DAY FIRST. This is the whole correction: every comparison below is against a time of day,
  // so it may only be reached once the day is known to be today. `expectedAt` is an absolute
  // instant and `MIDDAY_MINUTES` is 720 - comparing them directly is the category error that made
  // a 09:00-tomorrow discharge render as "tonight".
  const daysAhead = dayOf(release.expectedAt) - dayOf(now);
  if (daysAhead >= 2) return "beyond-today";
  if (daysAhead === 1) return "tomorrow";

  // Anything already due, or dated earlier than today, is a bed a ward can act on now. A release
  // whose expected time has simply passed is not a mistake - it is a ward that has not yet
  // confirmed - and it belongs in front of somebody rather than in an excluded count.
  if (release.expectedAt <= now) return "now";

  const timeOfDay = minuteOfDay(release.expectedAt);
  if (timeOfDay <= MIDDAY_MINUTES) return "by-midday";
  if (timeOfDay <= LATE_AFTERNOON_MINUTES) return "by-1600";
  return "tonight";
}

export type CapacityBreakdown = {
  availableNow: number;
  confirmedToday: number;
  expectedToday: number;
  /**
   * How many of today's releases carry the blocked flag — the figure the four-stage model
   * structurally could not produce (bed-model rework, 2026-08-28).
   *
   * **It is a CROSS-CUT, not a fourth bucket.** Every release counted here is also counted in
   * `confirmedToday` or `expectedToday`, because being stuck says nothing about how certain the
   * discharge is. Never add it to those two, and never subtract it from them: it answers "how
   * many of these is somebody having to chase", which is a different question from "how many are
   * coming". A release expected beyond tonight is excluded here exactly as it is from the other
   * two, so this figure and `excludedBeyondToday` never double-count.
   */
  blockedToday: number;
  /**
   * How many of `confirmedToday` are also in `blockedToday` (Josh, 26 Oct 2026, decision A16). The
   * bed meeting splits held up + confirmed + expected = total, so its "confirmed" leaves these out;
   * Capacity keeps them in its confirmed figure and says "(N also held up)" so the two screens agree.
   */
  confirmedHeldUpToday: number;
  held: number;
  /**
   * 🔴 **BEDS ON LEAVE. RENAMED FROM `leaveUsable` 2026-09-06 AND THE MEANING CHANGED WITH IT —
   * OWNER RULING 11.** It used to count leave beds a ward had flagged `usable`, i.e. **had stated
   * could be filled while their occupant was away.** The ruling is that a bed on leave is not one a
   * ward would offer, so the field asking for that statement is gone and this counts the beds.
   *
   * ⚠️ **THE IDENTIFIER FOLLOWED THE MEANING HERE, AND DELIBERATELY DID NOT IN
   * `BED_RELEASE_BLOCKED_FIGURE_LABEL` ON THE SAME DAY.** There only the display wording changed and
   * `blocked` is still the model's own word for the field, so renaming would have carried a display
   * decision into the domain. **Here the concept itself changed**, so a name still saying `Usable`
   * would assert the removed claim at every call site.
   *
   * Never merged into `availableNow` — unchanged, and re-verified rather than assumed.
   */
  onLeave: number;
  excludedBeyondToday: number;
};

/**
 * One ward's bed releases not yet discharged: the window the ward page's Ward flow "Discharges"
 * lists and counts, and the count the Capacity and All wards ward panel shows (integration QA,
 * 3 Nov 2026), so the two cannot drift.
 */
export function openBedReleases(releases: readonly BedRelease[], unitId: string): BedRelease[] {
  return releases.filter((release) => release.unitId === unitId && release.state !== "discharged");
}

/**
 * Beds at this unit that are physically free but **NOT READY** — discharged, and still being made
 * ready. Owner ruling, 2026-09-01: *"A bed is only marked available once it is ready. Otherwise it is
 * marked pending."*
 */
export function bedsPendingPreparation(unitId: string, releases: BedRelease[]): number {
  return releases.filter((release) => release.unitId === unitId && release.state === "discharged" && release.preparing)
    .length;
}

/**
 * Pre-match a bed while it is being made ready (Top 25 item 15).
 * A bed being made ready is counted apart from Ready (D-179 item 8), but a patient can still be
 * matched to its ward and pulled while it is cleaned (D-181 item 5). This says whether the ward a
 * patient is matched or offered to has a bed being made ready, and whether the patient's placement
 * is paused for an unresumed ED medical deterioration (`Movement.medicalDeterioration`, D-34).
 * Replaces the showcase's `canPreMatchCleaningBed`, which read a deterioration off the bed.
 */
export function preMatchCleaningState(
  movement: { medicalDeterioration?: { at: Instant; resumedAt?: Instant } },
  unitId: string,
  releases: BedRelease[],
): { bedsBeingMadeReady: number; medicalPause: boolean } | undefined {
  const bedsBeingMadeReady = bedsPendingPreparation(unitId, releases);
  if (bedsBeingMadeReady === 0) return undefined;
  const medicalPause =
    movement.medicalDeterioration !== undefined && movement.medicalDeterioration.resumedAt === undefined;
  return { bedsBeingMadeReady, medicalPause };
}

/**
 * Top 25 item 4: this unit's beds still being made ready past `CLINICAL_VALUES.preparingBedStale`,
 * timed from the release's last recorded change (`confirmedAt`, restamped by `RECORD_LEAVING` and
 * `SET_BED_PREPARATION`). A reminder to confirm the bed is ready, read only: nothing here opens a
 * bed or changes a count (Q4). Oldest first.
 */
export function stalePreparingReleases(
  unitId: string,
  releases: readonly BedRelease[],
  now: Instant,
): { release: BedRelease; minutes: number }[] {
  return releases
    .filter((release) => release.unitId === unitId && release.state === "discharged" && release.preparing)
    .map((release) => ({ release, minutes: Math.max(0, now - release.confirmedAt) }))
    .filter((entry) => entry.minutes >= CLINICAL_VALUES.preparingBedStale.value)
    .sort((left, right) => right.minutes - left.minutes);
}

/**
 * Beds open and ready now: available, less the beds still being made ready (D-179 item 8). The
 * same figure as `capacityBreakdown().availableNow`. It does not take off pulls or named holds; the
 * Ready every screen prints is `readyBedsNow` (`ward-bed-states.ts`). A bed being made ready may
 * still be pulled (D-181 item 5), so the pull gate does not read this.
 */
export function openBedsNow(unit: Unit, releases: BedRelease[]): number {
  const { available } = boundedBedAvailability(unit);
  return Math.max(0, available - bedsPendingPreparation(unit.id, releases));
}

/**
 * Held up, one meaning (Josh, 13 Nov 2026, D-191 item 5; F-105): an open release with a recorded
 * blocker, due by tomorrow (an overdue date, today or tomorrow: `releaseBand` short of
 * "beyond-today"). `capacityBreakdownLists().blockedToday` below, Capacity, Ward, TV, the sheet and
 * the menu all count it this way; `ward-held-up.ts` carries the labels. Discharges keeps its own
 * "any date" group.
 */
export function isHeldUpDueByTomorrow(release: BedRelease, now: Instant): boolean {
  return release.state !== "discharged" && release.blocker !== null && releaseBand(release, now) !== "beyond-today";
}

/** The releases `isHeldUpDueByTomorrow` counts, in the order given. */
export function heldUpDueByTomorrow<T extends BedRelease>(releases: readonly T[], now: Instant): T[] {
  return releases.filter((release) => isHeldUpDueByTomorrow(release, now));
}

export type CapacityBreakdownLists = {
  confirmedToday: BedRelease[];
  expectedToday: BedRelease[];
  blockedToday: BedRelease[];
  confirmedHeldUpToday: BedRelease[];
  onLeave: LeaveBed[];
  excludedBeyondToday: number;
};

/**
 * Item 5 (count breakdown): the records behind `capacityBreakdown`'s day figures for one ward. The
 * figures are these lists' lengths, so a breakdown that lists them always adds up to the figure.
 */
export function capacityBreakdownLists(
  unit: Unit,
  releases: readonly BedRelease[],
  leave: readonly LeaveBed[],
  now: Instant,
): CapacityBreakdownLists {
  const lists: CapacityBreakdownLists = {
    confirmedToday: [],
    expectedToday: [],
    blockedToday: [],
    confirmedHeldUpToday: [],
    onLeave: leave.filter((bed) => bed.unitId === unit.id),
    excludedBeyondToday: 0,
  };
  for (const release of releases) {
    if (release.unitId !== unit.id || release.state === "discharged") continue;
    if (releaseBand(release, now) === "beyond-today") {
      lists.excludedBeyondToday += 1;
      continue;
    }
    // The bed-model rework's whole point (2026-08-28). `state` now carries ONLY how certain the
    // discharge is, so these two branches are exhaustive over every unreleased release and
    // nothing can fall between them — which is exactly what a release in the old fourth state
    // `"blocked"` did, silently dropping a stuck confirmed discharge out of the ward's confirmed
    // count. A blocked-but-confirmed bed is counted as confirmed here, deliberately, and the
    // block is reported alongside rather than instead. Do not re-introduce a `blocker` test into
    // this if/else — that is the defect, not a refinement of it.
    if (release.state === "confirmed") lists.confirmedToday.push(release);
    else lists.expectedToday.push(release);
    if (isHeldUpDueByTomorrow(release, now)) lists.blockedToday.push(release);
    if (release.blocker !== null && release.state === "confirmed") lists.confirmedHeldUpToday.push(release);
  }
  return lists;
}

export function capacityBreakdown(
  unit: Unit,
  releases: BedRelease[],
  leave: LeaveBed[],
  now: Instant,
): CapacityBreakdown {
  // Shared with the five-state bed grid so stale counts cannot make this screen disagree. A bed
  // still being made ready is not Ready (D-179 item 8).
  const { held } = boundedBedAvailability(unit);
  const availableNow = openBedsNow(unit, releases);
  const lists = capacityBreakdownLists(unit, releases, leave, now);
  return {
    availableNow,
    confirmedToday: lists.confirmedToday.length,
    expectedToday: lists.expectedToday.length,
    blockedToday: lists.blockedToday.length,
    confirmedHeldUpToday: lists.confirmedHeldUpToday.length,
    held,
    onLeave: lists.onLeave.length,
    excludedBeyondToday: lists.excludedBeyondToday,
  };
}
