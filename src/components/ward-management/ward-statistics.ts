import { admissionsForUnit, stayBand, type Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * Ward-level flow statistics — six figures about the WARD or the SYSTEM, never about a person.
 *
 * Every function here is pure: it takes an `Admission[]` and a `now` and returns numbers. No
 * React, no state, no I/O, and — the discipline this whole file exists to hold — no judgement.
 * None of the six figures below is a target, a threshold, or a ranking of one ward against
 * another. A ward reads its own numbers here; nothing here says whether they are good.
 *
 * **`null` means "nothing to average", and it must never be reported as `0`.** A ward with no
 * discharges has no average length of stay — it does not have an average of zero days. The two
 * claims are different, and this module is where they have already been confused once before (see
 * this file's own tests). Every averaging figure below is `number | null` for exactly this
 * reason; the count-based figures (`readyToLeaveCannot`, `longStays`, `dischargeDateOutcomes`) are
 * genuine counts, so `0` is a true and correct answer for them when there is no data.
 */

/**
 * How often a ward's own `expectedDischargeAt` plan was actually met, once someone left.
 *
 *   - `met` / `missed` are only known for an admission that has BOTH an expected date AND has
 *     actually left (`leftAt` set) — an admission still in the bed has no outcome yet, so it
 *     contributes to neither. Counting a still-occupied admission as "met" because its date
 *     has not yet passed would be optimistic rather than true; counting it as "missed" would be
 *     equally false in the other direction. It is simply not yet decided.
 *   - `moved` is a DIFFERENT question — how many admissions have had their plan revised at all
 *     (`dischargeDateMoves > 0`) — and is independent of whether the outcome is known yet. An
 *     admission still in the bed can already have a moved date; an admission that left on its
 *     very first expected date never moved at all. `met`/`missed`/`moved` are therefore NOT a
 *     three-way partition of the same population and must never be summed to "consideredCount".
 *   - `consideredCount` is `met + missed` — the admissions this figure has actually judged, kept
 *     separate so a caller can tell "no discharge dates were met" apart from "no discharge dates
 *     have resolved yet" (both would otherwise print `met: 0`).
 */
export type DischargeDateOutcomes = {
  met: number;
  missed: number;
  moved: number;
  consideredCount: number;
};

export type WardStatistics = {
  unitId: string;
  /**
   * `arrivedAt` -> `leftAt` (or `now`, for someone still in the bed), averaged and **rounded here
   * to ONE DECIMAL PLACE**.
   *
   * 🔴 THIS ROUNDS AT THE DERIVATION BECAUSE, UNTIL 2026-09-06, ONE FIGURE HAD THREE TREATMENTS.
   * This comment said "averaged in whole days"; nothing rounded; `statistics-compare-screen.tsx`
   * applied `.toFixed(1)`; and `statistics-ward-screen.tsx` rendered it raw, so **every ward page
   * published `44.33680555555556 days`** — fourteen decimal places of apparent precision on a
   * clinical figure derived from invented data. Found by opening the page; no test saw it, because
   * the suite asks whether the value renders and whether a null is ever shown as a zero. Both are
   * the right questions. Precision is a third one and nobody was asking it.
   *
   * ⚠️ "IN WHOLE DAYS" WAS AMBIGUOUS AND I AM NOT CLAIMING TO KNOW WHICH IT MEANT — it reads as
   * either "rounded to integers" or "expressed in days rather than hours". That ambiguity is why
   * the wording is now explicit rather than corrected: a contract a reader can take two ways is a
   * contract no implementation can violate.
   *
   * One decimal rather than integers because the compare screen had already chosen it, a reader has
   * already seen it, and a tenth of a day is about two and a half hours — real resolution on a stay
   * measured in weeks. Rounding HERE rather than at each render is what stops the third treatment
   * coming back.
   */
  averageLengthOfStayDays: number | null;
  /**
   * How many of this ward's admissions record an arrival AFTER the end of their stay — `leftAt` for
   * someone gone, `now` for a current occupant — excluded from the average above and counted here
   * instead, never folded in as a stay of no time. A count, so `0` is a true answer; it exists
   * because an exclusion nobody can see is behaviourally identical to the clamp that was removed.
   */
  lengthOfStayIncoherentCount: number;
  /**
   * `pulledAt` -> `arrivedAt`, averaged in minutes — the transport delay, measured. A number
   * nobody currently has: the bed is already gone at the pull, so this is time nobody occupies
   * anything, spent between two clocks the admission record keeps separately on purpose.
   *
   * ⚠️ **ROUNDED TO WHOLE MINUTES HERE, AND IT WAS NOT BEFORE.** This one rendered a tidy "300
   * minutes" and looked untouched by the defect above — **by fixture accident only.** Nothing
   * rounded it either; the seed happened to divide. A single changed admission would have printed
   * `300.41666666666663 minutes` on the same screen, and the fix that only chased the visible
   * fourteen-decimal figure would have left it there.
   */
  averageEmptyBedMinutes: number | null;
  /**
   * How many of this ward's admissions record an arrival EARLIER than the bed was given away —
   * excluded from the average above and counted here instead, never folded in as a wait of no time.
   *
   * A count, so `0` is a true answer. It exists because an exclusion nobody can see is behaviourally
   * identical to the clamp that was removed; see `emptyBedGap` for the ruling and the history.
   */
  emptyBedIncoherentCount: number;
  /**
   * The two ends of the same population the average above is taken over, `null` together when
   * there is nothing to average.
   *
   * 🔴 **ADDED 2026-09-06 BECAUSE THE WARD PAGE WAS PUBLISHING AN AVERAGE OVER A SET WITH NO
   * SPREAD AND SAYING NOTHING.** The statistics home page has warned about exactly this since
   * 2026-09-01 — *"every measured gap here is the same length, so this average is describing no
   * variation at all: it is one value repeated"* — and the per-ward pages, which are the surface a
   * coordinator opens about a NAMED ward, carried the same figure with no such signal.
   *
   * **Measured across the seed: 23 of 23 wards have zero spread.** So every ward page was showing
   * an "average" of one repeated number. The screen cannot detect that from the average alone,
   * which is why the ends belong here rather than being recomputed at a render.
   */
  emptyBedMinutesShortest: number | null;
  emptyBedMinutesLongest: number | null;
  dischargeDateOutcomes: DischargeDateOutcomes;
  /**
   * ALWAYS `null`. `Admission` records `pulledAt`, `arrivedAt`, `expectedDischargeAt`,
   * `dischargeDateSetAt` and `leftAt` — no instant marks the moment an admission entered
   * `"waitlisted"`. The equivalent figure already built elsewhere in this codebase
   * (`referralWaitLabel` in `ward-referrals.ts`) is measured from `Referral.raisedAt`, a field
   * this module has no access to: `wardStatistics` takes `Admission[]` only, by design. Rather
   * than fabricate a waitlist-start instant that does not exist on the record, this figure is
   * left honestly absent. See this module's test file for the full note, and the Task 7 report
   * for the flag: closing this gap needs either a new `Admission` field or a different input to
   * this function, and either is a product decision, not an implementation one.
   */
  averageWaitlistWaitMinutes: number | null;
  /** Admissions for this unit that have not departed and carry a `blockReason`. Never subtracted
   *  from any other figure — a blocked admission still counts everywhere else it belongs.
   *
   *  ⚠️ **"HAS NOT DEPARTED", NOT "ON THE WARD".** `admissionsForUnit` (`ward-admissions.ts:685`)
   *  returns "everything except `departed`", and its own doc records that "Waitlisted and pulled
   *  admissions are included". So a waitlisted person has no bed to be held in, and a pulled one
   *  has not arrived — neither can "leave". This doc said "currently on the ward" until 2026-09-07,
   *  which is the narrower population and not the one counted. */
  readyToLeaveCannot: number;
  /** Admissions currently on the ward whose `stayBand` (from `ward-admissions.ts`, never
   *  re-implemented here) is `"over-3-months"`. */
  longStays: number;
};

/** `null` when there is nothing to average — never `0`. See this module's doc comment. */
function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

/**
 * Round a published average to a stated number of decimal places, preserving `null`.
 *
 * ⚠️ **`null` PASSES STRAIGHT THROUGH, AND THAT IS THE WHOLE REASON THIS TAKES `number | null`
 * RATHER THAN `number`.** This module's central rule is that a null is worded and a nought is
 * counted, and they must never share a rendering — `ward-statistics-ward-nulls.dom.test.tsx`
 * fails on a digit inside any nullable measure. A rounding helper that coerced `null` to `0`
 * would convert "there was nothing to average" into "the average is zero" **silently, inside a
 * tidy-up commit**, which is precisely the confusion the type distinction exists to prevent.
 */
function roundTo(value: number | null, places: number): number | null {
  if (value === null) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * The verdict on one admission's stay, so an incoherent record can never be mistaken for a stay
 * of no time. Mirrors `emptyBedGap` below: a missing or unusable instant is "not-measurable", and
 * an arrival that falls AFTER the end of the stay (`leftAt`, or `now` for a current occupant) is
 * "incoherent" — a record that cannot be true of anybody, never a zero-minute stay.
 *
 * Reading `now` for a DEPARTED admission, or `leftAt`/nothing for a CURRENT one, is the exact
 * swap this function exists to prevent — see `daysInBed`'s own doc comment for why it looks
 * entirely reasonable in review and is wrong in the same direction every time.
 *
 * ⚠️ **THIS RETURNED `number | null` WITH A `Math.max(0, endedAt - arrivedAt)` CLAMP UNTIL THIS
 * FIX, AND THE CLAMP IS THE DEFECT.** An arrival after departure (or after `now`) produced a
 * negative duration that the clamp silently converted into a plausible "0 minutes", so the
 * impossible record was averaged in as a stay of no time — the same failure `emptyBedGap`'s ruling
 * documents at length. Ward Lead's ruling is that a clamp *"does not make a bad number safe, it
 * makes it invisible"*. Returning the verdict keeps one home for the decision, exactly as
 * `emptyBedGap` does for the empty-bed gap.
 */
type LengthOfStay =
  | { readonly kind: "measured"; readonly minutes: number }
  /** No stay to measure yet (not arrived), or an unusable instant. */
  | { readonly kind: "not-measurable" }
  /** Arrival is after the end of the stay (`leftAt`, or `now`). Cannot be true of anybody. */
  | { readonly kind: "incoherent" };

function lengthOfStay(admission: Admission, now: Instant): LengthOfStay {
  const arrivedAt = admission.arrivedAt;
  if (arrivedAt === null || !Number.isFinite(arrivedAt) || !Number.isFinite(now)) {
    return { kind: "not-measurable" };
  }
  const leftAt = admission.leftAt;
  const endedAt = leftAt !== null && Number.isFinite(leftAt) ? leftAt : now;
  const stay = endedAt - arrivedAt;
  return stay < 0 ? { kind: "incoherent" } : { kind: "measured", minutes: stay };
}

/**
 * Minutes from `pulledAt` to `arrivedAt` — and ONLY those two clocks. `null` when either instant
 * is missing or non-finite: a bed that has been pulled but not yet arrived has an empty-bed time
 * that is still running, not yet a measured fact, so it contributes nothing rather than a
 * guessed number.
 *
 * **Never `pulledAt` -> `now`.** That would keep growing after the person already arrived,
 * silently overstating the ward's transport-delay figure by however long ago they got there.
 * **Never `arrivedAt` -> `leftAt`** either — that is length of stay, a different question this
 * module answers separately.
 */
/**
 * ⚠️ **THIS RETURNED `number | null` UNTIL 2026-09-07, AND THE `null` MEANT THREE DIFFERENT
 * THINGS.** A missing instant, a non-finite one, and an impossible one all collapsed into the same
 * value, and `wardStatistics` filtered all three out together — so an incoherent record vanished
 * from the ward page with no figure, no sentence and nothing at all on screen.
 *
 * That is the exact outcome the clamp was removed to prevent. Ward Lead's ruling of 2026-09-01 is
 * that a clamp *"does not make a bad number safe, it makes it invisible"*, and the statistics home
 * page honours it in its own words — the exclusion *"must be VISIBLE or the exclusion is as
 * invisible as the clamp it replaces"*. The hub renders `pullToArrival.incoherentCount` for exactly
 * this. The per-ward page — the surface a coordinator opens about a NAMED ward — had no counterpart,
 * so it was one ruling short of the hub while looking compliant.
 *
 * Returning the verdict rather than a value keeps ONE home for the decision. The alternative was a
 * second predicate re-testing `arrivedAt - pulledAt < 0` beside this one, which is the shape that
 * drifts — the same reason `openBedsNow` is called rather than recomputed on the screens.
 */
type EmptyBedGap =
  | { readonly kind: "measured"; readonly minutes: number }
  /** No pair to measure yet, or an unusable instant. Not a defect: a bed pulled and not yet arrived. */
  | { readonly kind: "not-measurable" }
  /** Both instants present, and the arrival is earlier than the pull. Cannot be true of anybody. */
  | { readonly kind: "incoherent" };

function emptyBedGap(admission: Admission): EmptyBedGap {
  const { pulledAt, arrivedAt } = admission;
  if (pulledAt === null || arrivedAt === null || !Number.isFinite(pulledAt) || !Number.isFinite(arrivedAt)) {
    return { kind: "not-measurable" };
  }
  const gap = arrivedAt - pulledAt;
  /*
   * ⚠️ **A NEGATIVE GAP IS AN INCOHERENT RECORD, NOT A ZERO-MINUTE WAIT.** This was
   * `Math.max(0, arrivedAt - pulledAt)`, which looks like defensive arithmetic and is not: it converts
   * "this record cannot be true" — the patient reached the ward before the bed was allocated to them —
   * into a perfectly plausible figure nobody would ever query.
   *
   * ⚠️ **AND IT IS NOT HYPOTHETICAL.** Nine seeded records were measured on 2026-09-01 where the
   * patient arrives before the referral was raised, by gaps from 1.03 to 115 days. **The clamp would
   * have published all nine as zero-minute waits**, and one impossible record halves a real average —
   * measured: 60 minutes became 30. The 115-day case is obviously broken and anybody would catch it;
   * the 1.03-day case looks like a timezone bug and would have gone straight through. **The dangerous
   * ones are those that look almost right.**
   *
   * `null` excludes it from the average rather than folding it in. Owner ruling, 2026-09-01: neither
   * this function nor the statistics screen clamps.
   */
  return gap < 0 ? { kind: "incoherent" } : { kind: "measured", minutes: gap };
}

/**
 * The six ward-level flow figures for one unit, derived entirely from `admissions`.
 *
 * `longStays` and `readyToLeaveCannot` are scoped to admissions still ON the ward
 * (`admissionsForUnit` — everything except `"departed"`), never to the full history. Both reasons are
 * about a DEPARTED admission specifically, not a general "recent data only" preference:
 *   - `blockReason` describes what is currently holding a bed up. Someone who has already left is
 *     no longer being held from leaving, whatever the record still says.
 *   - `stayBand` (reused from `ward-admissions.ts`, never re-banded here) measures from
 *     `arrivedAt` to the `now` it is given — it has no way to know an admission has since ended,
 *     so applying it to a departed admission would keep their stay "growing" after they left.
 *
 * `averageLengthOfStayDays`, `averageEmptyBedMinutes` and `dischargeDateOutcomes` are, by
 * contrast, computed over EVERY admission for this unit including departed ones — a completed
 * stay or a completed empty-bed gap is a historical fact regardless of what state the admission
 * is in now, and excluding departed admissions from those three would silently shrink the ward's
 * own history every time somebody left.
 */
export function wardStatistics(unitId: string, admissions: Admission[], now: Instant): WardStatistics {
  const forThisUnit = admissions.filter((admission) => admission.unitId === unitId);

  const stays = forThisUnit.map((admission) => lengthOfStay(admission, now));
  const stayMinutes = stays.flatMap((stay) => (stay.kind === "measured" ? [stay.minutes] : []));
  const lengthOfStayIncoherentCount = stays.filter((stay) => stay.kind === "incoherent").length;
  const averageStayMinutes = average(stayMinutes);
  const averageLengthOfStayDays = averageStayMinutes === null ? null : roundTo(averageStayMinutes / MINUTES_PER_DAY, 1);

  const emptyBedGaps = forThisUnit.map((admission) => emptyBedGap(admission));
  const emptyMinutes = emptyBedGaps.flatMap((gap) => (gap.kind === "measured" ? [gap.minutes] : []));
  // Counted from the SAME pass that built the array above, so the excluded records and the included
  // ones can never be computed over different populations.
  const emptyBedIncoherentCount = emptyBedGaps.filter((gap) => gap.kind === "incoherent").length;
  const averageEmptyBedMinutes = roundTo(average(emptyMinutes), 0);
  // The ends come from the SAME array the average is taken over, so the screen can never show a
  // range that belongs to a different population from the figure it sits beside. Rounded the same
  // way for the same reason: an unrounded end beside a rounded average would read as a spread.
  const emptyBedMinutesShortest = emptyMinutes.length === 0 ? null : roundTo(Math.min(...emptyMinutes), 0);
  const emptyBedMinutesLongest = emptyMinutes.length === 0 ? null : roundTo(Math.max(...emptyMinutes), 0);

  let met = 0;
  let missed = 0;
  let moved = 0;
  for (const admission of forThisUnit) {
    const expectedDischargeAt = admission.expectedDischargeAt;
    const hasExpectedDate = expectedDischargeAt !== null && Number.isFinite(expectedDischargeAt);

    if (admission.dischargeDateMoves > 0) moved += 1;

    if (!hasExpectedDate) continue;
    const leftAt = admission.leftAt;
    if (leftAt === null || !Number.isFinite(leftAt)) continue; // no outcome yet — not met, not missed

    if (leftAt <= expectedDischargeAt) met += 1;
    else missed += 1;
  }

  const liveAdmissions = admissionsForUnit(admissions, unitId);
  const readyToLeaveCannot = liveAdmissions.filter((admission) => admission.blockReason !== null).length;
  const longStays = liveAdmissions.filter((admission) => stayBand(admission, now)?.id === "over-3-months").length;

  return {
    unitId,
    averageLengthOfStayDays,
    lengthOfStayIncoherentCount,
    averageEmptyBedMinutes,
    emptyBedIncoherentCount,
    emptyBedMinutesShortest,
    emptyBedMinutesLongest,
    dischargeDateOutcomes: { met, missed, moved, consideredCount: met + missed },
    averageWaitlistWaitMinutes: null,
    readyToLeaveCannot,
    longStays,
  };
}

/**
 * `wardStatistics` for every unit given, paired with the unit itself, in the SAME order `units`
 * arrives in — never re-sorted or filtered. Mirrors `referralCandidates` (`ward-referrals.ts`)'s
 * own discipline on this: a caller controls unit order (typically `allUnits()` from
 * `ward-sites.ts`), and re-ordering here would read as a ranking this module explicitly refuses
 * to make.
 */
export function allWardStatistics(
  units: Unit[],
  admissions: Admission[],
  now: Instant,
): { unit: Unit; statistics: WardStatistics }[] {
  return units.map((unit) => ({ unit, statistics: wardStatistics(unit.id, admissions, now) }));
}
