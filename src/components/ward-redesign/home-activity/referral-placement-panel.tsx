"use client";

import Link from "next/link";

import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { formatElapsed, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { referralSuburbLabel } from "@/components/ward-management/ward-referrals";
import { Fact } from "@/components/ward-management/coordinator/shortlist-panel-parts";
import styles from "@/components/ward-management/coordinator/coordinator.module.css";
import shortlistStyles from "@/components/ward-management/coordinator/shortlist-panel.module.css";
import { buttonClass } from "@/components/wf";

import redesign from "./home-redesign.module.css";

/**
 * Redesign fork of `ReferralPlacementPanel` (ward-management/coordinator/shortlist-panel.tsx), the
 * read-only preview Home's Referral placement panel shows for a chosen referral. The only change
 * from the real panel is the Decide button's style (see below); everything else is copied as is.
 *
 * Final design check (31 Oct 2026): Decide used the coordinator's own `shortlistConfirmButton`,
 * which reads the old `--accent` token: pale blue with dark text in dark mode and navy in light.
 * It now uses the kit's shared primary button (`buttonClass({ variant: "pri" })`), the same as
 * every other page's one filled action, in both themes. It keeps the panel's touch height.
 */
export function ReferralPlacementPanel({ referral, now }: { referral: Referral; now: Instant }) {
  const waitingLabel = formatElapsed(Math.max(now - referral.raisedAt, 0));
  const { patients, referrals, movements } = useWardFlowSelect("patients", "referrals", "movements");
  const patientInfo = resolveSubjectPatient(referral, { patients, referrals, movements });
  const patientLabel = patientInfo.patient ? patientInfo.formalName : "Not recorded";

  return (
    <div
      className={`${styles.shortlistBody} ${shortlistStyles.body}`}
      data-testid={`ward-referral-placement-${referral.id}`}
    >
      <header className={`${styles.shortlistHeader} ${shortlistStyles.subjectHeader}`}>
        <div className={styles.shortlistHeaderTop}>
          <h3 className={`${styles.shortlistMovementId} ${shortlistStyles.subjectId}`}>
            <small>Referral</small>
            {patientInfo.umrn}
          </h3>
          <span className={`${styles.shortlistTierBadge} ${shortlistStyles.tierBadge}`} data-tier={referral.urgency}>
            {urgencyTierLabel(referral.urgency)}
          </span>
        </div>
        <dl className={shortlistStyles.factGrid}>
          <Fact label="Patient" value={patientLabel} testId="ward-referral-placement-patient" />
          <Fact label="Profile" value={`${referral.ageBand} · ${referral.homeRegion}`} />
          {/* Owner ruling, 2026-09-02: a suburb is a service area, never an address (`PD-3`). */}
          <Fact label="Suburb" value={referralSuburbLabel(referral.suburb)} testId="ward-referral-placement-suburb" />
          <Fact label="Waiting" value={waitingLabel} />
        </dl>
        {/* WS-04 (workflow speed audit, 26 Oct 2026): Decide opens the referral on the Referrals
            board, where Accept and Decline live. */}
        <div className={styles.shortlistActionRow}>
          <Link
            href={referralBoardHref(referral.id)}
            // REDESIGN: the shared primary button in place of `shortlistConfirmButton`.
            className={buttonClass({
              variant: "pri",
              className: `${shortlistStyles.allocationButtonTouch} ${redesign.decide}`,
            })}
            aria-label={`Decide referral for ${patientLabel}`}
            data-testid="ward-referral-placement-decide"
          >
            Decide
          </Link>
        </div>
      </header>
      <details className={shortlistStyles.infoDisclosure}>
        <summary>About this referral</summary>
        <p className={styles.placeholder}>
          This is a request for a bed, not yet a movement — no ward is pointed at it, and it carries no stage and no
          legal clock of its own.
        </p>
      </details>
    </div>
  );
}
