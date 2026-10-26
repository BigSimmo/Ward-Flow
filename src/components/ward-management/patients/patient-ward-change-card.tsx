"use client";

import { useId, useState } from "react";
import { CalendarDays, DoorOpen, Stethoscope } from "lucide-react";
import { Button, Card, CardHead, Sheet, StatusGlyph, useIsPhone } from "@/components/wf";
import {
  MINUTES_PER_DAY,
  calendarDateOf,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import styles from "./patient-ward-change-card.module.css";

export type WardChangeForm = "none" | "leave" | "discharge";
export type LeaveKind = "off_ward" | "medical_trip";

const LEAVE_DAYS = [0, 1, 2, 3, 7] as const;
/** A planned discharge can sit weeks out (seeded stays run 8 to 10 days ahead), so offer six weeks. */
export const DISCHARGE_DAYS = Array.from({ length: 43 }, (_, day) => day);

/** "Today", "Tomorrow" or "In 9 days", with the calendar date for anything further out. */
export function dayOptionLabel(day: number, now: Instant, dayZero: Date): string {
  if (day === 0) return "Today";
  if (day === 1) return "Tomorrow";
  const date = calendarDateOf(Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY + day * MINUTES_PER_DAY, dayZero);
  return `In ${day} days, ${date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Perth",
  })}`;
}

/** v10 phone: the leave sheet offers four return times as chips (a past one is not offered). */
const LEAVE_PRESETS = [
  { id: "13", label: "13:00", time: "13:00", day: 0 },
  { id: "16", label: "16:00", time: "16:00", day: 0 },
  { id: "18", label: "18:00", time: "18:00", day: 0 },
  { id: "t10", label: "Tomorrow 10:00", time: "10:00", day: 1 },
] as const;

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
  dischargeInBar = false,
  leaveLegal,
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
  /** v10 phone: the discharge date is the pinned bar's primary, so the chip row leaves it out. */
  dischargeInBar?: boolean;
  /**
   * Audit S-32 (13 Oct 2026): the legal form and status shown in the leave sheet, and whether the
   * person is on an order (then the sheet says leave needs the psychiatrist's authority). A prompt,
   * never a block: the ward or coordinator still records the leave.
   */
  leaveLegal?: { form: string; onOrder: boolean };
}) {
  const [time, setTime] = useState("");
  const [day, setDay] = useState(0);
  const [kind, setKind] = useState<LeaveKind>("off_ward");
  /* v10 Patient, phone: "Record a change" is a heading over a row of chips, and the form rises
   * as a bottom sheet with Cancel beside its one primary. Desktop and tablet keep the card. */
  const isPhone = useIsPhone();
  // Phone leave: a preset return time is chosen up front (16:00, or the next one still ahead);
  // "Other time" opens the typed day and time.
  const [presetId, setPresetId] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState(false);
  const baseId = useId();
  const futurePresets = LEAVE_PRESETS.filter((preset) => {
    const at = typedTimeToInstant(preset.time, preset.day, now);
    return at !== undefined && at > now;
  });
  const phonePresets = isPhone && form === "leave" && !customTime;
  const preset = phonePresets
    ? (futurePresets.find((option) => option.id === presetId) ??
      futurePresets.find((option) => option.id === "16") ??
      futurePresets[0])
    : undefined;
  const parsed = preset ? typedTimeToInstant(preset.time, preset.day, now) : typedTimeToInstant(time, day, now);
  const future = parsed !== undefined && parsed > now;
  const leaveLimit = roleLimit("RECORD_LEAVE_BED");
  const edLimit = roleLimit("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT");
  const dischargeLimit = roleLimit("UPDATE_EXPECTED_DISCHARGE");

  function toggle(next: Exclude<WardChangeForm, "none">) {
    onFormChange(form === next ? "none" : next);
    setTime("");
    setDay(0);
    setPresetId(null);
    setCustomTime(false);
  }

  const chipRow = (
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
      {dischargeInBar ? null : (
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
      )}
    </div>
  );

  const formElement = (
    <form
      id={`${baseId}-pn-ward-change-form`}
      className={isPhone ? styles.phSheetForm : styles.changeForm}
      aria-label={form === "leave" ? "Start leave" : "Set discharge date"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!future || parsed === undefined) return;
        if (form === "leave") onRecordLeave(parsed, kind);
        else onSaveDischarge(parsed);
        setTime("");
      }}
    >
      {form === "leave" && leaveLegal ? (
        <p className={styles.legalLine} data-testid="ward-patient-leave-legal">
          <span>{leaveLegal.form}</span>
          {leaveLegal.onOrder ? <span>On an order: leave needs the treating psychiatrist&apos;s authority</span> : null}
        </p>
      ) : null}
      {form === "leave" && isPhone ? <span className={styles.phFieldLabel}>Kind of leave</span> : null}
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
      {phonePresets ? (
        <>
          <div className={styles.phPresetGroup} role="group" aria-labelledby={`${baseId}-pn-leave-back`}>
            <span id={`${baseId}-pn-leave-back`} className={styles.phFieldLabel}>
              Expected back
            </span>
            <div className={styles.phPresets}>
              {futurePresets.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={styles.kindChoice}
                  aria-pressed={preset?.id === option.id}
                  onClick={() => setPresetId(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {/* Only the chosen time is live: the countdown moves each minute and was re-announced (fresh audit A-9). */}
          <p className={styles.phSummary}>
            <span aria-live="polite">{parsed !== undefined ? `Back ${formatInstantWithDay(parsed, now)}` : null}</span>
            {parsed !== undefined ? `, in ${splitDuration(parsed - now)}. The bed is held while away.` : null}
          </p>
          <button type="button" className={styles.phOther} onClick={() => setCustomTime(true)}>
            Other time
          </button>
        </>
      ) : (
        <>
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
        </>
      )}
      {isPhone ? null : (
        <Button className={styles.tap} type="submit" size="sm" variant="pri" disabled={!future}>
          {form === "leave" ? "Record leave" : "Save date"}
        </Button>
      )}
    </form>
  );

  if (isPhone)
    return (
      <section className={styles.phSection} data-testid="ward-patient-change-card" aria-labelledby="pn-ward-change">
        <h2 id="pn-ward-change" className={styles.phHead}>
          Record a change
        </h2>
        {chipRow}
        {refusal ? (
          <p className={styles.refusal} role="alert">
            <StatusGlyph tone="danger" size={9} /> Not recorded: {refusal}
          </p>
        ) : null}
        <Sheet
          open={form !== "none"}
          onClose={() => onFormChange("none")}
          title={form === "leave" ? "Start leave" : "Set discharge date"}
          description={form === "leave" ? "Bed held while away" : "Typed by the ward"}
          mobilePlacement="bottom"
          testId="ward-patient-change-sheet"
          footer={
            <div className={styles.phSheetFoot}>
              <Button className={styles.tap} onClick={() => onFormChange("none")}>
                Cancel
              </Button>
              <Button
                className={styles.tap}
                type="submit"
                form={`${baseId}-pn-ward-change-form`}
                variant="pri"
                disabled={!future}
              >
                {form === "leave" ? "Record leave" : "Save date"}
              </Button>
            </div>
          }
        >
          {form !== "none" ? formElement : null}
        </Sheet>
      </section>
    );

  return (
    <Card data-testid="ward-patient-change-card" aria-labelledby="pn-ward-change">
      <CardHead id="pn-ward-change" level={2} title="Record a change" meta="Ward" />
      {chipRow}
      {form !== "none" ? formElement : null}
      {refusal ? (
        <p className={styles.refusal} role="alert">
          <StatusGlyph tone="danger" size={9} /> Not recorded: {refusal}
        </p>
      ) : null}
    </Card>
  );
}
