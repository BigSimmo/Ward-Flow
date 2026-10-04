import type { Metadata } from "next";

import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";

/**
 * ⚠️ **NOT `src/app/(search-app)/on-call` — A DIFFERENT PRODUCT AREA WITH THE SAME WORD.**
 *
 * The former clinical app had a built `on-call` mode of its own (`src/components/on-call/**`): clinical-reference
 * material for a doctor on call — education, logistics, playbook, orientation. **It shares the name
 * and nothing else.** This route is Ward Flow's bed-coordination roster view, and a reader who
 * confuses the two would look for ward roles in a guideline library.
 *
 * `src/components/caring-contacts/team-roster.tsx` is a third unrelated thing with a near-identical
 * name. **None of the three is a source of staff data for the others**, and this one holds no staff
 * data at all — see `on-call-screen.tsx`.
 */
export const metadata: Metadata = {
  title: "On-call and contacts - Ward Flow",
  description: "Synthetic prototype view of which on-call roles are recorded. Holds no names and no contact details.",
};

export default function WardOnCallPage() {
  return <OnCallScreen />;
}
