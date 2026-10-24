import type { Movement, Referral } from "@/components/ward-management/ward-model";

/**
 * A route desk sends only its own kind of referral, so a ward never acts as sender on one it is
 * answering (role access plan v2, D-80). Pure and type-only, so the reducer can ask it too.
 */
export function routeSentKind(routeRole: string, source: Referral["source"]): boolean {
  if (routeRole === "ward") return source === "psychiatric_ward";
  if (routeRole === "ed") return source === "ed_medical";
  if (routeRole === "community") return source !== "psychiatric_ward" && source !== "ed_medical";
  return true;
}

/**
 * The reducer's half of the sender rule for a journey (D-80). A ward or team changes a journey's
 * urgency, legal status or form receipt, and a team readies its handover, only on a journey its
 * kind of desk sent. The reducer holds no scope, so which ward or team is the server's check
 * (`journeySentByDesk`). Every other role passes here.
 */
export function journeySentByKind(
  referrals: readonly Pick<Referral, "id" | "source">[],
  movement: Pick<Movement, "referralId" | "sourceAdmissionId">,
  role: string,
): boolean {
  if (role !== "ward" && role !== "community") return true;
  // A journey leaving a stay was sent by its ward, whoever referred the stay (a repatriation).
  if (movement.sourceAdmissionId !== undefined) return role === "ward";
  const referral = movement.referralId
    ? referrals.find((candidate) => candidate.id === movement.referralId)
    : undefined;
  return referral !== undefined && routeSentKind(role, referral.source);
}
