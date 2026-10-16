"use client";

import Link from "next/link";
import { useId, useMemo } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { Count, durMinutes } from "@/components/wf";
import { wardOffersOutsideQueue } from "./home-ward-offers";
import styles from "./referrals.module.css";
import o from "./ward-offers-section.module.css";
import { movementHref } from "@/components/ward-management/shell/ward-facade";

/**
 * S-8 (audit 13 Oct 2026): the ward offers sent straight from Home, listed once below the queue.
 * Each row opens the movement, where the ward's answer is recorded. These wait on a ward, not on
 * the coordinator, so they sit apart from the "awaiting decision" queue and its count.
 */
export function WardOffersSection({
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
  const baseId = useId();
  if (offers.length === 0) return null;
  const wardName = (unitId: string) => (units.find((unit) => unit.id === unitId)?.name ?? unitId).split(" — ")[0];
  return (
    <section
      className={`${styles.v6Section} ${o.section}`}
      data-testid="ward-referral-board-ward-offers"
      aria-labelledby={`${baseId}-ward-referral-board-ward-offers-title`}
    >
      <h2 id={`${baseId}-ward-referral-board-ward-offers-title`} className={`${styles.v6Eyebrow} ${o.title}`}>
        Offered to wards <Count n={offers.length} />
      </h2>
      <ul className={o.list}>
        {offers.map((movement) => {
          const who = resolveSubjectPatient(movement, resolverState);
          const referredAt = movement.referredAt;
          return (
            <li key={movement.id} data-testid={`ward-referral-board-ward-offer-${movement.id}`}>
              <Link href={movementHref(movement.id)} className={o.row}>
                <strong>{nameFor(who.displayName, who.umrn)}</strong>
                <span className={o.meta}>
                  Offered to{" "}
                  {movement.referredUnitIds.length === 1
                    ? wardName(movement.referredUnitIds[0]!)
                    : `${movement.referredUnitIds.length} wards`}
                </span>
                {referredAt !== undefined ? (
                  <span className={o.meta}>· {durMinutes(now - referredAt)} waiting</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
