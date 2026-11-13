import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";

/*
 * A leaf module on purpose: `ward-board-time-features.ts` reads this rule, and importing it from
 * `ward-shared-figures.ts` (which reads the ED and reducer modules) made a runtime import cycle
 * (`architecture-boundaries.test.ts`). `ward-shared-figures.ts` re-exports it, so it stays listed
 * with the other shared figures.
 */

/**
 * BEDS EXPECTED TO FREE (A16-05, Audit 16, 13 Nov 2026): a bed release still to happen whose expected
 * time falls from `now` up to and including `until`. A release whose time has already passed is left
 * out: it is not about to free a bed, it is overdue, and Discharges counts it as "dates overdue"
 * (`expectedAt < now`). A discharged release is left out because its bed already counts as Ready.
 *
 * The one rule behind All wards' and the ward page's "ready by <shift end>", Capacity's and the
 * meeting sheet's "Beds freeing today", and the ward bed filter, so a past date is never added to
 * ready beds on one screen and left out on another ("65 ready by 15:00" was 25 ready plus 40 past
 * dates).
 */
export function isExpectedToFree(release: BedRelease, now: Instant, until: Instant): boolean {
  return release.state !== "discharged" && release.expectedAt >= now && release.expectedAt <= until;
}

/** `isExpectedToFree` over a list, optionally narrowed to some wards. */
export function releasesExpectedToFree(
  releases: readonly BedRelease[],
  now: Instant,
  until: Instant,
  unitIds?: ReadonlySet<string>,
): BedRelease[] {
  return releases.filter(
    (release) => isExpectedToFree(release, now, until) && (unitIds === undefined || unitIds.has(release.unitId)),
  );
}

/** Freeing later today: `isExpectedToFree` up to the end of today's demonstration day (`dayOf`). */
export function isFreeingToday(release: BedRelease, now: Instant): boolean {
  return isExpectedToFree(release, now, Number.POSITIVE_INFINITY) && dayOf(release.expectedAt) === dayOf(now);
}
