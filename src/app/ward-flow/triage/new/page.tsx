import type { Metadata } from "next";

import { TriageStartScreen } from "@/components/ward-management/triage/triage-risk-form";

export const metadata: Metadata = {
  title: "Start a triage — Ward Flow",
  description: "Synthetic prototype: choose who a mental health triage and risk assessment is for.",
};

/** Start a triage (built 7 Nov 2026): who the triage is for; choosing a person opens their form. */
export default function StartTriagePage() {
  return <TriageStartScreen />;
}
