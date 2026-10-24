"use client";

import { useId } from "react";
import Link from "next/link";

import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { commitmentsDueBy, promiseOverdue } from "@/components/ward-management/referrals/referral-commitments-model";
import { referralCommitmentStepLabel } from "@/components/ward-management/referrals/referral-commitments";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";

import styles from "./handover-open-promises.module.css";

/** One shift after the chosen handover: the window the next coordinator inherits. */
export const NEXT_SHIFT_MINUTES = 8 * 60;

/**
 * OPEN PROMISES CARRIED OVER AT HANDOVER (closing-the-loop package A, 24 Oct 2026). Response
 * commitments still open whose promised time or next callback is already past or falls before the
 * end of the next shift, each linked to its referral, so the incoming coordinator inherits them.
 * Read only, in recorded order, and nothing is ranked. Renders nothing when none is due.
 */
export function HandoverOpenPromises({
  referrals,
  units,
  now,
  handoverAt,
}: {
  referrals: readonly Referral[];
  units: readonly Unit[];
  now: Instant;
  /** The chosen handover's time. The window runs to one shift after it. */
  handoverAt: Instant;
}) {
  const baseId = useId();
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const until = Math.max(handoverAt, now) + NEXT_SHIFT_MINUTES;
  const items = commitmentsDueBy(referrals, until);
  if (items.length === 0) return null;
  const wardName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";
  return (
    <section className={styles.panel} aria-labelledby={`${baseId}-heading`} data-testid="ward-handover-open-promises">
      <h2 id={`${baseId}-heading`} className={styles.heading}>
        Open promises and callbacks to carry over ({items.length})
      </h2>
      <p className={styles.note}>Overdue, or due before {formatInstantWithDay(until, now)}. Recorded order.</p>
      <ul className={styles.list}>
        {items.map((item) => {
          const who = patientOf(item.referral);
          const overdue = promiseOverdue(item.status, now);
          const callback = item.status.nextCallbackAt;
          return (
            <li key={`${item.referral.id}-${item.unitId}`} data-testid={`ward-handover-promise-${item.referral.id}`}>
              <Link href={referralBoardHref(item.referral.id)} className={styles.link}>
                {nameFor(who.formalName, who.umrn)}
              </Link>{" "}
              <span>{wardName(item.unitId)}</span>
              <span className={styles.note}>
                {" "}
                · {item.status.step ? referralCommitmentStepLabel(item.status.step.step) : "No step recorded"}
                {item.status.promisedFor !== undefined
                  ? ` · promised by ${formatInstantWithDay(item.status.promisedFor, now)}`
                  : ""}
                {callback ? ` · next callback ${formatInstantWithDay(callback.at, now)}` : ""}
              </span>
              {overdue ? <span className={styles.overdue}> · Promise overdue</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
