"use client";

// New for the role view (as ED clinician): the open journeys this ED raised, shown on Referrals.
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { edReferralStatus, edStageLabel } from "@/components/ward-management/ed/ed-referral-status";
import { openWardReferralFor, referredToLabel } from "@/components/ward-management/ed/ed-bed-search-step";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { Card, Count, StatusGlyph, TierTile, buttonClass, durMinutes } from "@/components/wf";

import styles from "./as-ed-raised-section.module.css";

/** Rows shown before "Show more" (owner rule: long lists open on the first rows). */
const FIRST_ROWS = 8;

const TONE = { good: "success", warn: "warning", danger: "danger", quiet: "neutral" } as const;

/**
 * Role view (as ED clinician): what this ED has asked for and where each request stands, in the
 * ED board's own words (`edReferralStatus`). Each row opens the journey, where the steps are
 * recorded. The coordinator places people; this list only reads.
 */
export function AsEdRaisedSection({
  raised,
  departmentName,
  movements,
  referrals,
  units,
  patients,
  holdLabel,
  now,
}: {
  raised: Movement[];
  departmentName: string;
  movements: Movement[];
  referrals: Referral[];
  units: Unit[];
  patients: Patient[];
  holdLabel: string;
  now: Instant;
}) {
  const titleId = useId();
  const nameFor = usePatientNameDisplay();
  const [showAll, setShowAll] = useState(false);
  const resolverState = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const unitName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name;
  const shown = showAll ? raised : raised.slice(0, FIRST_ROWS);
  return (
    <Card className={styles.card} data-testid="as-ed-raised">
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>
          Raised from {departmentName} <Count n={raised.length} />
          <span className={styles.note}>Longest first</span>
        </h2>
        {raised.length === 0 ? (
          <p className={styles.empty}>Nothing raised from this ED is open.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Patient</th>
                <th scope="col">Since referral</th>
                <th scope="col">Where it stands</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((movement) => {
                const who = resolveSubjectPatient(movement, resolverState);
                const wardReferral = openWardReferralFor(who.patient?.id, referrals);
                const status = edReferralStatus(movement, {
                  acceptedUnitName: movement.acceptedUnitId ? unitName(movement.acceptedUnitId) : undefined,
                  fallback: edStageLabel(movement.stage),
                  referredTo: wardReferral ? referredToLabel(wardReferral.unitIds, unitName) : undefined,
                  holdLabel,
                  now,
                });
                return (
                  <tr key={movement.id} data-testid={`as-ed-raised-${movement.id}`}>
                    <td className={styles.tier}>
                      <TierTile tier={movement.urgency} />
                    </td>
                    <th scope="row" className={styles.who}>
                      <span className={styles.name}>{nameFor(who.formalName, who.umrn)}</span>
                      <span className={styles.umrn}>{who.umrn}</span>
                    </th>
                    <td className={styles.mono}>
                      {durMinutes(Math.max(now - (movement.referredAt ?? movement.openedAt), 0))}
                    </td>
                    <td className={styles.status}>
                      <span className={styles.statusTitle}>
                        <StatusGlyph tone={TONE[status.tone]} size={8} /> {status.title}
                      </span>
                      {status.line ? <span className={styles.statusLine}>{status.line}</span> : null}
                    </td>
                    <td className={styles.open}>
                      <Link
                        href={movementHref(movement.id)}
                        className={buttonClass({ variant: "sec", size: "sm", className: styles.openLink })}
                      >
                        Journey
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {raised.length > FIRST_ROWS ? (
          <button type="button" className={styles.more} onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Show fewer" : `Show ${raised.length - FIRST_ROWS} more`}
          </button>
        ) : null}
      </section>
    </Card>
  );
}
