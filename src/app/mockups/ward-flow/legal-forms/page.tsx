import type { Metadata } from "next";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";

export const metadata: Metadata = {
  title: "Legal forms — Ward Flow",
  description:
    "Synthetic prototype: every open movement that carries a legal form, ordered by time remaining, honest about which form types this model can never put a deadline against.",
};

export default function WardLegalFormsPage() {
  return <LegalFormsScreen />;
}
