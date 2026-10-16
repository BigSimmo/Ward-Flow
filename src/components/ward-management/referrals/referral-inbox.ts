import type { Referral, ReferralAddressing, WardReferralDestination } from "../ward-model";
import type { ReferralIntakeDetails } from "./referral-submission";

/** One recipient's own answer and submitted dossier. No other recipients or overall outcome. */
export type WardReferralInboxEntry = {
  id: string;
  patientId: Referral["patientId"];
  raisedAt: number;
  urgency: Referral["urgency"];
  history: string;
  intake?: ReferralIntakeDetails;
  state: ReferralAddressing["state"];
  withdrawnAt?: number;
  waitlistedAt?: number;
  destination: WardReferralDestination;
  declineReason?: ReferralAddressing["declineReason"];
  /** The bed this ward placed the referral in on its Bed board (`ACCEPT_REFERRAL.bedNumber`). */
  heldBedNumber?: number;
  source: Referral["source"];
  originUnitId?: Referral["originUnitId"];
};

/**
 * A referral sent with no person on file opens its history with "Not yet identified, <description>"
 * (the referral drawer writes it). The inbox heading reads that line instead of "Name not recorded".
 */
export const UNIDENTIFIED_REFERRAL_PREFIX = "Not yet identified, ";

/** The inbox heading's name: the referrer's description for an unidentified referral, else the resolved name. */
export function referralInboxName(entry: Pick<WardReferralInboxEntry, "patientId" | "history">, resolvedName: string) {
  if (entry.patientId !== undefined) return resolvedName;
  const firstLine = entry.history.split("\n", 1)[0]?.trim() ?? "";
  return firstLine.startsWith(UNIDENTIFIED_REFERRAL_PREFIX) && firstLine.length > UNIDENTIFIED_REFERRAL_PREFIX.length
    ? firstLine
    : resolvedName;
}

export function wardReferralInboxEntries(referrals: readonly Referral[], unitId: string): WardReferralInboxEntry[] {
  return referrals.flatMap((referral) => {
    const arm = referral.destinations.find(
      (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.destination.unitId === unitId,
    );
    if (!arm || arm.destination.kind !== "psychiatric_ward") return [];
    return [
      {
        id: referral.id,
        patientId: referral.patientId,
        raisedAt: referral.raisedAt,
        urgency: referral.urgency,
        history: referral.history,
        intake: referral.intake,
        state: arm.state,
        withdrawnAt: arm.withdrawnAt,
        waitlistedAt: arm.waitlistedAt,
        declineReason: arm.declineReason,
        ...(arm.heldBedNumber === undefined ? {} : { heldBedNumber: arm.heldBedNumber }),
        source: referral.source,
        originUnitId: referral.originUnitId,
        destination: {
          kind: "psychiatric_ward",
          unitId,
          sex: arm.destination.sex,
          gender: arm.destination.gender,
          secureBedNeeded: arm.destination.secureBedNeeded,
          involuntaryBedNeeded: arm.destination.involuntaryBedNeeded,
          highAcuityNursingNeeded: arm.destination.highAcuityNursingNeeded,
        },
      },
    ];
  });
}
