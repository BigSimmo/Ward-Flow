"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/wf";
import { NotWiredButton } from "@/components/ward-management/not-wired-button";
import { REFERRAL_CAP_REASONS, type ReferralCapReason } from "@/components/ward-management/ward-change-reasons";
import type { Movement } from "@/components/ward-management/ward-model";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { deriveStepDownBoard } from "@/components/ward-management/ward-step-down";
import styles from "./step-down-board.module.css";

/**
 * Top 25 item 8 (`top25-step-down-board`) and item 16 (`top25-step-down-swap`): each step-down
 * candidate with the wards that pass the main eligibility gates and have a Ready bed now, plus
 * incoming movements that fit `fromUnit` with a bed actually free there. Owner ruling (17 Oct 2026,
 * 10:13 PM AWST): no combined swap, each leg is referred on its own; a movement needing a gender
 * placement review is routed to Placement instead of being offered here.
 */
export function StepDownBoard({ now }: { now: Instant }) {
  const { admissions, units, movements, patients, referrals, dispatch, configuration, setFocusMovementId } =
    useWardFlowSelect(
      "admissions",
      "units",
      "movements",
      "patients",
      "referrals",
      "dispatch",
      "configuration",
      "setFocusMovementId",
    );
  const patientOf = usePatientOf();
  const stepDownSwapEnabled = useWardFeatureFlag("top25-step-down-swap");
  // Item 2's cap warns and asks for a reason, never blocks: one reason per stay at the limit.
  const [capReasons, setCapReasons] = useState<Record<string, ReferralCapReason | "">>({});
  // Fix list 1.5: raise by name. One REFER_TO_UNITS construction site for every Refer on this board,
  // sending the cap reason only when that movement is at the limit and a reason was chosen.
  const raise = useMemo(() => wardRaise(dispatch, "coordinator", now), [dispatch, now]);
  const refer = (movement: Movement, unitId: string, reason: ReferralCapReason | "" | undefined) => {
    raise("REFER_TO_UNITS", {
      movementId: movement.id,
      unitIds: [unitId],
      ...(movement.referredUnitIds.length >= configuration.parallelReferralCap && reason
        ? { overCapReason: reason }
        : {}),
    });
  };
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
                                refer(movement, ward.unit.id, capReasons[row.admission.id]);
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
                  {stepDownSwapEnabled && primaryStepDownWard ? (
                    <div className={styles.swapSection} data-testid="step-down-swap-candidates">
                      {row.swapCandidates.length > 0 ? (
                        <>
                          <p className={styles.meta}>
                            Incoming referrals that fit {row.fromUnit.name} now, with a bed free there:
                          </p>
                          <ul className={styles.wards} aria-label={`Incoming matches for ${row.fromUnit.name}`}>
                            {row.swapCandidates.slice(0, 3).map((candidate) => {
                              const incoming = candidate.incomingMovement;
                              const incomingReferred = incoming.referredUnitIds.includes(row.fromUnit.id);
                              const incomingAtCap =
                                !incomingReferred &&
                                incoming.referredUnitIds.length >= configuration.parallelReferralCap &&
                                !capReasons[incoming.id];
                              return (
                                <li key={incoming.id} className={styles.ward} data-testid="step-down-swap-option">
                                  <span>
                                    {patientOf(incoming).displayName} (
                                    {incoming.security === "Secure"
                                      ? "Secure"
                                      : incoming.highAcuity
                                        ? "High acuity"
                                        : "Open"}
                                    )
                                  </span>
                                  {incomingAtCap ? (
                                    <label className={styles.capReason}>
                                      <span>Incoming referral is at the usual limit; choose a reason.</span>
                                      <select
                                        value={capReasons[incoming.id] ?? ""}
                                        onChange={(e) =>
                                          setCapReasons((previous) => ({
                                            ...previous,
                                            [incoming.id]: e.target.value as ReferralCapReason | "",
                                          }))
                                        }
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
                                  <Button
                                    size="sm"
                                    variant="sec"
                                    disabledReason={
                                      incomingReferred
                                        ? `Already referred to ${row.fromUnit.name}.`
                                        : incomingAtCap
                                          ? "Choose a reason above to ask more wards than the usual limit."
                                          : undefined
                                    }
                                    onClick={() => {
                                      if (!incomingReferred) refer(incoming, row.fromUnit.id, capReasons[incoming.id]);
                                    }}
                                  >
                                    {incomingReferred ? "Referred" : `Refer to ${row.fromUnit.name}`}
                                  </Button>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      ) : (
                        <p className={styles.meta} data-testid="step-down-swap-waiting">
                          Incoming referrals show here once a bed on {row.fromUnit.name} is actually free.
                        </p>
                      )}
                      {row.placementReview.length > 0 ? (
                        <div data-testid="step-down-swap-placement-review">
                          <p className={styles.meta}>
                            Needs a gender placement review for {row.fromUnit.name} first, so not offered here:
                          </p>
                          <ul className={styles.wards}>
                            {row.placementReview.map((movement) => (
                              <li key={movement.id} className={styles.ward}>
                                <Link
                                  href="/mockups/ward-flow"
                                  data-testid={`step-down-placement-review-${movement.id}`}
                                  onClick={() => {
                                    setFocusMovementId(movement.id);
                                  }}
                                >
                                  Review {patientOf(movement).displayName} in Placement
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
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
