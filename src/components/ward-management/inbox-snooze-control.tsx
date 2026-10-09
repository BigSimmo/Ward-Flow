"use client";

import { useState } from "react";
import { AlarmClock } from "lucide-react";

import { Button, Field, Popover, Select, StatusGlyph, type ButtonSize } from "@/components/wf";

import { formatInstantWithDay, splitDuration, type Instant } from "./ward-clock";
import type { DecisionTargetReading } from "./ward-decision-targets";
import {
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
 * Snooze picker shared by the Alerts screen and the Tasks drawer (stream A, 9 Oct 2026): a reason
 * from the closed list, then a return time from the presets. An act-now row offers only the
 * presets inside the act-now cap; the reducer refuses anything longer regardless.
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
  const [reason, setReason] = useState<InboxSnoozeReason | "">("");
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
      {(close) => (
        <div className={styles.body}>
          <Field label="Reason">
            <Select
              value={reason}
              onChange={(event) => {
                setReason(event.target.value as InboxSnoozeReason | "");
              }}
            >
              <option value="">Choose a reason</option>
              {SNOOZE_REASONS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className={styles.presets} role="group" aria-label="Back in">
            {SNOOZE_PRESETS.map((preset) => {
              const until = snoozeUntilFor(preset.id, now);
              const allowed = snoozeAllowed(until, now, actNow);
              const disabledReason = !allowed
                ? `Act now: ${splitDuration(RED_ROW_SNOOZE_CAP_MINUTES)} at most`
                : reason === ""
                  ? "Choose a reason first"
                  : undefined;
              return (
                <Button
                  key={preset.id}
                  size="sm"
                  variant="sec"
                  title={`Back at ${formatInstantWithDay(until, now)}`}
                  disabledReason={disabledReason}
                  reasonDisplay="tooltip"
                  onClick={() => {
                    if (disabledReason || reason === "") return;
                    onSnooze(until, reason);
                    setReason("");
                    close();
                  }}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </Popover>
  );
}

/**
 * Who saw a row, who owns it, and when a decision target falls due. Each line only when the record
 * holds it. Durations carry units; a colon is only ever a clock time.
 */
export function InboxRowStatus({
  acknowledgements,
  ownership,
  target,
  now,
  className,
}: {
  acknowledgements?: readonly { at: Instant; by: string }[];
  ownership?: readonly InboxOwnershipEntry[];
  target?: DecisionTargetReading;
  now: Instant;
  className?: string;
}) {
  const seen = acknowledgements?.at(-1);
  const owner = ownership?.at(-1);
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
