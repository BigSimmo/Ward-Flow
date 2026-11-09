"use client";

// Feature 12 (9 Nov 2026): a ward asks another ward to take one of its step-down candidates.
// "Send step-down request" opens the existing New referral sheet as a ward-to-ward referral
// (source psychiatric_ward, this ward sending), prefilled for that person. The send is the
// ordinary RECEIVE_REFERRAL; the engine links the stay through `originUnitId`
// (`movementSourceAdmission`). No new event, no ranking, no automatic send.

import { Send } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { openReferralSheet } from "@/components/ward-management/shell/ward-drawer-bus";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { deriveStepDownBoard, type StepDownBoardRow } from "@/components/ward-management/ward-step-down";
import styles from "./step-down-request.module.css";

/**
 * The New referral link for a step-down request: the person by id only (never a name), source
 * psychiatric_ward, to a ward. The step-down wards are preselected, in the board's own fixed
 * name order, only when they fit within the parallel referral cap; otherwise none is, and the
 * referrer chooses. Nothing is sent until the referrer confirms.
 */
export function stepDownRequestHref(patientId: string, wardUnitIds: readonly string[], cap: number): string {
  return raiseReferralHref({
    patientId,
    source: "psychiatric_ward",
    refer: "ward",
    ...(wardUnitIds.length > 0 && wardUnitIds.length <= cap ? { unitIds: wardUnitIds } : {}),
  });
}

/**
 * Whether this desk may send a step-down request for a stay on `fromUnitId`: it acts as a ward,
 * the role may raise a referral (RECEIVE_REFERRAL), and the stay is on a ward the desk holds.
 */
export function useStepDownRequestGate(fromUnitId: string | undefined) {
  const gate = useRoleGate()("RECEIVE_REFERRAL", fromUnitId);
  const routeRole = useRouteRole();
  const access = useEffectiveWardAccess();
  const ownWard = !!fromUnitId && (access.scope.kind !== "ward" || access.scope.unitIds.includes(fromUnitId));
  return { asWard: routeRole === "ward" && ownWard, gate };
}

/** One stay's step-down row, read the board's way, or undefined when it is not a candidate. */
export function useStepDownRow(admission: Admission | undefined): StepDownBoardRow | undefined {
  const { units, movements, patients } = useWardFlowSelect("units", "movements", "patients");
  const now = useWardFlowClock();
  return useMemo(() => {
    if (!admission?.stepDownCandidate) return undefined;
    return deriveStepDownBoard({ admissions: [admission], units, movements, patients, now })[0];
  }, [admission, units, movements, patients, now]);
}

/**
 * The button and the wards it offers. The ward names are listed as the board lists them, by name,
 * with their Ready figure: no ward is put first or marked as a better match.
 */
export function StepDownRequestButton({
  row,
  fullWidthClassName,
}: {
  row: StepDownBoardRow;
  /** The board detail panel's full-width button class, so it sits like its neighbours. */
  fullWidthClassName?: string;
}) {
  const { configuration, patients, movements } = useWardFlowSelect("configuration", "patients", "movements");
  const { gate } = useStepDownRequestGate(row.fromUnit.id);
  // The person through the resolver, never the stay's patient link itself (D-14).
  const patientId = resolveSubjectPatient(row.admission, { patients, movements }).patient?.id;
  const reason = !gate.allowed
    ? gate.reason
    : !patientId
      ? "No person on file for this bed, so the request cannot name them."
      : undefined;
  const wardIds = row.wards.map((ward) => ward.unit.id);
  const preselected = wardIds.length > 0 && wardIds.length <= configuration.parallelReferralCap;
  const button = (
    <Button
      variant="sec"
      size="sm"
      icon={Send}
      className={fullWidthClassName}
      disabledReason={reason}
      data-testid="step-down-request-send"
      onClick={() => {
        if (!patientId || !gate.allowed) return;
        openReferralSheet(stepDownRequestHref(patientId, wardIds, configuration.parallelReferralCap));
      }}
    >
      Send step-down request
    </Button>
  );
  const count = row.wards.length;
  return (
    <div className={styles.request} data-testid="step-down-request">
      <div className={styles.head}>
        <span className={styles.title}>Step-down</span>
        <span className={styles.summary} data-testid="step-down-request-summary">
          {count === 0
            ? "No ward fits with a Ready bed now"
            : `${count} ${count === 1 ? "ward fits" : "wards fit"} with a Ready bed`}
        </span>
      </div>
      {count === 0 ? (
        <p className={styles.note} data-testid="step-down-request-wards">
          You can still choose wards in the request.
        </p>
      ) : (
        <details className={styles.disclosure}>
          <summary>{preselected ? "Wards offered in the request, by name" : "Show wards, by name"}</summary>
          <ul
            className={styles.wards}
            data-testid="step-down-request-wards"
            aria-label="Step-down wards with a Ready bed"
          >
            {row.wards.map((ward) => (
              <li key={ward.unit.id}>
                <span className={styles.name}>{ward.unit.name}</span>
                <span className={styles.figure}>{ward.readyBeds} ready</span>
              </li>
            ))}
          </ul>
          {preselected ? null : (
            <p className={styles.note}>Choose up to {configuration.parallelReferralCap} in the request.</p>
          )}
        </details>
      )}
      {button}
    </div>
  );
}

/**
 * The board detail panel's step-down request, for a ward looking at its own candidate. Draws
 * nothing for a stay not marked for step-down, or for a desk not acting as this ward.
 */
export function WardStepDownRequest({
  admission,
  fullWidthClassName,
}: {
  admission: Admission | undefined;
  fullWidthClassName?: string;
}) {
  const row = useStepDownRow(admission);
  const { asWard } = useStepDownRequestGate(admission?.unitId);
  if (!row || !asWard) return null;
  return <StepDownRequestButton row={row} fullWidthClassName={fullWidthClassName} />;
}
