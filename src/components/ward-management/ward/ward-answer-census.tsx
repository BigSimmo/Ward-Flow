"use client";

import type { MouseEvent } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { BED_STATE_LABELS, type bedStates } from "@/components/ward-management/ward-bed-states";
import { SrOnly } from "@/components/wf";
import styles from "./ward-answer-view.module.css";

/** The census squares and their key are filled by bed state, with the same colour for each. */
const CENSUS_FILL = {
  ready: styles.fillReady,
  beingMadeReady: styles.fillPreparing,
  pulled: styles.fillPulled,
  closed: styles.fillClosed,
  occupied: styles.fillOccupied,
} as const;

export interface WardAnswerCensusProps {
  unit: { id: string; name: string; beds: number };
  states: ReturnType<typeof bedStates>;
  /** A request is open, so the greyed squares' reason shows on screen and a ready square opens Accept. */
  requestOpen: boolean;
  activeSpeciallingCount: number;
  /** A ready square was pressed while a request is open. */
  onReadySquare: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * The Ward answer view's Census panel, moved out of ward-answer-view.tsx unchanged (13 Nov 2026) to
 * keep that file under its line cap.
 */
export function WardAnswerCensus({
  unit,
  states,
  requestOpen,
  activeSpeciallingCount,
  onReadySquare,
}: WardAnswerCensusProps) {
  const pendingPreparation = states.beingMadeReady;
  return (
    <section className={styles.panel} aria-label={`${unit.name} Census`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Census</h2>
        <span className={styles.panelSub}>
          {unit.beds} beds · {states.ready} ready
        </span>
      </div>
      {pendingPreparation > 0 ? (
        <p className={styles.notice}>
          {states.ready} ready, {pendingPreparation} being made ready at {unit.name}.
        </p>
      ) : null}
      <div className={styles.bedGrid}>
        {Array.from({ length: unit.beds }, (_, i) => {
          const bedNum = String(i + 1).padStart(2, "0");
          // Counts drawn in the ruled order — Ready, Being made ready, Pulled, Closed, then
          // Occupied — never particular beds: no admission records a bed number.
          const isVacant = i < states.ready;
          const preparingEnd = states.ready + states.beingMadeReady;
          const isPreparing = !isVacant && i < preparingEnd;
          const isPulled = !isVacant && !isPreparing && i < preparingEnd + states.pulled;
          const isClosed = !isVacant && !isPreparing && !isPulled && i < preparingEnd + states.pulled + states.closed;
          const statusLabel = isVacant
            ? "READY"
            : isPreparing
              ? BED_STATE_LABELS.beingMadeReady
              : isPulled
                ? BED_STATE_LABELS.pulled
                : isClosed
                  ? BED_STATE_LABELS.closed
                  : "Inpatient";
          const cellClass = `${styles.bedCell} ${
            isVacant
              ? styles.vacant
              : isPulled
                ? styles.pulled
                : isClosed || isPreparing
                  ? styles.closed
                  : styles.occupied
          } ${styles.cell} ${
            CENSUS_FILL[
              isVacant
                ? "ready"
                : isPreparing
                  ? "beingMadeReady"
                  : isPulled
                    ? "pulled"
                    : isClosed
                      ? "closed"
                      : "occupied"
            ]
          }`;
          return (
            <button
              type="button"
              key={bedNum}
              className={cellClass}
              onClick={(e) => {
                if (!isVacant) {
                  ignoreUnavailableActivation(e);
                  return;
                }
                if (requestOpen) onReadySquare(e);
              }}
              // Review 5 Nov 2026: counts in ruled order, not beds, so no bed number.
              aria-label={`Census square ${i + 1}: ${statusLabel}`}
              aria-describedby={isVacant ? undefined : `ward-answer-bed-reason-${unit.id}`}
              title={isVacant ? undefined : "Only a ready bed can take a request"}
              aria-disabled={!isVacant ? "true" : undefined}
            >
              <span>{statusLabel}</span>
            </button>
          );
        })}
      </div>
      {/* Redesign: a key to the filled squares, with the same counts the hero shows. */}
      <ul className={styles.legend} aria-label="Census key">
        {(
          [
            ["ready", states.ready],
            ["beingMadeReady", states.beingMadeReady],
            ["pulled", states.pulled],
            ["closed", states.closed],
            ["occupied", states.occupied],
          ] as const
        )
          // A bed being made ready is keyed only when there is one.
          .filter(([state, count]) => state !== "beingMadeReady" || count > 0)
          .map(([state, count]) => (
            <li key={state} className={styles.legendItem}>
              <span className={`${styles.swatch} ${CENSUS_FILL[state]}`} aria-hidden="true" />
              {BED_STATE_LABELS[state]} <b className={styles.legendCount}>{count}</b>
            </li>
          ))}
      </ul>
      {/* The reason the greyed beds give (a disabled control always says why). */}
      {/* Round 2: shown only while a request is open (it explains the greyed squares then);
          otherwise it stays for the squares' spoken description. */}
      {requestOpen ? (
        <p id={`ward-answer-bed-reason-${unit.id}`} className={styles.bedGridReason}>
          Only a ready bed can take a request.
        </p>
      ) : (
        <SrOnly id={`ward-answer-bed-reason-${unit.id}`}>Only a ready bed can take a request.</SrOnly>
      )}
      {/* Shift milieu and staffing balance. The ratio ("1 : 3 (Compliant)"), the shift name and a
        65/35 male-to-female split of the occupied count were typed in here (25 September
        2026 review). Ward Flow holds no staffing figures and this screen counts no one's
        sex, so both rows say so rather than show a number. */}
      {/* Round 2: the "Not recorded: nurse ratio, gender mix" row held nothing, and the expected
          discharges figure lives once, in Confirm your beds. */}
      <div className={styles.milieuList}>
        <div className={styles.milieuRow}>
          <span className={styles.milieuLabel}>Constant observation</span>
          <span className={styles.milieuValue}>{activeSpeciallingCount} active</span>
        </div>
      </div>
    </section>
  );
}
