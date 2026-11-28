import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Today's review — BedChart",
  description:
    "Synthetic prototype: what to settle before handover, and every decline, override, open problem and stopped action today.",
};

/**
 * Batch 3 (one Handover): "Before you hand over" is on Handover's Patients tab and "Everything today"
 * is the second group of Governance's Review tab, so this address opens there. Only the coordinator
 * opens /review, and the coordinator opens Governance (Flag 3), so no desk loses the page.
 * `TodaysReviewScreen` stays in its file, unused here.
 */
export default function WardTodaysReviewPage() {
  redirect("/bedchart/governance?tab=review");
}
