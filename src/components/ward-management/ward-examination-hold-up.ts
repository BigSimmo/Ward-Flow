/**
 * F-15, D-170 item 3 (Josh, 13 Nov 2026): what holds a movement up when an examination ends it while
 * transport is committed or a bed is still pulled (WLQ-4). An examination has an outcome; it is never
 * "revoked". A no-order outcome uses the ruled words "made no order"; a community treatment order is
 * an order, so it keeps its own name, as `examinationBedHeldNotice` (`ward-derivations.ts`) does.
 *
 * A leaf module, so the reducer's blocker list and the event slices it passes helpers to can all read
 * it without a runtime import cycle.
 */
export const EXAMINATION_NO_ORDER_AWAITING_RELEASE =
  "Awaiting a coordinator to release the bed, because the examination made no order";

export const EXAMINATION_COMMUNITY_ORDER_AWAITING_RELEASE =
  "Awaiting a coordinator to release the bed, because the examination made a community treatment order";

/**
 * The sentence this hold-up carried before D-170. A record saved before the change can still hold it,
 * so it is recognised as the same hold-up (and the bed stays held), but nothing writes it any more.
 */
const SAVED_BEFORE_D170 = "Awaiting a coordinator to release the bed, because the examination was revoked";

/** True when the hold-up is this examination hold-up, in either outcome's words or the saved old words. */
export function isExaminationAwaitingReleaseBlocker(blocker: string | undefined): boolean {
  return (
    blocker === EXAMINATION_NO_ORDER_AWAITING_RELEASE ||
    blocker === EXAMINATION_COMMUNITY_ORDER_AWAITING_RELEASE ||
    blocker === SAVED_BEFORE_D170
  );
}
