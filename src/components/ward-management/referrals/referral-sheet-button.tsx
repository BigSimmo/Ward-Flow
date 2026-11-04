"use client";

// RQ9 (Josh, 3 Nov 2026): the Referral button for any patient panel. Opens the Referral sheet for
// the person's latest referral (or the referral named), and is not drawn when there is none.

import { FileText } from "lucide-react";

import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { Button, type ButtonSize } from "@/components/wf";

import { openReferralRecord, type ReferralSheetTab } from "./referral-sheet-bus";
import { latestReferralForPerson } from "./referral-sheet-latest";

export function ReferralRecordButton({
  personId,
  referralId,
  tab,
  variant = "ghost",
  size = "sm",
  className,
}: {
  /** A `Patient.id`: opens that person's latest referral. */
  personId?: string;
  /** A referral id: opens that referral. Wins over `personId`. */
  referralId?: string;
  tab?: ReferralSheetTab;
  variant?: "ghost" | "sec";
  size?: ButtonSize;
  className?: string;
}) {
  const { referrals } = useWardFlowSelect("referrals");
  const referral = referralId
    ? referrals.find((candidate) => candidate.id === referralId)
    : latestReferralForPerson(personId, referrals);
  if (!referral) return null;
  return (
    <Button
      variant={variant}
      size={size}
      icon={FileText}
      className={className}
      onClick={() => openReferralRecord(referral.id, tab)}
      data-testid="ward-referral-record-button"
    >
      Referral
    </Button>
  );
}
