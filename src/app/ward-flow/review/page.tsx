import type { Metadata } from "next";

import { TodaysReviewScreen } from "@/components/ward-management/review/todays-review-screen";

export const metadata: Metadata = {
  title: "Today's review — Ward Flow",
  description:
    "Synthetic prototype: what to settle before handover, and every decline, override, open problem and stopped action today.",
};

export default function WardTodaysReviewPage() {
  return <TodaysReviewScreen />;
}
