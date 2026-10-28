"use client";

import { Badge, Button } from "@/components/wf";
import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import { deriveNextWardsAfterRefusal } from "@/components/ward-management/ward-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";

import styles from "./next-ward-after-refusal.module.css";

/**
 * Wards not yet asked after a refusal (Top 25 item 3). Shown in the shortlist once a ward has
 * declined and none has accepted. It lists every ward nobody has asked yet that passes every
 * eligibility gate (`deriveNextWardsAfterRefusal`), in a fixed order (health service, then name)
 * with no cap and no pick (Audit 1, Josh 20 Oct), and adds a chosen ward to the shortlist's
 * own referral selection, so the existing Refer button sends `REFER_TO_UNITS` with all of its
 * usual checks. Nothing is referred from here directly.
 */
export function NextWardAfterRefusal({
  movement,
  units,
  now,
  chosenUnitIds,
  onChoose,
}: {
  movement: Movement;
  units: readonly Unit[];
  now: Instant;
  /** Wards already picked in the shortlist's referral selection. */
  chosenUnitIds: readonly string[];
  onChoose: (unitId: string) => void;
}) {
  const next = deriveNextWardsAfterRefusal(movement, units, now);
  if (!next) return null;
  const declinedUnit = units.find((unit) => unit.id === next.latestDecline.unitId);
  const reason = (next.latestDecline.reason && declineReasonLabels[next.latestDecline.reason]) || "Reason not recorded";

  return (
    <section
      className={styles.block}
      aria-label="Wards not yet asked that pass every check"
      data-testid="ward-next-ward-after-refusal"
    >
      <h4 className={styles.heading}>Wards not yet asked that pass every check</h4>
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
                    // Finding 188 (Josh, 27 Oct 2026): past the usual limit is a warning on the
                    // shortlist footer, never a block here.
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
