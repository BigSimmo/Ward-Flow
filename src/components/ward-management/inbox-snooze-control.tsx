"use client";

import { useState } from "react";
import { AlarmClock } from "lucide-react";

import { Button, Popover, StatusGlyph, type ButtonSize } from "@/components/wf";

import { formatInstantWithDay, splitDuration, type Instant } from "./ward-clock";
import type { DecisionTargetReading } from "./ward-decision-targets";
import {
  currentInboxOwner,
  SNOOZE_PRESETS,
  SNOOZE_REASONS,
  snoozeAllowed,
  snoozeReasonLabel,
  snoozeUntilFor,
  type InboxOwnershipEntry,
  type InboxSnoozeEntry,
  type InboxSnoozeReason,
} from "./ward-inbox-snooze";
import { RED_ROW_SNOOZE_CAP_MINUTES } from "./ward-operational-defaults";

import styles from "./inbox-snooze-control.module.css";

/**
 * Snooze picker shared by the Alerts screen and the Tasks drawer (stream A, 9 Oct 2026): a return
 * time from the presets, then a reason from the closed list. An act-now row offers only the
 * presets inside the act-now cap; the reducer refuses anything longer regardless.
 *
 * UX audit (21 Oct 2026): the time chips no longer sit faded until a reason is chosen. The first
 * allowed time is selected on open, and each reason is one button that records the snooze, so the
 * reason is still always the person's own choice and is never filled in for them.
 */
export function InboxSnoozeControl({
  subject,
  actNow,
  now,
  onSnooze,
  size = "sm",
  variant = "ghost",
}: {
  /** Names the row for assistive technology ("Bed pull expired, Jane Citizen"). */
  subject: string;
  actNow: boolean;
  now: Instant;
  onSnooze: (until: Instant, reason: InboxSnoozeReason) => void;
  size?: ButtonSize;
  variant?: "ghost" | "sec";
}) {
  return (
    <Popover
      label={`Snooze ${subject}`}
      align="end"
      panelClassName={styles.panel}
      trigger={(props) => (
        <Button {...props} size={size} variant={variant} icon={AlarmClock} aria-label={`Snooze ${subject}`}>
          Snooze
        </Button>
      )}
    >
      {(close) => <SnoozePicker actNow={actNow} now={now} onSnooze={onSnooze} close={close} />}
    </Popover>
  );
}

/**
 * The picker lives inside the popover panel, which unmounts on every close, so an abandoned time
 * choice (Escape, an outside press or the trigger) never carries over to the next open.
 */
function SnoozePicker({
  actNow,
  now,
  onSnooze,
  close,
}: {
  actNow: boolean;
  now: Instant;
  onSnooze: (until: Instant, reason: InboxSnoozeReason) => void;
  close: () => void;
}) {
  const presets = SNOOZE_PRESETS.map((preset) => {
    const until = snoozeUntilFor(preset.id, now);
    return { ...preset, until, allowed: snoozeAllowed(until, now, actNow) };
  });
  const firstAllowed = presets.find((preset) => preset.allowed)?.id;
  const [chosenPreset, setChosenPreset] = useState<string | undefined>(undefined);
  const selected = presets.find((preset) => preset.id === (chosenPreset ?? firstAllowed) && preset.allowed);
  return (
    <div className={styles.body}>
      <div className={styles.presets} role="group" aria-label="Back in">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            variant={selected?.id === preset.id ? "pri" : "sec"}
            aria-pressed={selected?.id === preset.id}
            title={`Back at ${formatInstantWithDay(preset.until, now)}`}
            disabledReason={
              preset.allowed ? undefined : `Act now: ${splitDuration(RED_ROW_SNOOZE_CAP_MINUTES)} at most`
            }
            reasonDisplay="tooltip"
            onClick={() => {
              if (!preset.allowed) return;
              setChosenPreset(preset.id);
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {selected ? (
        <div className={styles.reasons} role="group" aria-label="Reason">
          <p className={styles.reasonsLead}>Back at {formatInstantWithDay(selected.until, now)}. Snooze because:</p>
          {SNOOZE_REASONS.map((entry) => (
            <Button
              key={entry.id}
              size="sm"
              variant="ghost"
              className={styles.reason}
              onClick={() => {
                onSnooze(selected.until, entry.id);
                close();
              }}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Who saw a row, who owns it, and when a decision target falls due. Each line only when the record
 * holds it. Durations carry units; a colon is only ever a clock time.
 */
export function InboxRowStatus({
  acknowledgements,
  ownership,
  since,
  target,
  now,
  className,
}: {
  acknowledgements?: readonly { at: Instant; by: string }[];
  ownership?: readonly InboxOwnershipEntry[];
  /** When the row's current occurrence began; an owner from an earlier one is not shown. */
  since?: Instant;
  target?: DecisionTargetReading;
  now: Instant;
  className?: string;
}) {
  const seen = acknowledgements?.at(-1);
  const owner = currentInboxOwner(ownership, since);
  if (!seen && !owner && !target) return null;
  return (
    <p className={className ?? styles.status}>
      {target ? (
        <span className={styles.part} data-testid="inbox-row-target">
          <StatusGlyph tone={target.overdue ? "danger" : "neutral"} size={8} />
          {target.label} {target.text}
        </span>
      ) : null}
      {seen ? (
        <span className={styles.part}>
          <StatusGlyph tone="info" size={8} />
          Seen by {seen.by} {formatInstantWithDay(seen.at, now)}
        </span>
      ) : null}
      {owner ? (
        <span className={styles.part}>
          <StatusGlyph tone="success" size={8} />
          Owned by {owner.by} since {formatInstantWithDay(owner.at, now)}
        </span>
      ) : null}
    </p>
  );
}

/** One line for a snoozed row: when it comes back, why, and who snoozed it. */
export function snoozedLine(entry: Extract<InboxSnoozeEntry, { kind: "snoozed" }>, now: Instant): string {
  return `Back ${formatInstantWithDay(entry.until, now)} · ${snoozeReasonLabel(entry.reason)} · ${entry.by}`;
}
