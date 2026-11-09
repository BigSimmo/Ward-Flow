"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button, Count, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { useWardRecordActors } from "@/components/ward-management/shell/ward-access";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { waitlistStands } from "@/components/ward-management/ward-waitlist";
import styles from "./ward-wait-list.module.css";

/** When the person was first asked about: the referral, else when the journey opened (as the offers table). */
function waitListSince(movement: Movement): Instant {
  return movement.referredAt ?? movement.openedAt;
}

/**
 * WARD WAIT LIST (Josh, 9 Nov 2026): the people whose wait list answer for this ward still stands,
 * oldest referral first. A neutral first-in, first-out order by the time each was asked about: it
 * scores, ranks and suggests no one, and nobody is pulled from here.
 */
export function wardWaitList(movements: readonly Movement[], unitId: string): Movement[] {
  return movements
    .filter((movement) => !movement.closure && waitlistStands(movement, unitId))
    .sort((a, b) => waitListSince(a) - waitListSince(b) || a.id.localeCompare(b.id));
}

/** The legal status as recorded on the journey, with its form code when one is recorded. */
function legalAsRecorded(movement: Movement): string {
  const status = movement.legalStatus ?? "Legal status not recorded";
  return movement.legalForm ? `${status}, Form ${movement.legalForm.code}` : status;
}

/**
 * The ward's Wait list card and its "Ready for next patient" mark. Marking ready tells the
 * coordinator, as a fact on Home; the coordinator still chooses and pulls by hand.
 */
export function WardWaitList({ unit }: { unit: Unit }) {
  const { movements, referrals, patients, dispatch, rejections } = useWardFlowSelect(
    "movements",
    "referrals",
    "patients",
    "dispatch",
    "rejections",
  );
  const now = useWardFlowClock();
  const nameFor = usePatientNameDisplay();
  const actors = useWardRecordActors();
  const actor = actors.find(
    (entry) => entry.role === "coordinator" || (entry.role === "ward" && entry.actingUnitId === unit.id),
  );
  const role = actor?.role === "ward" ? "ward" : "coordinator";
  const { run } = useUndoableStep({ dispatch, rejections, now, routeRole: role });
  const list = useMemo(() => wardWaitList(movements, unit.id), [movements, unit.id]);
  const resolverState = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const mark = (cancel: boolean) => {
    if (!actor) return;
    run(
      {
        type: "MARK_WARD_READY_FOR_NEXT",
        role,
        now,
        unitId: unit.id,
        ...(actor.role === "ward" ? { actingUnitId: actor.actingUnitId } : {}),
        ...(cancel ? { cancel: true as const } : {}),
      },
      { success: cancel ? `${unit.name} no longer marked ready.` : `${unit.name} marked ready for next patient.` },
    );
  };
  const ready = unit.isClosed ? undefined : unit.readyForNextAt;
  return (
    <section className={styles.card} aria-labelledby="ward-wait-list-heading" data-testid="ward-wait-list">
      <div className={styles.head}>
        <h2 className={styles.caps} id="ward-wait-list-heading">
          Wait list <Count n={list.length} />
        </h2>
        <span className={styles.note}>Oldest referral first</span>
        <span className={styles.readyMark} data-testid="ward-ready-for-next">
          {ready !== undefined ? (
            <>
              <span className={styles.readyLine}>
                <StatusGlyph tone="success" size={8} /> Ready for next patient since{" "}
                <b className={styles.mono}>{formatInstantWithDay(ready, now)}</b>
              </span>
              {actor ? (
                <Button variant="ghost" size="sm" onClick={() => mark(true)} data-testid="ward-ready-for-next-cancel">
                  Cancel
                </Button>
              ) : null}
            </>
          ) : actor ? (
            <Button
              variant="sec"
              size="sm"
              disabledReason={unit.isClosed ? `${unit.name} is closed to admissions.` : undefined}
              onClick={() => mark(false)}
              data-testid="ward-ready-for-next-mark"
            >
              Ready for next patient
            </Button>
          ) : null}
        </span>
      </div>
      {list.length === 0 ? (
        <p className={styles.empty}>Nobody is on this ward&rsquo;s wait list.</p>
      ) : (
        <table className={styles.table} aria-labelledby="ward-wait-list-heading">
          <thead>
            <tr>
              <th scope="col">Patient</th>
              <th scope="col">Legal status</th>
              <th scope="col" className={styles.end}>
                Waiting
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((movement) => {
              const who = resolveSubjectPatient(movement, resolverState);
              const since = waitListSince(movement);
              return (
                <tr key={movement.id} data-testid={`ward-wait-list-row-${movement.id}`}>
                  <th scope="row">
                    <Link href={movementHref(movement.id)} className={styles.name}>
                      {nameFor(who.formalName, who.umrn)}
                    </Link>
                    <span className={styles.sub}>
                      <span className={styles.mono}>{who.umrn}</span> · {movement.cohort} · {movement.security}
                    </span>
                  </th>
                  <td>{legalAsRecorded(movement)}</td>
                  <td className={styles.end}>
                    <b className={styles.mono}>{splitDuration(Math.max(0, now - since))}</b>
                    <span className={styles.sub}>since {formatInstantWithDay(since, now)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
