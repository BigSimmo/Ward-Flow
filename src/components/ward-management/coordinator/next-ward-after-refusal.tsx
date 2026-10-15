"use client";

import { Badge, Button } from "@/components/wf";
import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import { deriveNextWardsAfterRefusal } from "@/components/ward-management/ward-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";

import styles from "./next-ward-after-refusal.module.css";

/**
 * Next best ward after a refusal (Top 25 item 3, flag `top25-next-ward`). Shown in the shortlist
 * once a ward has declined and none has accepted. It lists the wards nobody has asked yet that pass
 * every eligibility gate (`deriveNextWardsAfterRefusal`) and adds a chosen ward to the shortlist's
 * own referral selection, so the existing Refer button sends `REFER_TO_UNITS` with all of its
 * usual checks. Nothing is referred from here directly.
 */
export function NextWardAfterRefusal({
  movement,
  units,
  now,
  chosenUnitIds,
  slotsLeft,
  onChoose,
}: {
  movement: Movement;
  units: readonly Unit[];
  now: Instant;
  /** Wards already picked in the shortlist's referral selection. */
  chosenUnitIds: readonly string[];
  /** How many more wards the referral can take before the parallel referral limit. */
  slotsLeft: number;
  onChoose: (unitId: string) => void;
}) {
  const next = deriveNextWardsAfterRefusal(movement, units, now);
  if (!next) return null;
  const declinedUnit = units.find((unit) => unit.id === next.latestDecline.unitId);
  const reason = declineReasonLabels[next.latestDecline.reason] ?? "Reason not recorded";

  return (
    <section className={styles.block} aria-label="Next wards to ask" data-testid="ward-next-ward-after-refusal">
      <h4 className={styles.heading}>Next wards to ask</h4>
      <p className={styles.note}>
        Last refusal: {declinedUnit ? declinedUnit.name : "Unresolved unit"}, {reason.toLowerCase()}.
      </p>
      {next.candidates.length === 0 ? (
        <p className={styles.note}>No ward that has not been asked passes every eligibility check.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {next.candidates.map((candidate) => {
              const chosen = chosenUnitIds.includes(candidate.unit.id);
              return (
                <li key={candidate.unit.id} className={styles.row} data-testid="ward-next-ward-row">
                  <span className={styles.name}>{candidate.unit.name}</span>
                  <Badge size="sm" tone={candidate.availableNow > 0 ? "success" : "neutral"}>
                    {candidate.availableNow === 1 ? "1 bed free" : `${candidate.availableNow} beds free`}
                  </Badge>
                  {candidate.isOutOfArea ? (
                    <Badge size="sm" tone="info">
                      Out of area
                    </Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant={chosen ? "tint" : "sec"}
                    aria-pressed={chosen}
                    disabledReason={!chosen && slotsLeft <= 0 ? "The referral limit is reached." : undefined}
                    reasonDisplay="tooltip"
                    onClick={() => onChoose(candidate.unit.id)}
                  >
                    {chosen ? "Added to referral" : "Add to referral"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className={styles.note}>Send the referral with Refer.</p>
        </>
      )}
    </section>
  );
}
