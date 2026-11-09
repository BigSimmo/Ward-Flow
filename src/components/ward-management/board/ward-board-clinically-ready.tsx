"use client";

import { useState } from "react";

import { Button, DateField, Field, isoDateAsTyped, parseTypedDate } from "@/components/wf";
import { DELAYED_DISCHARGE_REASONS, type DelayedDischargeReason } from "@/components/ward-management/ward-admissions";
import {
  dayOf,
  perthIsoDay,
  calendarDateOf,
  perthMidnight,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";

import { ChoiceChips } from "../ward/ward-bed-dossier-bits";
import styles from "./board.module.css";

const REASON_CHOICES = DELAYED_DISCHARGE_REASONS.map((reason) => ({ id: reason, label: reason }));
import type { Occupant } from "./ward-board-model";

/** "2026-11-04" as the instant of that Perth midnight on the demo clock; null when not a real day. */
function dayInstant(iso: string, dayZero: Date): Instant | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);
  if (!match) return null;
  const midnight = perthMidnight(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.round((midnight.getTime() - dayZero.getTime()) / 60_000);
}

/**
 * Item 5 (Josh, 9 Nov 2026): "Clinically ready since [date]" and the one reason they have not gone,
 * beside the long-stay hold-up on the board's detail panel. The day is typed in the kit's date box;
 * the reason is chosen from `DELAYED_DISCHARGE_REASONS` as kit chips (Q36). Clearing removes both.
 * Its fields and save sit in one `<form>`, which the shared board holds from the first touch.
 */
export function ClinicallyReadyControl({
  occupant,
  arrivedAt,
  unitId,
  now,
  dayZero,
  raise,
  dispatchAndReport,
  nameFor,
}: {
  occupant: Occupant;
  arrivedAt: Instant | null;
  unitId: string;
  now: Instant;
  dayZero: Date;
  raise: WardRaise;
  dispatchAndReport: (record: () => ReturnType<WardCommandDispatch>, success: string) => void;
  nameFor: (admissionId: string) => string;
}) {
  const recorded = occupant.clinicallyReady;
  const recordedDay = recorded ? perthIsoDay(calendarDateOf(recorded.since, dayZero)) : "";
  const [day, setDay] = useState(recordedDay);
  const [typed, setTyped] = useState(isoDateAsTyped(recordedDay));
  const [reason, setReason] = useState<DelayedDischargeReason | "">(recorded?.reason ?? "");
  // The fields follow the saved record once the store holds it, so a refused Clear leaves them
  // showing what is still recorded (PR #1583 review).
  const recordedKey = recorded ? `${recorded.since}|${recorded.reason}` : "";
  const [shownKey, setShownKey] = useState(recordedKey);
  if (recordedKey !== shownKey) {
    setShownKey(recordedKey);
    setDay(recordedDay);
    setTyped(isoDateAsTyped(recordedDay));
    setReason(recorded?.reason ?? "");
  }
  const since = day === "" ? null : dayInstant(day, dayZero);
  const notADay = typed.replace(/\D/gu, "").length >= 8 && parseTypedDate(typed) === null;
  const tooLate = since !== null && dayOf(since) > dayOf(now);
  const tooEarly = since !== null && arrivedAt !== null && dayOf(since) < dayOf(arrivedAt);
  const error = notADay
    ? "Type a real date."
    : tooLate
      ? "Choose today or an earlier day."
      : tooEarly
        ? "Choose a day on or after arrival."
        : null;
  const unchanged = recorded !== null && since === recorded.since && reason === recorded.reason;
  const canRecord = since !== null && reason !== "" && error === null && !unchanged;
  const name = nameFor(occupant.key);

  return (
    <form
      className={`${styles.barrierSelectGroup} ${styles.fullRowSpaced}`}
      data-testid="ward-board-ready-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canRecord) return;
        dispatchAndReport(
          () =>
            raise("SET_CLINICALLY_READY", {
              actingUnitId: unitId,
              admissionId: occupant.key,
              ready: { since, reason },
            }),
          `${name}: clinically ready, waiting on ${reason}.`,
        );
      }}
    >
      <Field label="Clinically ready since" hint="DD/MM/YYYY" id="ward-board-ready-since" error={error}>
        <DateField
          data-testid="ward-board-ready-since"
          value={day}
          onValueChange={setDay}
          rawText={typed}
          onRawTextChange={setTyped}
        />
      </Field>
      <div>
        <span className={styles.readyReasonLabel}>Why not gone</span>
        <ChoiceChips
          label="Why not gone"
          items={REASON_CHOICES}
          value={reason}
          onChange={setReason}
          testId="ward-board-ready-reason"
        />
      </div>
      <Button type="submit" variant="sec" disabled={!canRecord} data-testid="ward-board-ready-record">
        {recorded ? "Update" : "Record ready"}
      </Button>
      {recorded ? (
        <Button
          type="button"
          variant="ghost"
          data-testid="ward-board-ready-clear"
          onClick={() => {
            dispatchAndReport(
              () => raise("SET_CLINICALLY_READY", { actingUnitId: unitId, admissionId: occupant.key, ready: null }),
              `${name}: clinically ready date cleared.`,
            );
          }}
        >
          Clear
        </Button>
      ) : null}
    </form>
  );
}
