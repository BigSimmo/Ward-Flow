// The Today marks (Alerts redesign, 1 Nov 2026): what the Today track and the phone Today chart
// draw, read once for both. Kept out of `alerts-screen.tsx` so the screen stays under its line cap.
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import type { HistoryEntry } from "./alerts-history";
import type { QueueEntry } from "./alerts-queue";
import type { TodayPoint, TodaySpan } from "./alerts-visuals";
import type { BroadcastAlert } from "./ward-broadcast-model";

export function todayMarks(
  entries: readonly QueueEntry[],
  history: readonly HistoryEntry[],
  broadcasts: readonly BroadcastAlert[],
  now: Instant,
): { raised: TodayPoint[]; acted: TodayPoint[]; broadcasts: TodaySpan[] } {
  return {
    raised: entries.flatMap((entry) =>
      entry.raised === undefined
        ? []
        : [
            {
              id: entry.item.id,
              at: entry.raised,
              shape: entry.group === "act" ? ("act" as const) : ("wait" as const),
              title: `${entry.item.title} for ${entry.subject.displayName}. Raised ${formatInstantWithDay(entry.raised, now)}`,
            },
          ],
    ),
    acted: history
      .filter((entry) => entry.action)
      .map((entry) => ({
        id: entry.id,
        at: entry.at,
        shape: "done" as const,
        title: `${entry.title}, ${formatInstantWithDay(entry.at, now)}`,
      })),
    broadcasts: broadcasts.map((alert) => ({
      id: alert.id,
      from: alert.dispatchedAt,
      until: alert.stoodDownAt ?? alert.expiresAt,
      title: `${alert.title}, sent ${formatInstantWithDay(alert.dispatchedAt, now)}`,
    })),
  };
}
