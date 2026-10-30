import type { CancelTransportReason } from "@/components/ward-management/ward-change-reasons";
import type { CommunityDeclineReason } from "@/components/ward-management/ward-model";

/**
 * THE COMMUNITY SCREEN'S BLOCKED-REASON RULES — why a confirm control on the community screen is
 * unavailable, computed from explicit inputs only (the draft answer the person has chosen so far).
 *
 * Moved out of `community-screen.tsx` unchanged (fix list 1.3, 15 Oct 2026) so the same rules can
 * run without React, and later on the server. The wording is the screen's own, word for word. The
 * transport-booking answers rule, shared with the ED screen, lives in `../ward-transport-checks.ts`.
 * Pinned by `tests/ward-ed-blocked-reasons.test.ts`.
 */

/** Shown while no community decline reason is chosen. See `communityDeclineBlockedReason`. */
export const COMMUNITY_DECLINE_REASON_UNCHOSEN =
  "Choose the reason this team cannot take this referral before declining it.";

/** Shown while no cancel-transport reason is chosen. See `cancelTransportBlockedReason`. */
export const CANCEL_TRANSPORT_UNCHOSEN = "Choose why the transport job is being cancelled first.";

/**
 * Why "Decline referral" is unavailable, or `undefined` once a reason is chosen — the same "state a
 * reason before declining" rule `referral-match.tsx`'s own ward and ED controls hold to. The control
 * stays `aria-disabled`, never native `disabled`, for exactly as long as this returns a reason.
 */
export function communityDeclineBlockedReason(reason: CommunityDeclineReason | undefined): string | undefined {
  return reason === undefined ? COMMUNITY_DECLINE_REASON_UNCHOSEN : undefined;
}

/**
 * Why "Confirm cancel" on a booked transport job is unavailable, or `undefined` once a reason is
 * chosen. The recorded cancellation needs the team's own reason; provider contact is made by phone.
 */
export function cancelTransportBlockedReason(reason: CancelTransportReason | undefined): string | undefined {
  return reason === undefined ? CANCEL_TRANSPORT_UNCHOSEN : undefined;
}
