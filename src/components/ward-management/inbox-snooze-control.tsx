"use client";

import { useId, useState } from "react";
import { AlarmClock, ChevronRight } from "lucide-react";

import { Button, PhoneSheet, Popover, StatusGlyph, useIsPhone, type ButtonSize } from "@/components/wf";

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

import overlay from "@/components/wf/overlay.module.css";
import styles from "./inbox-snooze-control.module.css";

/**
 * Snooze picker shared by the Alerts screen and the Tasks drawer (stream A, 9 Oct 2026): a return
 * time from the presets, then a reason from the closed list. An act-now row offers only the
 * presets inside the act-now cap; the reducer refuses anything longer regardless.
 *
 * UX audit (21 Oct 2026): the time chips no longer sit faded until a reason is chosen. The first
 * allowed time is selected on open, and each reason is one button that records the snooze, so the
 * reason is still always the person's own choice and is never filled in for them.
 *
 * Design review (22 Oct 2026, Josh approved): on a phone the picker opens as its own bottom sheet.
 * As a popover inside an alert's More actions it ran off the bottom of the screen.
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
  const phone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  if (phone) {
    return (
      <>
        <Button
          size={size}
          variant={variant}
          icon={AlarmClock}
          aria-label={`Snooze ${subject}`}
          aria-haspopup="dialog"
          onClick={() => setSheetOpen(true)}
        >
          Snooze
        </Button>
        <PhoneSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Snooze" description={subject}>
          <SnoozePicker actNow={actNow} now={now} onSnooze={onSnooze} close={() => setSheetOpen(false)} />
        </PhoneSheet>
      </>
    );
  }
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
 * Audit three #71 (Josh, 28 Nov 2026: keep the reason, remember the last one). The reason stays
 * required and is still the person's own tap; the one they chose last, in this tab, is listed first
 * and marked. Held in memory only, so nothing new is saved.
 */
let lastSnoozeReason: InboxSnoozeReason | undefined;

/**
 * The picker lives inside the popover panel or the phone sheet, which unmount on every close, so an
 * abandoned time choice (Escape, an outside press or the trigger) never carries over to the next open.
 */
export function SnoozePicker({
  actNow,
  now,
  onSnooze,
  close,
  inset = true,
}: {
  actNow: boolean;
  now: Instant;
  onSnooze: (until: Instant, reason: InboxSnoozeReason) => void;
  close: () => void;
  /** False inside a kit Dialog, whose body already holds the inset (gate r10 F6). */
  inset?: boolean;
}) {
  const backInId = useId();
  const reasonId = useId();
  const presets = SNOOZE_PRESETS.map((preset) => {
    const until = snoozeUntilFor(preset.id, now);
    return { ...preset, until, allowed: snoozeAllowed(until, now, actNow) };
  });
  const firstAllowed = presets.find((preset) => preset.allowed)?.id;
  const [chosenPreset, setChosenPreset] = useState<string | undefined>(undefined);
  const selected = presets.find((preset) => preset.id === (chosenPreset ?? firstAllowed) && preset.allowed);
  const capReason = `Act now: ${splitDuration(RED_ROW_SNOOZE_CAP_MINUTES)} at most`;
  const capped = presets.some((preset) => !preset.allowed);
  return (
    <div className={styles.body} data-inset={inset ? undefined : "none"}>
      <div className={styles.section}>
        <p className={styles.eyebrow} id={backInId}>
          Back in
        </p>
        <div className={styles.presets} role="group" aria-labelledby={backInId}>
          {presets.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant={selected?.id === preset.id ? "pri" : "sec"}
              aria-pressed={selected?.id === preset.id}
              title={`Back at ${formatInstantWithDay(preset.until, now)}`}
              disabledReason={preset.allowed ? undefined : capReason}
              // States B review: the line under the row already gives the cap, so no chip draws its
              // own copy on a phone (they pushed 4 h and End of shift off the row).
              reasonDisplay="page"
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
          <p className={styles.when}>
            Back at <strong>{formatInstantWithDay(selected.until, now)}</strong>
            {capped ? `. ${capReason}.` : "."}
          </p>
        ) : null}
      </div>
      {selected ? (
        <div className={styles.section}>
          <p className={styles.eyebrow} id={reasonId}>
            Snooze because
          </p>
          <div className={styles.reasons} role="group" aria-labelledby={reasonId}>
            {[...SNOOZE_REASONS]
              .sort((a, b) => (a.id === lastSnoozeReason ? -1 : b.id === lastSnoozeReason ? 1 : 0))
              .map((entry) => (
                // Audit four #33: the reasons are kit menu rows (the Menu's own row, label and meta),
                // not hand-built ghost buttons; one tap still records the snooze.
                <button
                  key={entry.id}
                  type="button"
                  className={overlay.item}
                  onClick={() => {
                    lastSnoozeReason = entry.id;
                    onSnooze(selected.until, entry.id);
                    close();
                  }}
                >
                  <span className={overlay.itemLabel}>{entry.label}</span>
                  {entry.id === lastSnoozeReason ? <span className={overlay.itemMeta}>Last used</span> : null}
                  <ChevronRight size={16} strokeWidth={1.75} className={styles.reasonChevron} aria-hidden="true" />
                </button>
              ))}
          </div>
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
