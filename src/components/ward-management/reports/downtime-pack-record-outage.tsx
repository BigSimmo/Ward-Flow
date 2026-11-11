"use client";

import { useState } from "react";

import {
  Button,
  Card,
  CardBody,
  CardHead,
  Field,
  Segmented,
  SrOnly,
  StateLine,
  TimeField,
  useOptionalToast,
} from "@/components/wf";
import {
  dayOf,
  formatInstantWithDay,
  minuteOfDayFromClockText,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { savedAtToast } from "@/components/ward-management/ward-saved-at-toast";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";

import styles from "./downtime-pack-outage.module.css";

type StartDay = "today" | "yesterday";

/** Shown beside Save until the form is complete (Batch 4 item 25, drawn and approved, D-142). */
export const SAVE_NEEDS_BOTH_TIMES = "Save needs both times.";
export const SAVE_NEEDS_START_DAY = "Save needs the day it started.";

/**
 * The outage window from what the coordinator typed: the start on the day chosen, the end on the
 * same day, or the next day when the end's clock time is not after the start's (an outage past
 * midnight). `null` until all three are given. Nothing is filled in.
 */
export function typedOutageWindow(
  fromText: string,
  toText: string,
  day: StartDay | "",
  now: Instant,
): { from: Instant; to: Instant } | null {
  const fromMinute = minuteOfDayFromClockText(fromText);
  const toMinute = minuteOfDayFromClockText(toText);
  if (fromMinute === undefined || toMinute === undefined || day === "") return null;
  const start = (dayOf(now) - (day === "yesterday" ? 1 : 0)) * MINUTES_PER_DAY;
  const from = start + fromMinute;
  const to = start + toMinute + (toMinute <= fromMinute ? MINUTES_PER_DAY : 0);
  return { from, to };
}

/**
 * RECORD AN OUTAGE (Batch 4 item 25, Josh approved the drawing 11 Nov 2026, D-142). The bed
 * coordinator types "We were down from __ to __" and picks Today or Yesterday for the start. Both
 * times are typed, nothing is pre-filled and no day is pre-selected; Save waits until all three are
 * given. Saving sends `RECORD_OUTAGE_WINDOW` (coordinator only), after which each ward sees its
 * catch-up card. It changes no bed figure.
 */
export function DowntimeRecordOutage({ now, onDone }: { now: Instant; onDone: () => void }) {
  const raise = useWardRaise("coordinator");
  // The ward root's form save: it holds Save while the shared save is pending and says why one failed.
  const form = useWardFormSave("record-outage");
  const toast = useOptionalToast();
  const recorded = useOptionalWardFlowSelect("outageWindows")?.outageWindows ?? [];
  // "HH:MM" once a real 24-hour time is typed, otherwise "" (the kit TimeField's value).
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [day, setDay] = useState<StartDay | "">("");
  const [problem, setProblem] = useState<string | null>(null);
  const clearProblem = () => {
    setProblem(null);
    form.clearError();
  };
  const shownProblem = problem ?? form.error ?? null;

  const window = typedOutageWindow(fromTime, toTime, day, now);
  const reason =
    fromTime === "" || toTime === "" ? SAVE_NEEDS_BOTH_TIMES : day === "" ? SAVE_NEEDS_START_DAY : undefined;

  const save = () => {
    if (window === null) return;
    // The reducer refuses these too; saying so here keeps a local refusal from reading as saved.
    if (window.to > now)
      return setProblem("The time Ward Flow came back cannot be later than now. Check the end time.");
    if (recorded.some((row) => row.from === window.from && row.to === window.to))
      return setProblem("That outage is already recorded. Change a time to record another.");
    clearProblem();
    const words = `Outage recorded: down ${formatInstantWithDay(window.from, now)} to ${formatInstantWithDay(window.to, now)}`;
    form.submit(
      () => raise("RECORD_OUTAGE_WINDOW", { from: window.from, to: window.to }),
      () => {
        savedAtToast(toast, words, now);
        onDone();
      },
    );
  };

  return (
    <Card
      aria-labelledby="downtime-record-outage-title"
      className={styles.record}
      data-testid="ward-downtime-record-outage"
    >
      <CardHead id="downtime-record-outage-title" title="Record an outage" meta="Wards then see their catch-up list" />
      <CardBody>
        <div className={styles.recordRow}>
          <Field label="We were down from" className={styles.timeField}>
            <TimeField
              value={fromTime}
              onValueChange={(time) => {
                setFromTime(time);
                clearProblem();
              }}
              data-testid="ward-downtime-outage-from"
            />
          </Field>
          <div className={styles.dayChoice}>
            <Segmented<StartDay | "">
              label="Day the outage started"
              value={day}
              onChange={(next) => {
                setDay(next);
                clearProblem();
              }}
              items={[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
              ]}
            />
          </div>
          <Field
            label={
              <>
                to<SrOnly> (when it came back)</SrOnly>
              </>
            }
            className={styles.timeField}
          >
            <TimeField
              value={toTime}
              onValueChange={(time) => {
                setToTime(time);
                clearProblem();
              }}
              data-testid="ward-downtime-outage-to"
            />
          </Field>
          <div className={styles.saveCell}>
            <Button
              variant="pri"
              size="sm"
              disabledReason={reason ?? (form.pending ? "Saving the outage." : undefined)}
              onClick={save}
              data-testid="ward-downtime-outage-save"
            >
              Save outage
            </Button>
          </div>
        </div>
        <p className={styles.recordHint}>Pick the day it started. Nothing is filled in for you.</p>
        {shownProblem ? (
          <StateLine
            kind="error"
            compact
            title="Outage not saved"
            reason={shownProblem}
            className={styles.recordProblem}
            data-testid="ward-downtime-outage-problem"
          />
        ) : null}
      </CardBody>
    </Card>
  );
}
