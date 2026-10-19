"use client";

import { Badge } from "@/components/wf";
import { preMatchCleaningState } from "@/components/ward-management/ward-bed-availability";
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";

import styles from "./next-ward-after-refusal.module.css";

/**
 * Pre-match a bed while it is being made ready (Top 25 item 15).
 * Shown in the shortlist for the ward this patient is matched or offered to, when that ward has a
 * bed being made ready. The match can stand while the bed is cleaned, and an unresumed ED medical
 * deterioration on the patient is named beside it. Read only: the pull still waits for a ready bed
 * and the pause is recorded on the ED screen.
 */
export function PreMatchCleaningNote({
  movement,
  unit,
  bedReleases,
}: {
  movement: Movement;
  unit: Unit;
  bedReleases: BedRelease[];
}) {
  const state = preMatchCleaningState(movement, unit.id, bedReleases);
  if (!state) return null;
  return (
    <section className={styles.block} aria-label="Bed being made ready" data-testid="ward-prematch-cleaning">
      <div className={styles.row}>
        <Badge size="sm" tone="info">
          Bed being made ready
        </Badge>
        {state.medicalPause ? (
          <Badge size="sm" tone="warning">
            Placement paused, medical
          </Badge>
        ) : null}
      </div>
      <p className={styles.note}>
        {unit.name} has {state.bedsBeingMadeReady === 1 ? "1 bed" : `${state.bedsBeingMadeReady} beds`} being made
        ready. The match can stand now and the bed is pulled once it is ready.
        {state.medicalPause ? " The ED has paused this placement until the patient is medically cleared again." : ""}
      </p>
    </section>
  );
}
