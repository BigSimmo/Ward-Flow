"use client";

import { placeDisplayName } from "@/components/ward-management/ward-place-names";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useId, useMemo, useRef } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { wardOffersOutsideQueue } from "./home-ward-offers";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { Button, Count, StatusGlyph, cx, durMinutes } from "@/components/wf";
import { openMeetingAction } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useBedMeetingRecord } from "@/components/ward-management/bed-meeting/use-bed-meeting-done";

import styles from "./referral-page.module.css";

/** What the wards have said so far: nothing yet, or how many declined and how many are left. */
function offerStatus(movement: Movement): { text: string; tone: "warning" | "neutral" } {
  const asked = movement.referredUnitIds.length;
  const declined = movement.declines.filter((decline) => movement.referredUnitIds.includes(decline.unitId)).length;
  if (declined === 0) return { text: asked === 1 ? "Awaiting answer" : `Awaiting ${asked} answers`, tone: "neutral" };
  const left = asked - declined;
  return {
    text: left > 0 ? `${declined} declined · ${left} to answer` : `All ${declined} declined`,
    tone: "warning",
  };
}

/**
 * The ward offers sent straight from Home, as a table instead of loose lines: patient, the ward
 * asked, how long it has waited and what the wards have answered. Each row opens the movement,
 * where the answer is recorded. They wait on a ward, not on the coordinator, so they sit apart
 * from the queue and its count, as today.
 */
export function WardOffersTable({
  movements,
  referrals,
  units,
  patients,
  now,
}: {
  movements: Movement[];
  referrals: Referral[];
  units: Unit[];
  patients: Patient[];
  now: Instant;
}) {
  const offers = useMemo(() => wardOffersOutsideQueue(movements, referrals), [movements, referrals]);
  const resolverState = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const nameFor = usePatientNameDisplay();
  const titleId = useId();
  // ROLE BRANCH (ward): an offer on this desk is to this ward, so it is the ward's own to answer.
  const role = useEffectiveWardAccess().role;
  const wardDesk = role === "ward";
  // R4 (Josh, 3 Nov 2026): the coordinator can act on each offer from here. Chase puts a "Chase ward
  // answer" action, due in 2 hours, on the first ward still to answer; Manage opens the movement,
  // where an offer is withdrawn or sent to another ward.
  // Polish (Josh, 3 Nov 2026): the whole row opens the movement (the name is the link), so Chase is
  // the row's one button.
  const coordinatorDesk = role === "coordinator";
  // Chase Undo (Josh, 3 Nov 2026): the toast offers Undo, so a Chase tapped by mistake comes back.
  const recordAction = useBedMeetingRecord("coordinator");
  const chasedFocus = useRef<string | null>(null);
  if (offers.length === 0) return null;
  const wardName = (unitId: string) => placeDisplayName(unitId, units).split(" — ")[0];
  return (
    <section className={styles.offers} data-testid="ward-referral-board-ward-offers" aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.offersTitle}>
        {wardDesk ? "Offered to your ward" : "Offered to wards"} <Count n={offers.length} />
        <span className={styles.offersNote}>{wardDesk ? "Waiting on your answer" : "Waiting on a ward"}</span>
      </h2>
      <table className={styles.offersTable}>
        <thead>
          <tr>
            <th scope="col">Patient</th>
            <th scope="col">Offered to</th>
            <th scope="col">Waiting</th>
            <th scope="col">Answer</th>
            {coordinatorDesk ? (
              <th scope="col" className={styles.offerActionsHead}>
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {offers.map((movement) => {
            const who = resolveSubjectPatient(movement, resolverState);
            const status = offerStatus(movement);
            const wards = movement.referredUnitIds.map(wardName);
            const declined = new Set(movement.declines.map((decline) => decline.unitId));
            const toAnswer = movement.referredUnitIds.find((unitId) => !declined.has(unitId));
            const chased = openMeetingAction(movement.meetingActions, "chase_ward");
            return (
              <tr key={movement.id} data-testid={`ward-referral-board-ward-offer-${movement.id}`}>
                <th scope="row" className={styles.offerName}>
                  <Link href={movementHref(movement.id)} className={styles.offerLink}>
                    {nameFor(who.formalName, who.umrn)}
                  </Link>
                </th>
                <td className={styles.offerWards}>
                  {wards.join(", ")}
                  {/* Phone (Josh, 30 Oct 2026): two lines, the answer after the ward on the second. */}
                  <span className={styles.offerPhoneAnswer}>
                    {" · "}
                    {status.tone === "warning" ? <StatusGlyph tone="warning" size={8} /> : null}
                    {status.text}
                  </span>
                </td>
                <td className={cx(styles.mono, styles.offerWait)}>
                  {durMinutes(now - (movement.referredAt ?? movement.openedAt))}
                </td>
                <td className={styles.offerAnswer}>
                  <StatusGlyph tone={status.tone} size={8} /> {status.text}
                </td>
                {coordinatorDesk ? (
                  <td className={styles.offerActions}>
                    <div className={styles.offerActionRow}>
                      {chased ? (
                        <span
                          className={styles.offerChased}
                          data-testid={`ward-offer-chased-${movement.id}`}
                          // Stress test (3 Nov 2026): the Chase button goes away, so focus lands on what replaced it.
                          tabIndex={-1}
                          ref={(node) => {
                            if (node && chasedFocus.current === movement.id) {
                              chasedFocus.current = null;
                              node.focus();
                            }
                          }}
                        >
                          Chased · due {formatInstantWithDay(chased.dueAt, now)}
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={styles.offerAction}
                          aria-disabled={toAnswer === undefined ? "true" : undefined}
                          aria-label={`Chase ${toAnswer ? wardName(toAnswer) : "the ward"} for ${nameFor(who.formalName, who.umrn)}`}
                          onClick={() => {
                            if (toAnswer === undefined) return;
                            chasedFocus.current = movement.id;
                            recordAction({
                              subject: { kind: "movement", id: movement.id },
                              action: "chase_ward",
                              owner: "ward",
                              unitId: toAnswer,
                              dueAt: now + 120,
                              success: `Chased ${wardName(toAnswer)}.`,
                            });
                          }}
                          data-testid={`ward-offer-chase-${movement.id}`}
                        >
                          Chase
                        </Button>
                      )}
                      <ChevronRight className={styles.offerChevron} size={16} aria-hidden="true" />
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
