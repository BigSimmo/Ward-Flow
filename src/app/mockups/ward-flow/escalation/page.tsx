import { redirect } from "next/navigation";

/**
 * MERGE 01 (owner-approved 2026-09-05) folded the priority queue, the exceptions inbox and the
 * escalation board into one screen — `DelaysScreen` — that answers one question: why is this
 * person still waiting? See that screen's own doc comment for the merge's reasoning. This route
 * stays as a bookmark/deep-link backstop so an existing link to the escalation board does not 404.
 *
 * Wave 4 item 15: `from=escalation` lets Delays show the alias pedagogy banner.
 */
export default function WardEscalationRedirect() {
  redirect("/mockups/ward-flow/delays?from=escalation");
}
