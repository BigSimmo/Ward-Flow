/**
 * RESPONSE COMMITMENTS ON A WARD'S COPY OF A REFERRAL (closing-the-loop features, Josh "go ahead
 * and build", 24 Oct 2026).
 *
 * What a ward has agreed to do about a referral that is waiting on its answer, as a closed set of
 * steps: the coordinator asked for a response, the ward acknowledged it (saw it AND agreed to
 * respond, which is not the "opened" receipt), the ward promised an answer by a time, and the
 * commitment was resolved. Beside the steps, a "next callback" time tells the coordinator when to
 * ring again. Every value is chosen or a time, never typed, so nothing here stops device saving
 * (D-18). Who recorded each entry is a role label and when is an instant, the same provenance the
 * call log uses.
 *
 * Nothing here answers the referral, ranks it or acts by itself. "Promise overdue" is read from the
 * recorded promised time alone. The ward's answer is still `ACCEPT_REFERRAL` or `DECLINE_REFERRAL`.
 *
 * This file holds only the closed lists and their types, with one type-only import, so
 * `ward-model.ts` can name them. The selectors are in `referral-commitments-model.ts`.
 */
import type { Instant } from "@/components/ward-management/ward-clock";

/** The steps, in order. A later step may follow an earlier one; never the other way. */
export const REFERRAL_COMMITMENT_STEPS = [
  { id: "response_requested", label: "Response requested" },
  { id: "acknowledged", label: "Acknowledged" },
  { id: "promised", label: "Promised" },
  { id: "resolved", label: "Resolved" },
] as const;
export type ReferralCommitmentStep = (typeof REFERRAL_COMMITMENT_STEPS)[number]["id"];

/** Runtime id list for the reducer's membership check, in step order. */
export const REFERRAL_COMMITMENT_STEP_IDS: readonly ReferralCommitmentStep[] = REFERRAL_COMMITMENT_STEPS.map(
  (entry) => entry.id,
);

/** The steps a ward may record for itself. The coordinator records any step. */
export const WARD_COMMITMENT_STEPS: readonly ReferralCommitmentStep[] = ["acknowledged", "promised"];

export function referralCommitmentStepLabel(step: ReferralCommitmentStep): string {
  return REFERRAL_COMMITMENT_STEPS.find((entry) => entry.id === step)?.label ?? "Not recorded";
}

/**
 * The times a person can choose for a promise or a callback, as minutes from now. Offered as a
 * list, so a time is always a person's choice and never worked out for them.
 */
export const REFERRAL_COMMITMENT_TIME_CHOICES = [
  { minutes: 30, label: "In 30 min" },
  { minutes: 60, label: "In 1 hour" },
  { minutes: 120, label: "In 2 hours" },
  { minutes: 240, label: "In 4 hours" },
  { minutes: 480, label: "In 8 hours" },
] as const;

/**
 * One recorded commitment entry, kept on `ReferralAddressing.commitments`. `step` is the step
 * reached, if this entry moved it; `promisedFor` is the time the ward promised an answer by (only
 * with `promised`); `nextCallbackAt` is when the coordinator means to ring again. `by` is a ROLE
 * label, never a person; `unitId` is the ward the entry is about, because a copy naming no ward is
 * open to every ward. Nothing typed. Both times are re-anchored (`ward-reanchor.ts`).
 */
export type ReferralCommitmentEntry = {
  unitId: string;
  step?: ReferralCommitmentStep;
  promisedFor?: Instant;
  nextCallbackAt?: Instant;
  at: Instant;
  by: string;
};
