import { admittedStayForArrival, type Admission } from "@/components/ward-management/ward-admissions";
import { isClockBreached, type Instant } from "@/components/ward-management/ward-clock";
import { currentLegalDueAt } from "@/components/ward-management/ward-legal-form-progression";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * Journeys whose person arrived on a form and is still in the bed (walk-through WT-03, Josh's yes
 * 26 Oct 2026). Arrival closes the journey, so these are not open movements, but the person stays
 * on a legal form and the ward records the next one from the paper.
 *
 * At the ward root (moved from `legal-forms/legal-forms-admitted.tsx`, 14 Nov 2026) so the ward
 * desk, the coordinator's alerts and the Forms page read the one list without importing each other.
 */
export function admittedOnAForm(movements: readonly Movement[], admissions: readonly Admission[]): Movement[] {
  return movements
    .filter((movement) => movement.legalForm !== undefined && admittedStayForArrival(movement, admissions))
    .sort((a, b) => (a.closure?.at ?? a.openedAt) - (b.closure?.at ?? b.openedAt));
}

/**
 * A PASSED TYPED EXPIRY FOR SOMEONE ALREADY ADMITTED ON A FORM (mechanics and clock audit M1;
 * D-MCA (Josh, 14 Nov 2026), ruling 2). The typed expiry still in force (`currentLegalDueAt`, so a
 * form a person recorded as ended raises nothing) has gone by while the person is in the bed. The
 * ward desk's Act now, the coordinator's alerts and the Forms page's counts all read this one list.
 * Passed means the clock is after the typed minute, as for an open journey (`isClockBreached`).
 */
export function admittedLegalExpiryPassed(
  movements: readonly Movement[],
  admissions: readonly Admission[],
  now: Instant,
): Movement[] {
  return admittedOnAForm(movements, admissions).filter((movement) => {
    const dueAt = currentLegalDueAt(movement);
    return dueAt !== undefined && isClockBreached(dueAt, now);
  });
}
