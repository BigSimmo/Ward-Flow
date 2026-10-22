import dynamic from "next/dynamic";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Button, durMinutes } from "@/components/wf";
import { patientFitLine, type ReferralFit } from "./ward-referral-fit";
import styles from "./ward-home-tab.module.css";

// The full referral loads when a ward opens it, so its sections and the seeded referral details
// stay out of the ward page's first script.
export const WardReferralDetailDrawer = dynamic(
  () => import("./ward-referral-detail").then((module) => module.WardReferralDetailDrawer),
  { ssr: false, loading: () => null },
);

/**
 * Who is coming, on the overview's incoming card. Josh, 22 Oct 2026: a ward sees the patient's name
 * and UMRN before it answers, and the name opens the full referral. Never where else the patient was
 * referred (FD-23), and never the WF journey number.
 */
export function AwaitingIdentity({
  movement,
  person,
  now,
  onOpen,
}: {
  movement: Movement;
  person: ResolvedPatientInfo;
  now: Instant;
  onOpen: () => void;
}) {
  const originName = edById(movement.originEdId)?.name;
  return (
    <div className={styles.awaitingIdentity}>
      <span className={styles.awaitingTier} title={`Tier ${movement.urgency}`} aria-hidden="true">
        {movement.urgency}
      </span>
      <button
        type="button"
        className={styles.awaitingNameButton}
        data-testid={`ward-incoming-open-${movement.id}`}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        {person.displayName}
        <span className={styles.awaitingNameHint}>View referral</span>
      </button>
      <span className={styles.awaitingMeta}>
        {[person.umrn, movement.sex, movement.legalStatus, `Tier ${movement.urgency}`].filter(Boolean).join(" · ")}
      </span>
      <span
        className={`${styles.awaitingMeta} ${styles.awaitingSummary}`}
        data-testid={`ward-incoming-summary-${movement.id}`}
      >
        {[
          movement.cohort,
          `${movement.security} ward`,
          `Waiting ${durMinutes(Math.max(0, now - movement.openedAt))}`,
          originName ? `Now at ${originName}` : undefined,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );
}

/**
 * The patient's fit and the ward's own state as two lines, so a stale bed count no longer reads as
 * the patient failing a placement check (Josh's screenshot, 22 Oct 2026).
 */
export function AwaitingFitLines({
  movementId,
  fit,
  wardLine,
  onUpdateBeds,
}: {
  movementId: string;
  fit: ReferralFit;
  wardLine: string | undefined;
  onUpdateBeds?: () => void;
}) {
  const issue = fit.patientIssues.length > 0 || wardLine !== undefined;
  return (
    <div
      className={styles.fitLines}
      data-testid={issue ? `ward-eligibility-warning-${movementId}` : `ward-fit-${movementId}`}
      data-level={fit.patientIssues.length > 0 ? "ineligible" : issue ? "ward" : "fits"}
    >
      <span className={styles.fitLine}>
        <span
          className={`${styles.fitDot} ${fit.patientIssues.length === 0 ? styles.fitDotOk : styles.fitDotWarn}`}
          aria-hidden="true"
        />
        <span>{patientFitLine(fit)}</span>
      </span>
      {wardLine ? (
        <span className={styles.fitLine}>
          <span className={`${styles.fitDot} ${styles.fitDotWarn}`} aria-hidden="true" />
          <span>
            {wardLine}{" "}
            {fit.wardIssues.some((ward) => ward.gate === "capacity_freshness") && onUpdateBeds ? (
              <button type="button" className={styles.fitLink} onClick={onUpdateBeds}>
                Update beds
              </button>
            ) : null}
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** The referral sheet's own Decline and Accept in principle, which act exactly as the card's do. */
export function ReferralDetailFooter({
  movementId,
  blocked,
  onDecline,
  onAccept,
}: {
  movementId: string;
  blocked: string | undefined;
  onDecline: () => void;
  onAccept: () => void;
}) {
  return (
    <div className={styles.awaitingActions}>
      <Button
        variant="sec"
        size="md"
        disabledReason={blocked}
        reasonDisplay="tooltip"
        type="button"
        data-testid={`ward-referral-detail-decline-${movementId}`}
        onClick={blocked ? ignoreUnavailableActivation : onDecline}
      >
        Decline
      </Button>
      <Button
        variant="pri"
        size="md"
        disabledReason={blocked}
        reasonDisplay="tooltip"
        type="button"
        data-testid={`ward-referral-detail-accept-${movementId}`}
        onClick={blocked ? ignoreUnavailableActivation : onAccept}
      >
        Accept in principle
      </Button>
    </div>
  );
}
