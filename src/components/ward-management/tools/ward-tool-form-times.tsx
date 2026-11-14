"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, ListPlus } from "lucide-react";

import { formTitleForCode } from "@/lib/form-register";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { AUDITABLE_FORM_CODES } from "@/components/ward-management/ward-audit";
import {
  clockState,
  isClockBreached,
  type DueSoonThresholds,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { typedClockParts } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { formatReminderHours } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { parseDateTimeInput } from "@/components/ward-management/tools/ward-form-time-input";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { Badge, Button, DateField, Field, Menu, StatusGlyph, TimeField, type WfTone } from "@/components/wf";
import styles from "./ward-tool-form-times.module.css";

/**
 * Tools mock-up Q319, Form times. Forked from the live `WardFormTimes` view. The browser drop-down
 * becomes the kit Menu, and the result is one large clock time in mono, exactly as typed.
 *
 * D-93 holds (31 Oct 2026, "legal form times show only as typed, never as a countdown"): Q319 asked
 * for "time left", but D-93 forbids "3h 20m left" and "1h overdue" on any legal time, so the result
 * shows "Ends 15:42 as typed" with the user's own warning colour and its word ("Within 1h",
 * "Within 3h", "Passed") as a tinted tag, never a count. Form, date and time start empty (D5, Q120).
 */

function formLabel(code: string) {
  const title = formTitleForCode(code);
  return title === null ? `Form ${code}` : `Form ${code} (${title})`;
}

/** The warning colour and its word for a typed time: the same windows every legal list uses. */
function standing(dueAt: Instant, now: Instant, thresholds: DueSoonThresholds): { tone: WfTone; word?: string } {
  const state = clockState(dueAt, now, thresholds);
  if (state === "breached") return { tone: "danger", word: "Passed" };
  if (state === "critical")
    return { tone: "danger", word: `Within ${formatReminderHours(thresholds.urgentMinutes / 60)}` };
  if (state === "due") return { tone: "warning", word: `Within ${formatReminderHours(thresholds.soonMinutes / 60)}` };
  return { tone: "neutral" };
}

export function ToolFormTimes({ onNavigate }: { onNavigate: () => void }) {
  return useExecutiveStatisticsControl().executive ? (
    <ExecutiveFormTimes onNavigate={onNavigate} />
  ) : (
    <OperationalFormTimes onNavigate={onNavigate} />
  );
}

function ExecutiveFormTimes({ onNavigate }: { onNavigate: () => void }) {
  const report = useExecutiveStatistics();
  const dayZero = useMemo(() => (report ? new Date(Date.parse(report.network.asAt.dayZero)) : null), [report]);
  return report && dayZero ? (
    <FormTimesView dayZero={dayZero} now={report.network.asAt.now} onNavigate={onNavigate} />
  ) : (
    <p role="status">Form times are unavailable until this report is ready.</p>
  );
}

function OperationalFormTimes({ onNavigate }: { onNavigate: () => void }) {
  const now = useWardFlowClock();
  // The demo clock counts minutes from the scenario day, the anchor every board date uses.
  const { dayZero } = useWardFlowSelect("dayZero");
  return <FormTimesView dayZero={dayZero} now={now} onNavigate={onNavigate} />;
}

function FormTimesView({ dayZero, now, onNavigate }: { dayZero: Date; now: Instant; onNavigate: () => void }) {
  const thresholds = useDueSoonThresholds();
  // The sheet's own Legal forms row is one row away, so this tool links nowhere (QA, 2 Nov).
  void onNavigate;
  // Nothing is prefilled: a form, date or time already chosen would stand in for one read off the
  // paper form (rule D5; MHA forms are never prefilled; Q120 never defaults a written time to now).
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const id = useId();
  const typed = code && date && time ? parseDateTimeInput(date, time) : null;
  const dueAt = typed ? Math.round((typed.getTime() - dayZero.getTime()) / 60_000) : null;
  const tone = dueAt === null ? null : standing(dueAt, now, thresholds);
  // "15:42", "15:42 tomorrow" or "Tue 10 Nov 15:42": the clock face large, the day beside it.
  const { clock, day } = dueAt === null ? { clock: "", day: "" } : typedClockParts(dueAt, now, dayZero);

  return (
    <div className={styles.body} data-testid="ward-form-times">
      <div className={styles.field}>
        <span className={styles.label} id={`${id}-form-label`}>
          Form
        </span>
        <Menu
          label="Choose a form"
          className={styles.menu}
          items={AUDITABLE_FORM_CODES.map((candidate) => ({
            id: candidate,
            label: formLabel(candidate),
            checked: candidate === code,
            checkable: "radio" as const,
            onSelect: () => setCode(candidate),
          }))}
          trigger={(props) => (
            <button
              {...props}
              type="button"
              className={styles.picker}
              aria-labelledby={`${id}-form-label ${id}-form-value`}
              data-testid="ward-form-times-form"
            >
              <span id={`${id}-form-value`} className={code ? styles.pickerValue : styles.pickerEmpty}>
                {code ? formLabel(code) : "Choose a form"}
              </span>
              <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} />
            </button>
          )}
        />
      </div>
      <div className={styles.pair}>
        <Field label="Date on form">
          <DateField value={date} onValueChange={setDate} />
        </Field>
        <Field label="Time on form" hint="HH:MM">
          <TimeField value={time} onValueChange={setTime} />
        </Field>
      </div>
      <div className={styles.result} role="status" data-testid="ward-form-times-result">
        {typed && dueAt !== null && tone ? (
          <>
            <span className={styles.resultForm}>{formLabel(code)}</span>
            <span className={styles.resultLine}>
              <span className={styles.resultWord}>{isClockBreached(dueAt, now) ? "Ended" : "Ends"}</span>
              <span className={styles.clock}>{clock}</span>
              {day ? <span className={styles.day}>{day}</span> : null}
            </span>
            {tone.word ? (
              <Badge tone={tone.tone} size="sm" className={tone.tone === "danger" ? styles.tagAct : styles.tagSoon}>
                {tone.word}
              </Badge>
            ) : (
              <span className={styles.later}>
                <StatusGlyph tone="neutral" size={8} />
                Later than your warning times
              </span>
            )}
          </>
        ) : (
          <span className={styles.empty}>Not recorded</span>
        )}
      </div>
      {typed ? (
        <Button variant="ghost" size="sm" icon={ListPlus} disabledReason="Not wired in this prototype.">
          Add to My list
        </Button>
      ) : null}
    </div>
  );
}
