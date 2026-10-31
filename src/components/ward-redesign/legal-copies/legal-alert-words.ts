// The "Legal due time passed" alert, as typed (Josh, 31 Oct 2026). The real alert engine
// (ward-management/ward-derivations.ts) writes its detail with `formatRemaining` ("1h 15m overdue"),
// and the alert rows show its age since the typed time ("1h 15m", "1h 15m ago"): both are running
// "passed … ago" figures on a legal time. In the mock-ups the alert reads "Form 4C (Transfer order) ·
// ended 10:02 as typed" instead, with no elapsed count. The change to build is in the engine's detail
// and in each alert row's age for this one alert kind.
import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";

/** The typed time of a "Legal due time passed" alert, or undefined for any other alert. */
export function legalAlertDueAt(entry: QueueEntry): Instant | undefined {
  return entry.item.id.startsWith(INBOX_CATEGORIES.legal_timing_breached.idPrefix) ? entry.item.dueAt : undefined;
}

/** "Ended 10:02 as typed", in place of the alert's age. */
export function legalAlertEnded(dueAt: Instant, now: Instant): string {
  return `Ended ${formatInstantWithDay(dueAt, now)} as typed`;
}

/** "Form 4C (Transfer order) · ended 10:02 as typed", in place of "1h 15m overdue". */
export function legalAlertDetail(entry: QueueEntry, dueAt: Instant, now: Instant): string {
  const form = entry.movement?.legalForm;
  return `${form ? legalFormName(form) : "Legal form"} · ended ${formatInstantWithDay(dueAt, now)} as typed`;
}

/**
 * The engine's detail for a "Legal due time passed" item, as typed: "WF-001 · Form 4C (Transfer
 * order) · ended 10:02 as typed" in place of "WF-001 · 1h 15m overdue". Undefined for any other item.
 */
export function legalInboxDetailAsTyped(
  item: InboxItem,
  movements: readonly Movement[],
  now: Instant,
): string | undefined {
  if (!item.id.startsWith(INBOX_CATEGORIES.legal_timing_breached.idPrefix) || item.dueAt === undefined)
    return undefined;
  const form = movements.find((movement) => movement.id === item.movementId)?.legalForm;
  const typed = `${form ? legalFormName(form) : "Legal form"} · ended ${formatInstantWithDay(item.dueAt, now)} as typed`;
  return item.movementId ? `${item.movementId} · ${typed}` : typed;
}
