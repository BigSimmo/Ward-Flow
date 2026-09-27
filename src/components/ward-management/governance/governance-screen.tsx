"use client";

import type { ReactNode } from "react";
import { CircleSlash, Clock3, History, Users } from "lucide-react";

import {
  changeAudit,
  effectivenessNumbers,
  MINIMUM_EFFECTIVENESS_SAMPLE,
  type ChangeAuditEntry,
  type EffectivenessMeasure,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { GovernanceWorkbench } from "@/components/ward-management/governance-registers";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import type { Instant } from "@/components/ward-management/ward-clock";

import styles from "./governance.module.css";
import se from "../ward-modes-second-edition.module.css";
import governance from "../governance-third-edition.module.css";

/** Short human label for each ChangeAuditEntry kind — aligns with auditKindLabels */
const auditKindLabels: Record<ChangeAuditEntry["kind"], string> = {
  urgency: "Urgency change",
  legal_status: "Legal status change",
  pull_released: "Pull released",
  transport_cancelled: "Transport cancelled",
  stage_corrected: "Stage corrected",
  acceptance_withdrawn: "Acceptance withdrawn",
};

const auditKindWords = Object.values(auditKindLabels).map((label) => label.charAt(0).toLowerCase() + label.slice(1));
const auditKindsAnd = `${auditKindWords.slice(0, -1).join(", ")} and ${auditKindWords[auditKindWords.length - 1]}`;
const auditKindsOr = `${auditKindWords.slice(0, -1).join(", ")} or ${auditKindWords[auditKindWords.length - 1]}`;

function EffectivenessValue({
  measure,
  unit,
  basisNoun,
}: {
  measure: EffectivenessMeasure;
  unit: string;
  basisNoun: string;
}) {
  const basis = (
    <span className={se.effectivenessBasis}>
      from {measure.sampleSize} of {measure.population} {basisNoun}
    </span>
  );

  if (measure.value === undefined || measure.sampleSize < MINIMUM_EFFECTIVENESS_SAMPLE) {
    return (
      <div className={governance.effSuppressed}>
        <span className={governance.badge} data-tone="warn">
          Suppressed
        </span>
        <span data-testid="ward-governance-effectiveness-suppressed">Not enough data to compute</span>
        <span className={governance.auditDot}>·</span>
        {basis}
      </div>
    );
  }
  const rounded = Math.round(measure.value * 10) / 10;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div className={governance.effFigureRow}>
        <span className={governance.effFigure} data-testid="ward-governance-effectiveness-figure">
          {rounded}
        </span>
        <span className={governance.effUnit}>{unit}</span>
      </div>
      {basis}
    </div>
  );
}

export interface GovernanceScreenProps {
  movements?: Movement[];
  units?: Unit[];
  now?: Instant;
  children?: ReactNode;
}

/**
 * Clinical Governance & Risk Register Screen (Builder 14)
 *
 * Dedicated standalone screen providing:
 * 1. Governance Register Table & Cards:
 *    - Audit log entries, clinical risk categories, and statutory compliance status cards
 *    - Crisp borders (var(--line) and var(--line-strong) in dark mode)
 *    - Tabular numbers (font-variant-numeric: tabular-nums)
 * 2. Viewport responsiveness:
 *    - On viewports < 768px, audit table and register cards scroll and wrap cleanly without clipping
 * 3. Contrast & Design Tokens:
 *    - Strictly adheres to tests/ward-design-language-contract.test.ts (no raw hex, no bare rgb)
 */
