"use client";

// Copy of src/components/ward-management/alerts/alerts-queue.tsx (Round 2): a missing UMRN reads as plain words.
// Final round (Josh, 31 Oct 2026): a passed legal form reads "Ended Mon 09:27 as typed" in place of its
// age, with no age bar and no "1h 15m overdue" (legal-copies/legal-alert-words.ts).

import type { ReactNode } from "react";
import Link from "next/link";
import { AlarmClock } from "lucide-react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { InboxSnoozeEntry } from "@/components/ward-management/ward-inbox-snooze";
import { snoozedLine } from "@/components/ward-management/inbox-snooze-control";
import { Button, Count, StatusGlyph, buttonClass, type WfTone } from "@/components/wf";

import {
  extractOverdue,
  minutesText,
  type AlertAction,
  type AlertGroup,
  type AlertSubject,
} from "@/components/ward-management/alerts/alerts-model";
import { UMRN_NOT_RECORDED } from "@/components/ward-management/ward-patient-resolver";
import styles from "@/components/ward-management/alerts/alerts.module.css";
import { legalAlertDueAt, legalAlertEnded } from "@/components/ward-redesign/legal-copies/legal-alert-words";
import redesign from "./alerts-redesign.module.css";

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
  "Bed coordinator": "You",
  "ED mental health team": "ED team",
  "Ward nurse in charge": "Ward NIC",
};

/**
 * A short owner name for chips and rows. A planned arrival is owned by its booking ward, which is
 * named (Maali, RPH Older Adult), never collapsed to "Ward": two chips both reading "Ward" could not
 * be told apart (ops-15, 13 Oct 2026). Ward names are already short.
 */
export function ownerShort(owner: string, onCoordinatorDesk = true): string {
  const short = OWNER_SHORT[owner];
  // #801: "You" belongs to the coordinator desk alone. The role reads "Bed coordinator" on every
  // desk, so any other desk sees the coordinator's rows under that name.
  if (short === undefined || (short === "You" && !onCoordinatorDesk)) return owner;
  return short;
}

