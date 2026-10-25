import { movementNextStep } from "./movements/movement-next-step";
import type { Movement, Referral, ReferralState } from "./ward-model";
import type { SenderMovementPartialView, SenderReferralPartialView } from "./ward-partial-view-contract";
import {
  RECENTLY_DECIDED_DISPLAY_LIMIT,
  decidedReferrals,
  referralDecidedAt,
  referralQueueOrder,
  referralState,
  referralWithdrawable,
  referralWithdrawn,
} from "./ward-referrals";

/** Undefined preserves the existing record presentation. Null means that this sender requires
 * a summary but its current bound response is unavailable. Neither case invents domain arms. */
export type SenderReferralPresentation = SenderReferralPartialView | null | undefined;

export type ReferralPresentation =
  | { readonly kind: "unavailable" }
  | {
      readonly kind: "record" | "sender";
      readonly state: ReferralState;
      readonly withdrawn: boolean;
      readonly decidedAt: number | null;
      /** Display hint only. Existing role gates and full-source command checks still apply. */
      readonly canWithdraw: boolean;
    };

export function referralPresentation(
  referral: Referral,
  summary: SenderReferralPresentation,
  movements?: readonly Movement[],
): ReferralPresentation {
  if (summary === null || (summary !== undefined && summary.id !== referral.id)) return { kind: "unavailable" };
  if (summary !== undefined)
    return {
      kind: "sender",
      state: summary.state,
      withdrawn: summary.withdrawn,
      decidedAt: summary.decidedAt,
      canWithdraw: summary.canWithdraw,
    };
  return {
    kind: "record",
    state: referralState(referral),
    withdrawn: referralWithdrawn(referral),
    decidedAt: referralDecidedAt(referral) ?? null,
    canWithdraw: referralWithdrawable(referral, movements ? [...movements] : undefined),
  };
}

/** Presentation collections, never inputs to a reducer or permission decision. Unavailable
 * records remain explicit rather than being classified as queued or decided from empty arms. */
export function referralPresentationLists(
  referrals: readonly Referral[],
  summaryFor: (referral: Referral) => SenderReferralPresentation,
) {
  const entries = referrals.map((referral) => ({
    referral,
    presentation: referralPresentation(referral, summaryFor(referral)),
  }));
  const ordinary = entries.filter(({ presentation }) => presentation.kind === "record").map(({ referral }) => referral);
  const ordinaryQueue = new Set(referralQueueOrder(ordinary).map(({ id }) => id));
  const ordinaryDecided = new Set(decidedReferrals(ordinary).map(({ id }) => id));
  const queued = entries
    .filter(({ referral, presentation }) =>
      presentation.kind === "sender"
        ? presentation.state === "queued" && !presentation.withdrawn
        : presentation.kind === "record" && ordinaryQueue.has(referral.id),
    )
    .map(({ referral }) => referral)
    // D-32's existing queue order: longest wait first, urgency only breaks equal-time ties.
    .sort((a, b) => a.raisedAt - b.raisedAt || a.urgency - b.urgency);
  const decidedEntries = entries.filter(({ referral, presentation }) =>
    presentation.kind === "sender"
      ? presentation.state !== "queued" || presentation.withdrawn
      : presentation.kind === "record" && ordinaryDecided.has(referral.id),
  );
  const recentlyDecided = [...decidedEntries]
    .sort(
      (a, b) =>
        (b.presentation.kind === "unavailable" ? -Infinity : (b.presentation.decidedAt ?? -Infinity)) -
        (a.presentation.kind === "unavailable" ? -Infinity : (a.presentation.decidedAt ?? -Infinity)),
    )
    .slice(0, RECENTLY_DECIDED_DISPLAY_LIMIT)
    .map(({ referral }) => referral);
  return {
    queued,
    decided: decidedEntries.map(({ referral }) => referral),
    recentlyDecided,
    unavailable: entries
      .filter(({ presentation }) => presentation.kind === "unavailable")
      .map(({ referral }) => referral),
  };
}

export function movementPresentation(
  movement: Movement,
  summary: SenderMovementPartialView | null | undefined,
):
  | { readonly kind: "unavailable" }
  | { readonly kind: "record"; readonly nextStep: SenderMovementPartialView["nextStep"] }
  | {
      readonly kind: "sender";
      readonly progress: SenderMovementPartialView["progress"];
      readonly nextStep: SenderMovementPartialView["nextStep"];
    } {
  if (summary === null || (summary !== undefined && summary.id !== movement.id)) return { kind: "unavailable" };
  if (summary !== undefined) return { kind: "sender", progress: summary.progress, nextStep: summary.nextStep };
  return { kind: "record", nextStep: movementNextStep(movement)?.kind ?? "none" };
}
