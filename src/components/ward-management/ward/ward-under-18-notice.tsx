"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { Button, Field, Segmented, StatusGlyph, TIME_FIELD_ERROR, TimeField, cx } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { calendarDateOf, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { canDispatch } from "@/components/ward-management/ward-role-permissions";
import { clockTextOnDay } from "@/components/ward-management/ward-support-notifications";
import {
  CHIEF_PSYCHIATRIST_NOTIFIED_LABEL,
  UNDER_18_ADULT_WARD_NOTICE,
  under18AdultWardNotice,
} from "@/components/ward-management/ward-under-18-adult-ward";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";

import styles from "./ward-under-18-notice.module.css";

/** The day of the notification, so a time late yesterday is not read as later than now (CodeRabbit, #1609). */
type NotifiedDay = "0" | "1" | "2";
const DAY_ITEMS: { id: NotifiedDay; label: string }[] = [
  { id: "0", label: "Today" },
  { id: "1", label: "Yesterday" },
  { id: "2", label: "2 days ago" },
];

/**
 * Feature item 4 (Josh, 11 Nov 2026): the under 18 on an adult ward notice on the bed record, the
 * desktop drawer and the phone sheet alike. Read from the date of birth and the ward's cohort,
 * against the demo day. One optional typed field, "Chief Psychiatrist notified at", that opens
 * empty (D-93). Once a time is recorded the notice stays, quiet. It never blocks a bed offer and
 * never pre-selects anything. Renders nothing when it does not apply.
 */
export function WardUnder18Notice({
  patient,
  unit,
  admission,
}: {
  patient: Pick<Patient, "dateOfBirth"> | undefined;
  unit: Pick<Unit, "id" | "cohort">;
  admission: Pick<Admission, "id" | "chiefPsychiatristNotice"> | undefined;
}) {
  const now = useWardFlowClock();
  const { dayZero, dispatch, rejections } = useWardFlowSelect("dayZero", "dispatch", "rejections");
  const role = wardChromeRole(usePathname() ?? "");
  const [time, setTime] = useState("");
  const [typed, setTyped] = useState("");
  // Nothing is pre-selected (item 4): no day picked reads as today, as the hint says.
  const [day, setDay] = useState<NotifiedDay | "">("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { runRecorded } = useUndoableStep({ dispatch, rejections, now, routeRole: role, onMessage: setMessage });

  // Age is read against the demo day; with no day zero (a partial store) there is no age to read.
  const notice = dayZero ? under18AdultWardNotice(patient, unit, admission, calendarDateOf(now, dayZero)) : null;
  if (!notice || !admission) return null;
  const canRecord = canDispatch(role, "RECORD_CHIEF_PSYCHIATRIST_NOTIFIED");
  const quiet = notice.tone === "quiet";

  function save() {
    if (!admission) return;
    const notifiedAt = time === "" ? null : clockTextOnDay(time, day === "" ? 0 : Number(day), now);
    if (notifiedAt === null) {
      setError(typed.trim() === "" ? "Type the time the Chief Psychiatrist was notified" : TIME_FIELD_ERROR);
      return;
    }
    if (notifiedAt > now) {
      setError("That time is later than now");
      return;
    }
    setError(null);
    runRecorded(
      () => {
        const completion = wardRaise(
          dispatch,
          role,
          now,
        )("RECORD_CHIEF_PSYCHIATRIST_NOTIFIED", {
          actingUnitId: unit.id,
          admissionId: admission.id,
          notifiedAt,
        });
        const clear = () => {
          setTime("");
          setTyped("");
          setDay("");
        };
        if (completion && "then" in completion)
          void completion.then((result) => {
            if (result.status === "accepted") clear();
          });
        else if (completion?.status === "accepted") clear();
        return completion;
      },
      { success: "Chief Psychiatrist notified time saved" },
    );
  }

  return (
    <section
      className={cx(styles.notice, quiet && styles.quiet)}
      role="note"
      aria-label="Under 18 on an adult ward"
      data-testid="ward-under-18-notice"
      data-tone={notice.tone}
    >
      <p className={styles.text}>
        <StatusGlyph tone={quiet ? "neutral" : "warning"} />
        <span>{UNDER_18_ADULT_WARD_NOTICE}</span>
      </p>
      {notice.notifiedAt !== undefined ? (
        <p className={styles.recorded} data-testid="ward-under-18-notified">
          {CHIEF_PSYCHIATRIST_NOTIFIED_LABEL} {formatInstantWithDay(notice.notifiedAt, now)}
        </p>
      ) : null}
      {canRecord ? (
        <form
          className={styles.form}
          aria-label="Record when the Chief Psychiatrist was notified"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field
            label={notice.notifiedAt === undefined ? CHIEF_PSYCHIATRIST_NOTIFIED_LABEL : "Change the notified time"}
            hint="Optional · HH:MM · today unless you pick a day"
            error={error ?? undefined}
          >
            <TimeField
              value={time}
              onValueChange={setTime}
              onTextChange={setTyped}
              data-testid="ward-under-18-notified-time"
            />
          </Field>
          <Segmented<NotifiedDay> label="Day notified" items={DAY_ITEMS} value={day as NotifiedDay} onChange={setDay} />
          <Button type="submit" variant="sec" size="sm" className={styles.save}>
            Save
          </Button>
        </form>
      ) : null}
      {message ? (
        <p className={styles.recorded} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
