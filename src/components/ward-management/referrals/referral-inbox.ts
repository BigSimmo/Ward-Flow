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
  source: Referral["source"];
  originUnitId?: Referral["originUnitId"];
};

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
