"use client";

import { useId, useState } from "react";

import { Dialog, Field, TextInput } from "@/components/wf";

import {
  intakeWindowFromClockText,
  intakeWindowLine,
  tonightIntakeWindow,
} from "../capacity/ward-intake-window";
import { formatInstant, type Instant } from "../ward-clock";
import type { WardFlowRole } from "../ward-flow-events";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import type { Unit } from "../ward-model";
import { refusalReasonText } from "../ward-refusal-words";
import { useUndoableStep } from "../use-undoable-step";
import styles from "./ward-intake-window-control.module.css";

/**
 * Feature item 13 (10 Nov 2026): "Tonight: admit 21:00 to 02:00" on the ward hero, with an Edit that
 * opens two typed times. Information only: it never blocks a referral or orders wards. Nothing is
 * pre-filled, and the line reads "Tonight: not set" again after the 07:00 day start.
 *
 * `role` is the screen's route role: the ward for itself, or the coordinator. Any other desk reads
 * the line only.
 */
export function WardIntakeWindowControl({
  unit,
  now,
  role,
  triggerClassName,
}: {
  unit: Unit;
  now: Instant;
  role: WardFlowRole;
  triggerClassName?: string;
}) {
  const tonight = tonightIntakeWindow(unit, now);
  const mayEdit = role === "ward" || role === "coordinator";
  const [open, setOpen] = useState(false);
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [refused, setRefused] = useState<string | null>(null);
  const id = useId();
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  // The live clock stamps the step; `now` may be a paused page clock, kept for display only.
  const at = useWardFlowClock();
  const { run } = useUndoableStep({ dispatch, rejections, now: at, routeRole: role });

  const intake = intakeWindowFromClockText(fromText, toText, at);
  const problem =
    fromText.trim() === "" || toText.trim() === ""
      ? "Type both times."
      : intake === undefined
        ? "Type each time as 21:00 or 2100, and make them different."
        : undefined;

  const close = () => {
    setOpen(false);
    setFromText("");
    setToText("");
  };
  const send = (next: { from: Instant; to: Instant } | null) => {
    run(
      {
        type: "SET_INTAKE_WINDOW",
        role,
        now: at,
        unitId: unit.id,
        ...(role === "ward" ? { actingUnitId: unit.id } : {}),
        intake: next,
      },
      {
        success: next
          ? `${unit.name}: admit ${formatInstant(next.from)} to ${formatInstant(next.to)} tonight.`
          : `${unit.name}: tonight's intake hours cleared.`,
        refusalShownInline: true,
        onRefused: (why) => setRefused(refusalReasonText(why)),
      },
    );
    close();
  };

  return (
    <span className={styles.row} data-testid="ward-intake-window">
      <span data-testid="ward-intake-window-line">{intakeWindowLine(tonight)}</span>
      {mayEdit ? (
        <>
          {" · "}
          <button
            type="button"
            className={triggerClassName ?? styles.trigger}
            aria-label={`Edit tonight's intake hours for ${unit.name}`}
            onClick={() => {
              setRefused(null);
              setOpen(true);
            }}
            data-testid="ward-intake-window-edit"
          >
            Edit
          </button>
        </>
      ) : null}
      {refused ? (
        <span className={styles.refused} role="alert">
          Not saved. {refused}
        </span>
      ) : null}
      <Dialog
        open={open}
        onClose={close}
        size="sm"
        title="Tonight's intake hours"
        description={`The hours tonight ${unit.name} can take an admission. For information only: it never stops a referral. It clears at 07:00.`}
        secondary={[
          { label: "Cancel", onAction: close },
          ...(tonight ? [{ label: "Clear", onAction: () => send(null) }] : []),
        ]}
        primary={{
          label: "Save",
          disabledReason: problem,
          onAction: () => {
            if (problem || !intake) return;
            send(intake);
          },
        }}
        data-testid="ward-intake-window-dialog"
      >
        <div className={styles.fields}>
          <Field label="From" id={`${id}-from`}>
            <TextInput
              inputMode="numeric"
              autoComplete="off"
              placeholder="HH:MM"
              value={fromText}
              onChange={(event) => setFromText(event.target.value)}
              data-testid="ward-intake-window-from"
            />
          </Field>
          <Field label="To" id={`${id}-to`}>
            <TextInput
              inputMode="numeric"
              autoComplete="off"
              placeholder="HH:MM"
              value={toText}
              onChange={(event) => setToText(event.target.value)}
              data-testid="ward-intake-window-to"
            />
          </Field>
        </div>
      </Dialog>
    </span>
  );
}
