"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { AlarmClock } from "lucide-react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { InboxSnoozeEntry } from "@/components/ward-management/ward-inbox-snooze";
import { snoozedLine } from "@/components/ward-management/inbox-snooze-control";
import { Badge, Button, Count, StatusGlyph, buttonClass, type WfTone } from "@/components/wf";

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
import styles from "./alerts.module.css";
import homeStyles from "@/components/ward-management/coordinator/home-list.module.css";

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

/** "10m overdue" under "10m" says the time twice; the note keeps only what it adds. */
function ageNoteFor(entry: QueueEntry, age: string | undefined, now: Instant, dayZero: Date | undefined): string {
  // A snoozed alert says when it comes back, even a legal one with a typed end.
  if (entry.snooze) return snoozedLine(entry.snooze, now);
  const ended = legalTypedEnd(entry.item);
  if (ended !== undefined) return typedTimeLine(ended, now, dayZero);
  if (entry.raised === undefined) return "Time not recorded";
  const overdue = extractOverdue(entry.item.detail);
  if (!overdue) return `since ${formatInstantWithDay(entry.raised, now)}`;
  return age !== undefined && overdue.startsWith(`${age} `) ? overdue.slice(age.length + 1) : overdue;
}

/** True inside a "N alerts, one record" group, whose head already names the person (gate r10). */
export const LinkedRecordGroupContext = createContext(false);

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
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const { subject } = entry;
  const where = subject.to ? `${subject.to}, from ${subject.from}` : subject.from;
  // An alert about a ward or ED, not a person: no movement, booking, stay or person behind it.
  const unitAlert =
    !entry.item.movementId &&
    !entry.item.plannedAdmission &&
    !entry.item.admissionId &&
    !entry.item.personId &&
    !subject.patientHref;
  const state = entry.snooze ? undefined : stateLine(entry, now);
  // The owner shows only when it is not you, by its full name, as on Home.
  const owner = entry.mine || !entry.owner ? undefined : entry.owner;
  const ageFrom = entry.snooze ? undefined : shownAgeFrom(entry.item, entry.raised);
  const age = ageFrom === undefined ? undefined : minutesText(Math.max(0, now - ageFrom));
  // Gate r10 (1b upgrade 2): inside "N alerts, one record: <name>" the group head already names the
  // person and record, so each row leads with the alert alone, as an alert about a unit does.
  const inRecordGroup = useContext(LinkedRecordGroupContext) && !unitAlert;
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its Open button is the keyboard route
    <li
      className={`${homeStyles.hrow} ${homeStyles.hrowStacked} ${styles.queueRow}`}
      {...rowData(entry, handlers)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        handlers.onSelect(entry);
      }}
    >
      <span className={homeStyles.hrowGlyph}>
        <StatusGlyph tone={glyphTone(entry)} />
      </span>
      {/* Audit four item 108: one row grammar, Home's. Who or where first (the person, or the ward or
          ED on an alert about a unit), then the alert as a tag, then the detail. */}
      <span className={homeStyles.hrowMain}>
        <span className={homeStyles.hrowWho}>
          <button
            type="button"
            className={`${homeStyles.hrowName} ${homeStyles.hrowNameOpen}`}
            aria-current={handlers.selectedId === entry.item.id ? "true" : undefined}
            aria-label={
              inRecordGroup
                ? `Open ${entry.item.title} for ${subject.displayName}`
                : `${unitAlert ? subject.from : subject.displayName}, open ${entry.item.title}`
            }
            data-testid="ward-alerts-open"
            onClick={() => handlers.onSelect(entry)}
          >
            {inRecordGroup ? entry.item.title : unitAlert ? subject.from : subject.displayName}
          </button>{" "}
          {unitAlert || inRecordGroup ? null : <span className={homeStyles.hrowUmrn}>{subject.umrn}</span>}
          {inRecordGroup ? null : (
            <Badge size="sm" className={homeStyles.hrowTag}>
              {entry.item.title}
            </Badge>
          )}
        </span>
        {unitAlert ? (
          entry.item.detail ? (
            <span className={homeStyles.hrowLine}>{entry.item.detail}</span>
          ) : null
        ) : (
          <span className={homeStyles.hrowLine}>{where}</span>
        )}
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
      {/* Gate r10 (1b upgrade 3): the time sits left of the button on one line, as in r9. */}
      <span className={`${homeStyles.hrowEnd} ${styles.queueEnd}`}>
        <span className={homeStyles.hrowAge}>
          {age === undefined ? null : <span className={homeStyles.mono}>{age}</span>}
          <span>{ageNoteFor(entry, age, now, dayZero)}</span>
        </span>
        <span className={homeStyles.hrowAction}>
          <RowAction entry={entry} handlers={handlers} />
        </span>
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
      {icon || tone ? (
        <span className={styles.groupGlyph}>{icon ?? <StatusGlyph tone={tone ?? "neutral"} />}</span>
      ) : null}
      <span>{label}</span>
      <Count n={count} />
      {aside ? <span className={styles.groupAside}>{aside}</span> : null}
    </h2>
  );
}

