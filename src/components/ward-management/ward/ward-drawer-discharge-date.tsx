"use client";

import { useState, type FormEvent } from "react";
import { Button, Stepper, TimeField } from "@/components/wf";
import { dayOf, formatInstantWithDay, type Instant } from "../ward-clock";
import { clockInputValue } from "../capacity/planned-admissions-draft";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { useWardFormSave } from "../use-ward-form-save";
import { useRoleGate, useRouteRole } from "../ward-role-gate";
import { DISCHARGE_DAYS, dayOptionLabel, typedTimeToInstant } from "../patients/patient-ward-change-card";
import styles from "./ward-drawer-discharge-date.module.css";

/**
 * Walk-through WT-16 (26 Oct 2026): the bed drawer showed "No date" for going out with no way to
 * set it, so only the coordinator could. The nurse in charge now sets or changes the expected
 * discharge date here, with the same days and typed time as the Patient page. The time is the
 * one typed; nothing is worked out. Changing a recorded date opens on that date, so a nudge is
 * one change, and Save waits until it is moved.
 *
 * Form rule (design audit, Josh's card 3, 5 Nov 2026): a time that has already passed warns and
 * still saves as typed. Save is unavailable only with no readable time or no change.
 */
export function WardDrawerDischargeDate({
  admissionId,
  unitId,
  recordedAt,
}: {
  admissionId: string;
  unitId: string;
  /** The expected discharge already recorded, or null. */
  recordedAt: Instant | null;
}) {
  const { dayZero } = useWardFlowSelect("dayZero");
  const now = useWardFlowClock();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  const gate = useRoleGate()("UPDATE_EXPECTED_DISCHARGE", `drawer-${admissionId}`);
  const save = useWardFormSave(`drawer-discharge-${admissionId}`);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState("");
  const [openedAt, setOpenedAt] = useState(now);
  const parsed = typedTimeToInstant(time, day, openedAt);
  const dayFromToday = day + dayOf(openedAt) - dayOf(now);
  const dayLabel =
    dayFromToday === -1
      ? "Yesterday"
      : dayFromToday < 0
        ? `${-dayFromToday} days ago`
        : dayOptionLabel(dayFromToday, now, dayZero);
  const past = parsed !== undefined && parsed <= now;
  const unchanged = parsed !== undefined && parsed === recordedAt;
  const hasDate = recordedAt !== null;
  // The recorded day and time, when it is still on the day list; otherwise today and a blank time.
  const recordedDay = recordedAt === null ? undefined : dayOf(recordedAt) - dayOf(now);
  const startOnRecorded = recordedDay !== undefined && DISCHARGE_DAYS.includes(recordedDay);
  if (!open) {
    return (
      <span className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          disabledReason={gate.reason}
          onClick={() => {
            save.forget();
            setOpenedAt(now);
            setDay(startOnRecorded ? recordedDay : 0);
            setTime(startOnRecorded && recordedAt !== null ? clockInputValue(recordedAt) : "");
            setOpen(true);
          }}
          data-testid="ward-drawer-discharge-date-open"
        >
          {hasDate ? "Change discharge date" : "Set discharge date"}
        </Button>
      </span>
    );
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (unchanged || parsed === undefined || !gate.allowed) return;
    save.submit(
      () =>
        raise("UPDATE_EXPECTED_DISCHARGE", {
          admissionId,
          expectedDischargeAt: parsed,
          ...(routeRole === "ward" ? { actingUnitId: unitId } : {}),
        }),
      () => {
        setOpen(false);
        setTime("");
        setDay(0);
      },
    );
  };
  return (
    <form
      className={styles.form}
      onSubmit={submit}
      aria-label="Set discharge date"
      data-testid="ward-drawer-discharge-date"
    >
      {/* WH1 (Josh, 3 Nov 2026): the kit stepper in place of a 43 row browser drop-down. */}
      <div className={styles.day}>
        <span>Day</span>
        <Stepper
          noun="discharge day"
          unavailable={save.pending}
          value={day}
          min={0}
          max={DISCHARGE_DAYS.length - 1}
          onChange={(value) => {
            if (!save.pending) setDay(value);
          }}
          display={dayLabel}
          valueText={dayLabel}
          valueTestId="ward-drawer-discharge-day"
        />
      </div>
      <label>
        Expected discharge time
        <TimeField disabled={save.pending} value={time} onValueChange={setTime} />
      </label>
      <p className={styles.hint} aria-live="polite" data-testid="ward-drawer-discharge-date-hint">
        {parsed === undefined
          ? "Type the time"
          : unchanged
            ? "Change the day or time to save"
            : past
              ? `${formatInstantWithDay(parsed, now)}. That time has passed. It saves as typed.`
              : formatInstantWithDay(parsed, now)}
      </p>
      {save.error ? <p role="alert">{save.error}</p> : null}
      <div className={styles.actions}>
        <Button
          variant="pri"
          size="sm"
          type="submit"
          reasonDisplay="tooltip"
          disabledReason={
            save.pending
              ? "Saving"
              : parsed === undefined
                ? "Type the time"
                : unchanged
                  ? "Change the day or time to save"
                  : undefined
          }
        >
          Save date
        </Button>
        <Button variant="sec" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
