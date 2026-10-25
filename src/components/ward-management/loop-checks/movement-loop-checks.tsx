"use client";

import { useId, useState } from "react";

import { Badge, Button, DisabledReason, Field, Select, StatusGlyph } from "@/components/wf";

import { useWardRecordActors } from "../shell/ward-access";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useWardRaise } from "../ward-flow-raise";
import type { Movement, Unit } from "../ward-model";
import {
  ACCEPTANCE_BED_AFTER_HOURS,
  ACCEPTANCE_CONDITION_AGREED_WITH,
  ACCEPTANCE_CONDITION_KINDS,
  CANCELLED_MOVE_CHECK_ITEMS,
  CANCELLED_MOVE_CHECK_MARKS,
  cancelledMoveCheck,
  cancelledMoveStillHoldsBed,
  currentAcceptanceConditions,
  isCancelledMove,
  type AcceptanceConditionAgreedWith,
  type AcceptanceConditionKind,
  type CancelledMoveCheckItem,
} from "./ward-loop-checks";
import {
  ACCEPTANCE_AGREED_WITH_LABELS,
  ACCEPTANCE_CONDITION_LABELS,
  CANCELLED_MOVE_CHECK_LABELS,
  CANCELLED_MOVE_MARK_LABELS,
  acceptanceConditionsHeadline,
} from "./ward-loop-checks-view";
import styles from "./loop-checks.module.css";

/** Who may record against this move from the current desk: the coordinator, or the accepting ward. */
function useMoveActor(movement: Movement) {
  const actors = useWardRecordActors();
  const coordinator = actors.find((actor) => actor.role === "coordinator");
  if (coordinator) return { role: "coordinator" as const, actingUnitId: undefined };
  for (const actor of actors) {
    if (actor.role === "ward" && actor.actingUnitId === movement.acceptedUnitId) {
      return { role: "ward" as const, actingUnitId: actor.actingUnitId };
    }
  }
  return undefined;
}

const NOT_YOURS = "Only the coordinator or the accepting ward can record this.";

/** What the record already says about one item, so the person checking has the facts beside it. */
function cancelledItemFact(movement: Movement, item: CancelledMoveCheckItem, units: readonly Unit[], now: Instant) {
  const transport = movement.transport;
  switch (item) {
    case "transport_booking":
      if (!transport) return "No transport was recorded.";
      return transport.cancelledAt !== undefined
        ? `Transport recorded as cancelled ${formatInstantWithDay(transport.cancelledAt, now)}. Check the provider knows.`
        : "Transport is still recorded as booked. Cancelling it is a separate step.";
    case "escort":
      return transport?.escortRequired ? "An escort was arranged with the transport." : "No escort was recorded.";
    case "pulled_bed": {
      if (cancelledMoveStillHoldsBed(movement)) {
        return "A bed is still pulled for this move. Releasing it is a separate step on this record.";
      }
      const released = movement.unwinds.findLast((unwind) => unwind.kind === "pull_released");
      return released ? `Pulled bed released ${formatInstantWithDay(released.at, now)}.` : "No bed was pulled.";
    }
    case "receiving_notice": {
      const unit = units.find((candidate) => candidate.id === movement.acceptedUnitId);
      return unit ? `${unit.name} had accepted this move.` : "No ward had accepted this move.";
    }
  }
}

/**
 * Closing the loop D1: after a move is cancelled, the arrangements to review, each marked addressed
 * or not applicable. A reminder list only. Nothing here cancels or releases anything.
 */
