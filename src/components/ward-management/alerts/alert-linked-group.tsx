"use client";

import type { ReactNode } from "react";
import { Link2 } from "lucide-react";

import type { QueueEntry } from "./alerts-queue";
import type { LinkedQueueItem } from "./alert-linked-groups";
import styles from "./alert-linked-group.module.css";

/**
 * Closing-the-loop (package E): one grouped item for alerts that name the same record. The header
 * says how many alerts and which person; each alert below is the screen's own row, unchanged, so
 * its open button and action still work. See `alert-linked-groups.ts` for the grouping rules.
 */
export function LinkedAlertItem({
  item,
  sectionLabels,
  listClassName,
  renderEntry,
}: {
  item: Extract<LinkedQueueItem<QueueEntry>, { kind: "linked" }>;
  /** Section names in screen order, to say where an alert from another section is counted. */
  sectionLabels: readonly string[];
  listClassName: string;
  renderEntry: (entry: QueueEntry) => ReactNode;
}) {
  const first = item.entries[0]!;
  const elsewhere = [...new Set(item.sections.filter((section) => section !== item.sections[0]))]
    .map((section) => sectionLabels[section])
    .filter((label): label is string => label !== undefined);
  const headId = `ward-alert-linked-${item.key.replace(/[^a-zA-Z0-9-]/g, "-")}`;
  return (
    <li className={styles.item} data-linked-record={item.key} data-testid="ward-alerts-linked">
      <p className={styles.head} id={headId}>
        <Link2 size={14} aria-hidden="true" className={styles.icon} />
        <span className={styles.title}>
          {item.entries.length} alerts, one record: {first.subject.displayName}
        </span>
        {first.subject.umrn ? <span className={styles.quiet}>{first.subject.umrn}</span> : null}
        {elsewhere.length > 0 ? (
          <span className={styles.quiet}>Also counted under {elsewhere.join(" and ")}</span>
        ) : null}
      </p>
      <ul className={listClassName} aria-labelledby={headId}>
        {item.entries.map((entry) => renderEntry(entry))}
      </ul>
    </li>
  );
}
