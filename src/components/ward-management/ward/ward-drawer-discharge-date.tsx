"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/wf";
import { formatInstantWithDay } from "../ward-clock";
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
 * one typed; nothing is worked out.
 */
export function WardDrawerDischargeDate({
  admissionId,
  unitId,
  hasDate,
}: {
  admissionId: string;
  unitId: string;
  hasDate: boolean;
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
  if (!open) {
    return (
      <span className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          disabledReason={gate.reason}
          onClick={() => {
            save.forget();
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
    if (!future || parsed === undefined || !gate.allowed) return;
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
          : future
            ? formatInstantWithDay(parsed, now)
            : "That time has already passed"}
      </p>
      {save.error ? <p role="alert">{save.error}</p> : null}
      <div className={styles.actions}>
        <Button variant="pri" size="sm" type="submit" disabled={!future || save.pending}>
          Save date
        </Button>
        <Button variant="sec" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
