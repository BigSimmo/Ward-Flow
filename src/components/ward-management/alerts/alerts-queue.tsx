"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { AlarmClock } from "lucide-react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { InboxSnoozeEntry } from "@/components/ward-management/ward-inbox-snooze";
import { snoozedLine } from "@/components/ward-management/inbox-snooze-control";
import { Button, Count, StatusGlyph, buttonClass, type WfTone } from "@/components/wf";

import { extractOverdue, minutesText, type AlertAction, type AlertGroup, type AlertSubject } from "./alerts-model";
import styles from "./alerts.module.css";

/** One row of the queue, everything the row, the card and the panel read, computed once. */
export type QueueEntry = {
  item: InboxItem;
  movement: Movement | undefined;
  subject: AlertSubject;
  group: AlertGroup;
  owner: string;
  mine: boolean;
  raised: Instant | undefined;
  seen: { at: Instant; by: string } | undefined;
  ownedSince: Instant | undefined;
  snooze: Extract<InboxSnoozeEntry, { kind: "snoozed" }> | undefined;
  action: AlertAction;
  highlighted: boolean;
  /** v10: a highlight is on and this row does not match it, so it recedes by colour. */
  dimmed?: boolean;
};

export type QueueHandlers = {
  selectedId: string | undefined;
  onSelect: (entry: QueueEntry) => void;
  onRelease: (entry: QueueEntry) => void;
  onReturn: (entry: QueueEntry) => void;
};

const OWNER_SHORT: Record<string, string> = {
  "Flow coordinator": "You",
  "ED mental health team": "ED team",
  "Ward nurse in charge": "Ward NIC",
};

/** A short owner name for chips and rows. A planned arrival is owned by its booking ward, named in full beneath. */
export function ownerShort(owner: string, bookingWard = false): string {
  return OWNER_SHORT[owner] ?? (bookingWard ? "Ward" : owner);
}

/** True when the row is a planned arrival still held by the ward the engine addressed it to. */
export function ownedByBookingWard(entry: QueueEntry): boolean {
  return entry.item.plannedAdmission !== undefined && entry.owner === entry.item.owner;
}

export function groupTone(group: AlertGroup): WfTone {
  return group === "act" ? "danger" : group === "wait" ? "warning" : "neutral";
}

/** The row's severity glyph: red for act now, amber for waiting, neutral for a running target. */
function glyphTone(entry: QueueEntry): WfTone {
  return entry.item.tone === "danger" ? "danger" : groupTone(entry.group);
}

function stateLine(entry: QueueEntry, now: Instant): string | undefined {
  if (entry.snooze) return snoozedLine(entry.snooze, now);
  if (entry.mine && entry.ownedSince !== undefined)
    return `Taken by you ${formatInstantWithDay(entry.ownedSince, now)}`;
  if (entry.seen) return `Acknowledged ${formatInstantWithDay(entry.seen.at, now)}`;
  return undefined;
}

function Age({ entry, now, maxAge }: { entry: QueueEntry; now: Instant; maxAge: number }) {
  if (entry.raised === undefined) return <span className={styles.quiet}>Time not recorded</span>;
  const age = Math.max(0, now - entry.raised);
  return (
    <span className={styles.age}>
      <span className={styles.ageTop}>
        <span className={styles.mono}>{minutesText(age)}</span>
        <span className={styles.ageBar} aria-hidden="true">
          <span style={{ width: `${Math.max(6, Math.round((100 * age) / Math.max(1, maxAge)))}%` }} />
        </span>
      </span>
      <span className={styles.quiet}>
        {extractOverdue(entry.item.detail) ?? `since ${formatInstantWithDay(entry.raised, now)}`}
      </span>
    </span>
  );
}

function RowAction({ entry, handlers, size = "sm" }: { entry: QueueEntry; handlers: QueueHandlers; size?: "sm" }) {
  if (entry.snooze) {
    return (
      <Button
        size={size}
        variant="ghost"
        className={styles.btn}
        aria-label={`Return ${entry.item.title} now, ${entry.subject.displayName}`}
        onClick={() => handlers.onReturn(entry)}
      >
        Return now
      </Button>
    );
  }
  if (entry.action.kind === "release") {
    return (
      <Button
        size={size}
        className={styles.btn}
        aria-label={`${entry.action.label} for ${entry.subject.displayName}`}
        onClick={() => handlers.onRelease(entry)}
      >
        {entry.action.label}
      </Button>
    );
  }
  return (
    <Link
      className={buttonClass({ size, className: styles.btn })}
      href={entry.action.href}
      aria-label={`${entry.action.label} for ${entry.subject.displayName}`}
    >
      {entry.action.label}
    </Link>
  );
}

/** Clicking anywhere on a row that is not itself a control selects it. */
function selectOnRowClick(entry: QueueEntry, handlers: QueueHandlers) {
  return (event: MouseEvent<HTMLLIElement>) => {
    if ((event.target as HTMLElement).closest("a, button, select, input")) return;
    handlers.onSelect(entry);
  };
}