export function GovernanceScreen(props: GovernanceScreenProps = {}) {
  const flow = useWardFlow();
  const movements = props.movements ?? flow.movements;
  const units = props.units ?? flow.units;
  const clockNow = useWardFlowClock();
  const now = props.now ?? clockNow;
  const audit = changeAudit(movements);
  const effectiveness = effectivenessNumbers(movements);

  return (
    <div className={styles.governanceScreen} data-testid="ward-governance-screen">
      <main id="main-content" className={styles.main}>
        <GovernanceWorkbench
          movements={movements}
          units={units}
          now={now}
          api={flow}
          legacyChanges={
            <section className={governance.cardPanel} data-testid="ward-governance-change-audit">
              <header className={governance.cardHead}>
                <div>
                  <h2>Change audit</h2>
                  <p>Every {auditKindsAnd}, newest first</p>
                </div>
              </header>
              <div className={governance.cardBody} style={{ padding: 0 }}>
                {audit.length > 0 ? (
                  <ol className={governance.auditList}>
                    {audit.map((entry, index) => {
                      const tone =
                        entry.kind === "urgency"
                          ? "warn"
                          : entry.kind === "legal_status"
                            ? "accent"
                            : entry.kind === "stage_corrected"
                              ? "good"
                              : "warn";
                      return (
                        <li
                          key={`${entry.movementId}-${entry.kind}-${entry.at}-${index}`}
                          className={governance.auditItem}
                        >
                          <div className={governance.auditTop}>
                            <span className={governance.auditTime}>
                              {entry.kind === "pull_released" || entry.kind === "transport_cancelled" ? (
                                <History aria-hidden="true" />
                              ) : (
                                <Clock3 aria-hidden="true" />
                              )}{" "}
                              {formatInstantWithDay(entry.at, now)}
                            </span>
                            <span className={governance.auditDot}>·</span>
                            {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                            <a href="/mockups/ward-flow/movements" className={governance.auditMovementLink}>
                              {resolveSubjectPatient(
                                movements.find((candidate) => candidate.id === entry.movementId),
                                { patients: flow.patients, referrals: flow.referrals, movements },
                              ).displayName}
                            </a>
                            <span className={governance.auditDot}>·</span>
                            <span className={governance.badge} data-tone={tone}>
                              {auditKindLabels[entry.kind]}
                            </span>
                          </div>
                          <div className={governance.auditDetailRow}>
                            <span className={governance.auditDetail}>{entry.detail}</span>
                            <span className={governance.auditBy}>· Recorded by treating team · by {entry.by}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className={governance.overrideEmptyCard} data-testid="ward-governance-change-audit-empty">
                    None — no {auditKindsOr} has been recorded yet.
                  </p>
                )}
              </div>
            </section>
          }
          effectiveness={
            <aside className={governance.effCard} data-testid="ward-governance-effectiveness">
              <header className={governance.effHead}>
                <div>
                  <h2>Effectiveness</h2>
                  <p>Network placement response and operational quality measures</p>
                </div>
              </header>
              <dl className={governance.effGrid}>
                <div className={governance.effMetric} data-testid="ward-governance-effectiveness-acceptance">
                  <dt className={governance.effLabel}>
                    <Clock3 aria-hidden="true" /> Median time, referral to a ward accepting
                  </dt>
                  <dd style={{ margin: 0 }}>
                    <EffectivenessValue
                      measure={effectiveness.medianMinutesToAcceptance}
                      unit="min"
                      basisNoun="recorded acceptances"
                    />
                  </dd>
                  <span className={governance.effFootnote}>
                    Sample volume is below the required publishing floor of 5 acceptances. Figure is withheld per
                    clinical governance standards.
                  </span>
                </div>
                <div className={governance.effMetric} data-testid="ward-governance-effectiveness-units-contacted">
                  <dt className={governance.effLabel}>
                    <Users aria-hidden="true" /> Average units contacted per patient
                  </dt>
                  <dd style={{ margin: 0 }}>
                    <EffectivenessValue
                      measure={effectiveness.averageUnitsContacted}
                      unit="units"
                      basisNoun="movements that referred at least one unit"
                    />
                  </dd>
                  <span className={governance.effFootnote}>
                    Target range 1.0 – 2.5 units · Demonstrates targeted placement without multi-ward scatter
                  </span>
                </div>
              </dl>
              <p className={governance.effNotice}>
                Both numbers describe recorded operational placement activity; does not show real-world clinical
                performance.
              </p>
              <div className={governance.effDropped} data-testid="ward-governance-dropped-measure">
                <CircleSlash aria-hidden="true" />
                <div>
                  <strong>Governance Note on Time Limits: </strong>A third proposed success measure — statutory time
                  limits passed while a patient waits — is not published here. Form expiries remain recorded and shown
                  as operational alerts; this screen defines no effectiveness metric for them.
                </div>
              </div>
            </aside>
          }
        />
        {props.children}
      </main>
    </div>
  );
}

export default GovernanceScreen;
