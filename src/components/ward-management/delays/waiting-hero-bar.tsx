"use client";

/**
 * Waiting redesign, round 4 (Josh, 31 Oct 2026): the table's key line and the blocker groups'
 * whose-move tag. The round 4 header bar (next past 8h) is now a hero chip on the page top
 * (page tops, 9 Nov 2026; delays-board.tsx).
 */
import { SILENT_MINUTES, ownerName, type BoardRow } from "./delays-board-model";
import { SrOnly, useIsPhone } from "@/components/wf";
import { TierKey } from "@/components/ward-management/tier-key";
import { TYPED_TIME_KEY } from "./waiting-typed-time";
import board from "./delays-board.module.css";
import waitingKeys from "./waiting.module.css";
import styles from "./waiting-polish.module.css";

/** Round 4: whose move a blocker group is, as one short tag ("Your move", "Wards' move"). */
export function moveWord(owner: BoardRow["owner"]): string {
  if (owner === "yours") return "Your move";
  if (owner === "other") return "Someone else's move";
  const name = ownerName(owner);
  return name.endsWith("s") ? `${name}' move` : `${name}'s move`;
}

/**
 * Round 4: the table's one key line. The tier key, the wait bar's Active and Quiet key (moved down
 * from the crowded title row) and the colour key for typed legal times, word for word.
 */
export function WaitingKeyRow({ anyTypedTime }: { anyTypedTime: boolean }) {
  const isPhone = useIsPhone();
  if (isPhone) {
    // Josh, 4 Nov 2026: on a phone the tier key and the typed-time caveat fold into one line. The
    // caveat is a safety line, so it is shortened, never dropped, and read in full to a screen reader.
    return (
      <div className={`${waitingKeys.keyRow} ${styles.keyRow} ${styles.keyRowPhone}`}>
        <TierKey compact />
        {anyTypedTime ? (
          <p className={waitingKeys.typedKey}>
            <span aria-hidden="true">Times as typed, not legally checked</span>
            <SrOnly>{TYPED_TIME_KEY}</SrOnly>
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className={`${waitingKeys.keyRow} ${styles.keyRow}`}>
      <TierKey />
      <span className={`${board.wlegend} ${styles.wlegend}`} aria-hidden="true">
        <span>
          <i className={board.lgAct} />
          Active
        </span>
        <span>
          <i className={board.lgQuiet} />
          Quiet
        </span>
        <span>
          <i className={board.lgQuietLong} />
          {`Quiet ${SILENT_MINUTES / 60}h+`}
        </span>
      </span>
      {anyTypedTime ? <p className={waitingKeys.typedKey}>{TYPED_TIME_KEY}</p> : null}
    </div>
  );
}
