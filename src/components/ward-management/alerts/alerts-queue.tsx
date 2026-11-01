"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlarmClock } from "lucide-react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { InboxSnoozeEntry } from "@/components/ward-management/ward-inbox-snooze";
import { snoozedLine } from "@/components/ward-management/inbox-snooze-control";
import { Button, Count, StatusGlyph, buttonClass, type WfTone } from "@/components/wf";

import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import {
  extractOverdue,
  legalTypedEnd,
  minutesText,
  shownAgeFrom,
  type AlertAction,
  type AlertGroup,
  type AlertSubject,
} from "./alerts-model";
import { UMRN_NOT_RECORDED } from "@/components/ward-management/ward-patient-resolver";
import styles from "./alerts.module.css";
import homeStyles from "@/components/ward-management/coordinator/home-list.module.css";
import parts from "./alerts-screen-parts.module.css";

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
  /**
   * Alerts redesign (1 Nov 2026): the first-in-line row, the one alert whose action is a filled
   * button. Every other row's action is a plain secondary button, so one main action stands out.
   */
  firstInLineId?: string;
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

function RowAction({ entry, handlers, size = "sm" }: { entry: QueueEntry; handlers: QueueHandlers; size?: "sm" }) {
  // Only the first-in-line row's action is filled; with no first in line, the row keeps its usual look.
  const variant =
    handlers.firstInLineId === undefined
      ? undefined
      : handlers.firstInLineId === entry.item.id
        ? ("pri" as const)
        : ("sec" as const);
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
        variant={variant}
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
      className={buttonClass({ size, variant, className: styles.btn })}
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
  return (
    <span className={styles.who}>
      <strong className={styles.name}>{entry.subject.displayName}</strong>{" "}
      {/* Alerts redesign: a missing UMRN reads as plain words, not in bold mono as if it were a number. */}
      {entry.subject.umrn === UMRN_NOT_RECORDED ? (
        <span className={parts.umrnMissing}>{entry.subject.umrn}</span>
      ) : (
        <strong className={styles.umrn}>{entry.subject.umrn}</strong>
      )}
    </span>
  );
}

/** "10m overdue" under "10m" says the time twice; the note keeps only what it adds. */
function ageNoteFor(entry: QueueEntry, age: string | undefined, now: Instant): string {
  const ended = legalTypedEnd(entry.item);
  if (ended !== undefined) return typedTimeLine(ended, now);
  if (entry.snooze) return snoozedLine(entry.snooze, now);
  if (entry.raised === undefined) return "Time not recorded";
  const overdue = extractOverdue(entry.item.detail);
  if (!overdue) return `since ${formatInstantWithDay(entry.raised, now)}`;
  return age !== undefined && overdue.startsWith(`${age} `) ? overdue.slice(age.length + 1) : overdue;
}

/**
 * Desktop row (Alerts redesign, 1 Nov 2026): Home's act-now row. Glyph, the alert, then
 * "Surname, Given UMRN · where", then how long with a short note, then one action. The owner and
 * any acknowledgement follow on a quiet line when it is not yours.
 */
export function AlertRow({
  entry,
  now,
  handlers,
}: {
  entry: QueueEntry;
  now: Instant;
  maxAge?: number;
  handlers: QueueHandlers;
}) {
  const { subject } = entry;
  const where = subject.to ? `${subject.to}, from ${subject.from}` : subject.from;
  const state = entry.snooze ? undefined : stateLine(entry, now);
  // The owner shows only when it is not you, by its full name, as on Home.
  const owner = entry.mine || !entry.owner ? undefined : entry.owner;
  const ageFrom = entry.snooze ? undefined : shownAgeFrom(entry.item, entry.raised);
  const age = ageFrom === undefined ? undefined : minutesText(Math.max(0, now - ageFrom));
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its Open button is the keyboard route
    <li
      className={homeStyles.hrow}
      {...rowData(entry, handlers)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        handlers.onSelect(entry);
      }}
    >
      <span className={homeStyles.hrowGlyph}>
        <StatusGlyph tone={glyphTone(entry)} />
      </span>
      <span className={homeStyles.hrowMain}>
        <button
          type="button"
          className={homeStyles.hrowTitle}
          aria-current={handlers.selectedId === entry.item.id ? "true" : undefined}
          aria-label={`Open ${entry.item.title} for ${subject.displayName}`}
          data-testid="ward-alerts-open"
          onClick={() => handlers.onSelect(entry)}
        >
          {entry.item.title}
        </button>
        <span className={homeStyles.hrowLine}>
          <Who entry={entry} />
          <span className={homeStyles.hrowWhere}> · {where}</span>
        </span>
        {owner || state ? (
          <span className={homeStyles.hrowExtra}>
            {owner ? (
              <>
                With <span>{owner}</span>
              </>
            ) : null}
            {owner && state ? " · " : null}
            {state}
          </span>
        ) : null}
      </span>
      <span className={homeStyles.hrowAge}>
        {age === undefined ? null : <span className={homeStyles.mono}>{age}</span>}
        <span>{ageNoteFor(entry, age, now)}</span>
      </span>
      <span className={homeStyles.hrowAction}>
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
  const ageFrom = shownAgeFrom(entry.item, entry.raised);
  const ended = legalTypedEnd(entry.item);
  return (
    <li className={styles.card} {...rowData(entry, handlers)}>
      <span className={styles.cardTop}>
        {entry.snooze ? <AlarmClock size={14} aria-hidden="true" className={styles.snoozeIcon} /> : null}
        <StatusGlyph tone={glyphTone(entry)} />
        <OpenButton entry={entry} handlers={handlers} />
        {ageFrom !== undefined ? (
          <span className={`${styles.mono} ${styles.quiet}`}>{minutesText(Math.max(0, now - ageFrom))}</span>
        ) : ended !== undefined ? (
          <span className={styles.quiet}>{typedTimeLine(ended, now)}</span>
        ) : null}
      </span>
      <span className={styles.cardLine}>
        <Who entry={entry} />
        {ageFrom !== undefined ? (
          <span className={styles.ageBar} aria-hidden="true">
            <span
              style={{
                width: `${Math.max(6, Math.round((100 * Math.max(0, now - ageFrom)) / Math.max(1, maxAge)))}%`,
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
  const ageFrom = shownAgeFrom(entry.item, entry.raised);
  const ended = legalTypedEnd(entry.item);
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
      </span>
      <span className={styles.phoneRowEnd}>
        <span className={styles.phoneRowAge}>
          {ageFrom !== undefined
            ? minutesText(Math.max(0, now - ageFrom))
            : ended !== undefined
              ? typedTimeLine(ended, now)
              : ""}
        </span>
        <span className={styles.phoneRowOwner}>{entry.mine ? "You" : ownerShort(entry.owner, false)}</span>
      </span>
    </li>
  );
}
