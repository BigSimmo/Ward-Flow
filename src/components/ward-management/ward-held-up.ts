import { heldUpDueByTomorrow, isHeldUpDueByTomorrow } from "@/components/ward-management/ward-bed-availability";

/**
 * One meaning of "held up" (Josh, 13 Nov 2026, D-191 item 5; F-105, A14-11): an open bed release
 * with a recorded blocker, due by tomorrow. "Due by tomorrow" takes in an overdue date, today and
 * tomorrow, the same span as `capacityBreakdown().blockedToday`, the TV, the bed meeting sheet and
 * the menu's Discharges line. Capacity, Ward, TV, the sheet and Home all count held up this way.
 * Discharges keeps its own "any date" group, and says so. The rule lives beside `releaseBand` in
 * `ward-bed-availability.ts`, so `capacityBreakdownLists` uses it without an import cycle; this
 * module is its home for every screen, with the words.
 */
export { heldUpDueByTomorrow, isHeldUpDueByTomorrow };

/** The window words for held up (D-191 item 5: "by tomorrow" joins the window words). */
export const HELD_UP_WINDOW = "by tomorrow";

/** A heading or short label: "Held up · by tomorrow", in the "Arrivals · today" pattern. */
export const HELD_UP_BY_TOMORROW_LABEL = `Held up · ${HELD_UP_WINDOW}`;

/** Discharges' own group of every held-up release, whatever its date (D-191 item 5). */
export const HELD_UP_ANY_DATE_LABEL = "Held up · any date";

/**
 * The window word for a count of every open item at any date (F-105): Ward flow's Referrals,
 * Admissions and Discharges. The count is unchanged; the word says it is not a today figure. The
 * Capacity ward panel's Discharges tab says "any date" instead (D-191 item 5).
 */
export const OPEN_WINDOW = "open";
