// Copies of the ED screen's legal-form time wording (src/components/ward-management/ed/), for the
// redesign mock-ups. The one change to build (Josh, 31 Oct 2026): a legal form's time shows only as
// typed, never "(3h 20m left)", "in 3h 20m", "passed … ago" or "the deadline is … away". A passed time
// says so in words ("ended Mon 09:00 as typed") with no elapsed count, and its colour comes from the
// shared typed-time rule (`typedTimeStanding`). Bed pull limits and transport waits are not legal
// times and keep their own wording.
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { EdNeedsItem } from "@/components/ward-management/ed/ed-needs-you";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { LegalForm, Movement } from "@/components/ward-management/ward-model";

/**
 * Copy of `formExpiryLine` (ed/ed-screen-model.ts). Was "Expiry written on the form: Mon 09:00
 * (3h 20m left)" or "(passed 1h 05m ago)"; now "Ends Mon 09:00 as typed" or "Ended Mon 09:00 as
 * typed". It still reads only the typed `legalForm.dueAt`.
 */
export function formExpiryLine(legalForm: LegalForm, now: Instant): string {
  if (legalForm.dueAt === undefined) return "No expiry recorded from the form.";
  const when = formatInstantWithDay(legalForm.dueAt, now);
  return legalForm.dueAt < now ? `Ended ${when} as typed` : `Ends ${when} as typed`;
}

/** "Form 4C (Transfer order) · ends 15:42 as typed", the wording Movements and Placement use. */
export function formExpiryWithName(legalForm: LegalForm, now: Instant): string {
  if (legalForm.dueAt === undefined) return `${legalFormName(legalForm)} · no expiry recorded from the form`;
  const when = formatInstantWithDay(legalForm.dueAt, now);
  return `${legalFormName(legalForm)} · ${legalForm.dueAt < now ? "ended" : "ends"} ${when} as typed`;
}

/** The kind `deriveEdScreen` gives a passed form's Needs you item (ed/ed-screen-derivations.ts). */
const FORM_PASSED_KIND = "Form expiry passed";

/**
 * The change to build in `deriveEdScreen` (ed/ed-screen-derivations.ts, the "Form expiry passed"
 * flag): its `when` was "passed 1h 05m ago"; it becomes "ended Mon 09:00 as typed". Applied here
 * to the derived Needs you items, so the mock-up does not carry a 750-line copy of the derivations
 * for one string. An item's key is `${movementId}-${index}`.
 */
export function needsYouAsTyped<T extends { needsYouItems: EdNeedsItem[]; patients: Movement[] }>(
  derived: T,
  now: Instant,
): T {
  const needsYouItems = derived.needsYouItems.map((item) => {
    if (item.kind !== FORM_PASSED_KIND) return item;
    const movement = derived.patients.find((m) => item.key.startsWith(`${m.id}-`));
    const dueAt = movement?.legalForm?.dueAt;
    if (dueAt === undefined) return item;
    return { ...item, when: `ended ${formatInstantWithDay(dueAt, now)} as typed` };
  });
  return { ...derived, needsYouItems };
}
