"use client";

import { useState } from "react";
import { Button } from "@/components/wf";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  OVERRIDE_REASONS,
  type GenderPlacementReason,
  type OverrideReason,
} from "@/components/ward-management/ward-change-reasons";
import { candidateAccepts, matchReason, type ReferralCandidate } from "@/components/ward-management/ward-referrals";
import { checkedGates, gateMark } from "@/components/ward-management/ward-eligibility";
import styles from "./referrals.module.css";
import { GATE_LABELS, OVERRIDE_REASON_UNCHOSEN } from "./referral-match-model";

/* The match view's override and gender placement form for one picked ward, moved from `referral-match.tsx`. */

export function MatchRow({
  candidate,
  bandText,
  onAccept,
  needsGenderPlacement,
}: {
  candidate: ReferralCandidate;
  bandText: string;
  onAccept: (
    unitId: string,
    overrideReason?: OverrideReason,
    genderPlacementReason?: GenderPlacementReason,
    genderPlacementChecked?: true,
  ) => void;
  needsGenderPlacement: boolean;
}) {
  const { unit } = candidate;
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  const [genderPlacementReason, setGenderPlacementReason] = useState<GenderPlacementReason | "">("");
  const [genderPlacementChecked, setGenderPlacementChecked] = useState(false);

  const genderPlacementPending =
    needsGenderPlacement &&
    candidate.verdict.gates.some((gate) => gate.gate === "gender_designation" && !gate.pass) &&
    candidate.verdict.gates.filter((gate) => !gate.pass).length === 1;
  const accepts = candidateAccepts(candidate) || genderPlacementPending;
  // Information-only gates (acuity, specialling) are listed but never counted as criteria met.
  const totalGates = checkedGates(candidate.verdict.gates).length;
  const passingGates = checkedGates(candidate.verdict.gates).filter((gate) => gate.pass).length;

  return (
    <li
      className={accepts ? styles.matchRowAccepts : styles.matchRowDeclines}
      data-testid={`ward-referral-match-row-${unit.id}`}
    >
      <div className={styles.matchRowTop}>
        <div className={styles.matchUnitInfo}>
          <span className={styles.matchUnitName}>{unit.name}</span>
          {unit.forensic ? (
            <span className={styles.forensicBadge} data-testid={`ward-referral-match-forensic-${unit.id}`}>
              Forensic
            </span>
          ) : null}
        </div>
        {accepts ? (
          <span className={styles.acceptsLabel} data-testid={`ward-referral-match-accepts-${unit.id}`}>
            Accepts this referral
          </span>
        ) : (
          <span className={styles.declinedBadge}>Ineligible / full</span>
        )}
      </div>

      <p className={styles.matchBand} data-testid={`ward-referral-match-band-${unit.id}`}>
        {bandText}
      </p>

      <details className={styles.criteriaDisclosure} data-testid={`ward-referral-match-criteria-${unit.id}`}>
        <summary className={styles.criteriaSummary}>
          <span className={styles.criteriaSummaryTitle}>
            <strong>
              {passingGates} of {totalGates}
            </strong>{" "}
            criteria met
          </span>
          <span className={styles.criteriaSummaryHint}>{accepts ? "View gates" : "Inspect mismatch"}</span>
        </summary>
        <div className={styles.criteriaList} role="list" aria-label={`Eligibility criteria for ${unit.name}`}>
          {candidate.verdict.gates.map((gate) => (
            <div
              key={gate.gate}
              className={gateMark(gate) === "info" ? undefined : gate.pass ? styles.criteriaPass : styles.criteriaFail}
              role="listitem"
              data-testid={`ward-referral-match-criteria-item-${unit.id}-${gate.gate}`}
              data-mark={gateMark(gate)}
            >
              <span className={styles.criteriaGlyph} aria-hidden="true">
                {gateMark(gate) === "info" ? "i" : gate.pass ? "✓" : "✕"}
              </span>
              <span className={styles.criteriaName}>{GATE_LABELS[gate.gate] ?? gate.gate}</span>
              <span className={styles.criteriaDetail}>{gate.detail}</span>
            </div>
          ))}
        </div>
      </details>

      {accepts ? (
        <div className={styles.matchAcceptRow}>
          {needsGenderPlacement ? (
            <form
              className={styles.matchOverrideRow}
              data-testid={`ward-referral-match-gender-placement-form-${unit.id}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (genderPlacementReason === "" || !genderPlacementChecked) return;
                onAccept(unit.id, undefined, genderPlacementReason, true);
              }}
            >
              <p
                className={styles.matchReasonText}
                data-testid={`ward-referral-match-gender-placement-guidance-${unit.id}`}
              >
                Check with the ward first. A single room is preferred.
              </p>
              <p
                className={styles.matchReasonText}
                data-testid={`ward-referral-match-gender-placement-refusal-${unit.id}`}
              >
                {GENDER_PLACEMENT_REFUSAL}
              </p>
              <label
                className={styles.matchOverrideLabel}
                htmlFor={`ward-referral-match-gender-placement-reason-${unit.id}`}
              >
                Reason
              </label>
              <select
                id={`ward-referral-match-gender-placement-reason-${unit.id}`}
                required
                className={styles.matchOverrideSelect}
                data-testid={`ward-referral-match-gender-placement-reason-${unit.id}`}
                value={genderPlacementReason}
                onChange={(event) => {
                  const chosen = event.target.value;
                  setGenderPlacementReason(
                    GENDER_PLACEMENT_REASONS.includes(chosen as GenderPlacementReason)
                      ? (chosen as GenderPlacementReason)
                      : "",
                  );
                }}
              >
                <option value="">Choose a reason…</option>
                {GENDER_PLACEMENT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <label className={styles.matchOverrideLabel}>
                <input
                  type="checkbox"
                  checked={genderPlacementChecked}
                  onChange={(event) => setGenderPlacementChecked(event.target.checked)}
                  data-testid={`ward-referral-match-gender-placement-checked-${unit.id}`}
                />
                I have checked this placement with the ward
              </label>
              <Button
                variant="pri"
                size="md"
                data-placement-action
                type="submit"
                disabledReason={
                  genderPlacementReason === ""
                    ? "Choose a placement reason before accepting."
                    : !genderPlacementChecked
                      ? "Confirm you have checked this placement with the ward before accepting."
                      : undefined
                }
                reasonDisplay="tooltip"
                data-testid={`ward-referral-match-gender-placement-submit-${unit.id}`}
              >
                Record reason and accept at {unit.name}
              </Button>
            </form>
          ) : (
            <Button
              variant="pri"
              size="md"
              data-placement-action
              type="button"
              data-testid={`ward-referral-match-accept-${unit.id}`}
              onClick={() => onAccept(unit.id)}
            >
              Accept at {unit.name}
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.matchDeclineSection}>
          <p className={styles.matchReasonText} data-testid={`ward-referral-match-reason-${unit.id}`}>
            {matchReason(candidate)}
          </p>
          <div className={styles.matchOverrideRow} data-testid={`ward-referral-match-override-${unit.id}`}>
            <label className={styles.matchOverrideLabel} htmlFor={`ward-referral-match-override-reason-${unit.id}`}>
              Accept anyway — record why
            </label>
            <div className={styles.matchOverrideControls}>
              <select
                id={`ward-referral-match-override-reason-${unit.id}`}
                className={styles.matchOverrideSelect}
                data-testid={`ward-referral-match-override-reason-${unit.id}`}
                value={overrideReason ?? ""}
                onChange={(event) => {
                  const chosen = event.target.value;
                  setOverrideReason(
                    OVERRIDE_REASONS.includes(chosen as OverrideReason) ? (chosen as OverrideReason) : undefined,
                  );
                }}
              >
                <option value="">Choose a reason…</option>
                {OVERRIDE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <Button
                variant="pri"
                size="md"
                data-placement-action
                type="button"
                data-testid={`ward-referral-match-override-accept-${unit.id}`}
                disabledReason={overrideReason === undefined ? OVERRIDE_REASON_UNCHOSEN : undefined}
                reasonDisplay="tooltip"
                onClick={
                  overrideReason === undefined ? ignoreUnavailableActivation : () => onAccept(unit.id, overrideReason)
                }
              >
                Accept anyway at {unit.name}
              </Button>
            </div>
            {overrideReason === undefined ? (
              <span id={`ward-referral-match-override-blocked-${unit.id}`} className="sr-only">
                {OVERRIDE_REASON_UNCHOSEN}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </li>
  );
}
