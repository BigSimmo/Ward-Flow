"use client";

import { useId } from "react";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { strandedFlags, strandedPromptText } from "@/components/ward-management/ward-stranded";

import styles from "./stranded-prompts.module.css";

// The board's other quiet prompt, this ward's part in tomorrow's forecast (27 Oct 2026), shares the
// board's one import of the prompts family.
export { WardForecastShare } from "./ward-forecast-share";

/**
 * Stranded-patient prompts on one ward board (smart feature 12).
 *
 * `admissions` must already be scoped to this ward — the board passes
 * `admissionsForUnit(admissions, unit.id)`, the same call its other panels use. Choosing a row
 * opens that person's bed in the board's own detail panel; nothing here writes state.
 *
 * Renders nothing when nobody needs a prompt: an empty "all clear" panel would be one more box a
 * coordinator learns to skip.
 */
export function StrandedPrompts({
  admissions,
  now,
  nameFor,
  onOpen,
  bedReleases,
}: {
  admissions: readonly Admission[];
  now: Instant;
  nameFor: (admissionId: string) => string;
  onOpen: (admissionId: string) => void;
  bedReleases?: readonly BedRelease[];
}) {
  const baseId = useId();
  const flags = strandedFlags(admissions, now, bedReleases);
  if (flags.length === 0) return null;

  return (
    <details className={styles.panel} data-testid="ward-board-stranded" open>
      <summary className={styles.summary}>
        <span id={`${baseId}-ward-board-stranded-heading`}>Worth a look: long stays and people waiting to leave</span>
        <span className={styles.count}>({flags.length})</span>
      </summary>
      {/* Device audit, 11 Oct 2026: the four-line explanation is gone; the heading says what
          the list is. */}
      <ul className={styles.list} aria-labelledby={`${baseId}-ward-board-stranded-heading`}>
        {flags.map((flag) => (
          <li key={flag.admissionId} className={styles.row} data-testid={`ward-board-stranded-${flag.admissionId}`}>
            <button type="button" className={styles.open} onClick={() => onOpen(flag.admissionId)}>
              <span className={styles.name}>{nameFor(flag.admissionId)}</span>
              <span className={styles.days}>
                {flag.days} day{flag.days === 1 ? "" : "s"} in bed
              </span>
              <span className={styles.reason}>{strandedPromptText(flag)}</span>
              {flag.barrier !== null && <span className={styles.barrier}>Barrier recorded: {flag.barrier}</span>}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
