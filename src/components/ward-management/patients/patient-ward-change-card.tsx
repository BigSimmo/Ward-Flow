"use client";

import { useState } from "react";
import { CalendarDays, DoorOpen, Stethoscope } from "lucide-react";
import { Button, Card, CardHead, StatusGlyph } from "@/components/wf";
import {
  MINUTES_PER_DAY,
  calendarDateOf,
  formatInstantWithDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import styles from "./patient-ward-change-card.module.css";

export type WardChangeForm = "none" | "leave" | "discharge";
export type LeaveKind = "off_ward" | "medical_trip";

const LEAVE_DAYS = [0, 1, 2, 3, 7] as const;
/** A planned discharge can sit weeks out (seeded stays run 8 to 10 days ahead), so offer six weeks. */
const DISCHARGE_DAYS = Array.from({ length: 43 }, (_, day) => day);

/** "Today", "Tomorrow" or "In 9 days", with the calendar date for anything further out. */
function dayOptionLabel(day: number, now: Instant, dayZero: Date): string {
  if (day === 0) return "Today";
  if (day === 1) return "Tomorrow";
  const date = calendarDateOf(Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY + day * MINUTES_PER_DAY, dayZero);
  return `In ${day} days, ${date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}`;
}

const KIND_LABELS: Record<LeaveKind, string> = { off_ward: "Off-ward leave", medical_trip: "Medical trip" };

/** A typed "HH:MM" on a chosen day, as an instant. Undefined when the time is not a real clock time. */
export function typedTimeToInstant(time: string, dayOffset: number, now: Instant): Instant | undefined {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(time.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY + dayOffset * MINUTES_PER_DAY + hours * 60 + minutes;
}

/**
 * The ward's changes to a stay, from the Patient page: start leave with a typed return time, record
 * them gone to ED, or set the expected discharge date. Every time here is one a person typed, and it
 * must be later than now. Absence without leave stays on the status card.
 */
export function PatientWardChangeCard({
  now,
  dayZero,
  form,
  onFormChange,
  onRecordLeave,
  onGoneToEd,
  onSaveDischarge,
  refusal,
  roleLimit,
}: {
  now: Instant;
  dayZero: Date;
  form: WardChangeForm;
  onFormChange: (form: WardChangeForm) => void;
  onRecordLeave: (expectedReturn: Instant, kind: LeaveKind) => void;
  onGoneToEd: () => void;
  onSaveDischarge: (expectedDischargeAt: Instant) => void;
  /** The engine's reason when it refused the last change made here. */
  refusal?: string;
  /** Why the route's role may not raise this event, or undefined. */
  roleLimit: (eventType: WardFlowEventType) => string | undefined;
}) {
  const [time, setTime] = useState("");
  const [day, setDay] = useState(0);
  const [kind, setKind] = useState<LeaveKind>("off_ward");
  const parsed = typedTimeToInstant(time, day, now);
  const future = parsed !== undefined && parsed > now;
  const leaveLimit = roleLimit("RECORD_LEAVE_BED");
  const edLimit = roleLimit("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT");
  const dischargeLimit = roleLimit("UPDATE_EXPECTED_DISCHARGE");

  function toggle(next: Exclude<WardChangeForm, "none">) {
    onFormChange(form === next ? "none" : next);
    setTime("");
    setDay(0);
  }

  return (
    <Card data-testid="ward-patient-change-card" aria-labelledby="pn-ward-change">
      <CardHead id="pn-ward-change" level={3} title="Record a change" meta="Ward" />
      <div className={styles.changeRow}>
        <Button
          className={styles.tap}
          size="sm"
          icon={DoorOpen}
          aria-pressed={form === "leave"}
          disabledReason={leaveLimit}
          reasonDisplay="tooltip"
          onClick={() => toggle("leave")}
        >
          Start leave
        </Button>
        <Button
          className={styles.tap}
          size="sm"
          icon={Stethoscope}
          disabledReason={edLimit}
          reasonDisplay="tooltip"
          onClick={onGoneToEd}
        >
          Gone to ED
        </Button>
        <Button
          className={styles.tap}
          size="sm"
          icon={CalendarDays}
          aria-pressed={form === "discharge"}
          disabledReason={dischargeLimit}
          reasonDisplay="tooltip"
          onClick={() => toggle("discharge")}
        >
          Discharge date
        </Button>
      </div>
      {form !== "none" ? (
        <form
          className={styles.changeForm}
          aria-label={form === "leave" ? "Start leave" : "Set discharge date"}
          onSubmit={(event) => {
            event.preventDefault();
            if (!future || parsed === undefined) return;
            if (form === "leave") onRecordLeave(parsed, kind);
            else onSaveDischarge(parsed);
            setTime("");
          }}
        >
          {form === "leave" ? (
            <div className={styles.kindRow} role="group" aria-label="Kind of leave">
              {(Object.keys(KIND_LABELS) as LeaveKind[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={styles.kindChoice}
                  aria-pressed={kind === option}
                  onClick={() => setKind(option)}
                >
                  {KIND_LABELS[option]}
                </button>
              ))}
            </div>
          ) : null}
          <label className={styles.changeField}>
            <span>Day</span>
            <select value={day} onChange={(event) => setDay(Number(event.target.value))}>
              {(form === "leave" ? LEAVE_DAYS : DISCHARGE_DAYS).map((option) => (
                <option key={option} value={option}>
                  {dayOptionLabel(option, now, dayZero)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.changeField}>
            <span>{form === "leave" ? "Expected back time" : "Expected discharge time"}</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
          <p className={styles.changeHint} aria-live="polite">
            {parsed === undefined
              ? "Type the time"
              : future
                ? formatInstantWithDay(parsed, now)
                : "That time has already passed"}
          </p>
          <Button className={styles.tap} type="submit" size="sm" variant="pri" disabled={!future}>
            {form === "leave" ? "Record leave" : "Save date"}
          </Button>
        </form>
      ) : null}
      {refusal ? (
        <p className={styles.refusal} role="alert">
          <StatusGlyph tone="danger" size={9} /> Not recorded: {refusal}
        </p>
      ) : null}
    </Card>
  );
}
