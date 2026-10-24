import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral, ReferralContactEntry, ReferralOwnerEntry, Unit } from "@/components/ward-management/ward-model";
import { referralState } from "@/components/ward-management/ward-referrals";

import type { ReferralContactTarget, ReferralOwnerDesk } from "./referral-owner-and-calls";

/** Read-only selectors over a referral's owner history and call log (`referral-owner-and-calls.ts`). */

export function referralOwnerLabel(owner: ReferralOwnerDesk): string {
  return CHROME_ROLE_LABELS[owner];
}

/** The desk that has the referral now, or `undefined` when nobody has been assigned. */
export function currentReferralOwner(referral: Pick<Referral, "ownerHistory">): ReferralOwnerEntry | undefined {
  return referral.ownerHistory?.at(-1);
}

/** The latest call logged on the referral, or `undefined` when none has been. */
export function lastReferralContact(referral: Pick<Referral, "contactLog">): ReferralContactEntry | undefined {
  return referral.contactLog?.at(-1);
}

/**
 * Why a referral can no longer be assigned or have calls logged, or `undefined` while it is still
 * being worked: once a destination accepted, or once the referrer took every copy back.
 */
export function referralClosedForFollowUp(referral: Referral): string | undefined {
  if (referralState(referral) === "accepted") return "This referral has been accepted.";
  if (referral.destinations.length > 0 && referral.destinations.every((arm) => arm.withdrawnAt !== undefined))
    return "The referrer has withdrawn this referral.";
  return undefined;
}

/** "Ward 4B", "Armadale community team", "the referrer". */
export function referralContactTargetLabel(
  target: ReferralContactTarget,
  places: { units: readonly Pick<Unit, "id" | "name">[]; teamName: (teamId: string) => string | undefined },
): string {
  switch (target.kind) {
    case "psychiatric_ward":
      return places.units.find((unit) => unit.id === target.unitId)?.name ?? "Ward not recorded";
    case "community_team":
      return places.teamName(target.teamId) ?? "Team not recorded";
    case "referrer":
      return "the referrer";
  }
}

/** "5 min ago", "1h 40m ago", or "just now". */
export function minutesAgoLabel(at: Instant, now: Instant): string {
  const minutes = Math.max(0, Math.round(now - at));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m ago`;
}

/**
 * The queue row's short line: "Owner Bed coordinator · last call 40 min ago", either half alone,
 * or `undefined` when the referral has neither.
 */
export function referralFollowUpLine(referral: Referral, now: Instant): string | undefined {
  const owner = currentReferralOwner(referral);
  const call = lastReferralContact(referral);
  const parts = [
    owner ? `Owner ${referralOwnerLabel(owner.owner)}` : undefined,
    call ? `last call ${minutesAgoLabel(call.at, now)}` : undefined,
  ].filter((part): part is string => part !== undefined);
  if (parts.length === 0) return undefined;
  const line = parts.join(" · ");
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}`;
}
