import type { Instant } from "./ward-clock";
import type { Movement } from "./ward-model";

/**
 * WARD WAIT LIST AND PSYCHIATRY REVIEW DEMO (Josh, 9 Nov 2026): synthetic marks, so the ward's
 * Wait list and the ED "Awaiting review" stages show in the standard demo. Every figure here is
 * invented for the demonstration. Records missing from the seed, or no longer in the shape these
 * marks need, are left alone, so a changed fixture never breaks the seed.
 *
 * - WF-017 and WF-022, already asked of another adult ward, are each on Royal Perth Adult Secure's
 *   wait list. The live referral, the answer history and the wait-list mark are added, not a
 *   `declines` entry, so the seeded decline figures the statistics tests pin stay as they were.
 *   D-229 (stress test D1a-E-1): the live referral is added too, as the reducer's waitlist answer
 *   keeps it, so the ED board and person page show the wait list the ward shows.
 * - At Peel ED, WF-020's registrar has seen the person and WF-319's review is asked for.
 */
const WAITLIST_UNIT_ID = "rph-adult-secure";
const WAITLIST_MOVEMENT_IDS = ["WF-017", "WF-022"] as const;
const REGISTRAR_SEEN_ID = "WF-020";
const REVIEW_ASKED_ID = "WF-319";

export function applyWaitlistDemoOverlay<T extends { movements: Movement[] }>(state: T, now: Instant): T {
  const movements = state.movements.map((movement): Movement => {
    if (movement.closure || movement.acceptedUnitId !== undefined) return movement;
    if (
      (WAITLIST_MOVEMENT_IDS as readonly string[]).includes(movement.id) &&
      movement.stage === "destination_review" &&
      movement.cohort === "Adult" &&
      movement.referredUnitIds.length > 0 &&
      !movement.referredUnitIds.includes(WAITLIST_UNIT_ID) &&
      !(movement.waitlistedUnitIds ?? []).includes(WAITLIST_UNIT_ID)
    ) {
      const at = Math.min(now - 30, movement.openedAt + 90);
      return {
        ...movement,
        referredUnitIds: [...movement.referredUnitIds, WAITLIST_UNIT_ID],
        waitlistedUnitIds: [...(movement.waitlistedUnitIds ?? []), WAITLIST_UNIT_ID],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          { unitId: WAITLIST_UNIT_ID, at, answer: "waitlisted" },
        ],
      };
    }
    if (movement.examination || movement.psychReview) return movement;
    if (movement.id === REGISTRAR_SEEN_ID && movement.openedAt < now - 150)
      return { ...movement, psychReview: { requestedAt: now - 150, registrarSeenAt: now - 55 } };
    if (movement.id === REVIEW_ASKED_ID && movement.openedAt < now - 35)
      return { ...movement, psychReview: { requestedAt: now - 35 } };
    return movement;
  });
  return { ...state, movements };
}
