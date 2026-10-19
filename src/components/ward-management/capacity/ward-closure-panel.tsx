"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Button, DisabledReason, Field, Select, StatusGlyph } from "@/components/wf";

import { movementHref } from "../shell/ward-facade";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { WardRecordActor } from "../ward-discharge-records";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { Unit } from "../ward-model";
import {
  WARD_CLOSURE_REASONS,
  WARD_REOPEN_AFTER_HOURS,
  pointedAtWard,
  wardClosureReasonLabel,
  wardReopeningDue,
  type WardClosureReason,
  type WaitingOnClosedWard,
} from "./ward-closure";
import styles from "./ward-closure-panel.module.css";

const STATUS_WORDS: Record<Extract<WaitingOnClosedWard, { kind: "bed_request" }>["status"], string> = {
  asked: "asked this ward",
  accepted: "accepted here",
  bed_held: "bed held here",
};

/**
 * Smart features idea 7 (19 Oct 2026), the screen half: close a whole ward to admissions with a
 * listed reason, see what still points at it, and reopen it. Reopening is always a person's tap;
 * the expected time only prompts. Behind the `ward-closure-mode` switch.
 */
export function WardClosurePanel({ unit, now, actor }: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  const enabled = useWardFeatureFlag("ward-closure-mode");
  if (!enabled) return null;
  return <WardClosureControls unit={unit} now={now} actor={actor} />;
}

function WardClosureControls({ unit, now, actor }: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  const { movements, referrals } = useWardFlowSelect("movements", "referrals");
  const [reason, setReason] = useState<WardClosureReason | "">("");
  const [reopenAfter, setReopenAfter] = useState("");
  const reasonId = useId();
  const mayAct = actor.role === "coordinator" || (actor.role === "ward" && actor.actingUnitId === unit.id);
  const refusal = mayAct ? undefined : "Only this ward or the coordinator can close or reopen it.";
  const actingUnitId = actor.role === "ward" ? actor.actingUnitId : undefined;
  const raise = useWardRaise(actor.role === "ward" ? "ward" : "coordinator");

  if (!unit.isClosed) {
    const closeRefusal = refusal ?? (reason === "" ? "Choose a reason first." : undefined);
    return (
      <section className={styles.panel} aria-label="Close to admissions" data-testid="ward-closure-panel">
        <h3 className={styles.heading}>Close to admissions</h3>
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
          The ward stops being offered for new patients. Beds already held or accepted here stay until someone moves
          them.
        </p>
        <Button
          size="sm"
          variant="sec"
          aria-disabled={closeRefusal !== undefined ? "true" : undefined}
          aria-describedby={closeRefusal ? `${reasonId}-close` : undefined}
          onClick={() => {
            if (closeRefusal || reason === "") return;
            raise("CLOSE_WARD_TO_ADMISSIONS", {
              unitId: unit.id,
              ...(actingUnitId !== undefined ? { actingUnitId } : {}),
              reason,
              ...(reopenAfter !== "" ? { until: now + Number(reopenAfter) * 60 } : {}),
            });
            setReason("");
            setReopenAfter("");
          }}
          data-testid="ward-closure-close"
        >
          Close ward to admissions
        </Button>
        {/* Beneath the button, not beside it: the ward panel is too narrow for both on one line. */}
        {closeRefusal ? <DisabledReason id={`${reasonId}-close`}>{closeRefusal}</DisabledReason> : null}
      </section>
    );
  }

  const closure = unit.admissionsClosure;
  const waiting = pointedAtWard(unit.id, movements, referrals);
  const due = wardReopeningDue(unit, now);
  return (
    <section className={styles.panel} aria-label="Closed to admissions" data-testid="ward-closure-panel">
      <h3 className={styles.heading}>
        <StatusGlyph tone="closed" size={8} /> Closed to admissions
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
      {waiting.length > 0 ? (
        <>
          <p className={styles.subheading}>Still pointed at this ward ({waiting.length})</p>
          <ul className={styles.list} data-testid="ward-closure-waiting">
            {waiting.map((item) =>
              item.kind === "bed_request" ? (
                <li key={`m-${item.id}`}>
                  <Link href={movementHref(item.id)}>Bed request {item.id}</Link> · {STATUS_WORDS[item.status]}
                </li>
              ) : (
                <li key={`r-${item.id}`}>Referral {item.id} · waiting on this ward&rsquo;s answer</li>
              ),
            )}
          </ul>
        </>
      ) : (
        <p className={styles.line}>Nothing else is pointed at this ward.</p>
      )}
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
        Reopen to admissions
      </Button>
      {refusal ? <DisabledReason id={`${reasonId}-reopen`}>{refusal}</DisabledReason> : null}
    </section>
  );
}
