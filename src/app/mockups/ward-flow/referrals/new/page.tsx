import type { Metadata } from "next";

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";

export const metadata: Metadata = {
  title: "New referral — Ward Flow",
  description:
    "Synthetic prototype: opens the referral slide-out over the Referrals board. The slide-out is the one place a referral is written.",
};

export default function NewReferralPage() {
  return <ReferralBoard defaultSelectFirst />;
}
