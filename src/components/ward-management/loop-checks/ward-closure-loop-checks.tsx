"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Badge, Button, DisabledReason, Field, Select, StatusGlyph } from "@/components/wf";

import { movementHref, unitHref } from "../shell/ward-facade";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { WardRecordActor } from "../ward-discharge-records";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { Unit } from "../ward-model";
import {
  RESTRICTION_REVIEW_AFTER_HOURS,
  RESTRICTION_REVIEWER_ROLES,
  activeWardRestrictions,
  closureTransitionItems,
  closureTransitionMark,
  currentRestrictionReview,
  restrictionReviewOverdue,
  type ClosureTransitionItem,
  type RestrictionReviewerRole,
  type WardRestrictionKind,
} from "./ward-loop-checks";
import {
  CLOSURE_TRANSITION_LABELS,
  RESTRICTION_REVIEWER_LABELS,
  WARD_RESTRICTION_LABELS,
} from "./ward-loop-checks-view";
import styles from "./loop-checks.module.css";

type UnitActor = { role: "ward" | "bed_manager" | "coordinator"; actingUnitId?: string };

/** The ward for itself, its site bed manager or the coordinator, as for the closure itself. */
function unitActor(actor: WardRecordActor, unit: Unit): UnitActor | undefined {
  if (actor.role === "coordinator" || actor.role === "bed_manager") return { role: actor.role };
  if (actor.role === "ward" && actor.actingUnitId === unit.id) return { role: "ward", actingUnitId: unit.id };
  return undefined;
}

const NOT_YOURS = "Only this ward, its site bed manager or the coordinator can record this.";

/**
 * Closing the loop D3: a named reviewer (a role) and a review time for each temporary restriction on
 * this ward. "Review overdue" is read from the recorded time. A reminder only: nothing lapses or
 * lifts by itself, and the restriction stays until a person changes it.
 */
export function WardRestrictionReviews({ unit, now, actor }: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  const restrictions = activeWardRestrictions(unit);
  if (restrictions.length === 0) return null;
  return (
    <section
      className={styles.panel}
      aria-label={`${unit.name} restriction reviews`}
      data-testid="ward-restriction-reviews"
    >
      <h3 className={styles.heading}>Restriction reviews</h3>
      <ul className={styles.list}>
        {restrictions.map((restriction) => (
          <RestrictionReviewRow key={restriction} unit={unit} restriction={restriction} now={now} actor={actor} />
        ))}
      </ul>
      <p className={styles.line}>A review time is a reminder. Nothing is lifted until a person changes it.</p>
    </section>
  );
}

