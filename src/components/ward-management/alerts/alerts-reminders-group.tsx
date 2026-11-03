"use client";

/**
 * Now tab: the person's own Remind me reminders once they fall due (Tools Q323 follow-up). They are
 * kept in this browser only and every label is built from list values, so nothing typed is shown.
 * Prototype only: synthetic data.
 */
import { Check } from "lucide-react";

import { Button } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { removeReminder, useReminders } from "@/components/ward-management/tools/ward-tool-remind-store";

import { GroupHead } from "./alerts-queue";
import styles from "./alerts.module.css";

function useDueReminders(now: Instant) {
  return useReminders().filter((reminder) => reminder.dueAt <= now);
}

/** How many of this person's reminders are due, so Alerts does not say "Nothing needs you" above them. */
export function useDueReminderCount(now: Instant): number {
  return useDueReminders(now).length;
}

export function AlertsRemindersGroup({ now }: { now: Instant }) {
  const due = useDueReminders(now);
  if (due.length === 0) return null;
  return (
    <section className={styles.group} aria-label="Your reminders" data-testid="ward-alerts-reminders">
      <GroupHead tone="info" label="Your reminders" count={due.length} aside="set in Tools" />
      <ul className={styles.reminderList}>
        {due.map((reminder) => {
          const at = formatInstantWithDay(reminder.dueAt, now);
          return (
            <li key={reminder.id}>
              <span className={styles.mono}>{at}</span>
              <span className={styles.historyText}>
                <span className={styles.historyTitle}>{reminder.reason}</span>
                <span className={styles.quiet}>{reminder.targetLabel}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={Check}
                onClick={() => removeReminder(reminder.id)}
                aria-label={`Done: ${reminder.reason}, ${reminder.targetLabel}, due ${at}`}
              >
                Done
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
