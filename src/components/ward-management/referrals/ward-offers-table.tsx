"use client";

import Link from "next/link";
import { useId, useMemo } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { wardOffersOutsideQueue } from "./home-ward-offers";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { Count, StatusGlyph, cx, durMinutes } from "@/components/wf";

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
  const wardDesk = useEffectiveWardAccess().role === "ward";
  if (offers.length === 0) return null;
  const wardName = (unitId: string) => (units.find((unit) => unit.id === unitId)?.name ?? unitId).split(" — ")[0];
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
          </tr>
        </thead>
        <tbody>
          {offers.map((movement) => {
            const who = resolveSubjectPatient(movement, resolverState);
            const status = offerStatus(movement);
            const wards = movement.referredUnitIds.map(wardName);
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
