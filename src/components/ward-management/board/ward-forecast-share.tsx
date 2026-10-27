"use client";

import { useId } from "react";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardForecastShare } from "@/components/ward-management/capacity/beds-forecast";

// The ward's own surface, the same quiet panel the stranded prompts use, so the two read as one family.
import styles from "./stranded-prompts.module.css";
import own from "./ward-forecast-share.module.css";

/**
 * This ward's part in tomorrow's network forecast (forecast integration, Josh, 27 Oct 2026). Wards
 * feed the forecast with their flagged discharges, so the board shows what the forecast counts from
 * this ward, and which planned dates it cannot count until the ward flags them. Choosing a person
 * opens their bed in the board's own detail panel, where the discharge is flagged; nothing here
 * writes state. It reads the same live records as the board (`useWardFlowSelect`).
 *
 * Renders nothing when the ward adds nothing to tomorrow and has no unflagged date, for the same
 * reason the stranded prompts do: an empty panel is one more box people learn to skip.
 */
export function WardForecastShare({
  unit,
  now,
  nameFor,
  onOpen,
}: {
  unit: Unit;
  now: Instant;
  nameFor: (admissionId: string) => string;
  onOpen: (admissionId: string) => void;
}) {
  const baseId = useId();
  const { bedReleases, admissions } = useWardFlowSelect("bedReleases", "admissions");
  const share = wardForecastShare(unit, bedReleases ?? [], admissions, now);
  if (share === null) return null;
  const { confirmed, expected, heldUp, overdue, notFlagged } = share;
  if (confirmed + expected + heldUp + overdue + notFlagged.length === 0) return null;
  const headingId = `${baseId}-ward-forecast-share-heading`;

  return (
    <section className={styles.panel} aria-labelledby={headingId} data-testid="ward-board-forecast-share">
      <h2 id={headingId} className={own.heading}>
        Your part in tomorrow&apos;s forecast
      </h2>
      <p className={styles.lead} data-testid="ward-board-forecast-share-counted">
        {countedSentence(confirmed, expected, heldUp, overdue)}
      </p>
      {notFlagged.length === 0 ? null : (
        <>
          <p className={styles.lead} id={`${headingId}-unflagged`}>
            {`Planned date by this time tomorrow, discharge not flagged (${notFlagged.length}). The forecast only counts these as a best case until the discharge is flagged.`}
          </p>
          <ul className={styles.list} aria-labelledby={`${headingId}-unflagged`}>
            {notFlagged.map((admission) => (
              <li
                key={admission.id}
                className={styles.row}
                data-testid={`ward-board-forecast-share-unflagged-${admission.id}`}
              >
                <button type="button" className={styles.open} onClick={() => onOpen(admission.id)}>
                  <span className={styles.name}>{nameFor(admission.id)}</span>
                  {admission.expectedDischargeAt === null ? null : (
                    <span className={styles.days}>
                      Planned {formatInstantWithDay(admission.expectedDischargeAt, now)}
                    </span>
                  )}
                  <span className={styles.reason}>Open to flag the discharge</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function countedSentence(confirmed: number, expected: number, heldUp: number, overdue: number): string {
  const counted =
    confirmed + expected === 0
      ? "Tomorrow's forecast counts none of this ward's discharges yet."
      : `Tomorrow's forecast counts ${plural(confirmed + expected, "discharge")} from this ward: ${confirmed} confirmed, ${expected} expected.`;
  const notLikely = [heldUp > 0 ? `${heldUp} held up` : null, overdue > 0 ? `${overdue} overdue` : null].filter(
    (part): part is string => part !== null,
  );
  return notLikely.length === 0 ? counted : `${counted} Best case only: ${notLikely.join(", ")}.`;
}
