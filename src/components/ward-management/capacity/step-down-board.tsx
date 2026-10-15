"use client";

import { useMemo } from "react";

import { Button } from "@/components/wf";
import { NotWiredButton } from "@/components/ward-management/not-wired-button";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { deriveStepDownBoard } from "@/components/ward-management/ward-step-down";
import styles from "./step-down-board.module.css";

/**
 * Top 25 item 8 (`top25-step-down-board`): each step-down candidate with the wards that pass the
 * main eligibility gates and have a Ready bed now. Refer goes through `REFER_TO_UNITS` when the stay
 * already has an open transfer movement; otherwise the control is not wired (D4).
 */
export function StepDownBoard({ now }: { now: Instant }) {
  const { admissions, units, movements, patients, referrals, dispatch, configuration } = useWardFlow();
  const patientOf = usePatientOf();
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
            {rows.map((row) => (
              <li key={row.admission.id} className={styles.row} data-testid="step-down-row">
                <p className={styles.who}>
                  {patientOf(row.admission).displayName} <span className={styles.meta}>on {row.fromUnit.name}</span>
                </p>
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
                            // A plain refer has no reason to give, so a stay already at the cap is
                            // greyed with why. Over the cap with a reason is done from Placement.
                            disabledReason={
                              !row.transferMovement.referredUnitIds.includes(ward.unit.id) &&
                              row.transferMovement.referredUnitIds.length >= configuration.parallelReferralCap
                                ? "The referral limit is reached. Ask more wards from Placement."
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </WardPanel>
  );
}
