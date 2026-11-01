"use client";

import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ShowMoreRow, StatusGlyph, type WfTone } from "@/components/wf";
import type { InboxItem } from "./ward-derivations";

import styles from "./ward-tasks-drawer.module.css";

/** pop-alerts (Josh, 31 Oct 2026): a group longer than 8 shows its first 6, then Show more. */
const GROUP_SHOW_FIRST = 6;

export type AlertKindGroup = { key: string; title: string; items: InboxItem[] };

/** Alerts of the same kind (same title), in the order their first row appears. */
export function groupByTitle(rows: readonly InboxItem[]): AlertKindGroup[] {
  const groups: AlertKindGroup[] = [];
  const byTitle = new Map<string, AlertKindGroup>();
  for (const item of rows) {
    const found = byTitle.get(item.title);
    if (found) found.items.push(item);
    else {
      const group = { key: `group-${item.id}`, title: item.title, items: [item] };
      byTitle.set(item.title, group);
      groups.push(group);
    }
  }
  return groups;
}

/**
 * pop-alerts (Josh, 31 Oct 2026): alerts of the same kind share one row ("Transport awaiting
 * departure", then "5 people"), with one line per person drawn by `renderMember`.
 */
export function AlertKindGroupRow({
  group,
  icon: Icon,
  groupWord,
  listId,
  renderMember,
}: {
  group: AlertKindGroup;
  icon: LucideIcon;
  /** Act now, Waiting or Running, as each row's meta line says it. */
  groupWord: string;
  listId: string;
  renderMember: (item: InboxItem) => ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const first = group.items[0]!;
  const severity: WfTone = first.tone === "danger" ? "danger" : "warning";
  const long = group.items.length > GROUP_SHOW_FIRST + 2;
  const expanded = !long || showAll;
  const shown = expanded ? group.items : group.items.slice(0, GROUP_SHOW_FIRST);
  return (
    <li className={styles.row} data-tone={first.tone} data-group="" data-testid={`ward-task-${group.key}`}>
      <div className={styles.rowHead}>
        <span className={styles.rowIcon} aria-hidden="true">
          <Icon aria-hidden="true" />
        </span>
        <div className={styles.rowText}>
          <h4 className={styles.groupTitle}>{group.title}</h4>
          <p className={styles.rowMeta}>
            <StatusGlyph tone={severity} size={9} />
            <span>{groupWord}</span>
            <span aria-hidden="true">·</span>
            <span>{group.items.length} people</span>
          </p>
        </div>
      </div>
      <ul id={listId} className={styles.groupList} aria-label={`${group.title}, ${group.items.length} people`}>
        {shown.map(renderMember)}
      </ul>
      {long ? (
        <ShowMoreRow expanded={expanded} controls={listId} onClick={() => setShowAll((value) => !value)}>
          {expanded ? "Show fewer" : `Show ${group.items.length - GROUP_SHOW_FIRST} more`}
        </ShowMoreRow>
      ) : null}
    </li>
  );
}
