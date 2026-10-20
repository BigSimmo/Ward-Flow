import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import {
  INBOX_CATEGORIES,
  inboxItemCompletionState,
  type InboxCompletionEntry,
} from "@/components/ward-management/ward-inbox-reducer";

/**
 * "CHECKED, ALL ACCOUNTED FOR" (overall review, 20 Oct 2026): the coordinator ticks the check off
 * once a day. It is recorded through `COMPLETE_INBOX_ITEM` against one id per demo day, so the
 * record keeps who (the role, never a person) and when, and nothing new is added to the engine.
 * Ticking it off changes nothing on the list: the rules above still run and still show.
 */
export function dailyCheckId(now: Instant): string {
  return `${INBOX_CATEGORIES.daily_check.idPrefix}day-${dayOf(now)}`;
}

/** Today's tick, or `undefined` when the check has not been ticked off today (or was reopened). */
export function dailyCheckRecord(
  completions: Readonly<Record<string, readonly InboxCompletionEntry[]>>,
  now: Instant,
): InboxCompletionEntry | undefined {
  const history = completions[dailyCheckId(now)];
  return inboxItemCompletionState(history) === "complete" ? history?.at(-1) : undefined;
}
