import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardReferralInboxEntry } from "@/components/ward-management/referrals/referral-inbox";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import type { ResolvedPatientInfo, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { wardTransferNeedsCoordinator } from "@/components/ward-management/ward-referrals";
import type { WaitingReferral } from "./ward-bed-board";

/**
 * The Bed board's waiting list: the referrals waiting for this ward that it can place, straight from
 * the inbox, then (v10 pass 3) the people the coordinator referred here, placed with
 * ACCEPT_IN_PRINCIPLE. Split out of `ward-screen.tsx` to keep it under its line cap.
 */
export function boardWaitingReferrals({
  inboxEntries,
  movements,
  admissions,
  incoming,
  unitId,
  units,
  now,
  resolvePatientIdentity,
}: {
  inboxEntries: readonly WardReferralInboxEntry[];
  movements: readonly Movement[];
  admissions: readonly Admission[];
  incoming: readonly Movement[];
  unitId: string;
  units: readonly Unit[];
  now: Instant;
  resolvePatientIdentity: (subject: Parameters<typeof resolveSubjectPatient>[0]) => ResolvedPatientInfo;
}): WaitingReferral[] {
  return [
    ...inboxEntries
      .filter(
        (entry) =>
          (entry.state === "queued" || entry.state === "accepted") &&
          entry.withdrawnAt === undefined &&
          !movements.some((movement) => movement.referralId === entry.id) &&
          !admissions.some(
            (admission) =>
              admission.referralId === entry.id &&
              (admission.state === "pulled" || admission.state === "occupied" || admission.state === "departed"),
          ),
      )
      .map((entry) => ({
        id: entry.id,
        accepted: entry.state === "accepted",
        name: resolvePatientIdentity(entry).formalName,
        umrn: resolvePatientIdentity(entry).umrn,
        sex: entry.destination.sex === "Female" ? "F" : entry.destination.sex === "Male" ? "M" : entry.destination.sex,
        waitedMinutes: Math.max(0, now - entry.raisedAt),
        secureBedNeeded: entry.destination.secureBedNeeded === true,
        blockedReason:
          entry.state === "queued" && wardTransferNeedsCoordinator(entry, unitId, units)
            ? "Coordinator accepts transfers from another hospital"
            : undefined,
      })),
    ...incoming.map((movement) => ({
      kind: "movement" as const,
      id: movement.id,
      name: resolvePatientIdentity(movement).formalName,
      umrn: resolvePatientIdentity(movement).umrn,
      sex: movement.sex === "Female" ? "F" : movement.sex === "Male" ? "M" : "Not recorded",
      waitedMinutes: Math.max(0, now - (movement.referredAt ?? movement.openedAt)),
      secureBedNeeded: movement.security === "Secure",
    })),
  ];
}
