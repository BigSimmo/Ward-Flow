"use client";
// Referrals redesign: ReferralAlerts copied from src/components/ward-management/referrals/referral-board-parts.tsx
// (30 October 2026). Changed: a legal status recorded as "Not recorded" says what is missing
// ("Legal status not recorded"); it stays shown, as a missing legal status matters for placement.

import type { ReactNode } from "react";

import type { Referral } from "@/components/ward-management/ward-model";
import { StatusGlyph, cx } from "@/components/wf";
import styles from "./referral-board.module.css";

export function ReferralAlerts({
  referral,
  readmission,
  hideLegal = false,
}: {
  referral: Referral;
  readmission: ReactNode;
  /** Round 4: the Referrals panel shows the legal status once, in its facts, so the chip steps out. */
  hideLegal?: boolean;
}) {
  const intake = referral.intake;
  const risks = intake?.riskFlags ?? [];
  const legal = intake?.legalStatus?.trim();
  const showLegal = !hideLegal && legal !== undefined && legal !== "" && !/^voluntary/i.test(legal);
  if (risks.length === 0 && !readmission && !showLegal) return null;
  return (
    <div className={styles.alerts} aria-label="Alerts" role="group">
      {risks.map((risk) => (
        <span key={risk} className={styles.alert}>
          <StatusGlyph tone="warning" size={9} />
          {risk.charAt(0).toUpperCase() + risk.slice(1)} risk
        </span>
      ))}
      {readmission}
      {showLegal ? (
        <span className={cx(styles.alert, styles.alertQuiet)}>
          {/^not recorded$/i.test(legal) ? "Legal status not recorded" : legal}
        </span>
      ) : null}
    </div>
  );
}
