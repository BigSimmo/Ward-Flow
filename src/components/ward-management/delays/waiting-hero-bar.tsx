"use client";

/**
 * Waiting redesign, round 4 (Josh, 31 Oct 2026): the table's keys and the blocker groups'
 * whose-move tag. The round 4 header bar (next past 8h) is now a hero chip on the page top
 * (page tops, 9 Nov 2026; delays-board.tsx).
 */
import { SILENT_MINUTES, ownerName, type BoardRow } from "./delays-board-model";
import { URGENCY_LEVELS } from "@/components/ward-management/ward-model-vocabulary";
import { TIER_QUALIFIER } from "@/components/ward-management/ward-priority";
import board from "./delays-board.module.css";
import styles from "./waiting-polish.module.css";

/** Round 4: whose move a blocker group is, as one short tag ("Your move", "Wards' move"). */
export function moveWord(owner: BoardRow["owner"]): string {
  if (owner === "yours") return "Your move";
  if (owner === "other") return "Someone else's move";
  const name = ownerName(owner);
  return name.endsWith("s") ? `${name}' move` : `${name}'s move`;
}

/**
 * Simplification mock-up (26 Nov 2026): the tier key and the wait bar's Active and Quiet key, once a
 * grey row across the top of the table, now sit behind the list head's one ⓘ with the waiting total.
 * Plain spans only: the tip is itself a span, so no paragraph may sit inside it.
 */
export function WaitingKeys() {
  return (
    <span className={styles.tipKeys}>
      <span className={styles.tipKeyLine}>
        {URGENCY_LEVELS.map((tier) => (
          <span key={tier}>
            <b>T{tier}</b> {TIER_QUALIFIER[tier]}
          </span>
        ))}
      </span>
      <span className={`${board.wlegend} ${styles.tipKeyLine}`}>
        <span>
          <i className={board.lgAct} aria-hidden="true" />
          Active
        </span>
        <span>
          <i className={board.lgQuiet} aria-hidden="true" />
          Quiet
        </span>
        <span>
          <i className={board.lgQuietLong} aria-hidden="true" />
          {`Quiet ${SILENT_MINUTES / 60}h+`}
        </span>
      </span>
    </span>
  );
}