function RestrictionReviewRow({
  unit,
  restriction,
  now,
  actor,
}: {
  unit: Unit;
  restriction: WardRestrictionKind;
  now: Instant;
  actor: WardRecordActor;
}) {
  const review = currentRestrictionReview(unit, restriction);
  const overdue = review ? restrictionReviewOverdue(review, now) : false;
  const [editing, setEditing] = useState(false);
  const [reviewer, setReviewer] = useState<RestrictionReviewerRole | "">("");
  const [afterHours, setAfterHours] = useState("");
  const baseId = useId();
  const who = unitActor(actor, unit);
  const raise = useWardRaise(who?.role ?? "coordinator");
  const refusal = !who
    ? NOT_YOURS
    : reviewer === ""
      ? "Choose who reviews it."
      : afterHours === ""
        ? "Choose when it is reviewed."
        : undefined;

  return (
    <li className={styles.item} data-testid={`ward-restriction-review-${restriction}`}>
      <span className={styles.itemHead}>
        <strong>{WARD_RESTRICTION_LABELS[restriction]}</strong>
        {review ? (
          <Badge tone={overdue ? "danger" : "info"} size="sm">
            {overdue ? "Review overdue" : "Review set"}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            No review set
          </Badge>
        )}
      </span>
      {review ? (
        <span className={overdue ? styles.overdue : styles.line} role={overdue ? "status" : undefined}>
          {overdue ? <StatusGlyph tone="danger" size={8} /> : null} Review by{" "}
          {RESTRICTION_REVIEWER_LABELS[review.reviewer]} {overdue ? "was due" : "due"}{" "}
          {formatInstantWithDay(review.expectedAt, now)} · set by {review.by}
        </span>
      ) : null}
      {editing ? (
        <div className={styles.form}>
          <Field label="Reviewer">
            <Select
              value={reviewer}
              onChange={(event) => setReviewer(event.target.value as RestrictionReviewerRole | "")}
              data-testid={`ward-restriction-reviewer-${restriction}`}
            >
              <option value="">Choose a role</option>
              {RESTRICTION_REVIEWER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {RESTRICTION_REVIEWER_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Review by">
            <Select
              value={afterHours}
              onChange={(event) => setAfterHours(event.target.value)}
              data-testid={`ward-restriction-review-after-${restriction}`}
            >
              <option value="">Choose a time</option>
              {RESTRICTION_REVIEW_AFTER_HOURS.map((hours) => (
                <option key={hours} value={String(hours)}>
                  {formatInstantWithDay(now + hours * 60, now)} (in {hours} hours)
                </option>
              ))}
            </Select>
          </Field>
          <span className={styles.actions}>
            <Button
              size="sm"
              variant="sec"
              aria-disabled={refusal ? "true" : undefined}
              aria-describedby={refusal ? `${baseId}-save` : undefined}
              data-testid={`ward-restriction-review-save-${restriction}`}
              onClick={() => {
                if (refusal || !who || reviewer === "") return;
                raise("RECORD_RESTRICTION_REVIEW", {
                  unitId: unit.id,
                  ...(who.actingUnitId ? { actingUnitId: who.actingUnitId } : {}),
                  restriction,
                  reviewer,
                  expectedAt: now + Number(afterHours) * 60,
                });
                setEditing(false);
                setReviewer("");
                setAfterHours("");
              }}
            >
              Save review
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {refusal ? <DisabledReason id={`${baseId}-save`}>{refusal}</DisabledReason> : null}
          </span>
        </div>
      ) : (
        <span className={styles.actions}>
          <Button
            size="sm"
            variant="sec"
            aria-disabled={who ? undefined : "true"}
            aria-describedby={who ? undefined : `${baseId}-open`}
            data-testid={`ward-restriction-review-open-${restriction}`}
            onClick={() => {
              if (who) setEditing(true);
            }}
          >
            {review ? "Change review" : "Set a review"}
          </Button>
          {who ? null : <DisabledReason id={`${baseId}-open`}>{NOT_YOURS}</DisabledReason>}
        </span>
      )}
    </li>
  );
}

function itemHref(unit: Unit, item: ClosureTransitionItem): string | undefined {
  if (item.kind === "referral") return unitHref(unit.id);
  if (item.kind === "booked_arrival") return undefined;
  return movementHref(item.recordId);
}

/**
 * Closing the loop D4: what still points at the closed ward, each linked to its record and marked
 * dealt with by a person. It never moves, cancels or reassigns anything, never names another ward,
 * and never releases a pulled bed: each item is handled on its own record.
 */
export function ClosureTransitionChecklist({ unit, now, actor }: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  const selected = useWardFlowSelect("movements", "referrals", "plannedAdmissions");
  const { movements, referrals } = selected;
  const plannedAdmissions = selected.plannedAdmissions ?? [];
  const who = unitActor(actor, unit);
  const raise = useWardRaise(who?.role ?? "coordinator");
  const baseId = useId();
  const items = closureTransitionItems(unit, movements, referrals, plannedAdmissions);
  if (items.length === 0) return <p className={styles.line}>Nothing else is pointed at this ward.</p>;
  const open = items.filter((item) => !closureTransitionMark(unit, item)).length;
  return (
    <div className={styles.form} data-testid="ward-closure-transition">
      <p className={styles.heading}>
        Still pointed at this ward ({items.length})
        <Badge tone={open > 0 ? "warning" : "success"} size="sm">
          {open > 0 ? `${open} to deal with` : "All dealt with"}
        </Badge>
      </p>
      <p className={styles.line}>
        Reassign or cancel each one on its own record. This list moves nothing and picks no other ward.
      </p>
      <ul className={styles.list}>
        {/* Audit 1: no internal journey numbers and no names on a ward panel, so each item is
            numbered in this list only. */}
        {items.map((item, index) => {
          const mark = closureTransitionMark(unit, item);
          const href = itemHref(unit, item);
          const label = `${CLOSURE_TRANSITION_LABELS[item.kind]} ${index + 1}`;
          const booking =
            item.kind === "booked_arrival" ? plannedAdmissions.find((entry) => entry.id === item.recordId) : undefined;
          return (
            <li
              key={`${item.kind}-${item.recordId}`}
              className={styles.item}
              data-testid={`ward-closure-item-${index}`}
            >
              <span className={styles.itemHead}>
                {href ? <Link href={href}>{label}</Link> : <strong>{label}</strong>}
                {booking ? <span>expected {formatInstantWithDay(booking.expectedArrivalAt, now)}</span> : null}
                {booking ? <span className={styles.line}>(in Planned admissions)</span> : null}
              </span>
              {mark ? (
                <span className={styles.line}>
                  <StatusGlyph tone="success" size={8} /> Dealt with · {mark.by} · {formatInstantWithDay(mark.at, now)}
                </span>
              ) : (
                <span className={styles.actions}>
                  <Button
                    size="sm"
                    variant="sec"
                    aria-disabled={who ? undefined : "true"}
                    aria-describedby={who ? undefined : `${baseId}-${index}`}
                    data-testid={`ward-closure-item-done-${index}`}
                    onClick={() => {
                      if (!who) return;
                      raise("MARK_CLOSURE_TRANSITION_ITEM", {
                        unitId: unit.id,
                        ...(who.actingUnitId ? { actingUnitId: who.actingUnitId } : {}),
                        item: item.kind,
                        ...(item.kind === "referral"
                          ? { referralId: item.recordId }
                          : item.kind === "booked_arrival"
                            ? { plannedAdmissionId: item.recordId }
                            : { movementId: item.recordId }),
                      });
                    }}
                  >
                    Mark dealt with
                  </Button>
                  {who ? null : <DisabledReason id={`${baseId}-${index}`}>{NOT_YOURS}</DisabledReason>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