export function CancelledMoveChecklist({
  movement,
  units,
  now,
}: {
  movement: Movement;
  units: readonly Unit[];
  now: Instant;
}) {
  const actor = useMoveActor(movement);
  const raise = useWardRaise(actor?.role ?? "coordinator");
  const reasonId = useId();
  if (!isCancelledMove(movement)) return null;
  const open = CANCELLED_MOVE_CHECK_ITEMS.filter((item) => !cancelledMoveCheck(movement, item)).length;
  return (
    <section className={styles.panel} aria-label="Cancelled move checklist" data-testid="cancelled-move-checklist">
      <h3 className={styles.heading}>
        <StatusGlyph tone={open > 0 ? "warning" : "success"} size={8} /> Cancelled move: check linked arrangements
        <Badge tone={open > 0 ? "warning" : "success"} size="sm">
          {open > 0 ? `${open} to check` : "All checked"}
        </Badge>
      </h3>
      <p className={styles.line}>A reminder list. Marking an item cancels or releases nothing.</p>
      <ul className={styles.list}>
        {CANCELLED_MOVE_CHECK_ITEMS.map((item) => {
          const check = cancelledMoveCheck(movement, item);
          const holdsBed = item === "pulled_bed" && cancelledMoveStillHoldsBed(movement);
          return (
            <li key={item} className={styles.item} data-testid={`cancelled-move-check-${item}`}>
              <span className={styles.itemHead}>
                <strong>{CANCELLED_MOVE_CHECK_LABELS[item]}</strong>
                <span>
                  {check
                    ? `${CANCELLED_MOVE_MARK_LABELS[check.mark]} · ${check.by} · ${formatInstantWithDay(check.at, now)}`
                    : "Not checked yet"}
                </span>
              </span>
              <span className={styles.line}>{cancelledItemFact(movement, item, units, now)}</span>
              <span className={styles.actions}>
                {CANCELLED_MOVE_CHECK_MARKS.filter((mark) => mark !== check?.mark).map((mark) => {
                  const refusal = !actor
                    ? NOT_YOURS
                    : holdsBed && mark === "addressed"
                      ? "The bed is still pulled. Release it first."
                      : undefined;
                  const describedBy = refusal ? `${reasonId}-${item}-${mark}` : undefined;
                  return (
                    <span key={mark}>
                      <Button
                        size="sm"
                        variant="sec"
                        aria-disabled={refusal ? "true" : undefined}
                        aria-describedby={describedBy}
                        data-testid={`cancelled-move-mark-${item}-${mark}`}
                        onClick={() => {
                          if (refusal || !actor) return;
                          raise("MARK_CANCELLED_MOVE_CHECK", {
                            movementId: movement.id,
                            ...(actor.actingUnitId ? { actingUnitId: actor.actingUnitId } : {}),
                            item,
                            mark,
                          });
                        }}
                      >
                        {check
                          ? `Change to ${CANCELLED_MOVE_MARK_LABELS[mark].toLowerCase()}`
                          : CANCELLED_MOVE_MARK_LABELS[mark]}
                      </Button>
                      {refusal ? <DisabledReason id={describedBy!}>{refusal}</DisabledReason> : null}
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Closing the loop D2: conditions the accepting ward attached to its acceptance, who they were
 * agreed with and whether each is met. Shown apart from a plain acceptance. Placement reads none.
 */
export function AcceptanceConditionsPanel({ movement, now }: { movement: Movement; now: Instant }) {
  const actor = useMoveActor(movement);
  const raise = useWardRaise(actor?.role ?? "coordinator");
  const [kind, setKind] = useState<AcceptanceConditionKind | "">("");
  const [agreedWith, setAgreedWith] = useState<AcceptanceConditionAgreedWith | "">("");
  const [afterHours, setAfterHours] = useState("");
  const baseId = useId();
  if (movement.acceptedUnitId === undefined || movement.closure !== undefined) return null;
  const conditions = currentAcceptanceConditions(movement);
  const outstanding = conditions.filter((condition) => condition.met === undefined).length;
  const headline = acceptanceConditionsHeadline(conditions.length, outstanding);
  const unrecorded = ACCEPTANCE_CONDITION_KINDS.filter((entry) => !conditions.some((c) => c.kind === entry));
  const addRefusal = !actor
    ? NOT_YOURS
    : kind === ""
      ? "Choose a condition first."
      : agreedWith === ""
        ? "Choose who it was agreed with."
        : kind === "bed_after_time" && afterHours === ""
          ? "Choose when the bed is offered from."
          : undefined;

  return (
    <section
      className={`${styles.panel} ${outstanding > 0 ? styles.conditional : ""}`}
      aria-label="Acceptance conditions"
      data-testid="acceptance-conditions"
    >
      <h3 className={styles.heading}>
        <StatusGlyph tone={outstanding > 0 ? "warning" : headline ? "success" : "neutral"} size={8} />
        {headline ?? "Accepted with no conditions recorded"}
      </h3>
      {conditions.length > 0 ? (
        <ul className={styles.list}>
          {conditions.map((condition) => (
            <li key={condition.kind} className={styles.item} data-testid={`acceptance-condition-${condition.kind}`}>
              <span className={styles.itemHead}>
                <strong>{ACCEPTANCE_CONDITION_LABELS[condition.kind]}</strong>
                {condition.readyAt !== undefined ? (
                  <span>from {formatInstantWithDay(condition.readyAt, now)}</span>
                ) : null}
                <Badge tone={condition.met ? "success" : "warning"} size="sm">
                  {condition.met ? "Met" : "Outstanding"}
                </Badge>
              </span>
              <span className={styles.line}>
                Agreed with {ACCEPTANCE_AGREED_WITH_LABELS[condition.agreedWith]} · recorded by {condition.agreedBy}{" "}
                {formatInstantWithDay(condition.recordedAt, now)}
                {condition.met ? ` · met ${formatInstantWithDay(condition.met.at, now)} (${condition.met.by})` : ""}
              </span>
              {condition.met ? null : (
                <span className={styles.actions}>
                  <Button
                    size="sm"
                    variant="sec"
                    aria-disabled={actor ? undefined : "true"}
                    aria-describedby={actor ? undefined : `${baseId}-met-${condition.kind}`}
                    data-testid={`acceptance-condition-met-${condition.kind}`}
                    onClick={() => {
                      if (!actor) return;
                      raise("MARK_ACCEPTANCE_CONDITION_MET", {
                        movementId: movement.id,
                        ...(actor.actingUnitId ? { actingUnitId: actor.actingUnitId } : {}),
                        condition: condition.kind,
                      });
                    }}
                  >
                    Mark met
                  </Button>
                  {actor ? null : <DisabledReason id={`${baseId}-met-${condition.kind}`}>{NOT_YOURS}</DisabledReason>}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {unrecorded.length > 0 && actor ? (
        <div className={styles.form}>
          <Field label="Add a condition">
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value as AcceptanceConditionKind | "")}
              data-testid="acceptance-condition-kind"
            >
              <option value="">Choose a condition</option>
              {unrecorded.map((entry) => (
                <option key={entry} value={entry}>
                  {ACCEPTANCE_CONDITION_LABELS[entry]}
                </option>
              ))}
            </Select>
          </Field>
          {kind === "bed_after_time" ? (
            <Field label="Bed offered from">
              <Select
                value={afterHours}
                onChange={(event) => setAfterHours(event.target.value)}
                data-testid="acceptance-condition-after"
              >
                <option value="">Choose a time</option>
                {ACCEPTANCE_BED_AFTER_HOURS.map((hours) => (
                  <option key={hours} value={String(hours)}>
                    {formatInstantWithDay(now + hours * 60, now)} (in {hours} {hours === 1 ? "hour" : "hours"})
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Agreed with">
            <Select
              value={agreedWith}
              onChange={(event) => setAgreedWith(event.target.value as AcceptanceConditionAgreedWith | "")}
              data-testid="acceptance-condition-agreed-with"
            >
              <option value="">Choose who</option>
              {ACCEPTANCE_CONDITION_AGREED_WITH.map((entry) => (
                <option key={entry} value={entry}>
                  {ACCEPTANCE_AGREED_WITH_LABELS[entry]}
                </option>
              ))}
            </Select>
          </Field>
          <span className={styles.actions}>
            <Button
              size="sm"
              variant="sec"
              aria-disabled={addRefusal ? "true" : undefined}
              aria-describedby={addRefusal ? `${baseId}-add` : undefined}
              data-testid="acceptance-condition-add"
              onClick={() => {
                if (addRefusal || !actor || kind === "" || agreedWith === "") return;
                raise("RECORD_ACCEPTANCE_CONDITION", {
                  movementId: movement.id,
                  ...(actor.actingUnitId ? { actingUnitId: actor.actingUnitId } : {}),
                  condition: kind,
                  agreedWith,
                  ...(kind === "bed_after_time" ? { readyAt: now + Number(afterHours) * 60 } : {}),
                });
                setKind("");
                setAgreedWith("");
                setAfterHours("");
              }}
            >
              Record condition
            </Button>
            {addRefusal ? <DisabledReason id={`${baseId}-add`}>{addRefusal}</DisabledReason> : null}
          </span>
        </div>
      ) : null}
    </section>
  );
}