/**
 * Phone row layout (v10): a list row in one inset card. Glyph, the opener, the patient, the route and
 * its one action (Q180), with how long and the owner on the right. Every act-now row on Alerts uses
 * it, the accepted-to-pull rows too, so the list reads as one.
 */
export function AlertPhoneRowLayout({
  data,
  glyph,
  open,
  who,
  line,
  action,
  age,
  owner,
}: {
  data: Record<string, string | undefined>;
  glyph: ReactNode;
  /** The row's one Open button, its hit area stretched over the row (.rowOpen::after). */
  open: ReactNode;
  who: ReactNode;
  line: ReactNode;
  action: ReactNode;
  age: ReactNode;
  owner?: ReactNode;
}) {
  return (
    <li className={styles.phoneRow} {...data}>
      <span className={styles.phoneRowGlyph}>{glyph}</span>
      <span className={styles.phoneRowText}>
        {open}
        <span className={styles.phoneRowLine}>{who}</span>
        <span className={styles.phoneRowLine}>{line}</span>
        {/* Q180 (Josh, 1 Nov 2026): one action on every row, on a phone too. */}
        <span className={styles.phoneRowAct}>{action}</span>
      </span>
      <span className={styles.phoneRowEnd}>
        <span className={styles.phoneRowAge}>{age}</span>
        {owner !== undefined ? <span className={styles.phoneRowOwner}>{owner}</span> : null}
      </span>
    </li>
  );
}

/** Phone row (v10) for one alert: the title opens the alert's sheet. */
export function AlertPhoneRow({ entry, now, handlers }: { entry: QueueEntry; now: Instant; handlers: QueueHandlers }) {
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const route = entry.subject.to ? `${entry.subject.from} to ${entry.subject.to}` : entry.subject.from;
  const ageFrom = shownAgeFrom(entry.item, entry.raised);
  const ended = legalTypedEnd(entry.item);
  const unitAlert =
    !entry.item.movementId &&
    !entry.item.plannedAdmission &&
    !entry.item.admissionId &&
    !entry.item.personId &&
    !entry.subject.patientHref;
  return (
    <AlertPhoneRowLayout
      data={rowData(entry, handlers)}
      glyph={entry.snooze ? <AlarmClock size={14} aria-hidden="true" /> : <StatusGlyph tone={glyphTone(entry)} />}
      // Gate r10 F8: the phone row speaks the desktop and Home grammar. The person (or the ward or
      // ED on an alert about a unit) opens the row; the record number and the alert, as a tag, follow.
      open={
        <button
          type="button"
          className={styles.rowOpen}
          aria-current={handlers.selectedId === entry.item.id ? "true" : undefined}
          aria-label={`${unitAlert ? entry.subject.from : entry.subject.displayName}, open ${entry.item.title}`}
          data-testid="ward-alerts-open"
          onClick={() => handlers.onSelect(entry)}
        >
          <span className={styles.rowOpenText}>{unitAlert ? entry.subject.from : entry.subject.displayName}</span>
        </button>
      }
      who={
        <span className={styles.phoneRowTagLine}>
          {unitAlert ? null : <span className={styles.umrn}>{entry.subject.umrn}</span>}
          <Badge size="sm">{entry.item.title}</Badge>
        </span>
      }
      line={unitAlert ? (entry.item.detail ?? route) : route}
      action={<RowAction entry={entry} handlers={handlers} />}
      age={
        ageFrom !== undefined
          ? minutesText(Math.max(0, now - ageFrom))
          : ended !== undefined
            ? typedTimeLine(ended, now, dayZero)
            : ""
      }
      owner={entry.mine ? "You" : ownerShort(entry.owner, false)}
    />
  );
}
