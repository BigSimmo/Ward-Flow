"use client"; // Source: src/components/ward-redesign/governance/governance-page.tsx (role view: access admin)

import { useMemo } from "react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import governance from "@/components/ward-management/governance-third-edition.module.css";
import modes from "@/components/ward-management/ward-management-modes.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { AsAdminGovernanceWorkbench } from "./governance-redesign";
import styles from "@/components/ward-redesign/governance/governance-redesign.module.css";

/**
 * The Governance mock-up: today's route frame (`WardModeWorkspace` and `GovernanceView` in
 * `ward-management-modes.tsx`; its header is hidden there) around the redesigned workbench, with the scoped stylesheet that lets its columns wrap.
 */
export function AsAdminGovernancePage() {
  const {
    movements,
    units,
    worldGeneration,
    readAuditEvents,
    readAuditReviews,
    readGovernanceAuditEvents,
    dispatch,
    admissions,
    bedReleases,
    rejections,
  } = useWardFlowSelect(
    "movements",
    "units",
    "worldGeneration",
    "readAuditEvents",
    "readAuditReviews",
    "readGovernanceAuditEvents",
    "dispatch",
    "admissions",
    "bedReleases",
    "rejections",
  );
  const api = useMemo(
    () => ({
      worldGeneration,
      readAuditEvents,
      readAuditReviews,
      readGovernanceAuditEvents,
      dispatch,
      admissions,
      bedReleases,
      rejections,
    }),
    [
      worldGeneration,
      readAuditEvents,
      readAuditReviews,
      readGovernanceAuditEvents,
      dispatch,
      admissions,
      bedReleases,
      rejections,
    ],
  );
  const now = useWardFlowClock();
  return (
    <div
      className={`${modes.modeShell} ${modes.thirdEditionModeShell}`}
      data-testid="ward-mode-governance"
      data-ward-design="third-edition"
    >
      <main id="main-content" className={modes.modeContent}>
        <h1 className="sr-only">Governance</h1>
        <div className={`${governance.governanceRoute} ${styles.governance}`} data-testid="ward-governance-view">
          <AsAdminGovernanceWorkbench movements={movements} units={units} now={now} api={api} />
          <details className={governance.srOnly} data-testid="ward-governance-medical-device-notice">
            <summary tabIndex={-1}>Synthetic prototype · not approved for clinical use</summary>
            <p data-ward-type-floor="banner">
              This screen is <strong>not approved for clinical use</strong>. It orders operational placement work only —
              it never assesses a patient&apos;s risk, acuity or treatment. A human coordinator confirms or overrides
              every suggestion.
            </p>
            <p data-testid="ward-governance-data-scope">
              Patient identity and operational facts are recorded, including patient-linked discharge records. No
              diagnosis, medication or narrative history is held.
            </p>
            <p data-testid="ward-governance-audit-limit">
              The system&apos;s recommendations and the bed state shown at decision time are not recorded.
            </p>
          </details>
        </div>
        <WardPrototypeFooter testId="ward-mode-governance-disclosure" />
      </main>
    </div>
  );
}
