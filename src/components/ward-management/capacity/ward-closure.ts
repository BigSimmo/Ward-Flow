import type { Instant } from "../ward-clock";
import type { Movement, Referral, Unit } from "../ward-model";

/**
 * WARD CLOSURE MODE (smart features idea 7, 19 Oct 2026). One action closes a whole ward to new
 * admissions with a reason from this list and, optionally, an expected reopening time. Closing sets
 * the existing `Unit.isClosed`, which the shortlist, Home fit, bed finder, make room and the pull
 * already honour (owner decision, 17 Oct 2026). Reopening always needs a person: the expected time
 * only prompts.
 *
 * The reasons are chosen, never typed, so nothing a person writes is stored with a closure.
 */
export const WARD_CLOSURE_REASONS = [
  { id: "infection_outbreak", label: "Infection outbreak" },
  { id: "staffing", label: "Staffing" },
  { id: "building_or_maintenance", label: "Building or maintenance" },
  { id: "other_operational", label: "Other operational reason" },
] as const;

export type WardClosureReason = (typeof WARD_CLOSURE_REASONS)[number]["id"];

export const WARD_CLOSURE_REASON_IDS: readonly string[] = WARD_CLOSURE_REASONS.map((reason) => reason.id);

/** Expected reopening choices, in hours from now. "Not known" is the absence of one. */
export const WARD_REOPEN_AFTER_HOURS = [4, 8, 12, 24, 48] as const;

export function wardClosureReasonLabel(reason: WardClosureReason): string {
  return WARD_CLOSURE_REASONS.find((entry) => entry.id === reason)?.label ?? reason;
}

/** "Closed to admissions · Staffing" for a closed ward, for handover and the TV; `null` when open. */
export function wardClosedLine(unit: Unit): string | null {
  if (!unit.isClosed) return null;
  return unit.admissionsClosure
    ? `Closed to admissions · ${wardClosureReasonLabel(unit.admissionsClosure.reason)}`
    : "Closed to admissions";
}

/** The expected reopening time has come. A prompt for a person, never a reopening. */
export function wardReopeningDue(unit: Unit, now: Instant): boolean {
  const until = unit.admissionsClosure?.until;
  return unit.isClosed === true && until !== undefined && now >= until;
}

/** One request still pointed at a closed ward, so the coordinator can redirect it. */
export type WaitingOnClosedWard =
  { kind: "bed_request"; id: string; status: "asked" | "accepted" | "bed_held" } | { kind: "referral"; id: string };

/**
 * Open bed requests that asked this ward or were accepted by it, and front-door referrals whose copy
 * for this ward still waits on its answer. Closing the ward changes none of them: existing holds and
 * acceptances stand until a person moves them.
 */
export function pointedAtWard(
  unitId: string,
  movements: readonly Movement[],
  referrals: readonly Referral[],
): WaitingOnClosedWard[] {
  const requests = movements
    // `isOpen` (ward-derivations.ts), inlined: the reducer reads this file and must not load the derivations.
    .filter((movement) => !movement.closure && movement.stage !== "arrived")
    .filter((movement) => movement.acceptedUnitId === unitId || movement.referredUnitIds.includes(unitId))
    .map((movement): WaitingOnClosedWard => ({
      kind: "bed_request",
      id: movement.id,
      status: movement.acceptedUnitId !== unitId ? "asked" : movement.stage === "pulled" ? "bed_held" : "accepted",
    }));
  const waitingReferrals = referrals
    .filter((referral) =>
      referral.destinations.some(
        (addressing) =>
          addressing.destination.kind === "psychiatric_ward" &&
          addressing.destination.unitId === unitId &&
          addressing.state === "queued" &&
          addressing.withdrawnAt === undefined,
      ),
    )
    .map((referral): WaitingOnClosedWard => ({ kind: "referral", id: referral.id }));
  return [...requests, ...waitingReferrals];
}
