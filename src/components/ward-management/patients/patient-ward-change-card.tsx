"use client";

import { useId, useState } from "react";
import { CalendarDays, DoorOpen, Stethoscope, UserRoundX } from "lucide-react";
import { Button, Card, CardHead, Sheet, StatusGlyph, useIsPhone } from "@/components/wf";
import {
  MINUTES_PER_DAY,
  perthDayLabel,
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
  const instant = Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY + day * MINUTES_PER_DAY;
  return `In ${day} days, ${perthDayLabel(instant, dayZero)}`;
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
  pending = false,
  onFormChange,
  onRecordLeave,
  onGoneToEd,
  onSaveDischarge,
  refusal,
  saveError,
  roleLimit,
  dischargeInBar = false,
  leaveLegal,
  embedded = false,
  onMarkAbsent,
}: {
  now: Instant;
  dayZero: Date;
  form: WardChangeForm;
  pending?: boolean;
  onFormChange: (form: WardChangeForm) => void;
  /** `psychiatristAuthorised` is the tick's answer, given only when the person is on an order (#101). */
  onRecordLeave: (expectedReturn: Instant, kind: LeaveKind, psychiatristAuthorised?: boolean) => void;
  onGoneToEd: () => void;
  onSaveDischarge: (expectedDischargeAt: Instant) => void;
  /** The engine's reason when it refused the last change made here. */
  refusal?: string;
  /** The save outcome verbatim: an uncertain save must not be presented as a definite refusal. */
  saveError?: string;
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
  /**
   * Josh's approved list (3 Nov 2026): the row sits inside the On ward card as its one action row,
   * in place of a separate Record a change card. Same buttons, forms and test ids.
   */
  embedded?: boolean;
  /** Mark absent, moved here from the old Leave cell so the On ward card has one action row. */
  onMarkAbsent?: () => void;
}) {
  const [time, setTime] = useState("");
  const [day, setDay] = useState(0);
  const [kind, setKind] = useState<LeaveKind>("off_ward");
  // #101 (Josh, 27 Oct 2026): for a patient on an order, the ward ticks that the treating
  // psychiatrist authorised the leave. Unticked is a warning, never a block. Opens unticked, and the
  // answer is saved on the leave.
  const [authorised, setAuthorised] = useState(false);
  /* v10 Patient, phone: "Record a change" is a heading over a row of chips, and the form rises
   * as a bottom sheet with Cancel beside its one primary. Desktop and tablet keep the card. */
  const isPhone = useIsPhone();
  // Phone leave: a preset return time is chosen up front (16:00, or the next one still ahead);
  // "Other time" opens the typed day and time.
  const [presetId, setPresetId] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState(false);
  const baseId = useId();
  const failureMessage = saveError ?? (refusal ? `Not recorded: ${refusal}` : undefined);
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
  const absentLimit = roleLimit("RECORD_ABSENT_WITHOUT_LEAVE");
  const formLimit = form === "leave" ? leaveLimit : dischargeLimit;

  function toggle(next: Exclude<WardChangeForm, "none">) {
    if (pending || (next === "leave" ? leaveLimit : dischargeLimit)) return;
    onFormChange(form === next ? "none" : next);
    setTime("");
    setDay(0);
    setAuthorised(false);
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
        disabledReason={pending ? "Saving change…" : leaveLimit}
        reasonDisplay="tooltip"
        onClick={() => toggle("leave")}
      >
        Start leave
      </Button>
      <Button
        className={styles.tap}
        size="sm"
        icon={Stethoscope}
        disabledReason={pending ? "Saving change…" : edLimit}
        reasonDisplay="tooltip"
        onClick={() => {
          if (!pending && !edLimit) onGoneToEd();
        }}
      >
        Gone to ED
      </Button>
      {dischargeInBar ? null : (
        <Button
          className={styles.tap}
          size="sm"
          icon={CalendarDays}
          aria-pressed={form === "discharge"}
          disabledReason={pending ? "Saving change…" : dischargeLimit}
          reasonDisplay="tooltip"
          onClick={() => toggle("discharge")}
        >
          Discharge date
        </Button>
      )}
      {onMarkAbsent ? (
        <Button
          className={styles.tap}
          size="sm"
          variant="ghost"
          icon={UserRoundX}
          disabledReason={absentLimit}
          reasonDisplay="tooltip"
          onClick={() => {
            if (!pending && !absentLimit) onMarkAbsent();
          }}
        >
          Mark absent
        </Button>
      ) : null}
    </div>
  );

  const formElement = (
    <form
      id={`${baseId}-pn-ward-change-form`}
      className={isPhone ? styles.phSheetForm : styles.changeForm}
      aria-label={form === "leave" ? "Start leave" : "Set discharge date"}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || formLimit || !future || parsed === undefined) return;
        if (form === "leave") onRecordLeave(parsed, kind, leaveLegal?.onOrder ? authorised : undefined);
        else onSaveDischarge(parsed);
      }}
    >
      {formLimit ? (
        <p className={styles.changeHint} role="status">
          {formLimit}
        </p>
      ) : null}
      {form === "leave" && leaveLegal ? (
        <p className={styles.legalLine} data-testid="ward-patient-leave-legal">
          <span>{leaveLegal.form}</span>
          {leaveLegal.onOrder ? <span>On an order: leave needs the treating psychiatrist&apos;s authority</span> : null}
        </p>
      ) : null}
      {form === "leave" && leaveLegal?.onOrder ? (
        <>
          <label className={styles.authorised}>
            <input
              type="checkbox"
              checked={authorised}
              disabled={pending}
              onChange={(event) => {
                if (!pending) setAuthorised(event.target.checked);
              }}
              data-testid="ward-patient-leave-authorised"
            />
            Leave authorised by the treating psychiatrist
          </label>
          {authorised ? null : (
            <p className={styles.authorisedWarn} data-testid="ward-patient-leave-authorised-warning">
              <StatusGlyph tone="warning" size={9} />
              Not ticked. Check the treating psychiatrist has authorised this leave.
            </p>
          )}
        </>
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
              disabled={pending}
              onClick={() => {
                if (!pending) setKind(option);
              }}
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
                  disabled={pending}
                  onClick={() => {
                    if (!pending) setPresetId(option.id);
                  }}
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
          <button
            type="button"
            className={styles.phOther}
            disabled={pending}
            onClick={() => {
              if (!pending) setCustomTime(true);
            }}
          >
            Other time
          </button>
        </>
      ) : (
        <>
          <label className={styles.changeField}>
            <span>Day</span>
            <select
              value={day}
              disabled={pending}
              onChange={(event) => {
                if (!pending) setDay(Number(event.target.value));
              }}
            >
              {(form === "leave" ? LEAVE_DAYS : DISCHARGE_DAYS).map((option) => (
                <option key={option} value={option}>
                  {dayOptionLabel(option, now, dayZero)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.changeField}>
            <span>{form === "leave" ? "Expected back time" : "Expected discharge time"}</span>
            {/* Typed as HH:MM in a plain box, never the browser's time picker (Josh, 3 Nov 2026). */}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="HH:MM"
              maxLength={5}
              value={time}
              disabled={pending}
              onChange={(event) => {
                if (!pending) setTime(event.target.value);
              }}
            />
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
        <Button
          className={styles.tap}
          type="submit"
          size="sm"
          variant="pri"
          disabled={pending || Boolean(formLimit) || !future}
        >
          {form === "leave" ? "Record leave" : "Save date"}
        </Button>
      )}
    </form>
  );

  if (isPhone)
    return (
      <section
        className={embedded ? styles.embedded : styles.phSection}
        data-testid="ward-patient-change-card"
        aria-labelledby="pn-ward-change"
      >
        {embedded ? (
          <h3 id="pn-ward-change" className={styles.embeddedHead}>
            Record a change
          </h3>
        ) : (
          <h2 id="pn-ward-change" className={styles.phHead}>
            Record a change
          </h2>
        )}
        {chipRow}
        {failureMessage ? (
          <p className={styles.refusal} role="alert">
            <StatusGlyph tone="danger" size={9} /> {failureMessage}
          </p>
        ) : null}
        <Sheet
          open={form !== "none"}
          onClose={() => {
            if (!pending) onFormChange("none");
          }}
          title={form === "leave" ? "Start leave" : "Set discharge date"}
          description={form === "leave" ? "Bed held while away" : "Typed by the ward"}
          mobilePlacement="bottom"
          testId="ward-patient-change-sheet"
          footer={
            <div className={styles.phSheetFoot}>
              <Button
                className={styles.tap}
                disabled={pending}
                onClick={() => {
                  if (!pending) onFormChange("none");
                }}
              >
                Cancel
              </Button>
              <Button
                className={styles.tap}
                type="submit"
                form={`${baseId}-pn-ward-change-form`}
                variant="pri"
                disabled={pending || Boolean(formLimit) || !future}
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

  if (embedded)
    return (
      <section className={styles.embedded} data-testid="ward-patient-change-card" aria-labelledby="pn-ward-change">
        <h3 id="pn-ward-change" className={styles.embeddedHead}>
          Record a change
        </h3>
        {chipRow}
        {form !== "none" ? formElement : null}
        {failureMessage ? (
          <p className={styles.refusal} role="alert">
            <StatusGlyph tone="danger" size={9} /> {failureMessage}
          </p>
        ) : null}
      </section>
    );

  return (
    <Card data-testid="ward-patient-change-card" aria-labelledby="pn-ward-change">
      <CardHead id="pn-ward-change" level={2} title="Record a change" meta="Ward" />
      {chipRow}
      {form !== "none" ? formElement : null}
      {failureMessage ? (
        <p className={styles.refusal} role="alert">
          <StatusGlyph tone="danger" size={9} /> {failureMessage}
        </p>
      ) : null}
    </Card>
  );
}
