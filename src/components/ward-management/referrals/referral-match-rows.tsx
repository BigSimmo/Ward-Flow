"use client";

import { useState } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  OVERRIDE_REASONS,
  type GenderPlacementReason,
  type OverrideReason,
} from "@/components/ward-management/ward-change-reasons";
import {
  candidateAccepts,
  matchReason,
  TRAVEL_BAND_GROUP_EMPTY_SENTENCE,
  travelBandGroupCountsSentence,
  travelBandGroupLabel,
  type ReferralCandidate,
  type TravelBandGroup,
  type TravelBandGroupCounts,
} from "@/components/ward-management/ward-referrals";
import styles from "./referrals.module.css";
import { GATE_LABELS, OVERRIDE_REASON_UNCHOSEN } from "./referral-match-model";

/* The match view's travel-band groups and their rows, moved unchanged from `referral-match.tsx`. */

/**
 * One band group: its heading, its two counts, and the rows in it.
 *
 * `<details>`/`<summary>` rather than a hand-built disclosure, deliberately. The summary — heading
 * and BOTH counts — is rendered whether the group is open or shut, and it is rendered for an empty
 * group exactly as for a populated one, which is the binding condition the owner attached to
 * collapsing at all. Nothing is omitted, nothing is reordered, and the open/shut state depends only
 * on viewport width: never on which band this is, and never on either count. Making an empty group
 * non-collapsible would be exactly that forbidden dependency, so every group behaves the same.
 *
 * The band is taken from the GROUP this row sits in rather than looked up again per row. A band
 * looked up in two places is a band that can disagree with itself, and here the heading and the
 * rows beneath it would be the two places.
 */
export function BandGroup({
  group,
  counts,
  openByDefault,
  onAccept,
  needsGenderPlacement,
}: {
  group: TravelBandGroup;
  counts: TravelBandGroupCounts;
  openByDefault: boolean;
  onAccept: (
    unitId: string,
    overrideReason?: OverrideReason,
    genderPlacementReason?: GenderPlacementReason,
    genderPlacementChecked?: true,
  ) => void;
  needsGenderPlacement: (unitId: string) => boolean;
}) {
  const [open, setOpen] = useState(openByDefault);

  const label = travelBandGroupLabel(group.band);
  const hasAvailable = counts.accepting > 0;

  return (
    <details
      className={hasAvailable ? `${styles.bandGroup} ${styles.bandGroupHasAvailable}` : styles.bandGroup}
      data-testid={`ward-referral-match-band-group-${group.band}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.bandSummary}>
        <div className={styles.bandSummaryLead}>
          <span className={styles.bandLabel}>{label}</span>
          {hasAvailable ? (
            <span className={styles.bandAvailableBadge}>
              {counts.accepting} {counts.accepting === 1 ? "bed ready" : "beds ready"}
            </span>
          ) : null}
        </div>
        <span className={styles.bandCounts} data-testid={`ward-referral-match-band-counts-${group.band}`}>
          {travelBandGroupCountsSentence(counts)}
        </span>
      </summary>
      {group.candidates.length === 0 ? (
        <p className={styles.bandEmpty} data-testid={`ward-referral-match-band-empty-${group.band}`}>
          {TRAVEL_BAND_GROUP_EMPTY_SENTENCE}
        </p>
      ) : (
        <ul className={styles.bandRows}>
          {group.candidates.map((candidate) => (
            <MatchRow
              key={candidate.unit.id}
              candidate={candidate}
              bandText={label}
              onAccept={onAccept}
              needsGenderPlacement={needsGenderPlacement(candidate.unit.id)}
            />
          ))}
        </ul>
      )}
    </details>
  );
}

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
  const totalGates = candidate.verdict.gates.length;
  const passingGates = candidate.verdict.gates.filter((gate) => gate.pass).length;

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
              className={gate.pass ? styles.criteriaPass : styles.criteriaFail}
              role="listitem"
              data-testid={`ward-referral-match-criteria-item-${unit.id}-${gate.gate}`}
            >
              <span className={styles.criteriaGlyph} aria-hidden="true">
                {gate.pass ? "✓" : "✕"}
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
              <button
                type="submit"
                className={styles.matchOverrideButton}
                disabled={genderPlacementReason === "" || !genderPlacementChecked}
                data-testid={`ward-referral-match-gender-placement-submit-${unit.id}`}
              >
                Record reason and accept at {unit.name}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.acceptButton}
              data-testid={`ward-referral-match-accept-${unit.id}`}
              onClick={() => onAccept(unit.id)}
            >
              Accept at {unit.name}
            </button>
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
              <button
                type="button"
                className={styles.matchOverrideButton}
                data-testid={`ward-referral-match-override-accept-${unit.id}`}
                aria-disabled={overrideReason === undefined ? "true" : undefined}
                aria-describedby={
                  overrideReason === undefined ? `ward-referral-match-override-blocked-${unit.id}` : undefined
                }
                title={overrideReason === undefined ? OVERRIDE_REASON_UNCHOSEN : undefined}
                onClick={
                  overrideReason === undefined ? ignoreUnavailableActivation : () => onAccept(unit.id, overrideReason)
                }
              >
                Accept anyway at {unit.name}
              </button>
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
