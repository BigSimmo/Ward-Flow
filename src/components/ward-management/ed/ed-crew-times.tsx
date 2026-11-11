"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, durMinutes, StateLine } from "@/components/wf";
import { formatInstantWithDay, pastInstantFromClockText, type Instant } from "@/components/ward-management/ward-clock";
import {
  CREW_TIME_FIELDS,
  canMarkBroughtBy,
  crewArrivalMode,
  crewsWaiting,
  crewTimesRefusal,
  type CrewTimeField,
} from "@/components/ward-management/ward-crew-handover";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Movement } from "@/components/ward-management/ward-model";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { EdBroughtBy } from "./ed-brought-by";
import { EdTimeBox } from "./ed-referral-choices";
import edStyles from "./ed.module.css";
import styles from "./ed-crew-times.module.css";

const CREW_TIME_LABELS: Record<CrewTimeField, string> = {
  crewArrivedAt: "Crew arrived",
  crewHandedOverAt: "Handed over",
  crewReleasedAt: "Crew released",
};

const EMPTY: Record<CrewTimeField, string> = { crewArrivedAt: "", crewHandedOverAt: "", crewReleasedAt: "" };

/**
 * Item 9 (police and ambulance handover times, D-93). On an ED arrival brought by police or
 * ambulance, the record shows the crew's three times as typed and three empty time boxes to type
 * them from the paper. Nothing is filled in for the person, and a time left empty stays not
 * recorded. No target, countdown or overdue colour. Replaces the old "Police in attendance" line.
 */
export function EdCrewTimes({ movement, now, raise }: { movement: Movement; now: Instant; raise: WardRaise }) {
  const mode = crewArrivalMode(movement);
  const baseId = useId();
  const [draft, setDraft] = useState(EMPTY);
  const [status, setStatus] = useState<string>();
  const save = useWardFormSave(`ed-crew-times:${movement.id}`);
  if (!mode) return null;
  const typed: Partial<Record<CrewTimeField, Instant>> = {};
  let unreadable = false;
  for (const field of CREW_TIME_FIELDS) {
    if (draft[field].trim() === "") continue;
    const at = pastInstantFromClockText(draft[field], now);
    if (at === undefined) unreadable = true;
    else typed[field] = at;
  }
  const recorded = { ...pickTimes(movement), ...typed };
  const blocked =
    Object.keys(typed).length === 0 && !unreadable
      ? "Type at least one time from the paper."
      : unreadable
        ? "Type each time as a 24-hour clock time, for example 14:30."
        : crewTimesRefusal(typed, recorded, now);
  const crew = mode === "police" ? "Police" : "Ambulance";
  const waiting = crewsWaiting([movement], now);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked || save.pending) return;
    setStatus(undefined);
    save.submit(
      () => raise("RECORD_CREW_TIMES", { movementId: movement.id, ...typed }),
      () => {
        setDraft(EMPTY);
        setStatus("Crew times saved.");
      },
    );
  };
  return (
    <section className={edStyles.pxBlock} aria-labelledby={`${baseId}-title`} data-testid="ward-ed-crew-times">
      <h3 id={`${baseId}-title`}>{crew} crew</h3>
      <dl className={edStyles.pairs}>
        {CREW_TIME_FIELDS.map((field) => {
          const at = movement[field];
          return (
            <div key={field} className={edStyles.pair} data-testid={`ward-ed-crew-${field}`}>
              <dt>{CREW_TIME_LABELS[field]}</dt>
              <dd className={at === undefined ? styles.notRecorded : styles.mono}>
                {at === undefined ? "Not recorded" : formatInstantWithDay(at, now)}
              </dd>
            </div>
          );
        })}
      </dl>
      {waiting ? (
        <p className={styles.waiting} data-testid="ward-ed-crew-waiting-for">
          Crew waiting <span className={styles.mono}>{durMinutes(waiting.longestMinutes)}</span> since arrived
        </p>
      ) : null}
      <form className={styles.form} onSubmit={submit} data-testid="ward-ed-crew-times-form">
        <fieldset className={styles.fields} disabled={save.pending}>
          <legend className={styles.legend}>Type the times from the paper (24-hour, for example 14:30)</legend>
          {CREW_TIME_FIELDS.map((field) => (
            <div key={field} className={styles.field}>
              <span aria-hidden="true">{CREW_TIME_LABELS[field]}</span>
              <EdTimeBox
                label={CREW_TIME_LABELS[field]}
                testId={`ward-ed-crew-time-${field}`}
                value={draft[field]}
                onChange={(value) => {
                  setStatus(undefined);
                  save.clearError();
                  setDraft((current) => ({ ...current, [field]: value }));
                }}
              />
            </div>
          ))}
        </fieldset>
        <Button
          type="submit"
          variant="pri"
          aria-disabled={blocked || save.pending ? "true" : undefined}
          aria-describedby={blocked ? `${baseId}-reason` : undefined}
          data-testid="ward-ed-crew-times-save"
        >
          Save crew times
        </Button>
        {blocked ? (
          <p id={`${baseId}-reason`} className={styles.note}>
            {blocked}
          </p>
        ) : null}
        {save.error ? (
          <StateLine kind="error" compact title={save.error} />
        ) : status ? (
          <p className={styles.note} role="status">
            {status}
          </p>
        ) : null}
      </form>
    </section>
  );
}

/**
 * D-141: the record's arrival block. "Brought by" on an open ED arrival, then the crew's times once
 * it is marked Police or Ambulance (or was seeded so).
 */
export function EdArrivalCrew({ movement, now, raise }: { movement: Movement; now: Instant; raise: WardRaise }) {
  return (
    <>
      {canMarkBroughtBy(movement) ? <EdBroughtBy movement={movement} raise={raise} /> : null}
      <EdCrewTimes movement={movement} now={now} raise={raise} />
    </>
  );
}

function pickTimes(movement: Movement): Partial<Record<CrewTimeField, Instant>> {
  const times: Partial<Record<CrewTimeField, Instant>> = {};
  for (const field of CREW_TIME_FIELDS) {
    const at = movement[field];
    if (at !== undefined) times[field] = at;
  }
  return times;
}
