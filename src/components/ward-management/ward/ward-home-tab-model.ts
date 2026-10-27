import type { DeclineReason, Movement, Unit } from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { stageCopy } from "@/components/ward-management/ward-derivations";

/*
 * The ward Home tab's plain helpers and types, moved out of `ward-home-tab.tsx` (H-0283, 27 Oct
 * 2026) unchanged. `ward-home-tab.tsx` re-exports the ones other files import from it.
 */

export const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull the bed",
  PATIENT_ARRIVED: "Confirm arrival",
};

export const OVERRIDE_SUBMIT_UNAVAILABLE_REASON =
  "Choose an override reason and confirm nurse unit manager consultation when needed.";
export const DECLINE_SUBMIT_UNAVAILABLE_REASON = "Choose a decline reason first.";

export function canSubmitOverride(
  overrideReason: string | undefined,
  isAcuityRefusal: boolean,
  numConsulted: boolean,
): boolean {
  return Boolean(overrideReason && (!isAcuityRefusal || numConsulted));
}

/** A recorded decline reason in the one list's wording (D-78); an unknown value shows as written. */
export function declineReasonText(reason: string): string {
  return (DECLINE_REASON_LABELS as Record<string, string>)[reason] ?? reason.replace(/_/g, " ");
}

export function canSubmitDecline(declineReason: DeclineReason | "" | undefined): declineReason is DeclineReason {
  return Boolean(declineReason);
}

export function referralAnswerBlocked(movement: Movement, unit: Unit, who?: string): string | undefined {
  if (movement.stage !== "destination_review") {
    return `${who ?? "This patient"} is ${stageCopy[movement.stage].label.toLowerCase()}, not awaiting a destination decision.`;
  }
  if (movement.acceptedUnitId) {
    return `${who ?? "This patient"} already has an accepted destination.`;
  }
  if (!movement.referredUnitIds.includes(unit.id)) {
    return `${unit.name} does not currently hold a live referral for ${who ?? "this patient"}.`;
  }
  return undefined;
}

export type WardFlowTab = "referrals" | "admissions" | "discharges";
export type WardShiftView = "todo" | "log" | "stay";

/**
 * How many items sit in This shift's Act now column, so the hero's Act now pill and the column
 * always agree: each live form alert, plus one each for referrals waiting, discharges held up and
 * an overdue morning rollup.
 */
export function wardActNowCount({
  alerts,
  incoming,
  heldUp,
  rollupOverdue,
  lapsedHolds = 0,
  absences = 0,
  stoppedHolds = 0,
}: {
  alerts: number;
  incoming: number;
  heldUp: number;
  rollupOverdue: boolean;
  /** Audit A1-3: pulled beds whose hold has lapsed (one Act now row for all of them). */
  lapsedHolds?: number;
  /** Audit A3-1: this ward's absences on an order (`absentOnOrder`), one Act now row each. */
  absences?: number;
  /** Stopped transports whose held bed on this ward has not yet been released. */
  stoppedHolds?: number;
}): number {
  return (
    absences +
    alerts +
    (incoming > 0 ? 1 : 0) +
    (heldUp > 0 ? 1 : 0) +
    (rollupOverdue ? 1 : 0) +
    (lapsedHolds > 0 ? 1 : 0) +
    (stoppedHolds > 0 ? 1 : 0)
  );
}