function rowData(entry: QueueEntry, handlers: QueueHandlers) {
  return {
    // A planned arrival row has no movement behind it.
    "data-movement-id": entry.item.movementId || undefined,
    "data-alert-id": entry.item.id,
    "data-tone": entry.item.tone,
    "data-selected": handlers.selectedId === entry.item.id ? "true" : undefined,
    "data-highlighted": entry.highlighted ? "true" : undefined,
    "data-dim": entry.dimmed ? "true" : undefined,
    "data-act": entry.group === "act" && !entry.snooze ? "true" : undefined,
    "data-snoozed": entry.snooze ? "true" : undefined,
    "data-testid": entry.snooze ? `ward-alerts-snoozed-${entry.item.id}` : undefined,
  };
}

function OpenButton({ entry, handlers }: { entry: QueueEntry; handlers: QueueHandlers }) {
  return (
    <button
      type="button"
      className={styles.rowOpen}
      aria-current={handlers.selectedId === entry.item.id ? "true" : undefined}
      aria-label={`Open ${entry.item.title}, ${entry.subject.displayName}`}
      data-testid="ward-alerts-open"
      onClick={() => handlers.onSelect(entry)}
    >
      {entry.item.title}
    </button>
  );
}

function Who({ entry }: { entry: QueueEntry }) {
  return (
    <span className={styles.who}>
      <strong className={styles.name}>{entry.subject.displayName}</strong>{" "}
      <strong className={styles.umrn}>{entry.subject.umrn}</strong>
    </span>
  );
}

/** Desktop row: alert and patient, where, owner, how long, one action. */
export function AlertRow({
  entry,
  now,
  maxAge,
  handlers,
}: {
  entry: QueueEntry;
  now: Instant;
  maxAge: number;
  handlers: QueueHandlers;
}) {
  const state = stateLine(entry, now);
  return (
    <li className={styles.row} onClick={selectOnRowClick(entry, handlers)} {...rowData(entry, handlers)}>
      <span className={styles.rowGlyph}>
        <StatusGlyph tone={glyphTone(entry)} />
      </span>
      <span className={styles.cell}>
        <OpenButton entry={entry} handlers={handlers} />
        <Who entry={entry} />
      </span>
      <span className={`${styles.cell} ${styles.cellWhere}`}>
        <span className={styles.cellMain}>{entry.subject.to ?? entry.subject.from}</span>
        <span className={styles.quiet}>
          {entry.subject.to ? `from ${entry.subject.from}` : (entry.subject.legalStatus ?? "Status not recorded")}
        </span>
      </span>
      <span className={styles.cell}>
        <span className={styles.cellMain}>{ownerShort(entry.owner, ownedByBookingWard(entry))}</span>
        <span className={styles.quiet}>{state ?? entry.owner}</span>
      </span>
      <Age entry={entry} now={now} maxAge={maxAge} />
      <span className={styles.rowAction}>
        <RowAction entry={entry} handlers={handlers} />
      </span>
    </li>
  );
}

/** Lanes and phone card: title and time, patient, route, owner or state and one action. */
export function AlertCard({
  entry,
  now,
  maxAge,
  handlers,
}: {
  entry: QueueEntry;
  now: Instant;
  maxAge: number;
  handlers: QueueHandlers;
}) {
  const state = stateLine(entry, now);
  const route = entry.subject.to ? `${entry.subject.from} to ${entry.subject.to}` : entry.subject.from;
  return (
    <li className={styles.card} onClick={selectOnRowClick(entry, handlers)} {...rowData(entry, handlers)}>
      <span className={styles.cardTop}>
        {entry.snooze ? <AlarmClock size={14} aria-hidden="true" className={styles.snoozeIcon} /> : null}
        <StatusGlyph tone={glyphTone(entry)} />
        <OpenButton entry={entry} handlers={handlers} />
        {entry.raised !== undefined ? (
          <span className={`${styles.mono} ${styles.quiet}`}>{minutesText(Math.max(0, now - entry.raised))}</span>
        ) : null}
      </span>
      <span className={styles.cardLine}>
        <Who entry={entry} />
        {entry.raised !== undefined ? (
          <span className={styles.ageBar} aria-hidden="true">
            <span
              style={{
                width: `${Math.max(6, Math.round((100 * Math.max(0, now - entry.raised)) / Math.max(1, maxAge)))}%`,
              }}
            />
          </span>
        ) : null}
      </span>
      <span className={`${styles.cardLine} ${styles.quiet}`}>{route}</span>
      <span className={styles.cardFoot}>
        <span className={styles.cardState}>{state ?? (entry.mine ? "Yours" : entry.owner)}</span>
        <RowAction entry={entry} handlers={handlers} />
      </span>
    </li>
  );
}

export function GroupHead({
  tone,
  icon,
  label,
  count,
  aside,
}: {
  tone?: WfTone;
  icon?: ReactNode;
  label: string;
  count: number;
  aside?: ReactNode;
}) {
  return (
    <h3 className={styles.groupHead}>
      {icon ?? (tone ? <StatusGlyph tone={tone} size={9} /> : null)}
      <span>{label}</span>
      <Count n={count} />
      {aside ? <span className={styles.groupAside}>{aside}</span> : null}
    </h3>
  );
}
