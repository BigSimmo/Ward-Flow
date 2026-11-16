import type { Metadata } from "next";

import { PrivacyTrackerScreen } from "@/components/ward-management/privacy/privacy-tracker-screen";

export const metadata: Metadata = {
  title: "Privacy and data — Ward Flow",
  description:
    "Where Ward Flow stands against the Australian and WA rules for patient health data, with an example policy. Not enforced; synthetic data only.",
};

/** D-259 (Josh, 16 Nov 2026): the privacy and data requirements tracker, under Reports and reference. */
export default function WardPrivacyPage() {
  return <PrivacyTrackerScreen />;
}
