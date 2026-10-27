"use client";

import { useId, useState } from "react";

import { Button, Dialog, DisabledReason, Field, Select, StatusGlyph } from "@/components/wf";

import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { WardRecordActor } from "../ward-discharge-records";
import { useWardRaise } from "../ward-flow-raise";
import type { Unit } from "../ward-model";
import {
  WARD_CLOSURE_REASONS,
  WARD_REOPEN_AFTER_HOURS,
  wardClosureReasonLabel,
  wardReopeningDue,
  type WardClosureReason,
} from "./ward-closure";
import styles from "./ward-closure-panel.module.css";
// Closing the loop, package D (24 Oct 2026): restriction reviews and the closure transition list.
import { ClosureTransitionChecklist, WardRestrictionReviews } from "../loop-checks/loop-checks-lazy";

/**
 * Smart features idea 7 (19 Oct 2026), the screen half: close a whole ward to admissions with a
 * listed reason, see what still points at it, and reopen it. Reopening is always a person's tap;
 * the expected time only prompts. Behind the `ward-closure-mode` switch.
 */
export function WardClosurePanel({ unit, now, actor }: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  const enabled = useWardFeatureFlag("ward-closure-mode");
  if (!enabled) return null;
  return (
    <>
      <WardClosureControls unit={unit} now={now} actor={actor} />
      <WardRestrictionReviews unit={unit} now={now} actor={actor} />
    </>
  );
}

function WardClosureControls({ unit, now, actor }: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  const [reason, setReason] = useState<WardClosureReason | "">("");
  const [reopenAfter, setReopenAfter] = useState("");
  // DR-07 (design re-score, 24 Oct 2026): closing a ward asks once before it is recorded.
  const [confirming, setConfirming] = useState(false);
  const reasonId = useId();
  const mayAct = actor.role === "coordinator" || (actor.role === "ward" && actor.actingUnitId === unit.id);
  const refusal = mayAct ? undefined : "Only this ward or the coordinator can close or reopen it.";
  const actingUnitId = actor.role === "ward" ? actor.actingUnitId : undefined;
  const raise = useWardRaise(actor.role === "ward" ? "ward" : "coordinator");

  if (!unit.isClosed) {
    const closeRefusal = refusal ?? (reason === "" ? "Choose a reason first." : undefined);
    return (
      <section
        className={styles.panel}
        aria-label={`Close ${unit.name} to admissions`}
        data-testid="ward-closure-panel"
      >
        {/* Audit 1 (WP-10, Josh 20 Oct): the panel names its ward, so a close is never for the wrong one. */}
        <h3 className={styles.heading}>Close {unit.name} to admissions</h3>
        <Field label="Reason">
          <Select
            value={reason}
            onChange={(event) => setReason(event.target.value as WardClosureReason | "")}
            data-testid="ward-closure-reason"
          >
            <option value="">Choose a reason</option>
            {WARD_CLOSURE_REASONS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Expected to reopen">
          <Select
            value={reopenAfter}
            onChange={(event) => setReopenAfter(event.target.value)}
            data-testid="ward-closure-reopen-after"
          >
            <option value="">Not known</option>
            {WARD_REOPEN_AFTER_HOURS.map((hours) => (
              <option key={hours} value={String(hours)}>
                In {hours} hours
              </option>
            ))}
          </Select>
        </Field>
        <p className={styles.note}>
          The ward stops being offered for new patients. Beds already pulled here, and patients already accepted here,
          stay until someone moves them.
        </p>
        <Button
          size="sm"
          variant="sec"
          aria-disabled={closeRefusal !== undefined ? "true" : undefined}
          aria-describedby={closeRefusal ? `${reasonId}-close` : undefined}
          onClick={() => {
            if (closeRefusal || reason === "") return;
            setConfirming(true);
          }}
          data-testid="ward-closure-close"
        >
          Close {unit.name} to admissions
        </Button>
        {/* Beneath the button, not beside it: the ward panel is too narrow for both on one line. */}
        {closeRefusal ? <DisabledReason id={`${reasonId}-close`}>{closeRefusal}</DisabledReason> : null}
        <Dialog
          open={confirming}
          onClose={() => setConfirming(false)}
          size="sm"
          title={`Close ${unit.name} to admissions?`}
          description={`${unit.name} stops being offered for new patients until a person reopens it. Beds already pulled or accepted here stay where they are.`}
          secondary={[{ label: "Cancel", onAction: () => setConfirming(false) }]}
          primary={{
            label: `Close ${unit.name}`,
            onAction: () => {
              setConfirming(false);
              if (closeRefusal || reason === "") return;
              raise("CLOSE_WARD_TO_ADMISSIONS", {
                unitId: unit.id,
                ...(actingUnitId !== undefined ? { actingUnitId } : {}),
                reason,
                ...(reopenAfter !== "" ? { until: now + Number(reopenAfter) * 60 } : {}),
              });
              setReason("");
              setReopenAfter("");
            },
          }}
          data-testid="ward-closure-confirm"
        />
      </section>
    );
  }

  const closure = unit.admissionsClosure;
  const due = wardReopeningDue(unit, now);
  return (
    <section className={styles.panel} aria-label={`${unit.name} closed to admissions`} data-testid="ward-closure-panel">
      <h3 className={styles.heading}>
        <StatusGlyph tone="closed" size={8} /> {unit.name} closed to admissions
      </h3>
      {closure ? (
        <p className={styles.line}>
          {wardClosureReasonLabel(closure.reason)} · since {formatInstantWithDay(closure.at, now)} · by {closure.by}
        </p>
      ) : null}
      {closure?.until !== undefined ? (
        <p className={due ? styles.due : styles.line} role={due ? "status" : undefined}>
          {due
            ? `Was expected to reopen ${formatInstantWithDay(closure.until, now)}. Reopen it when the ward is ready.`
            : `Expected to reopen ${formatInstantWithDay(closure.until, now)}.`}
        </p>
      ) : null}
      {/* Closing the loop D4: each item links to its record and is marked dealt with by a person. */}
      <ClosureTransitionChecklist unit={unit} now={now} actor={actor} />
      <Button
        size="sm"
        variant="sec"
        aria-disabled={refusal !== undefined ? "true" : undefined}
        aria-describedby={refusal ? `${reasonId}-reopen` : undefined}
        onClick={() => {
          if (refusal) return;
          raise("REOPEN_WARD_TO_ADMISSIONS", {
            unitId: unit.id,
            ...(actingUnitId !== undefined ? { actingUnitId } : {}),
          });
        }}
        data-testid="ward-closure-reopen"
      >
        Reopen {unit.name} to admissions
      </Button>
      {refusal ? <DisabledReason id={`${reasonId}-reopen`}>{refusal}</DisabledReason> : null}
    </section>
  );
}
