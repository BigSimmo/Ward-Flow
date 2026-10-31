// Final round (Josh, 31 Oct 2026): legal form times only as typed on the Alerts mock-ups. The engine's
// "Legal due time passed" row says "1h 15m overdue" and every row shows its age since the typed time;
// here the detail reads "Form 4C (Transfer order) · ended 09:27 as typed" and the row shows no age.
// Shared by the coordinator's Alerts and its role forks (as-ward-alerts, as-officer-alerts). Bed pulls
// and transport waits are not legal times and keep their ages.
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { alertKindOf, minutesText } from "@/components/ward-management/alerts/alerts-model";
import { legalAlertEnded, legalInboxDetailAsTyped } from "@/components/ward-redesign/legal-copies/legal-alert-words";

type AgedEntry = { item: InboxItem; raised: Instant | undefined };

/** Maps each engine item so a passed legal form's detail reads as typed; other items are unchanged. */
export function legalDetailAsTyped(movements: readonly Movement[], now: Instant) {
  return (item: InboxItem): InboxItem => {
    const detail = legalInboxDetailAsTyped(item, movements, now);
    return detail === undefined ? item : { ...item, detail };
  };
}

/** The typed time of a passed legal form, or undefined for any other alert. */
export function legalEndedAt(entry: AgedEntry): Instant | undefined {
  return alertKindOf(entry.item.id) === "legal" ? entry.item.dueAt : undefined;
}

/** The start of the row's shown age, as a list: empty when none is recorded or for a passed legal form. */
export function ageTimes(entry: AgedEntry): Instant[] {
  return entry.raised === undefined || legalEndedAt(entry) !== undefined ? [] : [entry.raised];
}

/** The copied line's time: " Ended Mon 09:27 as typed." for a passed legal form, else " Open 1h 15m.". */
export function copyAge(entry: AgedEntry, now: Instant): string {
  const ended = legalEndedAt(entry);
  if (ended !== undefined) return ` ${legalAlertEnded(ended, now)}.`;
  return entry.raised === undefined ? "" : ` Open ${minutesText(Math.max(0, now - entry.raised))}.`;
}
