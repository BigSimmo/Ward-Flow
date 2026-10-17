"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/wf";
import { NotWiredButton } from "@/components/ward-management/not-wired-button";
import { REFERRAL_CAP_REASONS, type ReferralCapReason } from "@/components/ward-management/ward-change-reasons";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { deriveStepDownBoard } from "@/components/ward-management/ward-step-down";
import styles from "./step-down-board.module.css";

/**
 * Top 25 item 8 (`top25-step-down-board`) and item 16 (`top25-step-down-swap`): each step-down
 * candidate with the wards that pass the main eligibility gates and have a Ready bed now, plus
 * incoming movements that fit `fromUnit` once the step-down bed opens.
 */
export function StepDownBoard({ now }: { now: Instant }) {
  const { admissions, units, movements, patients, referrals, dispatch, configuration } = useWardFlowSelect(
    "admissions",
    "units",
    "movements",
    "patients",
    "referrals",
    "dispatch",
    "configuration",
  );
  const patientOf = usePatientOf();
  const stepDownSwapEnabled = useWardFeatureFlag("top25-step-down-swap");
  // Item 2's cap warns and asks for a reason, never blocks: one reason per stay at the limit.
  const [capReasons, setCapReasons] = useState<Record<string, ReferralCapReason | "">>({});
  const rows = useMemo(
    () => deriveStepDownBoard({ admissions, units, movements, patients, referrals, now }),
    [admissions, units, movements, patients, referrals, now],
  );

  return (
    <WardPanel title="Step down board" count={`${rows.length} ${rows.length === 1 ? "patient" : "patients"}`}>
      <div data-testid="capacity-step-down-board">
        {rows.length === 0 ? (
          <p className={styles.absent}>No patient is marked for step down.</p>
        ) : (
          <ul className={styles.list}>
            {rows.map((row) => {
              const primaryStepDownWard = row.wards[0]?.unit;
              return (
                <li key={row.admission.id} className={styles.row} data-testid="step-down-row">
                  <p className={styles.who}>
                    {patientOf(row.admission).displayName} <span className={styles.meta}>on {row.fromUnit.name}</span>
                  </p>
                  {row.transferMovement &&
                  row.transferMovement.referredUnitIds.length >= configuration.parallelReferralCap ? (
                    <label className={styles.capReason} data-testid="step-down-cap-reason">
                      <span>
                        {row.transferMovement.referredUnitIds.length} wards are already asked, the usual limit is{" "}
                        {configuration.parallelReferralCap}. Choose a reason to ask another.
                      </span>
                      <select
                        value={capReasons[row.admission.id] ?? ""}
                        onChange={(e) => {
                          const value = e.target.value as ReferralCapReason | "";
                          setCapReasons((previous) => ({ ...previous, [row.admission.id]: value }));
                        }}
                      >
                        <option value="">Choose reason</option>
                        {REFERRAL_CAP_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {row.wards.length === 0 ? (
                    <p className={styles.absent}>No ward passes every check with a Ready bed now.</p>
                  ) : (
                    <ul className={styles.wards} aria-label="Wards that fit with a Ready bed">
                      {row.wards.map((ward) => (
                        <li key={ward.unit.id} className={styles.ward}>
                          {ward.unit.name}, {ward.readyBeds} ready
                          {row.transferMovement ? (
                            <Button
                              size="sm"
                              variant="sec"
                              disabled={row.transferMovement.referredUnitIds.includes(ward.unit.id)}
                              // At the limit Refer waits for a reason, then sends it with the refer.
                              disabledReason={
                                !row.transferMovement.referredUnitIds.includes(ward.unit.id) &&
                                row.transferMovement.referredUnitIds.length >= configuration.parallelReferralCap &&
                                !capReasons[row.admission.id]
                                  ? "Choose a reason above to ask more wards than the usual limit."
                                  : undefined
                              }
                              onClick={() => {
                                const movement = row.transferMovement;
                                if (!movement) return;
                                dispatch({
                                  type: "REFER_TO_UNITS",
                                  role: "coordinator",
                                  now,
                                  movementId: movement.id,
                                  unitIds: [ward.unit.id],
                                  ...(movement.referredUnitIds.length >= configuration.parallelReferralCap &&
                                  capReasons[row.admission.id]
                                    ? { overCapReason: capReasons[row.admission.id] as ReferralCapReason }
                                    : {}),
                                });
                              }}
                            >
                              {row.transferMovement.referredUnitIds.includes(ward.unit.id) ? "Referred" : "Refer"}
                            </Button>
                          ) : (
                            <NotWiredButton size="sm" variant="sec" label="Pull" name={`Pull to ${ward.unit.name}`} />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {stepDownSwapEnabled && primaryStepDownWard && row.swapCandidates.length > 0 ? (
                    <div className={styles.swapSection} data-testid="step-down-swap-candidates">
                      <p className={styles.meta}>
                        Incoming referrals that fit {row.fromUnit.name} once this bed opens (via{" "}
                        {primaryStepDownWard.name}):
                      </p>
                      <ul className={styles.wards} aria-label={`Incoming swap matches for ${row.fromUnit.name}`}>
                        {row.swapCandidates.slice(0, 3).map((candidate) => {
                          const incomingReferred = candidate.incomingMovement.referredUnitIds.includes(row.fromUnit.id);
                          const transferNeedsRefer =
                            row.transferMovement !== undefined &&
                            !row.transferMovement.referredUnitIds.includes(primaryStepDownWard.id);
                          const incomingAtCap =
                            !incomingReferred &&
                            candidate.incomingMovement.referredUnitIds.length >= configuration.parallelReferralCap &&
                            !capReasons[candidate.incomingMovement.id];
                          const transferAtCap =
                            transferNeedsRefer &&
                            (row.transferMovement?.referredUnitIds.length ?? 0) >= configuration.parallelReferralCap &&
                            !capReasons[row.admission.id];
                          const alreadyPaired = incomingReferred && !transferNeedsRefer;
                          return (
                            <li
                              key={candidate.incomingMovement.id}
                              className={styles.ward}
                              data-testid="step-down-swap-option"
                            >
                              <span>
                                {patientOf(candidate.incomingMovement).displayName} (
                                {candidate.incomingMovement.security === "Secure"
                                  ? "Secure"
                                  : candidate.incomingMovement.highAcuity
                                    ? "High acuity"
                                    : "Open"}
                                )
                              </span>
                              {incomingAtCap ? (
                                <label className={styles.capReason}>
                                  <span>Incoming referral is at the usual limit; choose a reason.</span>
                                  <select
                                    value={capReasons[candidate.incomingMovement.id] ?? ""}
                                    onChange={(e) =>
                                      setCapReasons((previous) => ({
                                        ...previous,
                                        [candidate.incomingMovement.id]: e.target.value as ReferralCapReason | "",
                                      }))
                                    }
                                  >
                                    <option value="">Choose reason</option>
                                    {REFERRAL_CAP_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                                  </select>
                                </label>
                              ) : null}
                              <Button
                                size="sm"
                                variant="sec"
                                disabledReason={
                                  alreadyPaired
                                    ? "Already referred for this step-down swap."
                                    : incomingAtCap || transferAtCap
                                      ? "Choose a reason above to ask more wards than the usual limit."
                                      : undefined
                                }
                                onClick={() => {
                                  const transferReason = capReasons[row.admission.id]
                                    ? (capReasons[row.admission.id] as ReferralCapReason)
                                    : undefined;
                                  const incomingReason = capReasons[candidate.incomingMovement.id]
                                    ? (capReasons[candidate.incomingMovement.id] as ReferralCapReason)
                                    : undefined;
                                  if (row.transferMovement && transferNeedsRefer) {
                                    dispatch({
                                      type: "REFER_TO_UNITS",
                                      role: "coordinator",
                                      now,
                                      movementId: row.transferMovement.id,
                                      unitIds: [primaryStepDownWard.id],
                                      ...(row.transferMovement.referredUnitIds.length >=
                                        configuration.parallelReferralCap && transferReason
                                        ? { overCapReason: transferReason }
                                        : {}),
                                    });
                                  }
                                  if (!incomingReferred) {
                                    dispatch({
                                      type: "REFER_TO_UNITS",
                                      role: "coordinator",
                                      now,
                                      movementId: candidate.incomingMovement.id,
                                      unitIds: [row.fromUnit.id],
                                      ...(candidate.incomingMovement.referredUnitIds.length >=
                                        configuration.parallelReferralCap && incomingReason
                                        ? { overCapReason: incomingReason }
                                        : {}),
                                    });
                                  }
                                }}
                              >
                                {alreadyPaired
                                  ? "Swap referred"
                                  : row.transferMovement
                                    ? "Refer swap pair"
                                    : `Refer to ${row.fromUnit.name}`}
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WardPanel>
  );
}
