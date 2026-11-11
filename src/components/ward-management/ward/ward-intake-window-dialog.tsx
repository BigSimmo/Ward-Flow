"use client";

import { useId, useRef, useState } from "react";

import { Dialog, Field, StateLine, TextInput } from "@/components/wf";

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
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
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
  const problem =
    fromText.trim() === "" || toText.trim() === ""
      ? "Type both times."
      : intake === undefined
        ? "Type each time as 21:00 or 2100, and make them different."
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
        <Field label="From" id={`${id}-from`}>
          <TextInput
            inputMode="numeric"
            autoComplete="off"
            placeholder="HH:MM"
            value={fromText}
            onChange={(event) => {
              draft.current += 1;
              setFromText(event.target.value);
            }}
            data-testid="ward-intake-window-from"
          />
        </Field>
        <Field label="To" id={`${id}-to`}>
          <TextInput
            inputMode="numeric"
            autoComplete="off"
            placeholder="HH:MM"
            value={toText}
            onChange={(event) => {
              draft.current += 1;
              setToText(event.target.value);
            }}
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
