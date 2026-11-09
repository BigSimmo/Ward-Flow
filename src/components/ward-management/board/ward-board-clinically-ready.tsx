"use client";

import { useState } from "react";

import { Button, DateField, Field, Select } from "@/components/wf";
import {
  DELAYED_DISCHARGE_REASONS,
  isDelayedDischargeReason,
  type DelayedDischargeReason,
} from "@/components/ward-management/ward-admissions";
import {
  dayOf,
  perthIsoDay,
  calendarDateOf,
  perthMidnight,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";

import styles from "./board.module.css";
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
 * the reason is chosen from `DELAYED_DISCHARGE_REASONS`. Clearing removes both.
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
  const [day, setDay] = useState(recorded ? perthIsoDay(calendarDateOf(recorded.since, dayZero)) : "");
  const [reason, setReason] = useState<DelayedDischargeReason | "">(recorded?.reason ?? "");
  const since = day === "" ? null : dayInstant(day, dayZero);
  const tooLate = since !== null && dayOf(since) > dayOf(now);
  const tooEarly = since !== null && arrivedAt !== null && dayOf(since) < dayOf(arrivedAt);
  const error = tooLate ? "Choose today or an earlier day." : tooEarly ? "Choose a day on or after arrival." : null;
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
        <DateField data-testid="ward-board-ready-since" value={day} onValueChange={setDay} />
      </Field>
      <Field label="Why not gone" id="ward-board-ready-reason">
        <Select
          data-testid="ward-board-ready-reason"
          value={reason}
          onChange={(event) => setReason(isDelayedDischargeReason(event.target.value) ? event.target.value : "")}
        >
          <option value="">Choose a reason</option>
          {DELAYED_DISCHARGE_REASONS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="sec" disabled={!canRecord} data-testid="ward-board-ready-record">
        {recorded ? "Update" : "Record ready"}
      </Button>
      {recorded ? (
        <Button
          type="button"
          variant="ghost"
          data-testid="ward-board-ready-clear"
          onClick={() => {
            setDay("");
            setReason("");
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