function groupTone(group: AlertGroup): WfTone {
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
  const legalDueAt = legalAlertDueAt(entry);
  if (legalDueAt !== undefined) {
    return (
      <span className={styles.age}>
        <span className={redesign.legalEnded}>{legalAlertEnded(legalDueAt, now)}</span>
      </span>
    );
  }
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
        aria-label={`Return ${entry.item.title} now for ${entry.subject.displayName}`}
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

/** The row's one Open button; its hit area stretches over the whole row (see .rowOpen::after). */
function OpenButton({ entry, handlers }: { entry: QueueEntry; handlers: QueueHandlers }) {
  return (
    <button
      type="button"
      className={styles.rowOpen}
      aria-current={handlers.selectedId === entry.item.id ? "true" : undefined}
      aria-label={`Open ${entry.item.title} for ${entry.subject.displayName}`}
      data-testid="ward-alerts-open"
      onClick={() => handlers.onSelect(entry)}
    >
      <span className={styles.rowOpenText}>{entry.item.title}</span>
    </button>
  );
}

function Who({ entry }: { entry: QueueEntry }) {
  // Round 2: a missing UMRN reads as plain words, not in bold mono as if it were a number.
  return (
    <span className={styles.who}>
      <strong className={styles.name}>{entry.subject.displayName}</strong>{" "}
      {entry.subject.umrn === UMRN_NOT_RECORDED ? (
        <span className={redesign.umrnMissing}>{entry.subject.umrn}</span>
      ) : (
        <strong className={styles.umrn}>{entry.subject.umrn}</strong>
      )}
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
    <li className={styles.row} {...rowData(entry, handlers)}>
      <span className={styles.rowGlyph}>
        <StatusGlyph tone={glyphTone(entry)} />
      </span>
      <span className={styles.cell}>
        <OpenButton entry={entry} handlers={handlers} />
        <Who entry={entry} />
      </span>
      <span className={`${styles.cell} ${styles.cellWhere} ${redesign.cellWrap}`}>
        <span className={styles.cellMain}>{entry.subject.to ?? entry.subject.from}</span>
        <span className={styles.quiet}>
          {entry.subject.to ? `from ${entry.subject.from}` : (entry.subject.legalStatus ?? "Status not recorded")}
        </span>
      </span>
      <span className={`${styles.cell} ${redesign.cellWrap}`}>
        <span className={styles.cellMain}>{entry.mine ? "You" : ownerShort(entry.owner, false)}</span>
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
  const legalDueAt = legalAlertDueAt(entry);
  // A passed legal form shows no age or age bar; its time reads as typed on its own line.
  const age = legalDueAt === undefined ? entry.raised : undefined;
  return (
    <li className={styles.card} {...rowData(entry, handlers)}>
      <span className={styles.cardTop}>
        {entry.snooze ? <AlarmClock size={14} aria-hidden="true" className={styles.snoozeIcon} /> : null}
        <StatusGlyph tone={glyphTone(entry)} />
        <OpenButton entry={entry} handlers={handlers} />
        {age !== undefined ? (
          <span className={`${styles.mono} ${styles.quiet}`}>{minutesText(Math.max(0, now - age))}</span>
        ) : null}
      </span>
      <span className={styles.cardLine}>
        <Who entry={entry} />
        {age !== undefined ? (
          <span className={styles.ageBar} aria-hidden="true">
            <span
              style={{
                width: `${Math.max(6, Math.round((100 * Math.max(0, now - age)) / Math.max(1, maxAge)))}%`,
              }}
            />
          </span>
        ) : null}
      </span>
      <span className={`${styles.cardLine} ${styles.quiet}`}>{route}</span>
      {legalDueAt !== undefined ? (
        <span className={`${styles.cardLine} ${redesign.legalEnded}`}>{legalAlertEnded(legalDueAt, now)}</span>
      ) : null}
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
    <h2 className={styles.groupHead}>
      {icon ?? (tone ? <StatusGlyph tone={tone} size={9} /> : null)}
      <span>{label}</span>
      <Count n={count} />
      {aside ? <span className={styles.groupAside}>{aside}</span> : null}
    </h2>
  );
}

/**
 * Phone row (v10): a list row in one inset card. Glyph, the alert, the patient and the route, with
 * how long and the owner on the right. The row opens the alert's sheet, where its actions are.
 */
export function AlertPhoneRow({ entry, now, handlers }: { entry: QueueEntry; now: Instant; handlers: QueueHandlers }) {
  const route = entry.subject.to ? `${entry.subject.from} to ${entry.subject.to}` : entry.subject.from;
  // A passed legal form: no age on the right; its time reads as typed under the route, in full.
  const legalDueAt = legalAlertDueAt(entry);
  return (
    <li className={styles.phoneRow} {...rowData(entry, handlers)}>
      <span className={styles.phoneRowGlyph}>
        {entry.snooze ? <AlarmClock size={14} aria-hidden="true" /> : <StatusGlyph tone={glyphTone(entry)} />}
      </span>
      <span className={styles.phoneRowText}>
        <OpenButton entry={entry} handlers={handlers} />
        <span className={styles.phoneRowLine}>
          <Who entry={entry} />
        </span>
        <span className={styles.phoneRowLine}>{route}</span>
        {legalDueAt !== undefined ? (
          <span className={`${styles.phoneRowLine} ${redesign.legalEnded}`}>{legalAlertEnded(legalDueAt, now)}</span>
        ) : null}
      </span>
      <span className={styles.phoneRowEnd}>
        <span className={styles.phoneRowAge}>
          {entry.raised !== undefined && legalDueAt === undefined ? minutesText(Math.max(0, now - entry.raised)) : ""}
        </span>
        <span className={styles.phoneRowOwner}>{entry.mine ? "You" : ownerShort(entry.owner, false)}</span>
      </span>
    </li>
  );
}
