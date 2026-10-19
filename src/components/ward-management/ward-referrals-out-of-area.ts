// The out-of-area ledger (Phase 8, spec D8-3): who is in a bed far from home, read from admissions.
// Moved out of `ward-referrals.ts` unchanged; that file re-exports it.
import { bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import { OUT_OF_AREA_BANDS, travelBand, type TravelBand } from "@/components/ward-management/ward-distance";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * One person currently in a bed the fixture records as out of area, and how long since they got
 * there. Carries the `Admission` and the `Unit` themselves rather than copies of fields off them,
 * so nothing here becomes a second place a band or a time is spelled.
 *
 * `band` is narrowed to `TravelBand` and only ever holds a member of `OUT_OF_AREA_BANDS` — an
 * unrecorded band can never reach this type, which makes "every entry is genuinely out of area" a
 * fact about the type rather than a claim about the code.
 */
export type OutOfAreaEntry = {
  admission: Admission;
  unit: Unit;
  band: TravelBand;
  /** Minutes since the admission's `arrivedAt`, computed exactly as `referralWaitLabel` above
   *  computes a wait — never clamped here, so a fixture authored with an arrival in the future
   *  reads as the oddity it is rather than silently as zero. `formatElapsed` clamps at the point
   *  of display. */
  sinceArrival: number;
};

/**
 * Phase 8 (spec D8-3): how many people are currently in a bed a long way from where they live, and
 * how many of those beds could not be classified at all. Two counts of two different things.
 *
 * **It reads `Admission`, and that is the whole of Task 2R.** An earlier version read an
 * `arrivedAt` stamp added to `Referral`, and it had NO EXIT: a referral never stops being
 * accepted, so somebody discharged weeks ago stayed on this ledger forever with their elapsed
 * time still climbing. `Admission` (`ward-admissions.ts`) is the one record of a person occupying
 * a bed and it closes — `state: "departed"` and `leftAt` — which is why the referral field and its
 * `REFERRAL_ARRIVED` event were removed rather than kept alongside. One fact, one record.
 *
 * **The two numbers do not share a denominator.** `entries.length` counts people out of area;
 * `notBanded` counts admissions the fixture records no band for. Neither is a part of the other and
 * neither is a part of any whole — this returns exactly those two keys and no total, precisely so
 * that no screen can read a proportion out of it. A ratio of the two would be a figure this phase
 * has not been asked to author and that nobody has checked.
 *
 * **`notBanded` will normally be the far larger number, and that is the honest output of this
 * rule rather than a defect.** `SYNTHETIC_TRAVEL_BANDS` records only some home regions, and only
 * some sites within those, so most beds cannot be classified at all — measured against the
 * admission seed as it stood on 2026-08-29, the unclassified count outnumbered the out-of-area
 * count by roughly twelve to one. At that ratio ANY construction implying the second number is a
 * shortfall, a remainder or an incompleteness of the first would be actively misleading, which is
 * why the guard here is structural rather than advisory: this function returns two keys, no total,
 * no percentage and no denominator, and `tests/ward-travel-grouping.test.ts` asserts that key set
 * exactly. Two facts, side by side, neither one a part of the other.
 *
 * What each case does, and why:
 *
 *  - **Not holding a bed** → in neither number, whatever their band and however long they were
 *    there. SOMEBODY WHO HAS LEFT IS NOT IN A BED FAR FROM HOME. This is the first check in the
 *    loop and it is deliberately its own condition rather than folded into the arrival test: a
 *    departed admission still carries the `arrivedAt` it arrived on, so nothing else in this
 *    function would exclude it.
 *
 *    **It is an ALLOWLIST — `bedIsOccupied`, the record's own predicate — and never a
 *    `state !== "departed"` denylist.** Two reasons, and the second is the one that matters. First, a
 *    waitlisted admission carrying an arrival time is incoherent data, and a denylist counts it as
 *    somebody in a bed far from home. Second, and structurally: a fifth `AdmissionState` added
 *    later falls through a denylist as OCCUPIED BY DEFAULT. This ledger is read as fact by a
 *    coordinator, so an unrecognised state must be excluded rather than counted — the failure
 *    direction has to be conservative, and only an allowlist makes it so. Reusing the record's own
 *    predicate rather than restating the states here also means a state added to
 *    `ward-admissions.ts` is classified in ONE place. `tests/ward-travel-grouping.test.ts` pins
 *    both the departure and the waitlisted-with-an-arrival case directly.
 *  - **Arrived, still here, band is a member of `OUT_OF_AREA_BANDS`** → an entry. The clock runs
 *    from `arrivedAt`, NEVER from `pulledAt`: the bed has been gone since the pull, but this
 *    ledger measures how long somebody has been AWAY FROM HOME, which starts when they get there.
 *    Reading `pulledAt` would overstate every entry by the transport delay, in the same direction
 *    every time. The pull-to-arrival gap is a real and separate figure; nothing here surfaces it.
 *  - **Arrived, still here, band not recorded** → `notBanded`, never an entry. An unknown band must
 *    never become a figure, and a count that quietly excluded what it could not classify would be
 *    quoted as complete. The gap is reported as a gap — the same rule `travelBand` itself follows
 *    in returning `undefined` rather than falling back to a band.
 *  - **Arrived, still here, band recorded and in area** → in neither number. Present and correctly
 *    classified; there is nothing to report.
 *  - **Holding a bed but not yet arrived** → in neither number, and NOT reported as missing
 *    anything. A pulled bed is one given away to somebody still on their way, so as far as this
 *    prototype knows nobody is in it yet, and saying more would invent the arrival. A non-finite
 *    `arrivedAt` is treated the same way rather than yielding a `NaN` elapsed time. (A waitlisted
 *    admission never reaches this check — it holds no bed, so the allowlist above excludes it
 *    whether or not it carries an arrival.)
 *  - **`unitId` resolves to no unit** → skipped entirely, never banded against a guessed site. It
 *    is not counted as unbanded either: nothing was looked up, so nothing failed to be found.
 *
 * Order is the order `admissions` arrived in, and there is no comparator here at all. This is a
 * ledger of people, not a queue, and nothing about it ranks, prioritises or shortlists anyone.
 *
 * `units` is a parameter rather than a call to `allUnits()` so this derivation stays pure over its
 * inputs and testable against a fixture — the same reason `referralCandidates` above takes one.
 *
 * The band is looked up through `ward-distance.ts` from the admission's own `homeRegion` and the
 * accepting unit's site, exactly as `unitTravelBand` does it for a referral. No band is stored on
 * an `Admission`, and none is stored here.
 */
export function outOfAreaLedger(
  admissions: Admission[],
  units: Unit[],
  now: Instant,
): { entries: OutOfAreaEntry[]; notBanded: number } {
  const entries: OutOfAreaEntry[] = [];
  let notBanded = 0;

  for (const admission of admissions) {
    // The exit the referral-based version did not have, and an ALLOWLIST rather than a denylist.
    // Read this file's own comment above before moving, weakening or merging this line into the
    // arrival check below.
    if (!bedIsOccupied(admission)) continue;
    const arrivedAt = admission.arrivedAt;
    if (arrivedAt === null || !Number.isFinite(arrivedAt)) continue;

    const unit = units.find((candidate) => candidate.id === admission.unitId);
    if (!unit) continue;

    // Task 17, 2026-08-30: an arrival through the emergency-department pathway records no home
    // region yet, and a distance from an unknown home is not a distance. It counts as not banded,
    // which is the same honest bucket an unknown region has always fallen into - the figure is
    // reported rather than the person being dropped from the tally.
    if (admission.homeRegion === null) {
      notBanded += 1;
      continue;
    }

    const band = travelBand(admission.homeRegion, unit.siteCode);
    if (band === undefined) {
      notBanded += 1;
      continue;
    }
    if (!OUT_OF_AREA_BANDS.includes(band)) continue;

    entries.push({ admission, unit, band, sinceArrival: minutesUntil(now, arrivedAt) });
  }

  return { entries, notBanded };
}
