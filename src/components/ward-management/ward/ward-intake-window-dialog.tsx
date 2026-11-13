"use client";

import { useId, useRef, useState } from "react";

import { Dialog, Field, StateLine, TIME_FIELD_ERROR, TimeField } from "@/components/wf";

import { intakeWindowFromClockText } from "../ward-intake-window";
import { formatInstant, type Instant } from "../ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import type { Unit } from "../ward-model";
import { refusalReasonText } from "../ward-refusal-words";
import { useUndoableStep } from "../use-undoable-step";
import type { WardFlowRole } from "../ward-flow-roles";
import styles from "./ward-intake-window-control.module.css";

/**
 * Feature item 13: the two typed times behind the ward hero's Edit, in their own chunk so the phone's
 * first load carries only the line (script budget, 11 Nov 2026). Nothing is pre-filled.
 */
export function WardIntakeWindowDialog({
  unit,
  hasTonight,
  role,
  onClose,
}: {
  unit: Unit;
  hasTonight: boolean;
  role: Extract<WardFlowRole, "ward" | "coordinator">;
  onClose: () => void;
}) {
  // Each time is the kit TimeField's "HH:MM" (or "" while unfinished), plus the text as typed, so
  // an empty box can be told from an unfinished or wrong one.
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromTyped, setFromTyped] = useState("");
  const [toTyped, setToTyped] = useState("");
  // A box's error shows once the person has left it, not while they are still typing.
  const [fromLeft, setFromLeft] = useState(false);
  const [toLeft, setToLeft] = useState(false);
  // A refused or unconfirmed save keeps the dialog and both typed times, and says why here.
  const [refused, setRefused] = useState<string | null>(null);
  // Counts edits and saves, so an earlier save that lands late cannot close over newer typing.
  const draft = useRef(0);
  const id = useId();
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  // The live clock stamps the step; the page clock may be paused, kept for display only.
  const at = useWardFlowClock();
  const { run } = useUndoableStep({ dispatch, rejections, now: at, routeRole: role });

  const intake = intakeWindowFromClockText(fromText, toText, at);
  const fromWrong = fromTyped.trim() !== "" && fromText === "";
  const toWrong = toTyped.trim() !== "" && toText === "";
  const problem =
    fromWrong || toWrong
      ? TIME_FIELD_ERROR
      : fromText === "" || toText === ""
        ? "Type both times."
        : intake === undefined
          ? "Make the two times different."
          : undefined;

  const send = (next: { from: Instant; to: Instant } | null) => {
    setRefused(null);
    const sent = ++draft.current;
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
        onAccepted: () => {
          if (draft.current === sent) onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Tonight's intake hours"
      description={`The hours tonight ${unit.name} can take an admission. For information only: it never stops a referral. It clears at 07:00.`}
      secondary={[
        { label: "Cancel", onAction: onClose },
        ...(hasTonight ? [{ label: "Clear", onAction: () => send(null) }] : []),
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
        <Field label="From" id={`${id}-from`} hint="HH:MM" error={fromLeft && fromWrong ? TIME_FIELD_ERROR : undefined}>
          <TimeField
            value={fromText}
            onValueChange={(time) => {
              draft.current += 1;
              setFromText(time);
            }}
            onTextChange={setFromTyped}
            onBlur={() => setFromLeft(true)}
            data-testid="ward-intake-window-from"
          />
        </Field>
        <Field label="To" id={`${id}-to`} hint="HH:MM" error={toLeft && toWrong ? TIME_FIELD_ERROR : undefined}>
          <TimeField
            value={toText}
            onValueChange={(time) => {
              draft.current += 1;
              setToText(time);
            }}
            onTextChange={setToTyped}
            onBlur={() => setToLeft(true)}
            data-testid="ward-intake-window-to"
          />
        </Field>
      </div>
      {refused ? (
        <StateLine kind="error" compact title="Not saved. Check the hours and try again." reason={refused} />
      ) : null}
    </Dialog>
  );
}
