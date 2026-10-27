"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/wf";
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
 * discharge date here, with the same day list and typed time as the Patient page. The time is the
 * one typed; nothing is worked out. Changing a recorded date opens on that date, so a nudge is
 * one change, and Save waits until it is moved.
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
  const parsed = typedTimeToInstant(time, day, now);
  const future = parsed !== undefined && parsed > now;
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
    if (!future || unchanged || parsed === undefined || !gate.allowed) return;
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
      <label>
        Day
        <select value={day} onChange={(event) => setDay(Number(event.target.value))}>
          {DISCHARGE_DAYS.map((option) => (
            <option key={option} value={option}>
              {dayOptionLabel(option, now, dayZero)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Expected discharge time
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </label>
      <p className={styles.hint} aria-live="polite">
        {parsed === undefined
          ? "Type the time"
          : !future
            ? "That time has already passed"
            : unchanged
              ? "Change the day or time to save"
              : formatInstantWithDay(parsed, now)}
      </p>
      {save.error ? <p role="alert">{save.error}</p> : null}
      <div className={styles.actions}>
        <Button variant="pri" size="sm" type="submit" disabled={!future || unchanged || save.pending}>
          Save date
        </Button>
        <Button variant="sec" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
